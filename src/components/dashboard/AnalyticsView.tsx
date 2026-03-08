import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { Product, PriceEntry, STORE_CONFIG, StoreName } from '@/types';
import { format } from 'date-fns';
import { TrendingDown, TrendingUp, BarChart3, Activity, Radar as RadarIcon } from 'lucide-react';

type ChartType = 'line' | 'bar' | 'radar';

interface AnalyticsViewProps {
  products: Product[];
  prices: PriceEntry[];
}

const storeColors: Record<string, string> = {
  tunisianet: '#6C5CE7',
  tunisiatech: '#00B894',
  spacenet: '#F39C12',
  wiki: '#E74C3C',
};

const AnalyticsView = ({ products, prices }: AnalyticsViewProps) => {
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [chartType, setChartType] = useState<ChartType>('line');

  const selectedProduct = products.find(p => p.id === selectedProductId) || null;

  // Line/Bar chart data for a single product
  const singleProductData = useMemo(() => {
    if (!selectedProduct) return [];
    const productPrices = prices.filter(p => p.productId === selectedProduct.id);
    const dates = [...new Set(productPrices.map(p => p.checkedAt))].sort();
    return dates.map(date => {
      const entry: Record<string, string | number> = { date: format(new Date(date), 'dd/MM HH:mm') };
      (Object.keys(STORE_CONFIG) as StoreName[]).forEach(store => {
        const price = productPrices.find(p => p.checkedAt === date && p.store === store);
        if (price) entry[store] = price.price;
      });
      return entry;
    });
  }, [selectedProduct, prices]);

  // Comparison data: latest price per product per store (for "all" view)
  const comparisonData = useMemo(() => {
    return products.map(product => {
      const productPrices = prices.filter(p => p.productId === product.id);
      const entry: Record<string, string | number> = { name: product.name.length > 20 ? product.name.slice(0, 20) + '…' : product.name };
      (Object.keys(STORE_CONFIG) as StoreName[]).forEach(store => {
        const latest = productPrices.filter(p => p.store === store).sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
        if (latest) entry[store] = latest.price;
      });
      return entry;
    });
  }, [products, prices]);

  // Radar data for a single product
  const radarData = useMemo(() => {
    if (!selectedProduct) return [];
    const productPrices = prices.filter(p => p.productId === selectedProduct.id);
    return (Object.keys(STORE_CONFIG) as StoreName[]).map(store => {
      const latest = productPrices.filter(p => p.store === store).sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
      return {
        store: STORE_CONFIG[store].label,
        price: latest?.price || 0,
      };
    });
  }, [selectedProduct, prices]);

  // Stats for selected product
  const stats = useMemo(() => {
    const relevantPrices = selectedProductId === 'all'
      ? prices
      : prices.filter(p => p.productId === selectedProductId);
    
    if (relevantPrices.length === 0) return null;
    
    const allPriceValues = relevantPrices.map(p => p.price);
    const min = Math.min(...allPriceValues);
    const max = Math.max(...allPriceValues);
    const avg = allPriceValues.reduce((a, b) => a + b, 0) / allPriceValues.length;
    
    return { min, max, avg, count: relevantPrices.length };
  }, [prices, selectedProductId]);

  const renderChart = () => {
    if (selectedProductId === 'all') {
      // Comparison bar chart across all products
      return (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={comparisonData} margin={{ bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" angle={-30} textAnchor="end" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
              formatter={(value: number, name: string) => [`${value.toLocaleString()} TND`, STORE_CONFIG[name as StoreName]?.label || name]}
            />
            <Legend formatter={(value: string) => STORE_CONFIG[value as StoreName]?.label || value} />
            {(Object.keys(STORE_CONFIG) as StoreName[]).map(store => (
              <Bar key={store} dataKey={store} fill={storeColors[store]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={singleProductData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
              formatter={(value: number, name: string) => [`${value.toLocaleString()} TND`, STORE_CONFIG[name as StoreName]?.label || name]}
            />
            <Legend formatter={(value: string) => STORE_CONFIG[value as StoreName]?.label || value} />
            {(Object.keys(STORE_CONFIG) as StoreName[]).map(store => (
              <Line key={store} type="monotone" dataKey={store} stroke={storeColors[store]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2 }} connectNulls={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={singleProductData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
              formatter={(value: number, name: string) => [`${value.toLocaleString()} TND`, STORE_CONFIG[name as StoreName]?.label || name]}
            />
            <Legend formatter={(value: string) => STORE_CONFIG[value as StoreName]?.label || value} />
            {(Object.keys(STORE_CONFIG) as StoreName[]).map(store => (
              <Bar key={store} dataKey={store} fill={storeColors[store]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    // Radar
    return (
      <ResponsiveContainer width="100%" height={400}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis dataKey="store" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
          <PolarRadiusAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
          <Radar name="Prix" dataKey="price" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
          <Tooltip
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
            formatter={(value: number) => [`${value.toLocaleString()} TND`, 'Prix']}
          />
        </RadarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex-1 min-w-[240px]">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Produit</label>
          <Select value={selectedProductId} onValueChange={setSelectedProductId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sélectionner un produit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">📊 Tous les produits (comparaison)</SelectItem>
              {products.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedProductId !== 'all' && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type de graphique</label>
            <ToggleGroup type="single" value={chartType} onValueChange={(v) => v && setChartType(v as ChartType)} className="bg-muted/50 rounded-lg p-1">
              <ToggleGroupItem value="line" className="gap-1.5 text-xs px-3">
                <Activity className="h-3.5 w-3.5" /> Ligne
              </ToggleGroupItem>
              <ToggleGroupItem value="bar" className="gap-1.5 text-xs px-3">
                <BarChart3 className="h-3.5 w-3.5" /> Barres
              </ToggleGroupItem>
              <ToggleGroupItem value="radar" className="gap-1.5 text-xs px-3">
                <RadarIcon className="h-3.5 w-3.5" /> Radar
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="glass-card">
            <CardContent className="p-4 text-center">
              <TrendingDown className="h-4 w-4 text-green-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Prix min</p>
              <p className="text-lg font-bold font-display">{stats.min.toLocaleString()} TND</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-4 w-4 text-red-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Prix max</p>
              <p className="text-lg font-bold font-display">{stats.max.toLocaleString()} TND</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4 text-center">
              <Activity className="h-4 w-4 text-primary mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Prix moyen</p>
              <p className="text-lg font-bold font-display">{Math.round(stats.avg).toLocaleString()} TND</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4 text-center">
              <BarChart3 className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Relevés</p>
              <p className="text-lg font-bold font-display">{stats.count}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg">
            {selectedProductId === 'all' 
              ? 'Comparaison des prix — Tous les produits'
              : `Historique Prix — ${selectedProduct?.name}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderChart()}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsView;
