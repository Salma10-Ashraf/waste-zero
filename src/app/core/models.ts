
export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
}

export interface OrderLine {
  itemId: string;
  qty: number;
}

export type OrderStatus =
  | 'new'
  | 'preparing'
  | 'completed'
  | 'cancelled';

export interface Order {
  id: string;
  date: string;
  lines: OrderLine[];
  total: number;
  status: OrderStatus;
}

export type WasteReason =
  | 'over-preparation'
  | 'expired'
  | 'damaged'
  | 'returned';

export interface WasteRecord {
  id: string;
  date: string;
  itemId: string;
  qty: number;
  reason: WasteReason;
  note?: string;
}

export interface AppSettings {
  wasteAlertPercent: number;
  currency: string;
}

export interface CartLine {
  itemId: string;
  qty: number;
}

export interface DailyChartPoint {
  date: string;
  label: string;
  sales: number;
  waste: number;
}

export interface ItemPerformance {
  item: MenuItem;
  soldQty: number;
  wasteQty: number;
  revenue: number;
  wasteCost: number;
  profit: number;
  marginPercent: number;
  wastePercent: number;
}

export interface HeatmapCell {
  dayIndex: number;
  dayName: string;
  hour: number;
  quantity: number;
  intensity: number;
}

export interface PreparationRecommendation {
  item: MenuItem;
  historicalAverage: number;
  averageWaste: number;
  recommendedQty: number;
  daysRecorded: number;
}
