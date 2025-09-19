import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

interface PnLState {
  startingBalance: number | null;
  currentBalance: number | null;
  realizedPnL: number;
  openPnL: number;
  wins: number;
  losses: number;
  openTrades: number;
}

export function PnLPanel({ pnl }: { pnl: PnLState }) {
  const netPnL = (pnl.currentBalance !== null && pnl.startingBalance !== null)
    ? pnl.currentBalance - pnl.startingBalance
    : pnl.realizedPnL + pnl.openPnL;

  const pct = (pnl.currentBalance !== null && pnl.startingBalance !== null && pnl.startingBalance !== 0)
    ? (netPnL / pnl.startingBalance) * 100
    : 0;

  const netPositive = netPnL >= 0;

  const variant: 'default' | 'destructive' = netPositive ? 'default' : 'destructive';

  return (
    <Card className="p-6 bg-card/30 backdrop-blur-sm border-border/50">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">P&L</h3>
        <Badge variant={variant} className="ml-auto">
          {netPositive ? (
            <span className="flex items-center">
              <ArrowUpRight className="h-3 w-3 mr-1" />
              Profit
            </span>
          ) : (
            <span className="flex items-center">
              <ArrowDownRight className="h-3 w-3 mr-1" />
              Loss
            </span>
          )}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Starting Balance</div>
          <div className="text-lg font-bold">{pnl.startingBalance !== null ? pnl.startingBalance.toFixed(2) : '--'}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Current Balance</div>
          <div className="text-lg font-bold">{pnl.currentBalance !== null ? pnl.currentBalance.toFixed(2) : '--'}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Realized P&L</div>
          <div className={`text-lg font-bold ${pnl.realizedPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
            {pnl.realizedPnL.toFixed(2)}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Open P&L</div>
          <div className={`text-lg font-bold ${pnl.openPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
            {pnl.openPnL.toFixed(2)}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Net</div>
          <div className={`text-lg font-bold ${netPositive ? 'text-success' : 'text-destructive'}`}>
            {netPnL.toFixed(2)} ({pct.toFixed(2)}%)
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Open Trades</div>
          <div className="text-lg font-bold flex items-center gap-1">
            <Activity className="h-4 w-4 text-muted-foreground" />
            {pnl.openTrades}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between text-sm">
        <div>
          <span className="text-muted-foreground">Wins</span>{' '}
          <span className="font-bold">{pnl.wins}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Losses</span>{' '}
          <span className="font-bold">{pnl.losses}</span>
        </div>
      </div>
    </Card>
  );
}

