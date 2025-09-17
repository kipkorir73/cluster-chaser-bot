import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ConnectionControls } from './ConnectionControls';
import { VolatilityCard } from './VolatilityCard';
import { StatisticsPanel } from './StatisticsPanel';
import { AlertsLog } from './AlertsLog';
import { Card } from '@/components/ui/card';
import { AutoTradeManager } from './AutoTradeManager';
import dashboardHero from '../assets/dashboard-hero.jpg';
import { apiFetch } from '@/lib/api';

// Interfaces remain the same
interface VolatilityData {
  digits: number[];
  patternTracking: Record<number, PatternTracking>;
  clusterVisualization: ClusterVisualization[];
  lastTick: number | null;
}

interface PatternTracking {
  currentClusters: number;
  isActive: boolean;
  lastClusterEnd: number;
  expectedNextCluster: boolean;
  waitingForSingle: boolean;
}

interface ClusterVisualization {
  digit: number;
  clusterSize: number;
}

interface AlertItem {
  id: string;
  message: string;
  timestamp: Date;
  type: 'info' | 'warning' | 'success' | 'error';
}

interface ConnectionSettings {
  appId: string;
  alertThreshold: number;
  autoTrade: boolean;
  selectedVolatility: string;
  apiToken: string;
}

interface TickData {
  symbol: string;
  quote: number;
  epoch: number;
}

