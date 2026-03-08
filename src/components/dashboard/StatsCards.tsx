import { Card, CardContent } from '@/components/ui/card';
import { Package, Bell, TrendingDown, Store } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatsCardsProps {
  totalProducts: number;
  activeAlerts: number;
  priceDrops: number;
  storesTracked: number;
}

const StatsCards = ({ totalProducts, activeAlerts, priceDrops, storesTracked }: StatsCardsProps) => {
  const stats = [
    { label: 'Produits Surveillés', value: totalProducts, icon: Package, gradient: 'gradient-primary' },
    { label: 'Alertes Actives', value: activeAlerts, icon: Bell, gradient: 'gradient-accent' },
    { label: 'Baisses Détectées', value: priceDrops, icon: TrendingDown, className: 'bg-success' },
    { label: 'Sites Suivis', value: storesTracked, icon: Store, className: 'bg-warning' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
        >
          <Card className="glass-card overflow-hidden relative group hover:shadow-xl transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
                  <p className="text-3xl font-bold font-display mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-xl ${stat.gradient || stat.className}`}>
                  <stat.icon className="h-5 w-5 text-primary-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

export default StatsCards;
