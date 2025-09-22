import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { DerivAuth } from './DerivAuth';
import { VolatilityCard } from './VolatilityCard';
import { StatisticsPanel } from './StatisticsPanel';
import { AlertsLog } from './AlertsLog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EnhancedTradeManager } from './EnhancedTradeManager';
import dashboardHero from '../assets/dashboard-hero.jpg';
import { RotateCcw, Play, Square } from 'lucide-react';
import { PnLPanel } from './PnLPanel';

interface DerivAccount {
  loginid: string;
  currency: string;
  is_demo: boolean;
  balance: number;
  account_type: string;
  country: string;
  token?: string;
}

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
  runLength: number;
  inCluster: boolean;
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
  alertThreshold: number;
  autoTrade: boolean;
  selectedVolatility: string;
}

interface TickData {
  symbol: string;
  quote: number;
  epoch: number;
}

interface PnLState {
  startingBalance: number | null;
  currentBalance: number | null;
  realizedPnL: number;
  openPnL: number;
  wins: number;
  losses: number;
  openTrades: number;
}

interface AutoTradeSettings {
  enabled: boolean;
  contractType: 'DIGITDIFF' | 'DIGITOVER' | 'DIGITUNDER' | 'DIGITEVEN' | 'DIGITODD';
  tradeAmount: number;
  tradeDuration: number;
  minClusterSize: number;
}

