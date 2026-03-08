import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, TrendingDown, TrendingUp, CheckCheck } from 'lucide-react';
import { PriceAlert, STORE_CONFIG } from '@/types';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AlertsListProps {
  alerts: PriceAlert[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

const AlertsList = ({ alerts, onMarkRead, onMarkAllRead }: AlertsListProps) => {
  const unreadCount = alerts.filter(a => !a.isRead).length;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle className="font-display text-lg">Alertes Prix</CardTitle>
          {unreadCount > 0 && (
            <Badge className="gradient-primary text-primary-foreground border-0 text-xs">{unreadCount}</Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onMarkAllRead} className="text-xs">
            <CheckCheck className="h-3.5 w-3.5 mr-1" /> Tout lire
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Aucune alerte pour le moment</p>
          </div>
        ) : (
          alerts.map((alert, i) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
                alert.isRead 
                  ? 'bg-muted/30 border-border/30' 
                  : 'bg-card border-primary/20 shadow-sm'
              }`}
              onClick={() => onMarkRead(alert.id)}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg shrink-0 ${
                  alert.direction === 'down' ? 'bg-success/10' : 'bg-destructive/10'
                }`}>
                  {alert.direction === 'down' 
                    ? <TrendingDown className="h-4 w-4 text-success" />
                    : <TrendingUp className="h-4 w-4 text-destructive" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">{alert.productName}</span>
                    {!alert.isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">{STORE_CONFIG[alert.store].label}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {alert.oldPrice.toLocaleString()} → {alert.newPrice.toLocaleString()} TND
                    </span>
                    <Badge className={`text-xs border-0 ${
                      alert.direction === 'down' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                    }`}>
                      {alert.changePercent > 0 ? '+' : ''}{alert.changePercent.toFixed(1)}%
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{alert.recommendation}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true, locale: fr })}
                  </p>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default AlertsList;
