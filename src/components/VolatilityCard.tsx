import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DigitStream } from './DigitStream';
import { PatternInfo } from './PatternInfo';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

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

interface VolatilityCardProps {
  symbol: string;
  data?: VolatilityData;
  isSelected: boolean;
  autoTradeSettings?: {
    minClusterSize: number;
  };
}

export function VolatilityCard({ symbol, data, isSelected, autoTradeSettings }: VolatilityCardProps) {
  // Enhanced display names for all volatility indices
  const getDisplayName = (symbol: string) => {
    const nameMap: Record<string, string> = {
      'R_10': 'Volatility 10',
      'R_25': 'Volatility 25',
      'R_50': 'Volatility 50', 
      'R_75': 'Volatility 75',
      'R_100': 'Volatility 100',
      'RDBEAR': 'Bear Market',
      'RDBULL': 'Bull Market',
      '1HZ10V': 'Volatility 10 (1s)',
      '1HZ25V': 'Volatility 25 (1s)',
      '1HZ50V': 'Volatility 50 (1s)',
      '1HZ75V': 'Volatility 75 (1s)',
      '1HZ100V': 'Volatility 100 (1s)',
      '1HZ150V': 'Volatility 150 (1s)',
      '1HZ200V': 'Volatility 200 (1s)',
      '1HZ250V': 'Volatility 250 (1s)',
      '1HZ300V': 'Volatility 300 (1s)',
      'BOOM300N': 'Boom 300',
      'BOOM500N': 'Boom 500',
      'BOOM1000N': 'Boom 1000',
      'CRASH300N': 'Crash 300',
      'CRASH500N': 'Crash 500',
      'CRASH1000N': 'Crash 1000',
      'JD10': 'Jump 10',
      'JD25': 'Jump 25',
      'JD75': 'Jump 75',
      'JD100': 'Jump 100',
      'JD150': 'Jump 150',
      'JD200': 'Jump 200'
    };
    return nameMap[symbol] || symbol.replace('_', ' ');
  };
  
  const displayName = getDisplayName(symbol);
  const lastTick = data?.lastTick;
  
  // Calculate trend based on recent digits
  const getTrend = () => {
    if (!data?.digits || data.digits.length < 2) return 'neutral';
    const recent = data.digits.slice(-3);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    if (avg > 5.5) return 'up';
    if (avg < 4.5) return 'down';
    return 'neutral';
  };

  const trend = getTrend();
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  // Get active patterns
  const activePatterns = data ? Object.entries(data.patternTracking)
    .filter(([_, tracking]) => tracking.isActive && tracking.currentClusters >= 1)
    .map(([digit, tracking]) => ({ digit: parseInt(digit), clusters: tracking.currentClusters }))
    .sort((a, b) => b.clusters - a.clusters) : [];

  return (
    <Card className={`p-6 transition-all duration-300 ${
      isSelected 
        ? 'bg-gradient-primary border-primary shadow-glow' 
        : 'bg-card/30 backdrop-blur-sm border-border/50 hover:border-border hover:bg-card/50'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold">{displayName}</h3>
          <TrendIcon className={`h-5 w-5 ${
            trend === 'up' ? 'text-success' : 
            trend === 'down' ? 'text-destructive' : 
            'text-muted-foreground'
          }`} />
        </div>
        
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Last Tick</div>
          <div className="text-lg font-mono font-bold text-primary">
            {lastTick ? lastTick.toFixed(5) : '--'}
          </div>
        </div>
      </div>

      {/* Digit Stream */}
      <div className="mb-4">
        <DigitStream visualization={data?.clusterVisualization || []} />
      </div>

      {/* Pattern Information */}
      <PatternInfo patterns={activePatterns} />

      {/* Quick Stats - Enhanced cluster visualization */}
      {activePatterns.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border/30">
          <div className="flex gap-2 flex-wrap">
            {activePatterns.slice(0, 3).map(({ digit, clusters }) => (
              <Badge
                key={digit}
                variant="secondary"
                className={`transition-all duration-300 ${
                  clusters >= 6 ? 'bg-cluster-6 text-white animate-pulse-slow shadow-glow' :
                  clusters >= 5 ? 'bg-cluster-5 text-white animate-bounce-subtle' :
                  clusters >= 4 ? 'bg-cluster-4 text-white' :
                  clusters >= 3 ? 'bg-cluster-3 text-black font-bold' :
                  'bg-cluster-2 text-black'
                }`}
              >
                <span className="font-mono">
                  Digit {digit}: {clusters} cluster{clusters > 1 ? 's' : ''}
                </span>
                {clusters >= autoTradeSettings?.minClusterSize && (
                  <span className="ml-1 text-xs">🎯</span>
                )}
              </Badge>
            ))}
            {activePatterns.length > 3 && (
              <Badge variant="outline" className="animate-fade-in">
                +{activePatterns.length - 3} more patterns
              </Badge>
            )}
          </div>
          
          {/* Trade readiness indicator */}
          {activePatterns.some(p => p.clusters >= 3) && (
            <div className="mt-3 p-2 bg-gradient-primary/10 border border-primary/30 rounded-md">
              <p className="text-xs text-primary font-medium flex items-center gap-1">
                <span className="animate-pulse-slow">🚨</span>
                High-probability trade signals detected!
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}