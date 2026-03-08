export type StoreName = 'tunisianet' | 'tunisiatech' | 'spacenet' | 'wiki';

export interface Product {
  id: string;
  name: string;
  category: string;
  imageUrl?: string;
  urls: Partial<Record<StoreName, string>>;
  addedAt: string;
  isMonitored: boolean;
}

export interface PriceEntry {
  id: string;
  productId: string;
  store: StoreName;
  price: number;
  currency: string;
  checkedAt: string;
}

export interface PriceAlert {
  id: string;
  productId: string;
  productName: string;
  store: StoreName;
  oldPrice: number;
  newPrice: number;
  changePercent: number;
  direction: 'up' | 'down';
  recommendation: string;
  createdAt: string;
  isRead: boolean;
}

export interface MonitoringStatus {
  isAutoMonitoring: boolean;
  lastCheck: string | null;
  nextCheck: string | null;
  totalChecks: number;
}

export const STORE_CONFIG: Record<StoreName, { label: string; color: string; url: string }> = {
  tunisianet: { label: 'Tunisianet', color: 'hsl(245 58% 51%)', url: 'https://www.tunisianet.com.tn' },
  tunisiatech: { label: 'Tunisiatech', color: 'hsl(170 65% 45%)', url: 'https://www.tunisiatech.tn' },
  spacenet: { label: 'SpaceNet', color: 'hsl(38 92% 50%)', url: 'https://spacenet.tn' },
  wiki: { label: 'Wiki', color: 'hsl(0 72% 51%)', url: 'https://www.wiki.tn' },
};
