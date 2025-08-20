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
}

export function VolatilityCard({ symbol, data, isSelected }: VolatilityCardProps) {
  const displayName = symbol.replace('_', ' ');
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

      {/* Quick Stats */}
      {activePatterns.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border/30">
          <div className="flex gap-2 flex-wrap">
            {activePatterns.slice(0, 3).map(({ digit, clusters }) => (
              <Badge
                key={digit}
                variant="secondary"
                className={`${
                  clusters >= 5 ? 'bg-destructive text-destructive-foreground animate-pulse-slow' :
                  clusters >= 4 ? 'bg-warning text-warning-foreground' :
                  clusters >= 3 ? 'bg-info text-info-foreground' :
                  'bg-secondary text-secondary-foreground'
                }`}
              >
                Digit {digit}: {clusters} clusters
              </Badge>
            ))}
            {activePatterns.length > 3 && (
              <Badge variant="outline">
                +{activePatterns.length - 3} more
              </Badge>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}