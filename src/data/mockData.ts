import { Product, PriceEntry, PriceAlert, MonitoringStatus } from '@/types';

export const mockProducts: Product[] = [
  {
    id: '1',
    name: 'Samsung Galaxy S24 Ultra 256Go',
    category: 'Smartphones',
    urls: {
      tunisianet: 'https://www.tunisianet.com.tn/samsung-galaxy-s24-ultra',
      spacenet: 'https://spacenet.tn/samsung-galaxy-s24-ultra',
      wiki: 'https://www.wiki.tn/samsung-galaxy-s24-ultra',
    },
    addedAt: '2026-03-01T10:00:00Z',
    isMonitored: true,
  },
  {
    id: '2',
    name: 'iPhone 15 Pro Max 256Go',
    category: 'Smartphones',
    urls: {
      tunisianet: 'https://www.tunisianet.com.tn/iphone-15-pro-max',
      tunisiatech: 'https://www.tunisiatech.tn/iphone-15-pro-max',
      wiki: 'https://www.wiki.tn/iphone-15-pro-max',
    },
    addedAt: '2026-03-02T14:00:00Z',
    isMonitored: true,
  },
  {
    id: '3',
    name: 'MacBook Air M3 15" 256Go',
    category: 'Laptops',
    urls: {
      tunisianet: 'https://www.tunisianet.com.tn/macbook-air-m3',
      spacenet: 'https://spacenet.tn/macbook-air-m3',
    },
    addedAt: '2026-03-03T09:00:00Z',
    isMonitored: true,
  },
  {
    id: '4',
    name: 'Samsung Galaxy Tab S9 FE',
    category: 'Tablettes',
    urls: {
      tunisianet: 'https://www.tunisianet.com.tn/galaxy-tab-s9-fe',
      tunisiatech: 'https://www.tunisiatech.tn/galaxy-tab-s9-fe',
      spacenet: 'https://spacenet.tn/galaxy-tab-s9-fe',
      wiki: 'https://www.wiki.tn/galaxy-tab-s9-fe',
    },
    addedAt: '2026-03-04T11:30:00Z',
    isMonitored: false,
  },
  {
    id: '5',
    name: 'AirPods Pro 2ème génération',
    category: 'Accessoires',
    urls: {
      tunisianet: 'https://www.tunisianet.com.tn/airpods-pro-2',
      wiki: 'https://www.wiki.tn/airpods-pro-2',
    },
    addedAt: '2026-03-05T16:00:00Z',
    isMonitored: true,
  },
];

