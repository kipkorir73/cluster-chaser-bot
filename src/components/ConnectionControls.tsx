import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, RotateCcw, Settings2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface ConnectionSettings {
  appId: string;
  alertThreshold: number;
  autoTrade: boolean;
  selectedVolatility: string;
  apiToken: string;
}

interface AutoTradeSettings {
  enabled: boolean;
  tradeAmount: number;
  tradeDuration: number;
  minClusterSize: number;
}

interface SoundSettings {
  enabled: boolean;
}

interface ConnectionControlsProps {
  settings: ConnectionSettings;
  onSettingsChange: (settings: Partial<ConnectionSettings>) => void;
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onResetStats: () => void;
  autoTradeSettings: AutoTradeSettings;
  onAutoTradeSettingsChange: (settings: Partial<AutoTradeSettings>) => void;
  soundSettings: SoundSettings;
  onSoundSettingsChange: (settings: Partial<SoundSettings>) => void;
}

export function ConnectionControls({
  settings,
  onSettingsChange,
  isConnected,
  onConnect,
  onDisconnect,
  onResetStats,
  autoTradeSettings,
  onAutoTradeSettingsChange,
  soundSettings,
  onSoundSettingsChange
}: ConnectionControlsProps) {
  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50">
      <div className="flex items-center gap-2 mb-4">
        <Settings2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Connection Settings</h2>
        <Badge variant={isConnected ? "default" : "secondary"} className="ml-auto">
          {isConnected ? (
            <>
              <Wifi className="h-3 w-3 mr-1" />
              Connected
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 mr-1" />
              Disconnected
            </>
          )}
        </Badge>
      </div>

      <div className="space-y-6">
        {/* Connection Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
        {/* App ID */}
        <div className="space-y-2">
          <Label htmlFor="appId" className="text-sm font-medium">
            App ID
          </Label>
          <Input
            id="appId"
            type="text"
            placeholder="Enter your Deriv app_id"
            value={settings.appId}
            onChange={(e) => onSettingsChange({ appId: e.target.value })}
            className="bg-background/50"
          />
        </div>

        {/* API Token */}
        <div className="space-y-2 col-span-2">
          <Label htmlFor="apiToken" className="text-sm font-medium">
            API Token (Optional)
          </Label>
          <Input
            id="apiToken"
            type="password"
            placeholder="Enter your Deriv API token (optional)"
            value={settings.apiToken}
            onChange={(e) => onSettingsChange({ apiToken: e.target.value })}
            className="bg-background/50"
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to use demo account. Get your token from{' '}
            <a 
              href="https://app.deriv.com/account/api-token" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              app.deriv.com
            </a>
          </p>
        </div>

        {/* Display Volatility */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Display Volatility</Label>
          <Select
            value={settings.selectedVolatility}
            onValueChange={(value) => onSettingsChange({ selectedVolatility: value })}
          >
            <SelectTrigger className="bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="R_10">Volatility 10</SelectItem>
              <SelectItem value="R_25">Volatility 25</SelectItem>
              <SelectItem value="R_50">Volatility 50</SelectItem>
              <SelectItem value="R_75">Volatility 75</SelectItem>
              <SelectItem value="R_100">Volatility 100</SelectItem>
              <SelectItem value="RDBEAR">Bear Market</SelectItem>
              <SelectItem value="RDBULL">Bull Market</SelectItem>
              <SelectItem value="1HZ10V">Volatility 10 (1s)</SelectItem>
              <SelectItem value="1HZ25V">Volatility 25 (1s)</SelectItem>
              <SelectItem value="1HZ50V">Volatility 50 (1s)</SelectItem>
              <SelectItem value="1HZ75V">Volatility 75 (1s)</SelectItem>
              <SelectItem value="1HZ100V">Volatility 100 (1s)</SelectItem>
              <SelectItem value="1HZ150V">Volatility 150 (1s)</SelectItem>
              <SelectItem value="1HZ200V">Volatility 200 (1s)</SelectItem>
              <SelectItem value="1HZ250V">Volatility 250 (1s)</SelectItem>
              <SelectItem value="1HZ300V">Volatility 300 (1s)</SelectItem>
              <SelectItem value="BOOM300N">Boom 300</SelectItem>
              <SelectItem value="BOOM500N">Boom 500</SelectItem>
              <SelectItem value="BOOM1000N">Boom 1000</SelectItem>
              <SelectItem value="CRASH300N">Crash 300</SelectItem>
              <SelectItem value="CRASH500N">Crash 500</SelectItem>
              <SelectItem value="CRASH1000N">Crash 1000</SelectItem>
              <SelectItem value="JD10">Jump 10</SelectItem>
              <SelectItem value="JD25">Jump 25</SelectItem>
              <SelectItem value="JD75">Jump 75</SelectItem>
              <SelectItem value="JD100">Jump 100</SelectItem>
              <SelectItem value="JD150">Jump 150</SelectItem>
              <SelectItem value="JD200">Jump 200</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Alert Threshold */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Alert Threshold</Label>
          <Select
            value={String(settings.alertThreshold)}
            onValueChange={(value) => onSettingsChange({ alertThreshold: parseInt(value) })}
          >
            <SelectTrigger className="bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 Clusters</SelectItem>
              <SelectItem value="3">3 Clusters</SelectItem>
              <SelectItem value="4">4 Clusters</SelectItem>
              <SelectItem value="5">5 Clusters</SelectItem>
              <SelectItem value="6">6 Clusters</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Auto Trade */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Auto Trade</Label>
          <div className="flex items-center space-x-2 h-10">
            <Switch
              checked={settings.autoTrade}
              onCheckedChange={(checked) => onSettingsChange({ autoTrade: checked })}
            />
            <span className="text-sm text-muted-foreground">
              {settings.autoTrade ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>

        {/* Sound Alerts */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Sound Alerts</Label>
          <div className="flex items-center space-x-2 h-10">
            <Switch
              checked={soundSettings.enabled}
              onCheckedChange={(checked) => onSoundSettingsChange({ enabled: checked })}
            />
            <span className="text-sm text-muted-foreground">
              {soundSettings.enabled ? 'Enabled' : 'Muted'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Actions</Label>
          <div className="flex gap-2">
            <Button
              onClick={isConnected ? onDisconnect : onConnect}
              variant={isConnected ? "destructive" : "default"}
              size="sm"
              className="flex-1"
            >
              {isConnected ? (
                <>
                  <WifiOff className="h-4 w-4 mr-1" />
                  Disconnect
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4 mr-1" />
                  Connect
                </>
              )}
            </Button>
            <Button
              onClick={onResetStats}
              variant="outline"
              size="sm"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        </div>

        <Separator />

        {/* Auto Trading Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-md font-semibold">Automated Trading Settings</h3>
            <Badge variant={autoTradeSettings.enabled ? "default" : "secondary"}>
              {autoTradeSettings.enabled ? "Active" : "Inactive"}
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Enable Auto Trade */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Auto Trading</Label>
              <div className="flex items-center space-x-2 h-10">
                <Switch
                  checked={autoTradeSettings.enabled}
                  onCheckedChange={(checked) => onAutoTradeSettingsChange({ enabled: checked })}
                />
                <span className="text-sm text-muted-foreground">
                  {autoTradeSettings.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            {/* Trade Amount */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Trade Amount ($)</Label>
              <Input
                type="number"
                min="0.35"
                max="50000"
                step="0.01"
                value={autoTradeSettings.tradeAmount}
                onChange={(e) => onAutoTradeSettingsChange({ tradeAmount: parseFloat(e.target.value) || 1 })}
                className="bg-background/50"
              />
            </div>

            {/* Trade Duration */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Duration (ticks)</Label>
              <Select
                value={String(autoTradeSettings.tradeDuration)}
                onValueChange={(value) => onAutoTradeSettingsChange({ tradeDuration: parseInt(value) })}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Tick</SelectItem>
                  <SelectItem value="2">2 Ticks</SelectItem>
                  <SelectItem value="3">3 Ticks</SelectItem>
                  <SelectItem value="4">4 Ticks</SelectItem>
                  <SelectItem value="5">5 Ticks</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Minimum Cluster Size */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Min Cluster Size</Label>
              <Select
                value={String(autoTradeSettings.minClusterSize)}
                onValueChange={(value) => onAutoTradeSettingsChange({ minClusterSize: parseInt(value) })}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 Clusters</SelectItem>
                  <SelectItem value="4">4 Clusters</SelectItem>
                  <SelectItem value="5">5 Clusters</SelectItem>
                  <SelectItem value="6">6 Clusters</SelectItem>
                  <SelectItem value="7">7 Clusters</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Strategy Description */}
          <div className="p-4 bg-muted/30 rounded-lg border border-border/30">
            <h4 className="text-sm font-medium mb-2">Strategy: Digit Differs After Cluster</h4>
            <p className="text-xs text-muted-foreground">
              When a digit reaches the minimum cluster size ({autoTradeSettings.minClusterSize} consecutive occurrences), 
              the system waits for that same digit to appear again as a single occurrence. When detected, 
              it automatically places "Digit Differs" trades on all volatility indices, betting that the next tick 
              will be different from the target digit.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}