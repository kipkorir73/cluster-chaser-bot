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
  token: string;
  alertThreshold: number;
  autoTrade: boolean;
  selectedVolatility: string;
}

interface AutoTradeSettings {
  enabled: boolean;
  tradeAmount: number;
  tradeDuration: number;
  minClusterSize: number;
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
}

export function ConnectionControls({
  settings,
  onSettingsChange,
  isConnected,
  onConnect,
  onDisconnect,
  onResetStats,
  autoTradeSettings,
  onAutoTradeSettingsChange
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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
        <div className="space-y-2">
          <Label htmlFor="token" className="text-sm font-medium">
            API Token
          </Label>
          <Input
            id="token"
            type="password"
            placeholder="Enter your Deriv API token"
            value={settings.token}
            onChange={(e) => onSettingsChange({ token: e.target.value })}
            className="bg-background/50"
          />
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
            </SelectContent>
          </Select>
        </div>

        {/* Alert Threshold */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Alert Threshold</Label>
          <Select
            value={settings.alertThreshold.toString()}
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
                value={autoTradeSettings.tradeDuration.toString()}
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
                value={autoTradeSettings.minClusterSize.toString()}
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