export function VolatilityMonitor() {
  const { toast } = useToast();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeSubscriptions = useRef<Set<string>>(new Set());

  const [isConnected, setIsConnected] = useState(false);
  const [connectionSettings, setConnectionSettings] = useState<ConnectionSettings>({
    appId: '1089',
    alertThreshold: 5,
    autoTrade: false,
    selectedVolatility: 'R_25',
    apiToken: ''
  });
  
  const [volatilityIndices, setVolatilityIndices] = useState<string[]>([]);
  const symbolPipSizesRef = useRef<Record<string, number>>({});

  const [volatilityData, setVolatilityData] = useState<Record<string, VolatilityData>>({});
  const volatilityDataRef = useRef<Record<string, VolatilityData>>({});

  const [statistics, setStatistics] = useState<Record<number, number>>({ 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
  const [alerts, setAlerts] = useState<AlertItem[]>([
    {
      id: '1',
      message: 'System ready. Please connect.',
      timestamp: new Date(),
      type: 'info'
    }
  ]);
  
  const [reconnectDelay, setReconnectDelay] = useState(1000);
  const [autoTradeSettings, setAutoTradeSettings] = useState({
    enabled: true,
    tradeAmount: 1,
    tradeDuration: 1,
    minClusterSize: 5
  });

  const [soundSettings, setSoundSettings] = useState({
    enabled: true
  });

  const [paperSettings, setPaperSettings] = useState({
    enabled: true
  });

  const [apiToken, setApiToken] = useState<string>('');

  useEffect(() => {
    volatilityDataRef.current = volatilityData;
  }, [volatilityData]);

  useEffect(() => {
    const initialData: Record<string, VolatilityData> = {};
    volatilityIndices.forEach(vol => {
      const patternTracking: Record<number, PatternTracking> = {};
      for (let digit = 0; digit <= 9; digit++) {
        patternTracking[digit] = {
          currentClusters: 0,
          isActive: false,
          lastClusterEnd: -1,
          expectedNextCluster: false,
          waitingForSingle: false
        };
      }
      
      initialData[vol] = {
        digits: [],
        patternTracking,
        clusterVisualization: [],
        lastTick: null
      };
    });
    setVolatilityData(initialData);
  }, [volatilityIndices]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/settings');
        if (res.ok) {
          const s = await res.json();
          if (s?.connectionSettings) setConnectionSettings(prev => ({ ...prev, ...s.connectionSettings }));
          if (s?.autoTradeSettings) setAutoTradeSettings(prev => ({ ...prev, ...s.autoTradeSettings }));
          if (s?.soundSettings) setSoundSettings(prev => ({ ...prev, ...s.soundSettings }));
          if (s?.paperSettings) setPaperSettings(prev => ({ ...prev, ...s.paperSettings }));
        }
      } catch (e) {
        console.error('Failed to fetch settings:', e);
      }
    })();
  }, []);

  const saveSettings = useCallback((newSettings: Partial<ConnectionSettings>) => {
    const updated = { ...connectionSettings, ...newSettings };
    setConnectionSettings(updated);
  }, [connectionSettings]);

  const persistTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = setTimeout(async () => {
      try {
        const payload = {
          connectionSettings,
          autoTradeSettings,
          soundSettings,
          paperSettings
        };
        await apiFetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (e) {
        console.error('Failed to persist settings:', e);
      }
    }, 500);
    return () => { if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current); };
  }, [connectionSettings, autoTradeSettings, soundSettings, paperSettings]);

  const addAlert = useCallback((message: string, type: AlertItem['type'] = 'info') => {
    const newAlert: AlertItem = {
      id: Date.now().toString(),
      message,
      timestamp: new Date(),
      type
    };
    setAlerts(prev => [newAlert, ...prev.slice(0, 19)]); // Increased log size
  }, []);

  const autoTradeManager = AutoTradeManager({
    isConnected,
    token: apiToken,
    socketRef,
    onTradeExecuted: (trade) => {
      addAlert(`Trade executed: ${trade.symbol} - ${trade.contract_type}`, 'success');
    },
    onAddAlert: addAlert,
    volatilityIndices: volatilityIndices,
    paperTrading: paperSettings.enabled
  });

  const resetStatistics = useCallback(() => {
    setStatistics({ 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
    addAlert('Statistics reset', 'info');
    toast({ title: "Statistics Reset", description: "All pattern statistics have been cleared" });
  }, [addAlert, toast]);

  const analyzePatterns = useCallback((symbolData: VolatilityData, symbol: string) => {
    const digits = symbolData.digits;
    if (!digits || digits.length === 0) return;

    const minCluster = autoTradeSettings.minClusterSize;

    for (let target = 0; target <= 9; target++) {
      const tracking = symbolData.patternTracking[target] || {
        currentClusters: 0,
        isActive: false,
        lastClusterEnd: -1,
        expectedNextCluster: false,
        waitingForSingle: false
      };

      // Count clusters of the target digit and the end index of the last cluster
      let clusters = 0;
      let lastClusterEnd = -1;
      for (let i = 0; i < digits.length; i++) {
        if (digits[i] === target && (i === 0 || digits[i - 1] !== target)) {
          let j = i;
          while (j + 1 < digits.length && digits[j + 1] === target) j++;
          clusters++;
          lastClusterEnd = j;
          i = j;
        }
      }

      tracking.currentClusters = clusters;
      tracking.lastClusterEnd = lastClusterEnd;
      tracking.isActive = clusters >= 1;

      // If we reached threshold, look for a single isolated target after last cluster end
      if (clusters >= minCluster) {
        const lastIndex = digits.length - 1;
        if (lastIndex > lastClusterEnd && digits[lastIndex] === target && !tracking.waitingForSingle) {
          const isIsolated = (lastIndex === 0 || digits[lastIndex - 1] !== target) &&
                            (lastIndex === digits.length - 1 || digits[lastIndex + 1] !== target);
          if (isIsolated && autoTradeSettings.enabled) {
            addAlert(`Signal: ${symbol} digit ${target} differs after cluster x${clusters}. Placing trades...`, 'warning');
            autoTradeManager.executeDigitDiffersTradeForAllVolatilities(target, autoTradeSettings.tradeAmount, autoTradeSettings.tradeDuration);
            tracking.waitingForSingle = true;
          }
        }
      }

      // Reset waiting flag once the digit changes again
      if (digits[digits.length - 1] !== target) {
        tracking.waitingForSingle = false;
      }

      symbolData.patternTracking[target] = tracking;
    }
  }, []);

  const processTick = useCallback((tick: TickData) => {
    const { symbol, quote } = tick;
    const pipSize = symbolPipSizesRef.current[symbol];
    if (quote == null || pipSize === undefined) return;

    const quoteStr = quote.toFixed(pipSize);
    const lastDigit = parseInt(quoteStr.slice(-1), 10);
    if (isNaN(lastDigit)) return;

    setVolatilityData(prev => {
      const updated = { ...prev };
      const symbolData = { ...(updated[symbol] || { digits: [], patternTracking: {}, clusterVisualization: [], lastTick: null }) };

      symbolData.lastTick = quote;
      symbolData.digits = [...symbolData.digits, lastDigit].slice(-40);

      // Build cluster visualization from recent digits
      const buildClusterVisualization = (digits: number[]): ClusterVisualization[] => {
        const maxItems = 30;
        const recent = digits.slice(-maxItems);
        const result: ClusterVisualization[] = [];
        let i = 0;
        while (i < recent.length) {
          const val = recent[i];
          let j = i;
          while (j + 1 < recent.length && recent[j + 1] === val) j++;
          const runLength = j - i + 1;
          for (let k = i; k <= j; k++) {
            result.push({ digit: val, clusterSize: runLength });
          }
          i = j + 1;
        }
        return result;
      };

      symbolData.clusterVisualization = buildClusterVisualization(symbolData.digits);

      analyzePatterns(symbolData, symbol);
      updated[symbol] = symbolData;
      return updated;
    });
  }, [analyzePatterns]);

  const connect = useCallback(async () => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    addAlert('Attempting to connect...', 'info');

    try {
      addAlert('Resolving API token...', 'info');
      let resolvedToken: string | undefined;

      let tokenSource: 'function' | 'env' | 'unknown' = 'unknown';

      try {
        const response = await apiFetch('/api/token');
        if (response.ok) {
          const body = await response.json();
          if (body && typeof body.token === 'string' && body.token.length > 0) {
            resolvedToken = body.token;
            tokenSource = 'env';
          }
        } else {
          throw new Error(`Token endpoint failed: ${response.status}`);
        }
      } catch (e) {
        addAlert('Token fetch failed. Ensure DERIV_API_TOKEN is set on backend.', 'error');
      }

      if (!resolvedToken) {
        throw new Error('API token not found. Set DERIV_API_TOKEN in backend .env.');
      }

      setApiToken(resolvedToken);
      const masked = resolvedToken.length > 8 
        ? `${'*'.repeat(resolvedToken.length - 4)}${resolvedToken.slice(-4)}` 
        : '****';
      addAlert(`Token resolved from ${tokenSource}. Using: ${masked}`, 'info');

      addAlert('Connecting to Deriv WebSocket...', 'info');
      const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=${connectionSettings.appId}`;
      socketRef.current = new WebSocket(wsUrl);

      socketRef.current.onopen = () => {
        addAlert('WebSocket open. Authenticating...', 'info');
        socketRef.current.send(JSON.stringify({ authorize: resolvedToken }));
      };

      socketRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.error) {
          addAlert(`API Error: ${data.error.message}`, 'error');
          return;
        }

        if (data.msg_type === 'authorize') {
          if (data.error) {
            addAlert(`Authorization failed: ${data.error.message}`, 'error');
            return;
          }
          addAlert('Authorization successful. Fetching active symbols...', 'success');
          setIsConnected(true);
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ active_symbols: 'full', product_type: 'basic' }));
          }
        } else if (data.msg_type === 'active_symbols') {
          const allSymbols = data.active_symbols || [];
          addAlert(`Received ${allSymbols.length} symbols.`, 'info');

          const indicesInfo = allSymbols
            .filter(symbol => symbol.market === 'synthetic_index' && symbol.symbol.startsWith('R_'))
            .map(symbol => ({ symbol: symbol.symbol, pip_size: Number(symbol.pip) }));

          addAlert(`Found ${indicesInfo.length} Volatility indices.`, 'info');

          if (indicesInfo.length === 0) {
            addAlert('No volatility indices (R_ symbols) found. Check account permissions.', 'error');
            return;
          }

          const validIndices = indicesInfo.filter(info => typeof info.pip_size === 'number');
          addAlert(`${validIndices.length} indices have valid pip size. Subscribing...`, 'info');

          const indices = validIndices.map(info => info.symbol);
          setVolatilityIndices(indices);

          symbolPipSizesRef.current = validIndices.reduce((acc, info) => {
            acc[info.symbol] = info.pip_size;
            return acc;
          }, {});

          indices.forEach((vol, index) => {
            setTimeout(() => {
              if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({ ticks: vol, subscribe: 1 }));
              }
            }, index * 100);
          });
        } else if (data.msg_type === 'tick') {
          processTick(data.tick);
        }
      };

      socketRef.current.onclose = () => {
        setIsConnected(false);
        addAlert('WebSocket connection closed. Reconnecting...', 'warning');
        reconnectTimeoutRef.current = setTimeout(connect, reconnectDelay);
      };

      socketRef.current.onerror = (error) => {
        addAlert('WebSocket error.', 'error');
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      addAlert(`Connection failed: ${error.message}`, 'error');
    }
  }, [connectionSettings.appId, reconnectDelay, addAlert, processTick]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsConnected(false);
    setVolatilityIndices([]);
    addAlert('Disconnected manually.', 'info');
  }, [addAlert]);

  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto p-4 space-y-6">
        <Card 
          className="relative p-6 bg-gradient-primary text-primary-foreground border-0 shadow-glow overflow-hidden"
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(220, 38, 127, 0.9), rgba(147, 51, 234, 0.9)), url(${dashboardHero})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundBlendMode: 'overlay'
          }}
        >
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
              🎯 Deriv Volatility Monitor
            </h1>
            <p className="text-lg opacity-90">
              Real-time pattern detection and automated trading for Deriv
            </p>
          </div>
        </Card>

        <ConnectionControls
          settings={connectionSettings}
          onSettingsChange={saveSettings}
          isConnected={isConnected}
          onConnect={connect}
          onDisconnect={disconnect}
          onResetStats={resetStatistics}
          autoTradeSettings={autoTradeSettings}
          onAutoTradeSettingsChange={(partial) => setAutoTradeSettings(prev => ({ ...prev, ...partial }))}
          soundSettings={soundSettings}
          onSoundSettingsChange={(partial) => setSoundSettings(prev => ({ ...prev, ...partial }))}
          paperSettings={paperSettings}
          onPaperSettingsChange={(partial) => setPaperSettings(prev => ({ ...prev, ...partial }))}
        />

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3 space-y-4">
            {volatilityIndices.length > 0 ? (
              volatilityIndices.map(vol => (
                <VolatilityCard
                  key={vol}
                  symbol={vol}
                  data={volatilityData[vol]}
                  isSelected={vol === connectionSettings.selectedVolatility}
                />
              ))
            ) : (
              <Card className="p-6 text-center text-muted-foreground">
                {isConnected ? 'Waiting for symbol data...' : 'Disconnected. Please connect.'}
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <StatisticsPanel statistics={statistics} />
            <AlertsLog alerts={alerts} />
          </div>
        </div>
      </div>
    </div>
  );
}
