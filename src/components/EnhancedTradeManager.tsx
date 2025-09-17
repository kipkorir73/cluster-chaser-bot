import React, { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface DerivAccount {
  loginid: string;
  currency: string;
  is_demo: boolean;
  balance: number;
  account_type: string;
  country: string;
}

interface TradeConfig {
  symbol: string;
  digit: number;
  stake: number;
  duration: number;
  duration_unit: string;
}

interface EnhancedTradeManagerProps {
  isConnected: boolean;
  authToken: string;
  wsRef: React.RefObject<WebSocket>;
  selectedAccount: DerivAccount | null;
  onTradeExecuted: (tradeInfo: any) => void;
  onAlert: (alert: any) => void;
  volatilityIndices: string[];
  autoTradeSettings: {
    enabled: boolean;
    tradeAmount: number;
    tradeDuration: number;
    minClusterSize: number;
  };
  paperSettings: {
    enabled: boolean;
  };
}

export function EnhancedTradeManager({
  isConnected,
  authToken,
  wsRef,
  selectedAccount,
  onTradeExecuted,
  onAlert,
  volatilityIndices,
  autoTradeSettings,
  paperSettings
}: EnhancedTradeManagerProps) {
  const { toast } = useToast();

  const executeDigitDiffersTradeForAllDigits = useCallback(async (
    symbol: string,
    detectedDigit: number,
    clusterSize: number
  ) => {
    if (!isConnected || !wsRef.current || !selectedAccount) {
      toast({
        title: "Cannot Execute Trade",
        description: "Not connected to Deriv or no account selected",
        variant: "destructive"
      });
      return false;
    }

    if (clusterSize < autoTradeSettings.minClusterSize) {
      return false;
    }

    // All digits from 0-9
    const allDigits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    
    // Get digits different from the detected cluster digit
    const targetDigits = allDigits.filter(digit => digit !== detectedDigit);
    
    try {
      for (const targetDigit of targetDigits) {
        const tradeConfig: TradeConfig = {
          symbol: symbol,
          digit: targetDigit,
          stake: autoTradeSettings.tradeAmount,
          duration: autoTradeSettings.tradeDuration,
          duration_unit: 'tick'
        };

        if (paperSettings.enabled) {
          // Paper trading - simulate the trade
          const paperTradeResult = {
            id: `paper_${Date.now()}_${targetDigit}`,
            symbol: symbol,
            digit: targetDigit,
            stake: tradeConfig.stake,
            duration: tradeConfig.duration,
            account: selectedAccount.loginid,
            type: 'DIGITDIFF',
            cluster_detected: detectedDigit,
            cluster_size: clusterSize,
            timestamp: new Date().toISOString(),
            status: 'simulated'
          };

          onTradeExecuted(paperTradeResult);
          
          onAlert({
            id: `paper_trade_${Date.now()}_${targetDigit}`,
            message: `📊 Paper Trade: DIGITDIFF ${symbol} - Target: ${targetDigit}, After cluster of ${clusterSize} x ${detectedDigit}`,
            timestamp: new Date(),
            type: 'info' as const
          });

          // Simulate API call for logging (if backend exists)
          try {
            const response = await fetch('/api/trades', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(paperTradeResult)
            });
          } catch (error) {
            // Backend not available, continue with frontend-only operation
          }

        } else {
          // Real trading
          const proposalRequest = {
            proposal: 1,
            amount: tradeConfig.stake,
            basis: 'stake',
            contract_type: 'DIGITDIFF',
            currency: selectedAccount.currency,
            duration: tradeConfig.duration,
            duration_unit: tradeConfig.duration_unit,
            symbol: tradeConfig.symbol,
            barrier: targetDigit.toString()
          };

          // Send proposal request
          wsRef.current.send(JSON.stringify(proposalRequest));

          // Wait for proposal response and then buy
          const buyRequest = {
            buy: 1,
            price: tradeConfig.stake,
            parameters: {
              contract_type: 'DIGITDIFF',
              symbol: tradeConfig.symbol,
              barrier: targetDigit.toString(),
              duration: tradeConfig.duration,
              duration_unit: tradeConfig.duration_unit,
              amount: tradeConfig.stake,
              basis: 'stake'
            }
          };

          // For real trades, we'll send the buy request after a short delay
          // In a production app, you'd want to wait for the proposal response
          setTimeout(() => {
            if (wsRef.current) {
              wsRef.current.send(JSON.stringify(buyRequest));
            }
          }, 100);

          const realTradeResult = {
            id: `real_${Date.now()}_${targetDigit}`,
            symbol: symbol,
            digit: targetDigit,
            stake: tradeConfig.stake,
            duration: tradeConfig.duration,
            account: selectedAccount.loginid,
            type: 'DIGITDIFF',
            cluster_detected: detectedDigit,
            cluster_size: clusterSize,
            timestamp: new Date().toISOString(),
            status: 'executed'
          };

          onTradeExecuted(realTradeResult);
          
          onAlert({
            id: `real_trade_${Date.now()}_${targetDigit}`,
            message: `💰 Real Trade: DIGITDIFF ${symbol} - Target: ${targetDigit}, Stake: ${tradeConfig.stake} ${selectedAccount.currency}`,
            timestamp: new Date(),
            type: 'success' as const
          });
        }

        // Small delay between trades to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      toast({
        title: paperSettings.enabled ? "Paper Trades Executed" : "Trades Executed",
        description: `Placed ${targetDigits.length} DIGITDIFF trades for ${symbol} targeting digits other than ${detectedDigit}`,
        variant: "default"
      });

      return true;

    } catch (error) {
      toast({
        title: "Trade Execution Error",
        description: `Failed to execute trades: ${error}`,
        variant: "destructive"
      });
      
      onAlert({
        id: `trade_error_${Date.now()}`,
        message: `❌ Trade execution failed for ${symbol}: ${error}`,
        timestamp: new Date(),
        type: 'error' as const
      });

      return false;
    }
  }, [isConnected, wsRef, selectedAccount, autoTradeSettings, paperSettings, toast, onTradeExecuted, onAlert]);

  const executeSingleDigitDiffersTradeForSymbol = useCallback(async (
    symbol: string,
    targetDigit: number,
    stake?: number
  ) => {
    if (!isConnected || !wsRef.current || !selectedAccount) {
      toast({
        title: "Cannot Execute Trade",
        description: "Not connected to Deriv or no account selected",
        variant: "destructive"
      });
      return false;
    }

    const tradeStake = stake || autoTradeSettings.tradeAmount;

    try {
      const tradeConfig: TradeConfig = {
        symbol: symbol,
        digit: targetDigit,
        stake: tradeStake,
        duration: autoTradeSettings.tradeDuration,
        duration_unit: 'tick'
      };

      if (paperSettings.enabled) {
        // Paper trading
        const paperTradeResult = {
          id: `paper_single_${Date.now()}`,
          symbol: symbol,
          digit: targetDigit,
          stake: tradeStake,
          duration: tradeConfig.duration,
          account: selectedAccount.loginid,
          type: 'DIGITDIFF',
          timestamp: new Date().toISOString(),
          status: 'simulated'
        };

        onTradeExecuted(paperTradeResult);
        
        toast({
          title: "Paper Trade Executed",
          description: `DIGITDIFF ${symbol} - Target: ${targetDigit}`,
          variant: "default"
        });

      } else {
        // Real trading
        const buyRequest = {
          buy: 1,
          price: tradeStake,
          parameters: {
            contract_type: 'DIGITDIFF',
            symbol: symbol,
            barrier: targetDigit.toString(),
            duration: tradeConfig.duration,
            duration_unit: tradeConfig.duration_unit,
            amount: tradeStake,
            basis: 'stake'
          }
        };

        wsRef.current.send(JSON.stringify(buyRequest));

        const realTradeResult = {
          id: `real_single_${Date.now()}`,
          symbol: symbol,
          digit: targetDigit,
          stake: tradeStake,
          duration: tradeConfig.duration,
          account: selectedAccount.loginid,
          type: 'DIGITDIFF',
          timestamp: new Date().toISOString(),
          status: 'executed'
        };

        onTradeExecuted(realTradeResult);
        
        toast({
          title: "Real Trade Executed",
          description: `DIGITDIFF ${symbol} - Target: ${targetDigit}, Stake: ${tradeStake} ${selectedAccount.currency}`,
          variant: "default"
        });
      }

      return true;

    } catch (error) {
      toast({
        title: "Trade Execution Error",
        description: `Failed to execute trade: ${error}`,
        variant: "destructive"
      });
      return false;
    }
  }, [isConnected, wsRef, selectedAccount, autoTradeSettings, paperSettings, toast, onTradeExecuted]);

  return {
    executeDigitDiffersTradeForAllDigits,
    executeSingleDigitDiffersTradeForSymbol
  };
}