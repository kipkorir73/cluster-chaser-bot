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

// Interfaces
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

interface DerivAccount {
  loginid: string;
  currency: string;
  is_demo: boolean;
  balance: number;
  account_type: string;
  country: string;
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

export function VolatilityMonitor() {
  const { toast } = useToast();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeSubscriptions = useRef<Set<string>>(new Set());

  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<DerivAccount | null>(null);
  
  const [connectionSettings, setConnectionSettings] = useState<ConnectionSettings>({
    alertThreshold: 5,
    autoTrade: false,
    selectedVolatility: 'R_25'
  });
  
  const [volatilityIndices, setVolatilityIndices] = useState<string[]>([]);
  const symbolPipSizesRef = useRef<Record<string, number>>({});

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
  const [autoTradeSettings, setAutoTradeSettings] = useState({
    enabled: true,
    contractType: 'DIGITDIFF' as 'DIGITDIFF' | 'DIGITOVER' | 'DIGITUNDER' | 'DIGITEVEN' | 'DIGITODD',
    tradeAmount: 1,
    tradeDuration: 1,
    minClusterSize: 5
  });

  const [soundSettings, setSoundSettings] = useState({
    enabled: true
  });

  // Fetch initial volatility indices from a predefined list
  useEffect(() => {
    const defaultVolatilityIndices = [
      'R_10', 'R_25', 'R_50', 'R_75', 'R_100',
      '1HZ10V', '1HZ25V', '1HZ50V', '1HZ75V', '1HZ100V'
    ];
    setVolatilityIndices(defaultVolatilityIndices);
  }, []);

  // Initialize volatility data when indices are available
  useEffect(() => {
    if (volatilityIndices.length > 0) {
      const initialData: Record<string, VolatilityData> = {};
      
      volatilityIndices.forEach(symbol => {
        initialData[symbol] = {
          digits: [],
          patternTracking: Array.from({length: 10}, (_, i) => [i, {
            currentClusters: 0,
            isActive: false,
            lastClusterEnd: 0,
            expectedNextCluster: false,
            waitingForSingle: false
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
    }
  }, [volatilityIndices]);

  const addAlert = useCallback((alert: Omit<AlertItem, 'id'> & { id?: string }) => {
    const newAlert: AlertItem = {
      ...alert,
      id: alert.id || Date.now().toString()
    };
    
    setAlerts(prevAlerts => [newAlert, ...prevAlerts.slice(0, 49)]);
    
    if (soundSettings.enabled) {
      // Add sound notification here if needed
    }
  }, [soundSettings.enabled]);

  // Enhanced Trade Manager integration
  const enhancedTradeManager = EnhancedTradeManager({
    isConnected,
    authToken,
    wsRef: socketRef,
    selectedAccount,
    onTradeExecuted: (tradeInfo) => {
      addAlert({
        id: `trade_${Date.now()}`,
        message: `Trade executed: ${tradeInfo.symbol} - ${tradeInfo.type} targeting digit ${tradeInfo.digit}`,
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

  const analyzePatterns = useCallback(async (tickData: TickData) => {
    const symbol = tickData.symbol;
    const currentData = volatilityDataRef.current[symbol];
    
    if (!currentData || currentData.digits.length < 10) return;

    const recentDigits = currentData.digits.slice(-10);
    const lastDigit = recentDigits[recentDigits.length - 1];

    // Detect clusters for all digits (0-9)
    for (let digit = 0; digit <= 9; digit++) {
      const tracking = currentData.patternTracking[digit];
      
      if (lastDigit === digit) {
        tracking.currentClusters++;
        tracking.isActive = true;
        tracking.waitingForSingle = false;
      } else {
        if (tracking.isActive && tracking.currentClusters >= autoTradeSettings.minClusterSize) {
          tracking.lastClusterEnd = Date.now();
          tracking.expectedNextCluster = true;
          tracking.waitingForSingle = true;
          
          // Update statistics
          setStatistics(prev => ({
            ...prev,
            [tracking.currentClusters]: (prev[tracking.currentClusters] || 0) + 1
          }));

          // Execute trades if auto-trade is enabled and authenticated
          if (connectionSettings.autoTrade && autoTradeSettings.enabled && isAuthenticated) {
            try {
              const success = await enhancedTradeManager.executeAutoTradeOnClusterDetection(
                symbol,
                digit,
                tracking.currentClusters
              );
              
              if (success) {
                addAlert({
                  id: `pattern_${Date.now()}`,
                  message: `🎯 Pattern detected: ${symbol} - Cluster of ${tracking.currentClusters} consecutive ${digit}s. Trades executed for all other digits!`,
                  timestamp: new Date(),
                  type: 'success'
                });
              }
            } catch (error) {
              addAlert({
                id: `error_${Date.now()}`,
                message: `❌ Failed to execute trades for ${symbol}: ${error}`,
                timestamp: new Date(),
                type: 'error'
              });
            }
          } else {
            addAlert({
              id: `pattern_${Date.now()}`,
              message: `📊 Pattern detected: ${symbol} - Cluster of ${tracking.currentClusters} consecutive ${digit}s`,
              timestamp: new Date(),
              type: 'info'
            });
          }
        }
        
        tracking.currentClusters = 0;
        tracking.isActive = false;
      }
    }
  }, [connectionSettings.autoTrade, autoTradeSettings, enhancedTradeManager, addAlert, isAuthenticated]);

  const processTick = useCallback(async (tick: any) => {
    const symbol = tick.symbol;
    const quote = parseFloat(tick.quote);
    const lastDigit = Math.floor((quote * 100) % 10);

    // Update volatility data
    setVolatilityData(prevData => {
      const symbolData = prevData[symbol] || {
        digits: [],
        patternTracking: Array.from({length: 10}, (_, i) => [i, {
          currentClusters: 0,
          isActive: false,
          lastClusterEnd: 0,
          expectedNextCluster: false,
          waitingForSingle: false
        }]).reduce((acc, [digit, tracking]) => {
          acc[digit as number] = tracking as PatternTracking;
          return acc;
        }, {} as Record<number, PatternTracking>),
        clusterVisualization: [],
        lastTick: null
      };

      const newDigits = [...symbolData.digits, lastDigit].slice(-50);
      const clusterVisualization = newDigits.slice(-20).map((digit, index, arr) => {
        let clusterSize = 1;
        // Count backwards to find cluster size
        for (let i = index - 1; i >= 0; i--) {
          if (arr[i] === digit) {
            clusterSize++;
          } else {
            break;
          }
        }
        return { digit, clusterSize };
      });

      const updatedData = {
        ...symbolData,
        digits: newDigits,
        clusterVisualization,
        lastTick: quote
      };

      // Update the ref for pattern analysis
      volatilityDataRef.current = {
        ...volatilityDataRef.current,
        [symbol]: updatedData
      };

      return {
        ...prevData,
        [symbol]: updatedData
      };
    });

    // Analyze patterns
    await analyzePatterns({ symbol, quote, epoch: tick.epoch || Date.now() / 1000 });
  }, [analyzePatterns]);

  const connect = useCallback(async () => {
    if (isConnected || !isAuthenticated || !authToken) {
      toast({
        title: "Connection Error",
        description: "Please authenticate with Deriv first",
        variant: "destructive"
      });
      return;
    }

    try {
      // Create WebSocket connection (app_id is handled in auth)
      const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=1089`);
      socketRef.current = ws;

      ws.onopen = () => {
        // Authorize with API token
        ws.send(JSON.stringify({
          authorize: authToken
        }));
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        if (data.msg_type === 'authorize') {
          if (data.error) {
            toast({
              title: "Authorization Failed",
              description: data.error.message,
              variant: "destructive"
            });
            return;
          }

          setIsConnected(true);
          setReconnectDelay(1000);
          
          addAlert({
            message: `✅ Connected successfully to Deriv as ${selectedAccount?.loginid}`,
            timestamp: new Date(),
            type: 'success'
          });

          // Subscribe to all volatility indices
          volatilityIndices.forEach(symbol => {
            if (!activeSubscriptions.current.has(symbol)) {
              ws.send(JSON.stringify({
                ticks: symbol,
                subscribe: 1
              }));
              activeSubscriptions.current.add(symbol);
            }
          });
        }

        if (data.msg_type === 'tick') {
          await processTick(data.tick);
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

        // Auto-reconnect logic
        if (isAuthenticated && authToken) {
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectDelay(prev => Math.min(prev * 2, 30000));
            connect();
          }, reconnectDelay);
        }
      };

      ws.onerror = (error) => {
        addAlert({
          message: '❌ WebSocket error occurred',
          timestamp: new Date(),
          type: 'error'
        });
      };

    } catch (error) {
      toast({
        title: "Connection Failed",
        description: `Failed to connect: ${error}`,
        variant: "destructive"
      });
    }
  }, [isConnected, isAuthenticated, authToken, volatilityIndices, processTick, toast, selectedAccount, reconnectDelay, addAlert]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socketRef.current) {
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
  }, [addAlert]);

  // Cleanup on unmount
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
    }
  }, [disconnect]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
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
        {/* Authentication */}
        <DerivAuth 
          onAuthChange={handleAuthChange}
          isConnected={isConnected}
        />

        {/* Connection Controls */}
        {isAuthenticated && (
          <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50">
            <div className="flex items-center gap-4 mb-4">
              <h2 className="text-lg font-semibold">Trading Controls</h2>
              <div className="flex gap-2 ml-auto">
                <Button
                  onClick={connect}
                  disabled={isConnected || !isAuthenticated}
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

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Alert Threshold</label>
                <input
                  type="number"
                  min="3"
                  max="10"
                  value={connectionSettings.alertThreshold}
                  onChange={(e) => setConnectionSettings(prev => ({ ...prev, alertThreshold: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 bg-background/50 border border-border rounded-md"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Trade Amount ({selectedAccount?.currency})</label>
                <input
                  type="number"
                  min="0.35"
                  step="0.01"
                  value={autoTradeSettings.tradeAmount}
                  onChange={(e) => setAutoTradeSettings(prev => ({ ...prev, tradeAmount: parseFloat(e.target.value) }))}
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
                  onChange={(e) => setAutoTradeSettings(prev => ({ ...prev, minClusterSize: parseInt(e.target.value) }))}
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
                      setConnectionSettings(prev => ({ ...prev, autoTrade: e.target.checked }));
                      setAutoTradeSettings(prev => ({ ...prev, enabled: e.target.checked }));
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
                  onChange={(e) => setAutoTradeSettings(prev => ({ ...prev, contractType: e.target.value as any }))}
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

            <div className="mt-4 p-4 bg-info/10 border border-info/20 rounded-md">
              <p className="text-sm text-info-foreground">
                <strong>Strategy:</strong> When a cluster of {autoTradeSettings.minClusterSize}+ identical digits is detected, 
                the system will auto-trade using {autoTradeSettings.contractType} contracts on all supported volatility indices.
              </p>
            </div>
          </Card>
        )}

        {/* Volatility Cards */}
        {isAuthenticated && isConnected && (
          <>
            {volatilityIndices.length === 0 ? (
              <Card className="p-8 text-center bg-card/50 backdrop-blur-sm border-border/50">
                <p className="text-muted-foreground">Waiting for volatility indices...</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {volatilityIndices.map((symbol) => {
                  const data = volatilityData[symbol];
                  return data ? (
                     <VolatilityCard
                       key={symbol}
                       symbol={symbol}
                       data={data}
                       isSelected={false}
                     />
                  ) : null;
                })}
              </div>
            )}

            {/* Statistics and Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <StatisticsPanel statistics={statistics} />
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