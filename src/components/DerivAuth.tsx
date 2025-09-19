import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface DerivAuthProps {
  onAuthChange: (isAuthenticated: boolean, token: string, selectedAccount: DerivAccount | null) => void;
  isConnected: boolean;
}

export function DerivAuth({ onAuthChange, isConnected }: DerivAuthProps) {
  const { toast } = useToast();
  const [authSettings, setAuthSettings] = useState<AuthSettings>({
    appId: ((import.meta as any)?.env?.VITE_DERIV_APP_ID as string) || '101679',
    apiToken: '',
    scopes: ((import.meta as any)?.env?.VITE_DERIV_SCOPES as string) || 'read,trade'
  });
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accounts, setAccounts] = useState<DerivAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<DerivAccount | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const authenticateWithDeriv = async (incomingToken?: string) => {
    const tokenToUse = incomingToken || authSettings.apiToken;
    if (!tokenToUse) {
      toast({
        title: "Missing API Token",
        description: "Please enter your Deriv API token",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Create WebSocket connection to Deriv API
      const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=' + authSettings.appId);
      
      ws.onopen = () => {
        // Send authorization request
        ws.send(JSON.stringify({
          authorize: tokenToUse
        }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.msg_type === 'authorize') {
          if (data.error) {
            toast({
              title: "Authentication Failed",
              description: data.error.message,
              variant: "destructive"
            });
            setIsLoading(false);
            ws.close();
            return;
          }

          // Request login list and balance
          ws.send(JSON.stringify({ login_list: 1 }));
          ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
        }

        // Populate accounts from login_list
        if (data.msg_type === 'login_list' && Array.isArray(data.login_list)) {
          try {
            const list = data.login_list as Array<any>;
            const parsed: DerivAccount[] = list.map((itm) => ({
              loginid: String(itm.loginid),
              currency: typeof itm.currency === 'string' ? itm.currency : 'USD',
              is_demo: String(itm.loginid).startsWith('VRT'),
              balance: 0,
              account_type: String(itm.loginid).startsWith('VRT') ? 'demo' : 'real',
              country: 'unknown'
            }));
            setAccounts(parsed);
            if (!selectedAccount && parsed.length > 0) {
              setSelectedAccount(parsed[0]);
            }
          } catch {}
        }

        if (data.msg_type === 'balance') {
          // Parse account information
          const accountInfo: DerivAccount = {
            loginid: data.balance.loginid,
            currency: data.balance.currency,
            is_demo: data.balance.loginid.startsWith('VRT'),
            balance: parseFloat(data.balance.balance),
            account_type: data.balance.loginid.startsWith('VRT') ? 'demo' : 'real',
            country: 'unknown'
          };

          setAccounts((prev) => {
            const existing = prev.find(a => a.loginid === accountInfo.loginid);
            if (existing) {
              // Update balance and currency
              return prev.map(a => a.loginid === accountInfo.loginid ? { ...a, balance: accountInfo.balance, currency: accountInfo.currency } : a);
            }
            return [accountInfo, ...prev];
          });
          setSelectedAccount((prev) => prev && prev.loginid !== accountInfo.loginid ? prev : accountInfo);
          setIsAuthenticated(true);
          setIsLoading(false);
          
          toast({
            title: "Authentication Successful",
            description: `Connected to ${accountInfo.is_demo ? 'Demo' : 'Real'} account: ${accountInfo.loginid}`,
            variant: "default"
          });

          onAuthChange(true, authSettings.apiToken, accountInfo);
          ws.close();
        }

        if (data.error) {
          toast({
            title: "Error",
            description: data.error.message,
            variant: "destructive"
          });
          setIsLoading(false);
          ws.close();
        }
      };

      ws.onerror = (error) => {
        toast({
          title: "Connection Error",
          description: "Failed to connect to Deriv API",
          variant: "destructive"
        });
        setIsLoading(false);
      };

    } catch (error) {
      toast({
        title: "Authentication Error",
        description: "Failed to authenticate with Deriv",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  };

  const logout = () => {
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

  // OAuth login: redirect to Deriv OAuth with appId and current URL as redirect_uri
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

  // On mount, parse token returned from OAuth (query or hash) and auto-authenticate
  useEffect(() => {
    try {
      const parse = (s: string) => new URLSearchParams(s.startsWith('#') || s.startsWith('?') ? s.slice(1) : s);
      const qs = parse(window.location.search);
      const hs = parse(window.location.hash);
      // Parse multiple account tokens if present (acct1, token1, acct2, token2, ...)
      const collected: { loginid: string; token: string }[] = [];
      let index = 1;
      while (true) {
        const acctKey = `acct${index}`;
        const tokenKey = `token${index}`;
        const acct = qs.get(acctKey) || hs.get(acctKey);
        const tok = qs.get(tokenKey) || hs.get(tokenKey);
        if (!acct || !tok) break;
        collected.push({ loginid: acct, token: tok });
        index++;
      }

      // Fallback single token
      const singleToken = qs.get('token1') || qs.get('token') || qs.get('access_token') || hs.get('token1') || hs.get('token') || hs.get('access_token');

      if (!isAuthenticated && (collected.length > 0 || singleToken)) {
        if (collected.length > 0) {
          // Populate accounts from collected list
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
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch {
      // ignore
    }
  }, [isAuthenticated]);

  const handleAccountChange = (loginid: string) => {
    const account = accounts.find(acc => acc.loginid === loginid);
    if (!account) return;

    setSelectedAccount(account);
    const tokenToUse = account.token || authSettings.apiToken;
    setAuthSettings(prev => ({ ...prev, apiToken: tokenToUse }));
    onAuthChange(true, tokenToUse, account);

    // Switch account via WebSocket authorize call using the same token; Deriv will set active loginid
    try {
      const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=' + authSettings.appId);
      ws.onopen = () => {
        ws.send(JSON.stringify({ authorize: tokenToUse }));
      };
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.msg_type === 'authorize' && data.authorize && data.authorize.loginid === account.loginid) {
          toast({
            title: "Account Switched",
            description: `Active account: ${account.loginid}`,
            variant: "default"
          });
          ws.close();
        }
      };
      ws.onerror = () => ws.close();
    } catch {}
  };

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50">
      <div className="flex items-center gap-2 mb-4">
        <User className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Deriv Authentication</h2>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appId" className="text-sm font-medium">
                App ID
              </Label>
              <Input
                id="appId"
                type="text"
                placeholder="1089"
                value={authSettings.appId}
                onChange={(e) => setAuthSettings(prev => ({ ...prev, appId: e.target.value }))}
                className="bg-background/50"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="apiToken" className="text-sm font-medium">
                API Token
              </Label>
              <Input
                id="apiToken"
                type="password"
                placeholder="Enter your Deriv API token"
                value={authSettings.apiToken}
                onChange={(e) => setAuthSettings(prev => ({ ...prev, apiToken: e.target.value }))}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oauthScopes" className="text-sm font-medium">
                OAuth Scopes
              </Label>
              <Input
                id="oauthScopes"
                type="text"
                placeholder="read,trade,payments"
                value={authSettings.scopes}
                onChange={(e) => setAuthSettings(prev => ({ ...prev, scopes: e.target.value }))}
                className="bg-background/50"
              />
              <p className="text-[10px] text-muted-foreground">
                Your app_id must permit the scopes requested. Use the maximum you need.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button 
              onClick={authenticateWithDeriv}
              disabled={isLoading || !authSettings.apiToken || isConnected}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Authenticating...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Login to Deriv
                </>
              )}
            </Button>
            <Button
              onClick={handleOAuthLogin}
              variant="outline"
              disabled={isLoading || isConnected}
              className="w-full"
            >
              <LogIn className="h-4 w-4 mr-2" />
              Login with Deriv (OAuth)
            </Button>
            
            <p className="text-xs text-muted-foreground text-center">
              Get your API token from{' '}
              <a 
                href="https://app.deriv.com/account/api-token" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Deriv API Token page
              </a>
            </p>
          </div>
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
            disabled={isConnected}
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