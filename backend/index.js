const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const WebSocket = require('ws');

const token = process.env.DERIV_API_TOKEN;
const MIN_CLUSTER_SIZE = 2;
const STAKE = 0.35; // The amount to stake on each trade, in USD
const DURATION = 1; // The duration of the trade, in ticks

if (!token || token === 'your_api_token_here') {
  console.error('DERIV_API_TOKEN not found or not set in backend/.env file');
  process.exit(1);
}

const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=1089`);

const symbolsData = {};

const initializeSymbolData = (symbol) => {
  if (!symbolsData[symbol]) {
    symbolsData[symbol] = {
      digits: [],
      patternTracking: {},
    };
    for (let i = 0; i < 10; i++) {
      symbolsData[symbol].patternTracking[i] = {
        isActive: false,
        currentClusters: 0,
        lastClusterEnd: -1,
        waitingForSingle: false,
      };
    }
  }
};

const getActiveSymbols = () => {
  ws.send(JSON.stringify({ 
    active_symbols: "full",
    product_type: "basic"
  }));
};

const subscribeToTicks = (symbol) => {
  ws.send(JSON.stringify({
    ticks: symbol,
    subscribe: 1
  }));
};

const placeTrade = (symbol, digit) => {
  console.log(`Placing trade for ${symbol}, digit differ from ${digit}`);
  ws.send(JSON.stringify({
    buy: "1",
    price: STAKE,
    parameters: {
      amount: STAKE,
      basis: "stake",
      contract_type: "DIGITDIFF",
      currency: "USD",
      duration: DURATION,
      duration_unit: "t",
      symbol: symbol,
      prediction: digit,
    }
  }));
};

ws.on('open', () => {
  console.log('Connected to Deriv WebSocket');
  ws.send(JSON.stringify({ authorize: token }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data);

  if (response.error) {
    console.error('API Error:', response.error.message);
    return;
  }

  if (response.authorize) {
    console.log('Successfully authorized.');
    console.log('Fetching active symbols...');
    getActiveSymbols();
  }

  if (response.active_symbols) {
    console.log('Received active symbols. Subscribing to volatility indices...');
    response.active_symbols.forEach(symbol => {
      if (symbol.market === 'synthetic_index' && symbol.symbol.startsWith('R_')) {
        console.log(`Subscribing to ${symbol.symbol}`);
        initializeSymbolData(symbol.symbol);
        subscribeToTicks(symbol.symbol);
      }
    });
  }

  if (response.tick) {
    processTick(response.tick);
  }

  if (response.buy) {
    if (response.buy.contract_id) {
      console.log(`Trade placed successfully. Contract ID: ${response.buy.contract_id}`);
    } else {
      console.error(`Error placing trade: ${response.error.message}`);
    }
  }
});

ws.on('close', () => {
  console.log('Disconnected from Deriv WebSocket');
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

function processTick(tick) {
  const symbol = tick.symbol;
  const quote = tick.quote;
  const symbolData = symbolsData[symbol];

  if (!symbolData) return;

  const lastDigit = parseInt(quote.toString().slice(-1), 10);

  if (isNaN(lastDigit) || lastDigit < 0 || lastDigit > 9) {
    console.warn(`Invalid digit for ${symbol}: quote=${quote}, lastDigit=${lastDigit}`);
    return;
  }

  symbolData.digits.push(lastDigit);

  for (let digit = 0; digit < 10; digit++) {
    updatePatternForDigit(symbol, digit);
  }
}

function updatePatternForDigit(symbol, digit) {
    const symbolData = symbolsData[symbol];
    const tracking = symbolData.patternTracking[digit];
    const digits = symbolData.digits;

    let clusterEnd = -1;
    let clusterCount = 0;
    for (let i = digits.length - 1; i >= 0; i--) {
        if (digits[i] === digit && (i === 0 || digits[i-1] !== digit)) {
            let end = i;
            while(end < digits.length -1 && digits[end+1] === digit) {
                end++;
            }
            if(clusterEnd === -1) clusterEnd = end;
            clusterCount++;
        }
    }

    if (clusterCount > tracking.currentClusters) {
        tracking.isActive = true;
        tracking.currentClusters = clusterCount;
        tracking.lastClusterEnd = clusterEnd;
        tracking.waitingForSingle = false;
    }

    if (clusterCount < tracking.currentClusters) {
        tracking.isActive = false;
        tracking.currentClusters = 0;
        tracking.lastClusterEnd = -1;
        tracking.waitingForSingle = false;
    }
    
    if (tracking.currentClusters >= MIN_CLUSTER_SIZE) {
        const lastIndex = digits.length - 1;
        if (lastIndex > tracking.lastClusterEnd && digits[lastIndex] === digit && !tracking.waitingForSingle) {
            const isIsolatedDigit = (lastIndex === 0 || digits[lastIndex - 1] !== digit) && (digits.length > lastIndex + 1 ? digits[lastIndex + 1] !== digit : true);
            if (isIsolatedDigit) {
                console.log(`TRADE SIGNAL: Symbol: ${symbol}, Digit: ${digit}, Cluster Size: ${tracking.currentClusters}`);
                placeTrade(symbol, digit);
                tracking.waitingForSingle = true;
            }
        }
    }
}
