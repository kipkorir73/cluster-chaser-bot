import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Target, Zap, AlertTriangle } from 'lucide-react';

interface Pattern {
  digit: number;
  clusters: number;
}

interface PatternInfoProps {
  patterns: Pattern[];
}

export function PatternInfo({ patterns }: PatternInfoProps) {
  if (patterns.length === 0) {
    return (
      <div className="flex items-center justify-center h-12 text-muted-foreground text-sm">
        <Target className="h-4 w-4 mr-2" />
        No active patterns detected
      </div>
    );
  }

  const getPatternIcon = (clusters: number) => {
    if (clusters >= 5) return <AlertTriangle className="h-3 w-3" />;
    if (clusters >= 4) return <Zap className="h-3 w-3" />;
    return <Target className="h-3 w-3" />;
  };

  const getPatternVariant = (clusters: number) => {
    if (clusters >= 5) return 'destructive';
    if (clusters >= 4) return 'secondary';
    if (clusters >= 3) return 'outline';
    return 'secondary';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Target className="h-4 w-4" />
        Active Patterns
      </div>
      
      <div className="flex flex-wrap gap-2">
        {patterns.map(({ digit, clusters }) => (
          <Badge
            key={digit}
            variant={getPatternVariant(clusters)}
            className={`flex items-center gap-1 ${
              clusters >= 5 ? 'animate-pulse-slow shadow-glow' :
              clusters >= 4 ? 'animate-bounce-subtle' :
              ''
            }`}
          >
            {getPatternIcon(clusters)}
            <span className="font-mono">
              {digit}: {clusters}
            </span>
          </Badge>
        ))}
      </div>

      {/* Pattern Summary */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/30">
        <span>
          {patterns.length} pattern{patterns.length !== 1 ? 's' : ''} active
        </span>
        {patterns.some(p => p.clusters >= 5) && (
          <span className="text-destructive font-medium animate-pulse">
            ⚠️ High Alert
          </span>
        )}
        {patterns.some(p => p.clusters >= 4) && !patterns.some(p => p.clusters >= 5) && (
          <span className="text-warning font-medium">
            🔶 Medium Alert
          </span>
        )}
      </div>
    </div>
  );
}