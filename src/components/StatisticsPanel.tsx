import React from 'react';
import { Card } from '@/components/ui/card';
import { BarChart3, TrendingUp } from 'lucide-react';

interface StatisticsPanelProps {
  statistics: Record<number, number>;
}

export function StatisticsPanel({ statistics }: StatisticsPanelProps) {
  const total = Object.values(statistics).reduce((sum, count) => sum + count, 0);
  const maxValue = Math.max(...Object.values(statistics), 1);

  const getStatColor = (clusters: number) => {
    switch (clusters) {
      case 2: return 'text-cluster-2';
      case 3: return 'text-cluster-3';
      case 4: return 'text-cluster-4';
      case 5: return 'text-cluster-5';
      case 6: return 'text-cluster-6';
      default: return 'text-muted-foreground';
    }
  };

  const getStatBg = (clusters: number) => {
    switch (clusters) {
      case 2: return 'bg-cluster-2/20';
      case 3: return 'bg-cluster-3/20';
      case 4: return 'bg-cluster-4/20';
      case 5: return 'bg-cluster-5/20';
      case 6: return 'bg-cluster-6/20';
      default: return 'bg-muted/20';
    }
  };

  return (
    <Card className="p-6 bg-card/30 backdrop-blur-sm border-border/50">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Pattern Statistics</h3>
      </div>

      <div className="space-y-3">
        {Object.entries(statistics).map(([clusters, count]) => {
          const clusterNum = parseInt(clusters);
          const percentage = total > 0 ? (count / total) * 100 : 0;
          const barWidth = maxValue > 0 ? (count / maxValue) * 100 : 0;

          return (
            <div key={clusters} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Ended at {clusters}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-xl font-bold ${getStatColor(clusterNum)}`}>
                    {count}
                  </span>
                  {percentage > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {percentage.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${getStatBg(clusterNum)} rounded-full`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-border/30">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            Total Patterns
          </div>
          <span className="font-bold text-lg text-primary">
            {total}
          </span>
        </div>
        
        {total > 0 && (
          <div className="mt-2 text-xs text-muted-foreground">
            Most common: {Object.entries(statistics)
              .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'} clusters
          </div>
        )}
      </div>
    </Card>
  );
}