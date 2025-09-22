import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LogIn, LogOut, User, DollarSign, TestTube } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DerivAccount {
  loginid: string;
  currency: string;
  is_demo: boolean;
  balance: number;
  account_type: string;
  country: string;
  token?: string;
}

interface AuthSettings {
  appId: string;
  apiToken: string;
  scopes: string;
}

interface ImportMetaEnv {
  VITE_DERIV_APP_ID?: string;
  VITE_DERIV_SCOPES?: string;
}

interface DerivAuthProps {
  onAuthChange: (isAuthenticated: boolean, token: string, selectedAccount: DerivAccount | null) => void;
  isConnected: boolean;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 1000;

export function DerivAuth({ onAuthChange, isConnected }: DerivAuthProps) {
  const { toast } = useToast();
  const env = import.meta.env as ImportMetaEnv;
  const [authSettings, setAuthSettings] = useState<AuthSettings>({
    appId: env.VITE_DERIV_APP_ID || '101679',
    apiToken: '',
    scopes: env.VITE_DERIV_SCOPES || 'read,trade'
  });
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accounts, setAccounts] = useState<DerivAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<DerivAccount | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Validate appId
  useEffect(() => {
    const appIdTrimmed = String(authSettings.appId).trim();
    if (!/^[0-9]+$/.test(appIdTrimmed)) {
      toast({
        title: "Configuration Error",
        description: "Enter a valid numeric Deriv app_id or set VITE_DERIV_APP_ID.",
        variant: "destructive"
      });
    }
  }, [authSettings.appId, toast]);

