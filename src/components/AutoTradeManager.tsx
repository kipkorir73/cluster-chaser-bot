import React, { useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface TradeInfo {
  symbol: string;
  contract_type: 'DIGITDIFF';
  amount: number;
  duration: number;
  target_digit: number;
  paper: boolean;
  timestamp: number;
}

interface AutoTradeManagerProps {
  isConnected: boolean;
  token: string;
  socketRef: React.MutableRefObject<WebSocket | null>;
  onTradeExecuted: (trade: TradeInfo) => void;
  onAddAlert: (message: string, type: 'info' | 'warning' | 'success' | 'error') => void;
  volatilityIndices: string[];
  paperTrading: boolean;
}

export function AutoTradeManager({ 
  isConnected, 
  token, 
  socketRef, 
  onTradeExecuted, 
  onAddAlert,
  volatilityIndices,
  paperTrading
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
    
    for (const symbol of volatilityIndices) {
      try {
        const requestId = tradeRequestIdRef.current++;
        
        if (paperTrading) {
          const simulated: TradeInfo = {
            symbol,
            contract_type: 'DIGITDIFF',
            amount,
            duration,
            target_digit: targetDigit,
            paper: true,
            timestamp: Date.now()
          };
          onTradeExecuted(simulated);
          // Log to backend
          try {
            await fetch('/api/trades', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(simulated)
            });
          } catch {}
          onAddAlert(
            `Paper trade: Digit Differs on ${symbol.replace('_', ' ')} - Target digit: ${targetDigit}`,
            'success'
          );
          toast({
            title: "Paper Trade Simulated",
            description: `Digit Differs on ${symbol.replace('_', ' ')} for digit ${targetDigit}`,
          });
        } else {
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
          
          // Wait a bit for proposal response, then buy (simplified)
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
              // Log to backend
              const realTrade: TradeInfo = {
                symbol,
                contract_type: 'DIGITDIFF',
                amount,
                duration,
                target_digit: targetDigit,
                paper: false,
                timestamp: Date.now()
              };
              try {
                void fetch('/api/trades', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(realTrade)
                });
              } catch {}
            }
          }, 500);
        }
        
        // Small delay between trades to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`Error executing trade for ${symbol}:`, error);
        onAddAlert(`Failed to execute trade for ${symbol}: ${String(error)}`, 'error');
      }
    }
  }, [isConnected, token, socketRef, onAddAlert, onTradeExecuted, toast, volatilityIndices, paperTrading]);

  return {
    executeDigitDiffersTradeForAllVolatilities
  };
}