import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PriceEntry, Product, STORE_CONFIG, StoreName } from '@/types';
import { format } from 'date-fns';

interface PriceChartProps {
  product: Product | null;
  prices: PriceEntry[];
}

const PriceChart = ({ product, prices }: PriceChartProps) => {
  if (!product) {
    return (
      <Card className="glass-card">
        <CardContent className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
          Sélectionnez un produit pour voir l'historique des prix
        </CardContent>
      </Card>
    );
  }

  const productPrices = prices.filter(p => p.productId === product.id);
  const dates = [...new Set(productPrices.map(p => p.checkedAt))].sort();
  
  const chartData = dates.map(date => {
    const entry: Record<string, string | number> = {
      date: format(new Date(date), 'dd/MM'),
    };
    (Object.keys(STORE_CONFIG) as StoreName[]).forEach(store => {
      const price = productPrices.find(p => p.checkedAt === date && p.store === store);
      if (price) entry[store] = price.price;
    });
    return entry;
  });

  const storeColors: Record<string, string> = {
    tunisianet: '#6C5CE7',
    tunisiatech: '#00B894',
    spacenet: '#F39C12',
    wiki: '#E74C3C',
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-lg">
          Historique Prix — {product.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number, name: string) => [
                `${value.toLocaleString()} TND`,
                STORE_CONFIG[name as StoreName]?.label || name,
              ]}
            />
            <Legend formatter={(value: string) => STORE_CONFIG[value as StoreName]?.label || value} />
            {(Object.keys(STORE_CONFIG) as StoreName[]).map(store => (
              <Line
                key={store}
                type="monotone"
                dataKey={store}
                stroke={storeColors[store]}
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default PriceChart;
