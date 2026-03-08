import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Product, PriceEntry, PriceAlert, MonitoringStatus, StoreName } from '@/types';
import { toast } from 'sonner';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<PriceEntry[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [monitoring, setMonitoring] = useState<MonitoringStatus>({
    isAutoMonitoring: true,
    lastCheck: null,
    nextCheck: null,
    totalChecks: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [productsRes, pricesRes, alertsRes, monitoringRes] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('price_entries').select('*').order('checked_at', { ascending: false }),
      supabase.from('price_alerts').select('*').order('created_at', { ascending: false }),
      supabase.from('monitoring_status').select('*').limit(1).single(),
    ]);

    if (productsRes.data) {
      setProducts(productsRes.data.map((p: any) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        imageUrl: p.image_url,
        urls: (p.urls || {}) as Partial<Record<StoreName, string>>,
        addedAt: p.created_at,
        isMonitored: p.is_monitored,
      })));
    }

    if (pricesRes.data) {
      setPrices(pricesRes.data.map((p: any) => ({
        id: p.id,
        productId: p.product_id,
        store: p.store as StoreName,
        price: Number(p.price),
        currency: p.currency,
        checkedAt: p.checked_at,
      })));
    }

    if (alertsRes.data) {
      setAlerts(alertsRes.data.map((a: any) => ({
        id: a.id,
        productId: a.product_id,
        productName: a.product_name,
        store: a.store as StoreName,
        oldPrice: Number(a.old_price),
        newPrice: Number(a.new_price),
        changePercent: Number(a.change_percent),
        direction: a.direction as 'up' | 'down',
        recommendation: a.recommendation || '',
        createdAt: a.created_at,
        isRead: a.is_read,
      })));
    }

    if (monitoringRes.data) {
      const m = monitoringRes.data as any;
      setMonitoring({
        isAutoMonitoring: m.is_auto_monitoring,
        lastCheck: m.last_check,
        nextCheck: m.next_check,
        totalChecks: m.total_checks,
      });
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addProduct = useCallback(async (product: Omit<Product, 'id' | 'addedAt'>) => {
    const { error } = await supabase.from('products').insert({
      name: product.name,
      category: product.category,
      urls: product.urls,
      is_monitored: product.isMonitored,
    });
    if (error) { toast.error('Erreur lors de l\'ajout'); return; }
    await fetchAll();
    // Auto-check prices for the new product
    try {
      await checkPrices();
      toast.success('📊 Prix récupérés automatiquement !');
    } catch {
      // Silently fail — user can manually check later
    }
  }, [fetchAll, checkPrices]);

  const removeProduct = useCallback(async (id: string) => {
    await supabase.from('products').delete().eq('id', id);
    await fetchAll();
  }, [fetchAll]);

  const markAlertRead = useCallback(async (id: string) => {
    await supabase.from('price_alerts').update({ is_read: true }).eq('id', id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
  }, []);

  const markAllAlertsRead = useCallback(async () => {
    await supabase.from('price_alerts').update({ is_read: true }).eq('is_read', false);
    setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
  }, []);

  const toggleAutoMonitoring = useCallback(async (enabled: boolean) => {
    const { data: row } = await supabase.from('monitoring_status').select('id').limit(1).single();
    if (row) {
      await supabase.from('monitoring_status').update({ is_auto_monitoring: enabled }).eq('id', (row as any).id);
    }
    setMonitoring(prev => ({ ...prev, isAutoMonitoring: enabled }));
  }, []);

  const checkPrices = useCallback(async () => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await fetch(`https://${projectId}.supabase.co/functions/v1/check-prices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Check failed');
    await fetchAll();
    return data;
  }, [fetchAll]);

  return {
    products, prices, alerts, monitoring, loading,
    addProduct, removeProduct, markAlertRead, markAllAlertsRead,
    toggleAutoMonitoring, checkPrices, refetch: fetchAll,
  };
}