export const mockPriceHistory: PriceEntry[] = [
  // Samsung Galaxy S24 Ultra
  { id: 'p1', productId: '1', store: 'tunisianet', price: 4299, currency: 'TND', checkedAt: '2026-03-06T08:00:00Z' },
  { id: 'p2', productId: '1', store: 'tunisianet', price: 4199, currency: 'TND', checkedAt: '2026-03-07T08:00:00Z' },
  { id: 'p3', productId: '1', store: 'tunisianet', price: 4149, currency: 'TND', checkedAt: '2026-03-08T08:00:00Z' },
  { id: 'p4', productId: '1', store: 'spacenet', price: 4350, currency: 'TND', checkedAt: '2026-03-06T08:00:00Z' },
  { id: 'p5', productId: '1', store: 'spacenet', price: 4280, currency: 'TND', checkedAt: '2026-03-07T08:00:00Z' },
  { id: 'p6', productId: '1', store: 'spacenet', price: 4250, currency: 'TND', checkedAt: '2026-03-08T08:00:00Z' },
  { id: 'p7', productId: '1', store: 'wiki', price: 4199, currency: 'TND', checkedAt: '2026-03-06T08:00:00Z' },
  { id: 'p8', productId: '1', store: 'wiki', price: 4199, currency: 'TND', checkedAt: '2026-03-07T08:00:00Z' },
  { id: 'p9', productId: '1', store: 'wiki', price: 4099, currency: 'TND', checkedAt: '2026-03-08T08:00:00Z' },
  // iPhone 15 Pro Max
  { id: 'p10', productId: '2', store: 'tunisianet', price: 5499, currency: 'TND', checkedAt: '2026-03-06T08:00:00Z' },
  { id: 'p11', productId: '2', store: 'tunisianet', price: 5499, currency: 'TND', checkedAt: '2026-03-07T08:00:00Z' },
  { id: 'p12', productId: '2', store: 'tunisianet', price: 5399, currency: 'TND', checkedAt: '2026-03-08T08:00:00Z' },
  { id: 'p13', productId: '2', store: 'tunisiatech', price: 5550, currency: 'TND', checkedAt: '2026-03-06T08:00:00Z' },
  { id: 'p14', productId: '2', store: 'tunisiatech', price: 5450, currency: 'TND', checkedAt: '2026-03-07T08:00:00Z' },
  { id: 'p15', productId: '2', store: 'tunisiatech', price: 5450, currency: 'TND', checkedAt: '2026-03-08T08:00:00Z' },
  // MacBook Air M3
  { id: 'p16', productId: '3', store: 'tunisianet', price: 4899, currency: 'TND', checkedAt: '2026-03-06T08:00:00Z' },
  { id: 'p17', productId: '3', store: 'tunisianet', price: 4799, currency: 'TND', checkedAt: '2026-03-07T08:00:00Z' },
  { id: 'p18', productId: '3', store: 'tunisianet', price: 4799, currency: 'TND', checkedAt: '2026-03-08T08:00:00Z' },
  { id: 'p19', productId: '3', store: 'spacenet', price: 4950, currency: 'TND', checkedAt: '2026-03-06T08:00:00Z' },
  { id: 'p20', productId: '3', store: 'spacenet', price: 4850, currency: 'TND', checkedAt: '2026-03-07T08:00:00Z' },
  { id: 'p21', productId: '3', store: 'spacenet', price: 4750, currency: 'TND', checkedAt: '2026-03-08T08:00:00Z' },
];

export const mockAlerts: PriceAlert[] = [
  {
    id: 'a1',
    productId: '1',
    productName: 'Samsung Galaxy S24 Ultra 256Go',
    store: 'wiki',
    oldPrice: 4199,
    newPrice: 4099,
    changePercent: -2.38,
    direction: 'down',
    recommendation: '🔥 Prix le plus bas détecté chez Wiki ! Achetez maintenant avant que le prix ne remonte. Économie de 100 TND par rapport au dernier prix.',
    createdAt: '2026-03-08T08:15:00Z',
    isRead: false,
  },
  {
    id: 'a2',
    productId: '2',
    productName: 'iPhone 15 Pro Max 256Go',
    store: 'tunisianet',
    oldPrice: 5499,
    newPrice: 5399,
    changePercent: -1.82,
    direction: 'down',
    recommendation: '📉 Baisse de prix chez Tunisianet ! C\'est le meilleur prix actuel pour ce modèle. Tunisiatech propose encore à 5450 TND.',
    createdAt: '2026-03-08T08:10:00Z',
    isRead: false,
  },
  {
    id: 'a3',
    productId: '3',
    productName: 'MacBook Air M3 15" 256Go',
    store: 'spacenet',
    oldPrice: 4850,
    newPrice: 4750,
    changePercent: -2.06,
    direction: 'down',
    recommendation: '💡 SpaceNet offre le meilleur prix pour le MacBook Air M3 ! 50 TND moins cher que Tunisianet. Tendance à la baisse depuis 3 jours.',
    createdAt: '2026-03-08T08:05:00Z',
    isRead: true,
  },
  {
    id: 'a4',
    productId: '1',
    productName: 'Samsung Galaxy S24 Ultra 256Go',
    store: 'tunisianet',
    oldPrice: 4199,
    newPrice: 4149,
    changePercent: -1.19,
    direction: 'down',
    recommendation: '📊 Tunisianet baisse aussi son prix ! Mais Wiki reste le moins cher à 4099 TND.',
    createdAt: '2026-03-08T08:00:00Z',
    isRead: true,
  },
];

export const mockMonitoringStatus: MonitoringStatus = {
  isAutoMonitoring: true,
  lastCheck: '2026-03-08T08:00:00Z',
  nextCheck: '2026-03-08T09:00:00Z',
  totalChecks: 47,
};
