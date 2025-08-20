import React from 'react';
import { cn } from '@/lib/utils';

interface ClusterVisualization {
  digit: number;
  clusterSize: number;
}

interface DigitStreamProps {
  visualization: ClusterVisualization[];
}

export function DigitStream({ visualization }: DigitStreamProps) {
  if (!visualization.length) {
    return (
      <div className="flex items-center justify-center h-16 text-muted-foreground">
        Waiting for data...
      </div>
    );
  }

  const getDigitClassName = (clusterSize: number) => {
    if (clusterSize === 0) return '';
    
    switch (Math.min(clusterSize, 6)) {
      case 2:
        return 'bg-cluster-2 text-black shadow-md animate-fade-in';
      case 3:
        return 'bg-cluster-3 text-white shadow-md animate-fade-in';
      case 4:
        return 'bg-cluster-4 text-white shadow-lg animate-fade-in border-2 border-cluster-4/50';
      case 5:
        return 'bg-cluster-5 text-white shadow-lg animate-bounce-subtle border-2 border-cluster-5/50';
      case 6:
        return 'bg-cluster-6 text-white shadow-xl animate-pulse-slow border-2 border-cluster-6/70 shadow-glow';
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-wrap gap-2 min-h-16 items-center p-4 bg-background/20 rounded-lg border border-border/30">
      {visualization.map((item, index) => (
        <div
          key={index}
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-lg font-mono text-lg font-bold transition-all duration-300',
            'bg-muted/50 text-foreground hover:scale-110',
            getDigitClassName(item.clusterSize)
          )}
          title={item.clusterSize >= 2 ? `Digit ${item.digit} in cluster of ${item.clusterSize}` : `Single digit ${item.digit}`}
        >
          {item.digit}
        </div>
      ))}
      
      {visualization.length === 0 && (
        <div className="flex items-center justify-center w-full h-16 text-muted-foreground">
          No digits yet
        </div>
      )}
      
      {visualization.length > 0 && (
        <div className="flex items-center ml-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse mr-2" />
          Live
        </div>
      )}
    </div>
  );
}