import React, { useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface TradeRequest {
  symbol: string;
  digit: number;
  amount: number;
  duration: number;
  basis: 'stake' | 'payout';
}

interface AutoTradeManagerProps {
  isConnected: boolean;
  token: string;
  socketRef: React.MutableRefObject<WebSocket | null>;
  onTradeExecuted: (trade: any) => void;
  onAddAlert: (message: string, type: 'info' | 'warning' | 'success' | 'error') => void;
}

export function AutoTradeManager({ 
  isConnected, 
  token, 
  socketRef, 
  onTradeExecuted, 
  onAddAlert 
}: AutoTradeManagerProps) {
  const { toast } = useToast();
  const tradeRequestIdRef = useRef(1000);

  const executeDigitDiffersTradeForAllVolatilities = useCallback(async (
    targetDigit: number,
    amount: number = 1,
    duration: number = 1
  ) => {
    if (!isConnected || !token || !socketRef.current) {
      onAddAlert('Cannot execute trade: Not connected or no token provided', 'error');
      return;
    }

    // All Deriv volatility indices that support Digit Differs contract
    const volatilities = [
      'R_10', 'R_25', 'R_50', 'R_75', 'R_100',
      'RDBEAR', 'RDBULL',
      '1HZ10V', '1HZ25V', '1HZ50V', '1HZ75V', '1HZ100V', 
      '1HZ150V', '1HZ200V', '1HZ250V', '1HZ300V',
      'BOOM300N', 'BOOM500N', 'BOOM1000N',
      'CRASH300N', 'CRASH500N', 'CRASH1000N',
      'JD10', 'JD25', 'JD75', 'JD100', 'JD150', 'JD200'
    ];
    
    for (const symbol of volatilities) {
      try {
        const requestId = tradeRequestIdRef.current++;
        
        // Create the trade proposal first
        const proposalMessage = {
          proposal: 1,
          amount: amount,
          basis: 'stake',
          contract_type: 'DIGITDIFF',
          currency: 'USD',
          symbol: symbol,
          duration: duration,
          duration_unit: 't',
          barrier: targetDigit.toString(),
          req_id: requestId
        };

        // Send proposal
        socketRef.current.send(JSON.stringify(proposalMessage));
        
        // Wait a bit for proposal response, then buy
        setTimeout(() => {
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            const buyMessage = {
              buy: 1,
              price: amount,
              req_id: requestId + 1000
            };
            
            socketRef.current.send(JSON.stringify(buyMessage));
            
            onAddAlert(
              `Auto-trade executed: Digit Differs on ${symbol.replace('_', ' ')} - Target digit: ${targetDigit}`,
              'success'
            );
            
            toast({
              title: "Auto Trade Executed",
              description: `Digit Differs trade placed on ${symbol.replace('_', ' ')} for digit ${targetDigit}`,
            });
          }
        }, 500);
        
        // Small delay between trades to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`Error executing trade for ${symbol}:`, error);
        onAddAlert(`Failed to execute trade for ${symbol}: ${error}`, 'error');
      }
    }
  }, [isConnected, token, socketRef, onAddAlert, onTradeExecuted, toast]);

  return {
    executeDigitDiffersTradeForAllVolatilities
  };
}