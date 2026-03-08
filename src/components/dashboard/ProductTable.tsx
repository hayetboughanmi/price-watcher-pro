import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, Trash2 } from 'lucide-react';
import { Product, PriceEntry, STORE_CONFIG, StoreName } from '@/types';
import { motion } from 'framer-motion';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface ProductTableProps {
  products: Product[];
  prices: PriceEntry[];
  onRemove: (id: string) => void;
  onSelect: (product: Product) => void;
}

const ProductTable = ({ products, prices, onRemove, onSelect }: ProductTableProps) => {
  const getLatestPriceEntry = (productId: string, store: StoreName) => {
    const storePrices = prices
      .filter(p => p.productId === productId && p.store === store)
      .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());
    return storePrices[0] || null;
  };

  const getBestPrice = (productId: string) => {
    const latest = prices.filter(p => p.productId === productId);
    const byStore = new Map<string, number>();
    latest.forEach(p => {
      const existing = byStore.get(p.store);
      if (!existing || new Date(p.checkedAt) > new Date(prices.find(x => x.store === p.store && x.price === existing)?.checkedAt || '')) {
        byStore.set(p.store, p.price);
      }
    });
    let min = Infinity;
    let store = '';
    byStore.forEach((price, s) => {
      if (price < min) { min = price; store = s; }
    });
    return { price: min === Infinity ? null : min, store };
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg">Produits Surveillés</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead>Produit</TableHead>
              <TableHead>Catégorie</TableHead>
              {Object.values(STORE_CONFIG).map(store => (
                <TableHead key={store.label} className="text-center">{store.label}</TableHead>
              ))}
              <TableHead className="text-center">Meilleur Prix</TableHead>
              <TableHead className="text-center">Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product, i) => {
              const best = getBestPrice(product.id);
              return (
                <motion.tr
                  key={product.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => onSelect(product)}
                >
                  <TableCell className="font-medium max-w-[200px] truncate">{product.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{product.category}</Badge>
                  </TableCell>
                  {(Object.keys(STORE_CONFIG) as StoreName[]).map(store => {
                    const entry = getLatestPriceEntry(product.id, store);
                    const price = entry?.price;
                    const isBest = best.store === store && best.price === price;
                    return (
                      <TableCell key={store} className="text-center">
                        {price ? (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={`font-mono text-sm cursor-default ${isBest ? 'text-success font-bold' : ''}`}>
                                  {price.toLocaleString()} TND
                                </span>
                              </TooltipTrigger>
                              {entry?.matchedName && (
                                <TooltipContent side="top" className="max-w-[250px]">
                                  <p className="text-xs">{entry.matchedName}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center">
                    {best.price ? (
                      <span className="font-mono font-bold text-success text-sm">
                        {best.price.toLocaleString()} TND
                      </span>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={product.isMonitored ? 'default' : 'secondary'}
                      className={product.isMonitored ? 'gradient-primary text-primary-foreground border-0' : ''}>
                      {product.isMonitored ? 'Actif' : 'Inactif'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onSelect(product)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onRemove(product.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </motion.tr>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default ProductTable;
