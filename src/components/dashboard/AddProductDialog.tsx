import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus } from 'lucide-react';
import { Product, STORE_CONFIG, StoreName } from '@/types';
import { toast } from 'sonner';

interface AddProductDialogProps {
  onAdd: (product: Omit<Product, 'id' | 'addedAt'>) => void;
}

const AddProductDialog = ({ onAdd }: AddProductDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [selectedStores, setSelectedStores] = useState<Set<StoreName>>(new Set());

  const categories = ['Smartphones', 'Laptops', 'Tablettes', 'Accessoires', 'TV & Audio', 'Gaming', 'Composants PC'];

  const toggleStore = (store: StoreName) => {
    setSelectedStores(prev => {
      const next = new Set(prev);
      if (next.has(store)) next.delete(store);
      else next.add(store);
      return next;
    });
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Veuillez entrer un nom de produit');
      return;
    }
    if (!category) {
      toast.error('Veuillez sélectionner une catégorie');
      return;
    }
    if (selectedStores.size === 0) {
      toast.error('Sélectionnez au moins un magasin');
      return;
    }

    // Build URLs automatically from store base URLs
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const urls: Partial<Record<StoreName, string>> = {};
    selectedStores.forEach(store => {
      urls[store] = `${STORE_CONFIG[store].url}/${slug}`;
    });

    onAdd({ name: name.trim(), category, urls, isMonitored: true });
    toast.success('✅ Produit ajouté avec succès !');
    setName('');
    setCategory('');
    setSelectedStores(new Set());
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-primary text-primary-foreground border-0">
          <Plus className="h-4 w-4 mr-2" /> Ajouter Produit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] glass-card">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Ajouter un Produit à Surveiller</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label htmlFor="product-name">Nom du produit</Label>
            <Input 
              id="product-name" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Ex: Samsung Galaxy S24 Ultra 256Go"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Catégorie</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <Label>Magasins à surveiller</Label>
            <div className="grid grid-cols-2 gap-3 mt-1.5">
              {(Object.keys(STORE_CONFIG) as StoreName[]).map(store => (
                <label
                  key={store}
                  className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedStores.has(store)
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border/50 hover:border-border'
                  }`}
                >
                  <Checkbox
                    checked={selectedStores.has(store)}
                    onCheckedChange={() => toggleStore(store)}
                  />
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: STORE_CONFIG[store].color }}
                    />
                    <span className="text-sm font-medium">{STORE_CONFIG[store].label}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <Button onClick={handleSubmit} className="w-full gradient-primary text-primary-foreground border-0 h-11">
            <Plus className="h-4 w-4 mr-2" /> Ajouter et Surveiller
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddProductDialog;