export function VolatilityMonitor() {
  const { toast } = useToast();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSubscriptions = useRef<Set<string>>(new Set());

  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<DerivAccount | null>(null);
  
  const [connectionSettings, setConnectionSettings] = useState<ConnectionSettings>({
    alertThreshold: 5,
    autoTrade: true,
    selectedVolatility: 'R_25'
  });
  
  const [volatilityIndices, setVolatilityIndices] = useState<string[]>([]);
  const [volatilityData, setVolatilityData] = useState<Record<string, VolatilityData>>({});
  const volatilityDataRef = useRef<Record<string, VolatilityData>>({});

  const [statistics, setStatistics] = useState<Record<number, number>>({ 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
  const [alerts, setAlerts] = useState<AlertItem[]>([
    {
      id: '1',
      message: 'System ready. Please authenticate with Deriv.',
      timestamp: new Date(),
      type: 'info'
    }
  ]);
  
  const [reconnectDelay, setReconnectDelay] = useState(1000);
  const [autoTradeSettings, setAutoTradeSettings] = useState<AutoTradeSettings>({
    enabled: true,
    contractType: 'DIGITDIFF',
    tradeAmount: 1,
    tradeDuration: 1,
    minClusterSize: 5
  });

  const [soundSettings] = useState({ enabled: true });
  const [pnl, setPnl] = useState<PnLState>({
    startingBalance: null,
    currentBalance: null,
    realizedPnL: 0,
    openPnL: 0,
    wins: 0,
    losses: 0,
    openTrades: 0
  });
  const openContractsRef = useRef<Record<string, { buy_price: number }>>({});

  useEffect(() => {
    const defaultVolatilityIndices = [
      'R_10', 'R_25', 'R_50', 'R_75', 'R_100',
      '1HZ10V', '1HZ25V', '1HZ50V', '1HZ75V', '1HZ100V'
    ];
    setVolatilityIndices(defaultVolatilityIndices);
  }, []);

  useEffect(() => {
    if (volatilityIndices.length === 0) return;
    const initialData: Record<string, VolatilityData> = {};
    volatilityIndices.forEach(symbol => {
      initialData[symbol] = {
        digits: [],
        patternTracking: Array.from({ length: 10 }, (_, i) => [i, {
          currentClusters: 0,
          isActive: false,
          lastClusterEnd: 0,
          expectedNextCluster: false,
          waitingForSingle: false,
          runLength: 0,
          inCluster: false
        }]).reduce((acc, [digit, tracking]) => {
          acc[digit as number] = tracking as PatternTracking;
          return acc;
        }, {} as Record<number, PatternTracking>),
        clusterVisualization: [],
        lastTick: null
      };
    });
    setVolatilityData(initialData);
    volatilityDataRef.current = initialData;
  }, [volatilityIndices]);

  const addAlert = useCallback((alert: Omit<AlertItem, 'id'> & { id?: string }) => {
    const newAlert: AlertItem = {
      ...alert,
      id: alert.id || Date.now().toString()
    };
    setAlerts(prev => [newAlert, ...prev.slice(0, 49)]);
    if (soundSettings.enabled) {
      console.log('Alert sound triggered:', newAlert.message);
    }
  }, [soundSettings.enabled]);

  const enhancedTradeManager = EnhancedTradeManager({
    isConnected,
    authToken,
    wsRef: socketRef,
    selectedAccount,
    onTradeExecuted: (tradeInfo) => {
      addAlert({
        id: `trade_${Date.now()}`,
        message: `Trade executed: ${tradeInfo.symbol} - ${tradeInfo.contract_type}${tradeInfo.barrier ? ` @ ${tradeInfo.barrier}` : ''}`,
        timestamp: new Date(),
        type: 'success'
      });
    },
    onAlert: addAlert,
    volatilityIndices,
    autoTradeSettings
  });

  const resetStatistics = useCallback(() => {
    setStatistics({ 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
    addAlert({
      message: 'Statistics reset successfully',
      timestamp: new Date(),
      type: 'info'
    });
  }, [addAlert]);

  const processTick = useCallback((tick: TickData) => {
    const symbol = tick.symbol;
    const quote = parseFloat(String(tick.quote));
    const quoteStr = String(quote);
    const sanitized = quoteStr.replace(/[^0-9]/g, '');
    const lastDigit = sanitized.length > 0 ? parseInt(sanitized[sanitized.length - 1]) : 0;

    setVolatilityData(prevData => {
      const symbolData = prevData[symbol] || {
        digits: [],
        patternTracking: Array.from({ length: 10 }, (_, i) => [i, {
          currentClusters: 0,
          isActive: false,
          lastClusterEnd: 0,
          expectedNextCluster: false,
          waitingForSingle: false,
          runLength: 0,
          inCluster: false
        }]).reduce((acc, [digit, tracking]) => {
          acc[digit as number] = tracking as PatternTracking;
          return acc;
        }, {} as Record<number, PatternTracking>),
        clusterVisualization: [],
        lastTick: null
      };

      const newDigits = [...symbolData.digits, lastDigit].slice(-200);
      const clusterVisualization = newDigits.slice(-20).map((digit, index, arr) => {
        let clusterSize = 1;
        for (let i = index - 1; i >= 0 && arr[i] === digit; i--) {
          clusterSize++;
        }
        return { digit, clusterSize };
      });

      const updatedData = {
        ...symbolData,
        digits: newDigits,
        clusterVisualization,
        lastTick: quote
      };

      volatilityDataRef.current = {
        ...volatilityDataRef.current,
        [symbol]: updatedData
      };

      return {
        ...prevData,
        [symbol]: updatedData
      };
    });

    const currentData = volatilityDataRef.current[symbol];
    if (!currentData) return;

    const latestIndex = currentData.digits.length - 1;
    for (let d = 0; d < 10; d++) {
      const tracking = currentData.patternTracking[d];
      if (!tracking) continue;

      if (d === lastDigit) {
        tracking.runLength += 1;
        if (!tracking.inCluster && tracking.runLength >= 2) {
          tracking.currentClusters += 1;
          tracking.inCluster = true;
          tracking.lastClusterEnd = latestIndex;
          tracking.isActive = true;
          if (tracking.currentClusters >= autoTradeSettings.minClusterSize) {
            tracking.expectedNextCluster = true;
          }
          tracking.waitingForSingle = false;
        }
      } else {
        const wasInCluster = tracking.inCluster;
        tracking.runLength = 0;
        if (wasInCluster) {
          tracking.inCluster = false;
          tracking.lastClusterEnd = latestIndex;
        }
      }

      if (
        connectionSettings.autoTrade &&
        autoTradeSettings.enabled &&
        isAuthenticated &&
        isConnected &&
        socketRef.current &&
        selectedAccount &&
        tracking.expectedNextCluster &&
        !tracking.waitingForSingle &&
        d === lastDigit &&
        tracking.runLength === 1
      ) {
        enhancedTradeManager.executeAutoTradeOnClusterDetection(symbol, d, tracking.currentClusters)
          .then(success => {
            if (success) {
              setStatistics(prev => ({
                ...prev,
                [tracking.currentClusters]: (prev[tracking.currentClusters] || 0) + 1
              }));
              addAlert({
                id: `trade_${Date.now()}`,
                message: `🚀 AUTO TRADE: ${symbol} - After ${tracking.currentClusters} clusters of digit ${d}, ${autoTradeSettings.contractType} placed!`,
                timestamp: new Date(),
                type: 'success'
              });
              tracking.waitingForSingle = true;
            }
          })
          .catch(error => {
            addAlert({
              id: `error_${Date.now()}`,
              message: `❌ Trade failed for ${symbol}: ${error instanceof Error ? error.message : String(error)}`,
              timestamp: new Date(),
              type: 'error'
            });
          });
      }
    }
  }, [connectionSettings.autoTrade, autoTradeSettings, enhancedTradeManager, addAlert, isAuthenticated, isConnected, selectedAccount]);

  const connect = useCallback(() => {
    if (isConnected || !isAuthenticated || !authToken || !selectedAccount) {
      toast({
        title: "Connection Error",
        description: "Please authenticate with Deriv and select an account",
        variant: "destructive"
      });
      return;
    }

    try {
      // Use the same WebSocket endpoint for both demo and real accounts
      // The app_id is used for authorization, not for determining connection endpoint
      const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=1089`);
      socketRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ authorize: authToken }));
      };

      ws.onmessage = async (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (error) {
          addAlert({
            message: `❌ Failed to parse WebSocket message: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: new Date(),
            type: 'error'
          });
          return;
        }

        if (data.msg_type === 'authorize') {
          if (data.error) {
            toast({
              title: "Authorization Failed",
              description: data.error.message,
              variant: "destructive"
            });
            ws.close();
            return;
          }

          setIsConnected(true);
          setReconnectDelay(1000);
          addAlert({
            message: `✅ Connected to Deriv as ${selectedAccount.loginid}`,
            timestamp: new Date(),
            type: 'success'
          });

          ws.send(JSON.stringify({ set_account: selectedAccount.loginid }));
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
            }
          }, 200);

          volatilityIndices.forEach(symbol => {
            if (!activeSubscriptions.current.has(symbol)) {
              ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
              activeSubscriptions.current.add(symbol);
            }
          });
        }

        if (data.msg_type === 'tick' && data.tick) {
          await processTick(data.tick);
        }

        if (data.msg_type === 'buy' && data.buy?.contract_id) {
          ws.send(JSON.stringify({ proposal_open_contract: 1, contract_id: String(data.buy.contract_id), subscribe: 1 }));
        }

        if (data.msg_type === 'balance' && data.balance) {
          const newBalance = parseFloat(data.balance.balance || '0');
          if (data.balance.loginid === selectedAccount.loginid) {
            setPnl(prev => ({
              ...prev,
              startingBalance: prev.startingBalance ?? newBalance,
              currentBalance: newBalance
            }));
            setSelectedAccount(prev => prev ? { ...prev, balance: newBalance } : prev);
            addAlert({
              message: `Balance update for ${data.balance.loginid}: ${data.balance.currency} ${newBalance.toFixed(2)}`,
              timestamp: new Date(),
              type: 'info'
            });
          }
        }

        if (data.msg_type === 'proposal_open_contract' && data.proposal_open_contract) {
          const poc = data.proposal_open_contract;
          const contractId = String(poc.contract_id);
          const buyPrice = parseFloat(poc.buy_price || '0');
          const currentProfit = parseFloat(poc.profit || '0');
          const isSold = !!poc.is_sold;

          if (!openContractsRef.current[contractId] && buyPrice > 0) {
            openContractsRef.current[contractId] = { buy_price: buyPrice };
          }

          if (!isSold) {
            setPnl(prev => ({
              ...prev,
              openPnL: currentProfit,
              openTrades: Object.keys(openContractsRef.current).length
            }));
          } else {
            const realized = currentProfit;
            const wasWin = realized > 0;
            const { [contractId]: _, ...rest } = openContractsRef.current;
            openContractsRef.current = rest;

            setPnl(prev => ({
              ...prev,
              realizedPnL: prev.realizedPnL + realized,
              openTrades: Object.keys(rest).length,
              openPnL: 0,
              wins: prev.wins + (wasWin ? 1 : 0),
              losses: prev.losses + (!wasWin ? 1 : 0)
            }));
          }
        }

        if (data.error && data.msg_type !== 'authorize') {
          addAlert({
            message: `⚠️ API Error: ${data.error.message}`,
            timestamp: new Date(),
            type: 'error'
          });
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        activeSubscriptions.current.clear();
        addAlert({
          message: '🔌 Connection closed',
          timestamp: new Date(),
          type: 'warning'
        });

        if (isAuthenticated && authToken) {
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectDelay(prev => Math.min(prev * 2, 30000));
            connect();
          }, reconnectDelay);
        }
      };

      ws.onerror = () => {
        addAlert({
          message: '❌ WebSocket error occurred',
          timestamp: new Date(),
          type: 'error'
        });
      };
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: `Failed to connect: ${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive"
      });
    }
  }, [isConnected, isAuthenticated, authToken, selectedAccount, volatilityIndices, processTick, toast, reconnectDelay, addAlert]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socketRef.current) {
      if (selectedAccount) {
        socketRef.current.send(JSON.stringify({ balance: 0, subscribe: 0 }));
      }
      socketRef.current.close();
      socketRef.current = null;
    }

    setIsConnected(false);
    activeSubscriptions.current.clear();
    addAlert({
      message: '🔌 Disconnected from Deriv',
      timestamp: new Date(),
      type: 'info'
    });
  }, [addAlert, selectedAccount]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const handleAuthChange = useCallback((authenticated: boolean, token: string, account: DerivAccount | null) => {
    setIsAuthenticated(authenticated);
    setAuthToken(token);
    setSelectedAccount(account);
    if (!authenticated) {
      disconnect();
    } else if (account) {
      setPnl(prev => ({
        ...prev,
        startingBalance: account.balance,
        currentBalance: account.balance
      }));
    }
  }, [disconnect]);

  useEffect(() => {
    if (isConnected && selectedAccount) {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ balance: 0, subscribe: 0 }));
        setTimeout(() => {
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ set_account: selectedAccount.loginid }));
            setTimeout(() => {
              if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({ balance: 1, subscribe: 1 }));
              }
            }, 200);
          }
        }, 200);
      }
    }
  }, [selectedAccount, isConnected]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="relative h-64 bg-gradient-to-r from-blue-600 to-purple-700 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${dashboardHero})` }}
        />
        <div className="relative z-10 container mx-auto px-4 h-full flex items-center">
          <div className="text-white">
            <h1 className="text-4xl md:text-5xl font-bold mb-2">Deriv Volatility Trader</h1>
            <p className="text-xl opacity-90">Real-time pattern detection and automated digit trading</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-6">
        <DerivAuth 
          onAuthChange={handleAuthChange}
          isConnected={isConnected}
        />

        {isAuthenticated && (
          <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50">
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-lg font-semibold">Trading Controls</h2>
              <div className="ml-auto flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">Account:</span>
                <span className="font-mono font-semibold">{selectedAccount?.loginid || '—'}</span>
                <span className="px-2 py-1 rounded bg-background/40 border text-xs">
                  {selectedAccount?.is_demo ? 'Demo' : selectedAccount ? 'Real' : ''}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={connect}
                  disabled={isConnected || !isAuthenticated || !selectedAccount}
                  variant={isConnected ? "secondary" : "default"}
                >
                  {isConnected ? (
                    <Square className="h-4 w-4 mr-2" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {isConnected ? 'Connected' : 'Start Trading'}
                </Button>
                <Button
                  onClick={disconnect}
                  disabled={!isConnected}
                  variant="outline"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
                <Button
                  onClick={resetStatistics}
                  variant="outline"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Stats
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Alert Threshold</label>
                <input
                  type="number"
                  min="3"
                  max="10"
                  value={connectionSettings.alertThreshold}
                  onChange={(e) => setConnectionSettings(prev => ({ ...prev, alertThreshold: parseInt(e.target.value) || 5 }))}
                  className="w-full px-3 py-2 bg-background/50 border border-border rounded-md"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Trade Amount ({selectedAccount?.currency || 'USD'})</label>
                <input
                  type="number"
                  min="0.35"
                  step="0.01"
                  value={autoTradeSettings.tradeAmount}
                  onChange={(e) => setAutoTradeSettings(prev => ({ ...prev, tradeAmount: parseFloat(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 bg-background/50 border border-border rounded-md"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Min Cluster Size</label>
                <input
                  type="number"
                  min="3"
                  max="10"
                  value={autoTradeSettings.minClusterSize}
                  onChange={(e) => setAutoTradeSettings(prev => ({ ...prev, minClusterSize: parseInt(e.target.value) || 5 }))}
                  className="w-full px-3 py-2 bg-background/50 border border-border rounded-md"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Auto Trade</label>
                <div className="flex items-center gap-2 p-2 bg-background/50 rounded-md">
                  <input
                    type="checkbox"
                    checked={connectionSettings.autoTrade && autoTradeSettings.enabled}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setConnectionSettings(prev => ({ ...prev, autoTrade: checked }));
                      setAutoTradeSettings(prev => ({ ...prev, enabled: checked }));
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">Live Trading</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Contract Type</label>
                <select
                  value={autoTradeSettings.contractType}
                  onChange={(e) => setAutoTradeSettings(prev => ({ ...prev, contractType: e.target.value as AutoTradeSettings['contractType'] }))}
                  className="w-full px-3 py-2 bg-background/50 border border-border rounded-md"
                >
                  <option value="DIGITDIFF">Digit Differs</option>
                  <option value="DIGITOVER">Digit Over</option>
                  <option value="DIGITUNDER">Digit Under</option>
                  <option value="DIGITEVEN">Digit Even</option>
                  <option value="DIGITODD">Digit Odd</option>
                </select>
              </div>
            </div>

            <div className="mt-4 p-4 bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-lg">
              <p className="text-sm font-medium mb-2">
                <strong>🎯 Advanced Cluster Strategy:</strong>
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                1. Monitor for {autoTradeSettings.minClusterSize}+ <strong>separate clusters</strong> of each digit (0-9)<br/>
                2. Wait for an <strong>isolated single occurrence</strong> of that digit<br/>
                3. Execute <strong>{autoTradeSettings.contractType}</strong> trade<br/>
                4. Auto-trade across <strong>all volatility indices</strong>
              </p>
            </div>
          </Card>
        )}

        {isAuthenticated && isConnected && (
          <>
            {volatilityIndices.length === 0 ? (
              <Card className="p-8 text-center bg-card/50 backdrop-blur-sm border-border/50">
                <p className="text-muted-foreground">Waiting for volatility indices...</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {volatilityIndices.map(symbol => {
                  const data = volatilityData[symbol];
                  return data ? (
                    <VolatilityCard
                      key={symbol}
                      symbol={symbol}
                      data={data}
                      isSelected={symbol === connectionSettings.selectedVolatility}
                      autoTradeSettings={autoTradeSettings}
                    />
                  ) : null;
                })}
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <StatisticsPanel statistics={statistics} />
              <PnLPanel pnl={pnl} />
              <AlertsLog alerts={alerts} />
            </div>
          </>
        )}

        {!isAuthenticated && (
          <Card className="p-8 text-center bg-card/50 backdrop-blur-sm border-border/50">
            <h3 className="text-lg font-semibold mb-2">Welcome to Deriv Volatility Trader</h3>
            <p className="text-muted-foreground">
              Please authenticate with your Deriv account to start monitoring volatility patterns and executing trades.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}