import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [urls, setUrls] = useState<Partial<Record<StoreName, string>>>({});

  const categories = ['Smartphones', 'Laptops', 'Tablettes', 'Accessoires', 'TV & Audio', 'Gaming', 'Composants PC'];

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Veuillez entrer un nom de produit');
      return;
    }
    if (!category) {
      toast.error('Veuillez sélectionner une catégorie');
      return;
    }
    const validUrls = Object.fromEntries(
      Object.entries(urls).filter(([, v]) => v && v.trim())
    ) as Partial<Record<StoreName, string>>;

    if (Object.keys(validUrls).length === 0) {
      toast.error('Ajoutez au moins un lien de produit');
      return;
    }

    onAdd({ name: name.trim(), category, urls: validUrls, isMonitored: true });
    toast.success('✅ Produit ajouté avec succès !');
    setName('');
    setCategory('');
    setUrls({});
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
            <Label>Liens des produits (au moins 1)</Label>
            {(Object.keys(STORE_CONFIG) as StoreName[]).map(store => (
              <div key={store} className="flex items-center gap-2">
                <span className="text-xs font-medium w-24 shrink-0">{STORE_CONFIG[store].label}</span>
                <Input
                  value={urls[store] || ''}
                  onChange={e => setUrls(prev => ({ ...prev, [store]: e.target.value }))}
                  placeholder={`URL ${STORE_CONFIG[store].label}`}
                  className="text-xs"
                />
              </div>
            ))}
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
