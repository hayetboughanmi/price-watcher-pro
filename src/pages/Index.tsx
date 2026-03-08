import { useState } from 'react';
import Sidebar, { View } from '@/components/dashboard/Sidebar';
import StatsCards from '@/components/dashboard/StatsCards';
import ProductTable from '@/components/dashboard/ProductTable';
import AlertsList from '@/components/dashboard/AlertsList';
import PriceChart from '@/components/dashboard/PriceChart';
import MonitoringControls from '@/components/dashboard/MonitoringControls';
import AnalyticsView from '@/components/dashboard/AnalyticsView';
import AddProductDialog from '@/components/dashboard/AddProductDialog';
import { useProducts } from '@/hooks/useProducts';
import { Product } from '@/types';
import { motion } from 'framer-motion';

const Index = () => {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const {
    products, prices, alerts, monitoring, loading,
    addProduct, removeProduct, markAlertRead, markAllAlertsRead,
    toggleAutoMonitoring, checkPrices,
  } = useProducts();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const unreadAlerts = alerts.filter(a => !a.isRead).length;

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} unreadAlerts={unreadAlerts} />
      
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-display font-bold">
                {activeView === 'dashboard' && 'Dashboard'}
                {activeView === 'products' && 'Produits'}
                {activeView === 'alerts' && 'Alertes'}
                {activeView === 'analytics' && 'Analytique'}
                {activeView === 'settings' && 'Paramètres'}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Surveillance des prix — Tunisianet, Tunisiatech, SpaceNet, Wiki
              </p>
            </div>
            <AddProductDialog onAdd={addProduct} />
          </div>
        </header>

        <div className="p-6">
          {activeView === 'dashboard' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <StatsCards
                totalProducts={products.filter(p => p.isMonitored).length}
                activeAlerts={unreadAlerts}
                priceDrops={alerts.filter(a => a.direction === 'down').length}
                storesTracked={4}
              />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <PriceChart product={selectedProduct || products[0] || null} prices={prices} />
                </div>
                <div className="space-y-6">
                  <MonitoringControls
                    status={monitoring}
                    onManualCheck={checkPrices}
                    onToggleAuto={toggleAutoMonitoring}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <ProductTable
                    products={products}
                    prices={prices}
                    onRemove={removeProduct}
                    onSelect={handleSelectProduct}
                  />
                </div>
                <AlertsList
                  alerts={alerts}
                  onMarkRead={markAlertRead}
                  onMarkAllRead={markAllAlertsRead}
                />
              </div>
            </motion.div>
          )}

          {activeView === 'products' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ProductTable
                products={products}
                prices={prices}
                onRemove={removeProduct}
                onSelect={handleSelectProduct}
              />
            </motion.div>
          )}

          {activeView === 'alerts' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl">
              <AlertsList
                alerts={alerts}
                onMarkRead={markAlertRead}
                onMarkAllRead={markAllAlertsRead}
              />
            </motion.div>
          )}

          {activeView === 'analytics' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <PriceChart product={selectedProduct || products[0] || null} prices={prices} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {products.slice(0, 4).map(p => (
                  <div key={p.id} className="cursor-pointer" onClick={() => handleSelectProduct(p)}>
                    <PriceChart product={p} prices={prices} />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeView === 'settings' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="glass-card rounded-xl p-6 max-w-lg">
                <h2 className="font-display text-lg font-bold mb-4">Paramètres</h2>
                <div className="space-y-4 text-sm text-muted-foreground">
                  <p>⚙️ Configuration des alertes email et des préférences de monitoring à venir.</p>
                  <p>✅ Backend connecté — Tavily API active pour la recherche de prix.</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