  const closeWebSocket = useCallback(() => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      closeWebSocket();
    };
  }, [closeWebSocket]);

  const sendPing = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ ping: 1 }));
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      const pingInterval = setInterval(sendPing, 30000);
      return () => clearInterval(pingInterval);
    }
  }, [isAuthenticated, sendPing]);

  const authenticateWithDeriv = useCallback(async (incomingToken?: string, attempt = 1) => {
    const tokenToUse = incomingToken || authSettings.apiToken;
    if (!tokenToUse) {
      toast({
        title: "Not Authenticated",
        description: "Please login via Deriv to continue",
        variant: "destructive"
      });
      return;
    }

    if (!authSettings.appId || !/^[0-9]+$/.test(authSettings.appId)) {
      toast({
        title: "Configuration Error",
        description: "Invalid or missing Deriv app_id.",
        variant: "destructive"
      });
      return;
    }

    closeWebSocket();
    setIsLoading(true);

    try {
      // Use the same WebSocket endpoint for both demo and real accounts
      // The app_id is used for authorization, not for determining connection endpoint
      wsRef.current = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${authSettings.appId}`);
      const ws = wsRef.current;

      ws.onopen = () => {
        ws.send(JSON.stringify({ authorize: tokenToUse }));
      };

      ws.onmessage = async (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          toast({
            title: "WebSocket Error",
            description: "Failed to parse WebSocket message",
            variant: "destructive"
          });
          return;
        }

        if (data.msg_type === 'authorize') {
          if (data.error) {
            toast({
              title: "Authentication Failed",
              description: data.error.message,
              variant: "destructive"
            });
            setIsLoading(false);
            if (attempt < MAX_RECONNECT_ATTEMPTS) {
              setTimeout(() => authenticateWithDeriv(tokenToUse, attempt + 1), RECONNECT_DELAY * attempt);
            } else {
              ws.close();
            }
            return;
          }

          try {
            const auth = data.authorize || {};
            if (Array.isArray(auth.account_list)) {
              const parsed: DerivAccount[] = auth.account_list.map((itm: any) => ({
                loginid: String(itm.loginid),
                currency: typeof itm.currency === 'string' ? itm.currency : 'USD',
                is_demo: String(itm.loginid).startsWith('VRT'),
                balance: 0,
                account_type: String(itm.loginid).startsWith('VRT') ? 'demo' : 'real',
                country: itm.landing_company_fullname || 'unknown',
                token: tokenToUse
              }));

              setAccounts(parsed);

              // Fetch balances sequentially for all accounts
              for (const account of parsed) {
                if (ws.readyState !== WebSocket.OPEN) break;
                await new Promise(resolve => setTimeout(resolve, 200));
                ws.send(JSON.stringify({ set_account: account.loginid }));
                await new Promise(resolve => setTimeout(resolve, 200));
                ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
              }

              if (!selectedAccount && parsed.length > 0) {
                const defaultAccount = parsed.find(a => !a.is_demo) || parsed[0];
                setSelectedAccount(defaultAccount);
                onAuthChange(true, tokenToUse, defaultAccount);
              }
            }
          } catch (error) {
            console.error('Error processing account list:', error);
            toast({
              title: "Error",
              description: "Failed to process account list",
              variant: "destructive"
            });
          }
        }

        if (data.msg_type === 'balance' && data.balance) {
          const accountInfo: DerivAccount = {
            loginid: data.balance.loginid,
            currency: data.balance.currency || 'USD',
            is_demo: data.balance.loginid.startsWith('VRT'),
            balance: parseFloat(data.balance.balance || '0'),
            account_type: data.balance.loginid.startsWith('VRT') ? 'demo' : 'real',
            country: 'unknown',
            token: tokenToUse
          };

          setAccounts(prevAccounts => {
            const updated = prevAccounts.map(a =>
              a.loginid === accountInfo.loginid
                ? { ...a, balance: accountInfo.balance, currency: accountInfo.currency }
                : a
            );
            return updated.length === prevAccounts.length ? updated : [...prevAccounts, accountInfo];
          });

          if (selectedAccount?.loginid === accountInfo.loginid) {
            setSelectedAccount(prev => prev ? { ...prev, balance: accountInfo.balance, currency: accountInfo.currency } : accountInfo);
            onAuthChange(true, tokenToUse, { ...accountInfo });
            toast({
              title: "Balance Updated",
              description: `Account ${accountInfo.loginid} balance: ${accountInfo.currency} ${accountInfo.balance.toFixed(2)}`,
              variant: "default"
            });
          }

          setIsAuthenticated(true);
          setIsLoading(false);
        }

        if (data.error) {
          toast({
            title: "Error",
            description: data.error.message,
            variant: "destructive"
          });
          setIsLoading(false);
          if (attempt < MAX_RECONNECT_ATTEMPTS) {
            setTimeout(() => authenticateWithDeriv(tokenToUse, attempt + 1), RECONNECT_DELAY * attempt);
          } else {
            ws.close();
          }
        }
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        if (attempt < MAX_RECONNECT_ATTEMPTS && isAuthenticated) {
          setTimeout(() => authenticateWithDeriv(tokenToUse, attempt + 1), RECONNECT_DELAY * attempt);
        } else {
          toast({
            title: "Connection Lost",
            description: "Max reconnection attempts reached.",
            variant: "destructive"
          });
          setIsAuthenticated(false);
          onAuthChange(false, '', null);
        }
        setIsLoading(false);
      };

      ws.onerror = () => {
        console.error('WebSocket error');
        toast({
          title: "Connection Error",
          description: "Failed to connect to Deriv API",
          variant: "destructive"
        });
        setIsLoading(false);
        if (attempt < MAX_RECONNECT_ATTEMPTS) {
          setTimeout(() => authenticateWithDeriv(tokenToUse, attempt + 1), RECONNECT_DELAY * attempt);
        }
      };
    } catch (error) {
      console.error('Authentication setup error:', error);
      toast({
        title: "Authentication Error",
        description: "Failed to authenticate with Deriv",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  }, [authSettings, isAuthenticated, selectedAccount, onAuthChange, toast, closeWebSocket]);

  const logout = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      accounts.forEach(account => {
        wsRef.current?.send(JSON.stringify({ balance: 0, subscribe: 0 }));
      });
    }
    closeWebSocket();
    setIsAuthenticated(false);
    setAccounts([]);
    setSelectedAccount(null);
    setAuthSettings(prev => ({ ...prev, apiToken: '' }));
    onAuthChange(false, '', null);
    toast({
      title: "Logged Out",
      description: "Successfully logged out from Deriv",
      variant: "default"
    });
  };

  const handleOAuthLogin = () => {
    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    const appIdTrimmed = String(authSettings.appId).trim();
    if (!/^[0-9]+$/.test(appIdTrimmed)) {
      toast({
        title: "Missing app_id",
        description: "Enter a valid numeric Deriv app_id or set VITE_DERIV_APP_ID.",
        variant: "destructive"
      });
      return;
    }

    const state = Math.random().toString(36).slice(2);
    const params = new URLSearchParams({
      app_id: appIdTrimmed,
      scope: authSettings.scopes,
      redirect_uri: redirectUri,
      response_type: 'token',
      state
    });
    const url = `https://oauth.deriv.com/oauth2/authorize?${params.toString()}`;
    window.location.href = url;
  };

  useEffect(() => {
    if (isAuthenticated) return;

    try {
      const parse = (s: string) => new URLSearchParams(s.startsWith('#') || s.startsWith('?') ? s.slice(1) : s);
      const params = window.location.hash ? parse(window.location.hash) : parse(window.location.search);
      
      const collected: { loginid: string; token: string }[] = [];
      let index = 1;
      while (true) {
        const acctKey = `acct${index}`;
        const tokenKey = `token${index}`;
        const acct = params.get(acctKey);
        const tok = params.get(tokenKey);
        if (!acct || !tok) break;
        collected.push({ loginid: acct, token: tok });
        index++;
      }

      const singleToken = params.get('token1') || params.get('token') || params.get('access_token');

      if (collected.length > 0 || singleToken) {
        if (collected.length > 0) {
          const parsedAccounts: DerivAccount[] = collected.map(({ loginid, token }) => ({
            loginid,
            currency: 'USD',
            is_demo: loginid.startsWith('VRT'),
            balance: 0,
            account_type: loginid.startsWith('VRT') ? 'demo' : 'real',
            country: 'unknown',
            token
          }));
          setAccounts(parsedAccounts);
          const preferred = parsedAccounts.find(a => !a.is_demo) || parsedAccounts[0];
          setSelectedAccount(preferred);
          setAuthSettings(prev => ({ ...prev, apiToken: preferred.token || '' }));
          void authenticateWithDeriv(preferred.token);
        } else if (singleToken) {
          setAuthSettings(prev => ({ ...prev, apiToken: singleToken }));
          void authenticateWithDeriv(singleToken);
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (error) {
      console.error('OAuth token parsing error:', error);
      toast({
        title: "OAuth Error",
        description: "Failed to parse OAuth token",
        variant: "destructive"
      });
    }
  }, [isAuthenticated, authenticateWithDeriv, toast]);

  const handleAccountChange = async (loginid: string) => {
    const account = accounts.find(a => a.loginid === loginid);
    if (account && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (selectedAccount && selectedAccount.loginid !== loginid) {
        wsRef.current.send(JSON.stringify({ balance: 0, subscribe: 0 }));
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
      wsRef.current.send(JSON.stringify({ set_account: loginid }));
      await new Promise(resolve => setTimeout(resolve, 200));
      wsRef.current.send(JSON.stringify({ balance: 1, subscribe: 1 }));

      setSelectedAccount(account);
      onAuthChange(true, account.token || authSettings.apiToken, account);

      toast({
        title: "Account Switched",
        description: `Active account: ${account.loginid}`,
        variant: "default"
      });
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 backdrop-blur-sm border-border/50 shadow-2xl">
      <div className="flex items-center gap-2 mb-4">
        <User className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-green-600">🚀 Deriv Authentication (Hot Reload Test)</h2>
        <Badge variant={isAuthenticated ? "default" : "secondary"} className="ml-auto">
          {isAuthenticated ? (
            <>
              <LogIn className="h-3 w-3 mr-1" />
              Authenticated
            </>
          ) : (
            <>
              <LogOut className="h-3 w-3 mr-1" />
              Not Authenticated
            </>
          )}
        </Badge>
      </div>

      {!isAuthenticated ? (
        <div className="space-y-4">
          <Button
            onClick={handleOAuthLogin}
            disabled={isLoading || isConnected}
            className="w-full"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Redirecting to Deriv...
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4 mr-2" />
                Login with Deriv
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            You will be redirected to Deriv to authorize this app.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Selected Account</Label>
              <Select value={selectedAccount?.loginid || ''} onValueChange={handleAccountChange}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.loginid} value={account.loginid}>
                      <div className="flex items-center gap-2">
                        {account.is_demo ? (
                          <TestTube className="h-4 w-4 text-blue-500" />
                        ) : (
                          <DollarSign className="h-4 w-4 text-green-500" />
                        )}
                        <span>{account.loginid}</span>
                        <span className="text-xs text-muted-foreground">
                          ({account.currency} {account.balance.toFixed(2)})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Account Type</Label>
              <div className="flex items-center gap-2 p-2 bg-background/50 rounded-md">
                {selectedAccount?.is_demo ? (
                  <>
                    <TestTube className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Demo Account</span>
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Real Account</span>
                  </>
                )}
                <Badge variant="outline" className="ml-auto">
                  {selectedAccount?.currency} {selectedAccount?.balance.toFixed(2)}
                </Badge>
              </div>
            </div>
          </div>

          <Button 
            onClick={logout}
            variant="outline"
            disabled={isConnected || isLoading}
            className="w-full"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      )}
    </Card>
  );
}