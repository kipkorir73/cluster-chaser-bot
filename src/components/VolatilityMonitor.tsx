import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ConnectionControls } from './ConnectionControls';
import { VolatilityCard } from './VolatilityCard';
import { StatisticsPanel } from './StatisticsPanel';
import { AlertsLog } from './AlertsLog';
import { Card } from '@/components/ui/card';
import dashboardHero from '@/assets/dashboard-hero.jpg';

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
  token: string;
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
  
  const [isConnected, setIsConnected] = useState(false);
  const [connectionSettings, setConnectionSettings] = useState<ConnectionSettings>({
    appId: '1089',
    token: '',
    alertThreshold: 5,
    autoTrade: false,
    selectedVolatility: 'R_25'
  });
  
  const volatilities = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100'];
  const [volatilityData, setVolatilityData] = useState<Record<string, VolatilityData>>({});
  const [statistics, setStatistics] = useState<Record<number, number>>({ 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
  const [alerts, setAlerts] = useState<AlertItem[]>([
    {
      id: '1',
      message: 'System ready - waiting for patterns',
      timestamp: new Date(),
      type: 'info'
    }
  ]);
  
  const [pendingTrade, setPendingTrade] = useState<{ symbol: string; digit: number } | null>(null);
  const [reconnectDelay, setReconnectDelay] = useState(1000);

  // Initialize volatility data
  useEffect(() => {
    const initialData: Record<string, VolatilityData> = {};
    volatilities.forEach(vol => {
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
  }, []);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('volatilityMonitorSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setConnectionSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = useCallback((newSettings: Partial<ConnectionSettings>) => {
    const updated = { ...connectionSettings, ...newSettings };
    setConnectionSettings(updated);
    try {
      localStorage.setItem('volatilityMonitorSettings', JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, [connectionSettings]);

  const addAlert = useCallback((message: string, type: AlertItem['type'] = 'info') => {
    const newAlert: AlertItem = {
      id: Date.now().toString(),
      message,
      timestamp: new Date(),
      type
    };
    setAlerts(prev => [newAlert, ...prev.slice(0, 9)]);
  }, []);

  const resetStatistics = useCallback(() => {
    setStatistics({ 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
    addAlert('Statistics reset', 'info');
    toast({
      title: "Statistics Reset",
      description: "All pattern statistics have been cleared",
    });
  }, [addAlert, toast]);

  const processTick = useCallback((tick: TickData) => {
    const { symbol, quote } = tick;
    
    if (!volatilityData[symbol] || quote == null) return;

    const quoteStr = quote.toString();
    const lastDigit = parseInt(quoteStr.slice(-1));
    
    if (isNaN(lastDigit)) {
      console.warn(`Invalid digit for ${symbol}: quote=${quote}`);
      return;
    }

    setVolatilityData(prev => {
      const updated = { ...prev };
      const symbolData = { ...updated[symbol] };
      
      symbolData.lastTick = quote;
      symbolData.digits = [...symbolData.digits, lastDigit];
      
      // Keep only last 40 digits
      if (symbolData.digits.length > 40) {
        symbolData.digits = symbolData.digits.slice(-40);
        // Adjust cluster tracking positions
        Object.keys(symbolData.patternTracking).forEach(digit => {
          const tracking = symbolData.patternTracking[parseInt(digit)];
          if (tracking.lastClusterEnd > 0) {
            tracking.lastClusterEnd--;
          }
        });
      }
      
      // Analyze patterns
      analyzePatterns(symbolData, symbol);
      updated[symbol] = symbolData;
      return updated;
    });
  }, [volatilityData, connectionSettings.alertThreshold]);

  const analyzePatterns = useCallback((symbolData: VolatilityData, symbol: string) => {
    const digits = symbolData.digits;
    if (digits.length < 2) return;
    
    const clusters = findAllClusters(digits);
    
    for (let digit = 0; digit <= 9; digit++) {
      updatePatternForDigit(symbolData, digit, clusters, symbol);
    }
    
    updateClusterVisualization(symbolData);
  }, []);

  const findAllClusters = useCallback((digits: number[]) => {
    const clusters = [];
    
    for (let digit = 0; digit <= 9; digit++) {
      const digitClusters = [];
      let i = 0;
      
      while (i < digits.length) {
        if (digits[i] === digit) {
          let start = i;
          let end = i;
          
          while (end + 1 < digits.length && digits[end + 1] === digit) {
            end++;
          }
          
          if (end - start + 1 >= 2) {
            digitClusters.push({
              start,
              end,
              size: end - start + 1,
              digit
            });
          }
          
          i = end + 1;
        } else {
          i++;
        }
      }
      
      if (digitClusters.length > 0) {
        clusters.push({
          digit,
          clusters: digitClusters
        });
      }
    }
    
    return clusters;
  }, []);

  const updatePatternForDigit = useCallback((symbolData: VolatilityData, digit: number, allClusters: any[], symbol: string) => {
    const tracking = symbolData.patternTracking[digit];
    const digits = symbolData.digits;
    const digitData = allClusters.find(d => d.digit === digit);
    const clusters = digitData ? digitData.clusters : [];
    
    if (clusters.length === 0) {
      if (tracking.isActive && digits[digits.length - 1] !== digit) {
        if (tracking.currentClusters >= 2) {
          recordPatternEnd(tracking.currentClusters);
        }
        tracking.isActive = false;
        tracking.currentClusters = 0;
        tracking.lastClusterEnd = -1;
        tracking.waitingForSingle = false;
      }
      return;
    }
    
    const latestCluster = clusters[clusters.length - 1];
    
    if (!tracking.isActive) {
      tracking.isActive = true;
      tracking.currentClusters = clusters.length;
      tracking.lastClusterEnd = latestCluster.end;
    } else {
      const newClusterCount = clusters.length;
      
      if (newClusterCount > tracking.currentClusters) {
        const previousCluster = clusters[newClusterCount - 2];
        
        if (hasSoloDigitBetweenClusters(digits, previousCluster.end, latestCluster.start, digit)) {
          if (tracking.currentClusters >= 2) {
            recordPatternEnd(tracking.currentClusters);
          }
          tracking.currentClusters = 1;
        } else {
          tracking.currentClusters = newClusterCount;
        }
        
        tracking.lastClusterEnd = latestCluster.end;
        
        if (tracking.currentClusters === connectionSettings.alertThreshold) {
          triggerAlert(symbol, digit, tracking.currentClusters);
        }
      }
    }

    // Check for single digit after threshold clusters
    if (tracking.currentClusters === connectionSettings.alertThreshold && !tracking.waitingForSingle) {
      const lastIndex = digits.length - 1;
      if (lastIndex > tracking.lastClusterEnd && digits[lastIndex] === digit) {
        const isSingleDigit = (lastIndex === 0 || digits[lastIndex - 1] !== digit) && 
                             (lastIndex === digits.length - 1 || digits[lastIndex + 1] !== digit);
        if (isSingleDigit) {
          tracking.waitingForSingle = true;
          setPendingTrade({ symbol, digit });
          addAlert(`Waiting for single digit ${digit} on ${symbol.replace('_', ' ')} for auto-trade`, 'warning');
        }
      }
    }
  }, [connectionSettings.alertThreshold, addAlert]);

  const hasSoloDigitBetweenClusters = useCallback((digits: number[], clusterEnd: number, nextClusterStart: number, digit: number) => {
    for (let i = clusterEnd + 1; i < nextClusterStart; i++) {
      if (digits[i] === digit) {
        return true;
      }
    }
    return false;
  }, []);

  const recordPatternEnd = useCallback((clusterCount: number) => {
    if (clusterCount >= 2 && clusterCount <= 6) {
      setStatistics(prev => ({
        ...prev,
        [clusterCount]: prev[clusterCount] + 1
      }));
    }
  }, []);

  const updateClusterVisualization = useCallback((symbolData: VolatilityData) => {
    const digits = symbolData.digits;
    const visualization: ClusterVisualization[] = [];
    
    for (let i = 0; i < digits.length; i++) {
      const digit = digits[i];
      const clusterSize = getClusterSizeAtPosition(digits, i, digit);
      visualization.push({
        digit,
        clusterSize
      });
    }
    
    symbolData.clusterVisualization = visualization;
  }, []);

  const getClusterSizeAtPosition = useCallback((digits: number[], position: number, digit: number) => {
    if (digits[position] !== digit) return 0;
    
    let start = position;
    let end = position;
    
    while (start > 0 && digits[start - 1] === digit) {
      start--;
    }
    
    while (end < digits.length - 1 && digits[end + 1] === digit) {
      end++;
    }
    
    const clusterSize = end - start + 1;
    return clusterSize >= 2 ? clusterSize : 0;
  }, []);

  const triggerAlert = useCallback((symbol: string, digit: number, clusterCount: number) => {
    const message = `Digit ${digit} reached ${clusterCount} clusters on ${symbol.replace('_', ' ')}`;
    
    // Speech synthesis
    if ('speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 0.8;
        utterance.pitch = 1.1;
        speechSynthesis.speak(utterance);
      } catch (error) {
        console.error('Speech synthesis error:', error);
      }
    }
    
    addAlert(message, 'warning');
    toast({
      title: "Pattern Alert!",
      description: message,
      variant: "destructive",
    });

    if (connectionSettings.autoTrade && connectionSettings.token && isConnected && clusterCount === 5) {
      setVolatilityData(prev => {
        const updated = { ...prev };
        updated[symbol].patternTracking[digit].waitingForSingle = true;
        return updated;
      });
      setPendingTrade({ symbol, digit });
      addAlert(`Auto-trade setup for ${symbol} digit ${digit}`, 'info');
    }
  }, [addAlert, toast, connectionSettings, isConnected]);

  const connect = useCallback(() => {
    if (!connectionSettings.appId || !/^\d+$/.test(connectionSettings.appId)) {
      toast({
        title: "Invalid App ID",
        description: "Please enter a valid numeric App ID",
        variant: "destructive",
      });
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=${connectionSettings.appId}`;
      socketRef.current = new WebSocket(wsUrl);
    } catch (error) {
      console.error('WebSocket creation error:', error);
      toast({
        title: "Connection Error",
        description: "Failed to create WebSocket connection",
        variant: "destructive",
      });
      return;
    }

    socketRef.current.onopen = () => {
      setIsConnected(true);
      setReconnectDelay(1000);
      addAlert('Connected to Deriv WebSocket', 'success');
      
      // Subscribe to all volatilities
      volatilities.forEach((vol, index) => {
        setTimeout(() => {
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            const subscribeMessage = {
              ticks: vol,
              subscribe: 1,
              req_id: index + 1
            };
            socketRef.current.send(JSON.stringify(subscribeMessage));
          }
        }, index * 200);
      });

      // Authorize if token is provided
      if (connectionSettings.token) {
        socketRef.current.send(JSON.stringify({ authorize: connectionSettings.token }));
      }
    };

    socketRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.tick) {
          processTick(data.tick);
        } else if (data.msg_type === 'authorize') {
          if (data.error) {
            addAlert(`Authorization error: ${data.error.message}`, 'error');
          } else {
            addAlert('Successfully authorized', 'success');
          }
        } else if (data.error) {
          console.error('API Error:', data.error);
          addAlert(`API Error: ${data.error.message}`, 'error');
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };

    socketRef.current.onclose = () => {
      setIsConnected(false);
      addAlert('WebSocket connection closed', 'warning');
      
      // Auto-reconnect
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
        setReconnectDelay(prev => Math.min(prev * 1.5, 30000));
      }, reconnectDelay);
    };

    socketRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      addAlert('WebSocket connection error', 'error');
    };
  }, [connectionSettings, reconnectDelay, processTick, addAlert, toast]);

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
    setPendingTrade(null);
    addAlert('Disconnected from WebSocket', 'info');
  }, [addAlert]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto p-4 space-y-6">
        {/* Header */}
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
              Real-time pattern detection across all volatility indices with automated trading
            </p>
          </div>
        </Card>

        {/* Connection Controls */}
        <ConnectionControls
          settings={connectionSettings}
          onSettingsChange={saveSettings}
          isConnected={isConnected}
          onConnect={connect}
          onDisconnect={disconnect}
          onResetStats={resetStatistics}
        />

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Volatility Cards */}
          <div className="xl:col-span-3 space-y-4">
            {volatilities.map(vol => (
              <VolatilityCard
                key={vol}
                symbol={vol}
                data={volatilityData[vol]}
                isSelected={vol === connectionSettings.selectedVolatility}
              />
            ))}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <StatisticsPanel statistics={statistics} />
            <AlertsLog alerts={alerts} />
          </div>
        </div>
      </div>
    </div>
  );
}
