import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { RefreshCw, Zap, Clock, Activity } from 'lucide-react';
import { MonitoringStatus } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useState } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface MonitoringControlsProps {
  status: MonitoringStatus;
  onManualCheck: () => void;
  onToggleAuto: (enabled: boolean) => void;
}

const MonitoringControls = ({ status, onManualCheck, onToggleAuto }: MonitoringControlsProps) => {
  const [isChecking, setIsChecking] = useState(false);

  const handleManualCheck = async () => {
    setIsChecking(true);
    toast.info('🔍 Vérification des prix en cours...');
    // Simulate check
    setTimeout(() => {
      setIsChecking(false);
      onManualCheck();
      toast.success('✅ Prix mis à jour avec succès !');
    }, 2000);
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Monitoring
          </CardTitle>
          <Badge className={status.isAutoMonitoring 
            ? 'gradient-accent text-accent-foreground border-0 animate-pulse-glow' 
            : 'bg-muted text-muted-foreground'
          }>
            {status.isAutoMonitoring ? '● Auto ON' : '○ Auto OFF'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-warning" />
            <span className="text-sm font-medium">Monitoring Auto (1h)</span>
          </div>
          <Switch 
            checked={status.isAutoMonitoring} 
            onCheckedChange={onToggleAuto} 
          />
        </div>

        <motion.div whileTap={{ scale: 0.98 }}>
          <Button 
            onClick={handleManualCheck} 
            disabled={isChecking}
            className="w-full gradient-primary text-primary-foreground border-0 h-11"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Vérification en cours...' : 'Vérification Manuelle'}
          </Button>
        </motion.div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Dernière vérif.
            </span>
            <span className="font-mono text-xs">
              {status.lastCheck ? format(new Date(status.lastCheck), 'dd/MM HH:mm', { locale: fr }) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Prochaine vérif.
            </span>
            <span className="font-mono text-xs">
              {status.nextCheck ? format(new Date(status.nextCheck), 'dd/MM HH:mm', { locale: fr }) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Total vérifications</span>
            <span className="font-mono font-bold">{status.totalChecks}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MonitoringControls;
