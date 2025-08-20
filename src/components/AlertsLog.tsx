import React from 'react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bell, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

interface AlertItem {
  id: string;
  message: string;
  timestamp: Date;
  type: 'info' | 'warning' | 'success' | 'error';
}

interface AlertsLogProps {
  alerts: AlertItem[];
}

export function AlertsLog({ alerts }: AlertsLogProps) {
  const getAlertIcon = (type: AlertItem['type']) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'error':
        return <X className="h-4 w-4 text-destructive" />;
      default:
        return <Info className="h-4 w-4 text-info" />;
    }
  };

  const getAlertVariant = (type: AlertItem['type']) => {
    switch (type) {
      case 'warning':
        return 'secondary';
      case 'success':
        return 'default';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getAlertBorder = (type: AlertItem['type']) => {
    switch (type) {
      case 'warning':
        return 'border-l-warning';
      case 'success':
        return 'border-l-success';
      case 'error':
        return 'border-l-destructive';
      default:
        return 'border-l-info';
    }
  };

  return (
    <Card className="p-6 bg-card/30 backdrop-blur-sm border-border/50">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Recent Alerts</h3>
        {alerts.length > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {alerts.length}
          </Badge>
        )}
      </div>

      <ScrollArea className="h-80">
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <div className="text-center">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No alerts yet</p>
              </div>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`
                  p-3 rounded-lg border-l-4 bg-background/30 backdrop-blur-sm 
                  transition-all duration-300 hover:bg-background/50
                  animate-slide-in
                  ${getAlertBorder(alert.type)}
                `}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getAlertIcon(alert.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-relaxed">
                      {alert.message}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <Badge 
                        variant={getAlertVariant(alert.type)} 
                        className="text-xs"
                      >
                        {alert.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {alert.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Quick Actions */}
      {alerts.some(alert => alert.type === 'warning' || alert.type === 'error') && (
        <div className="mt-4 pt-4 border-t border-border/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {alerts.filter(a => a.type === 'warning').length} warnings, {' '}
              {alerts.filter(a => a.type === 'error').length} errors
            </span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-warning rounded-full animate-pulse" />
              <span>Active monitoring</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}