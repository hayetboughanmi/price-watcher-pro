import { useState, useCallback } from 'react';
import Sidebar, { View } from '@/components/dashboard/Sidebar';
import StatsCards from '@/components/dashboard/StatsCards';
import ProductTable from '@/components/dashboard/ProductTable';
import AlertsList from '@/components/dashboard/AlertsList';
import PriceChart from '@/components/dashboard/PriceChart';
import MonitoringControls from '@/components/dashboard/MonitoringControls';
import AddProductDialog from '@/components/dashboard/AddProductDialog';
import { mockProducts, mockPriceHistory, mockAlerts, mockMonitoringStatus } from '@/data/mockData';
import { Product, PriceAlert, MonitoringStatus } from '@/types';
import { motion } from 'framer-motion';

const Index = () => {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [alerts, setAlerts] = useState<PriceAlert[]>(mockAlerts);
  const [monitoring, setMonitoring] = useState<MonitoringStatus>(mockMonitoringStatus);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(mockProducts[0]);

  const unreadAlerts = alerts.filter(a => !a.isRead).length;

  const handleAddProduct = useCallback((product: Omit<Product, 'id' | 'addedAt'>) => {
    const newProduct: Product = {
      ...product,
      id: Date.now().toString(),
      addedAt: new Date().toISOString(),
    };
    setProducts(prev => [...prev, newProduct]);
  }, []);

  const handleRemoveProduct = useCallback((id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    if (selectedProduct?.id === id) setSelectedProduct(null);
  }, [selectedProduct]);

  const handleMarkRead = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
  }, []);

  const handleMarkAllRead = useCallback(() => {
    setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
  }, []);

  const handleManualCheck = useCallback(() => {
    setMonitoring(prev => ({
      ...prev,
      lastCheck: new Date().toISOString(),
      nextCheck: new Date(Date.now() + 3600000).toISOString(),
      totalChecks: prev.totalChecks + 1,
    }));
  }, []);

  const handleToggleAuto = useCallback((enabled: boolean) => {
    setMonitoring(prev => ({ ...prev, isAutoMonitoring: enabled }));
  }, []);

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
            <AddProductDialog onAdd={handleAddProduct} />
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
                  <PriceChart product={selectedProduct} prices={mockPriceHistory} />
                </div>
                <div className="space-y-6">
                  <MonitoringControls
                    status={monitoring}
                    onManualCheck={handleManualCheck}
                    onToggleAuto={handleToggleAuto}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <ProductTable
                    products={products}
                    prices={mockPriceHistory}
                    onRemove={handleRemoveProduct}
                    onSelect={setSelectedProduct}
                  />
                </div>
                <AlertsList
                  alerts={alerts}
                  onMarkRead={handleMarkRead}
                  onMarkAllRead={handleMarkAllRead}
                />
              </div>
            </motion.div>
          )}

          {activeView === 'products' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ProductTable
                products={products}
                prices={mockPriceHistory}
                onRemove={handleRemoveProduct}
                onSelect={setSelectedProduct}
              />
            </motion.div>
          )}

          {activeView === 'alerts' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl">
              <AlertsList
                alerts={alerts}
                onMarkRead={handleMarkRead}
                onMarkAllRead={handleMarkAllRead}
              />
            </motion.div>
          )}

          {activeView === 'analytics' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <PriceChart product={selectedProduct} prices={mockPriceHistory} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {products.slice(0, 4).map(p => (
                  <div key={p.id} className="cursor-pointer" onClick={() => setSelectedProduct(p)}>
                    <PriceChart product={p} prices={mockPriceHistory} />
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
                  <p>Pour activer le backend (Tavily + base de données), connectez Lovable Cloud.</p>
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
