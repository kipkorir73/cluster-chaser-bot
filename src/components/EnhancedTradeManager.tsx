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
    contractType: 'DIGITDIFF' | 'DIGITOVER' | 'DIGITUNDER' | 'DIGITEVEN' | 'DIGITODD';
    tradeAmount: number;
    tradeDuration: number;
    minClusterSize: number;
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
  autoTradeSettings
}: EnhancedTradeManagerProps) {
  const { toast } = useToast();

  const executeAutoTradeOnClusterDetection = useCallback(async (
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

    try {
      let tradeParams = {};
      let contractDescription = '';

      // Determine trade parameters based on contract type
      switch (autoTradeSettings.contractType) {
        case 'DIGITDIFF':
          // DIGITDIFF strategy: Next digit will be different from the detected digit
          tradeParams = {
            contract_type: 'DIGITDIFF',
            barrier: detectedDigit.toString()
          };
          contractDescription = `DIGITDIFF from ${detectedDigit}`;
          await executeSingleTrade(symbol, tradeParams, contractDescription, detectedDigit, clusterSize);
          break;

        case 'DIGITOVER':
          tradeParams = {
            contract_type: 'DIGITOVER',
            barrier: detectedDigit.toString()
          };
          contractDescription = `DIGITOVER ${detectedDigit}`;
          await executeSingleTrade(symbol, tradeParams, contractDescription, detectedDigit, clusterSize);
          break;

        case 'DIGITUNDER':
          tradeParams = {
            contract_type: 'DIGITUNDER',
            barrier: detectedDigit.toString()
          };
          contractDescription = `DIGITUNDER ${detectedDigit}`;
          await executeSingleTrade(symbol, tradeParams, contractDescription, detectedDigit, clusterSize);
          break;

        case 'DIGITEVEN':
          tradeParams = {
            contract_type: 'DIGITEVEN'
          };
          contractDescription = 'DIGITEVEN';
          await executeSingleTrade(symbol, tradeParams, contractDescription, detectedDigit, clusterSize);
          break;

        case 'DIGITODD':
          tradeParams = {
            contract_type: 'DIGITODD'
          };
          contractDescription = 'DIGITODD';
          await executeSingleTrade(symbol, tradeParams, contractDescription, detectedDigit, clusterSize);
          break;
      }

      return true;

    } catch (error) {
      toast({
        title: "Auto-Trade Error",
        description: `Failed to execute auto-trade: ${error}`,
        variant: "destructive"
      });
      
      onAlert({
        id: `auto_trade_error_${Date.now()}`,
        message: `❌ Auto-trade failed for ${symbol}: ${error}`,
        timestamp: new Date(),
        type: 'error' as const
      });

      return false;
    }
  }, [isConnected, wsRef, selectedAccount, autoTradeSettings, toast, onTradeExecuted, onAlert]);

  const executeSingleTrade = useCallback(async (
    symbol: string,
    tradeParams: any,
    contractDescription: string,
    detectedDigit: number,
    clusterSize: number
  ) => {
    const proposalRequest = {
      proposal: 1,
      amount: autoTradeSettings.tradeAmount,
      basis: 'stake',
      currency: selectedAccount!.currency,
      duration: autoTradeSettings.tradeDuration,
      duration_unit: 't',
      symbol: symbol,
      ...tradeParams
    };

    // Send proposal request
    wsRef.current!.send(JSON.stringify(proposalRequest));

    // Execute buy request after a short delay to allow proposal processing
    setTimeout(() => {
      if (wsRef.current) {
        const buyRequest = {
          buy: 1,
          price: autoTradeSettings.tradeAmount,
          parameters: {
            symbol: symbol,
            duration: autoTradeSettings.tradeDuration,
            duration_unit: 't',
            amount: autoTradeSettings.tradeAmount,
            basis: 'stake',
            currency: selectedAccount!.currency,
            ...tradeParams
          }
        };

        wsRef.current.send(JSON.stringify(buyRequest));
      }
    }, 200);

    const tradeResult = {
      id: `auto_${Date.now()}`,
      symbol: symbol,
      contract_type: tradeParams.contract_type,
      barrier: tradeParams.barrier || 'N/A',
      stake: autoTradeSettings.tradeAmount,
      duration: autoTradeSettings.tradeDuration,
      account: selectedAccount!.loginid,
      cluster_detected: detectedDigit,
      cluster_size: clusterSize,
      timestamp: new Date().toISOString(),
      status: 'executed'
    };

    onTradeExecuted(tradeResult);
    
    onAlert({
      id: `auto_trade_${Date.now()}`,
      message: `🚀 AUTO-TRADE: ${contractDescription} on ${symbol} after cluster of ${clusterSize} × ${detectedDigit}`,
      timestamp: new Date(),
      type: 'success' as const
    });

    toast({
      title: "Auto-Trade Executed",
      description: `${contractDescription} on ${symbol}`,
      variant: "default"
    });
  }, [autoTradeSettings, selectedAccount, wsRef, onTradeExecuted, onAlert, toast]);

  const executeManualTrade = useCallback(async (
    symbol: string,
    contractType: string,
    barrier?: string,
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
      let tradeParams: any = {
        contract_type: contractType
      };

      if (barrier) {
        tradeParams.barrier = barrier;
      }

      const buyRequest = {
        buy: 1,
        price: tradeStake,
        parameters: {
          symbol: symbol,
          duration: autoTradeSettings.tradeDuration,
          duration_unit: 't',
          amount: tradeStake,
          basis: 'stake',
          currency: selectedAccount.currency,
          ...tradeParams
        }
      };

      wsRef.current.send(JSON.stringify(buyRequest));

      const tradeResult = {
        id: `manual_${Date.now()}`,
        symbol: symbol,
        contract_type: contractType,
        barrier: barrier || 'N/A',
        stake: tradeStake,
        duration: autoTradeSettings.tradeDuration,
        account: selectedAccount.loginid,
        timestamp: new Date().toISOString(),
        status: 'executed'
      };

      onTradeExecuted(tradeResult);
      
      toast({
        title: "Manual Trade Executed",
        description: `${contractType} on ${symbol}${barrier ? ` - ${barrier}` : ''}`,
        variant: "default"
      });

      return true;

    } catch (error) {
      toast({
        title: "Trade Execution Error",
        description: `Failed to execute trade: ${error}`,
        variant: "destructive"
      });
      return false;
    }
  }, [isConnected, wsRef, selectedAccount, autoTradeSettings, toast, onTradeExecuted]);

  return {
    executeAutoTradeOnClusterDetection,
    executeManualTrade
  };
}