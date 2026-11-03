
import { Injectable, signal } from '@angular/core';
import { AppSettings, MenuItem, Order, OrderStatus, WasteRecord } from './models';
import { INITIAL_MENU } from './menu.data';

const STORAGE_KEY = 'waste-zero-v1';

@Injectable({ providedIn: 'root' })
export class DataService {
  readonly menu = signal<MenuItem[]>(INITIAL_MENU.map(item => ({ ...item })));
  readonly orders = signal<Order[]>([]);
  readonly wasteRecords = signal<WasteRecord[]>([]);
  readonly settings = signal<AppSettings>({
    wasteAlertPercent: 8,
    currency: 'ج.م'
  });
  readonly demoData = signal(false);
  readonly toastMessage = signal('');
  readonly toastType = signal<'success' | 'error'>('success');

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const saved = JSON.parse(raw);

      if (Array.isArray(saved.menu)) this.menu.set(saved.menu);
      if (Array.isArray(saved.orders)) this.orders.set(saved.orders);
      if (Array.isArray(saved.wasteRecords)) {
        this.wasteRecords.set(saved.wasteRecords);
      }
      if (saved.settings) this.settings.set(saved.settings);
      this.demoData.set(saved.demoData === true);
    } catch {
      this.notify('تعذر قراءة البيانات المحفوظة.', 'error');
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        menu: this.menu(),
        orders: this.orders(),
        wasteRecords: this.wasteRecords(),
        settings: this.settings(),
        demoData: this.demoData()
      }));
    } catch {
      this.notify('تعذر حفظ البيانات على الجهاز.', 'error');
    }
  }

  notify(message: string, type: 'success' | 'error' = 'success'): void {
    this.toastMessage.set(message);
    this.toastType.set(type);
  }

  dismissToast(): void {
    this.toastMessage.set('');
  }

  addMenuItem(item: Omit<MenuItem, 'id'>): void {
    if (!item.name.trim() || !item.category.trim() ||
        item.price < 0 || item.cost < 0 || item.cost > item.price) {
      this.notify('راجعي الاسم والتصنيف والأسعار.', 'error');
      return;
    }

    this.menu.update(items => [
      ...items,
      { ...item, id: this.makeId('item') }
    ]);
    this.persist();
    this.notify('تمت إضافة الصنف.');
  }

  updateMenuItem(item: MenuItem): void {
    if (!item.name.trim() || !item.category.trim() ||
        item.price < 0 || item.cost < 0 || item.cost > item.price) {
      this.notify('راجعي بيانات الصنف والأسعار.', 'error');
      return;
    }

    this.menu.update(items =>
      items.map(old => old.id === item.id ? { ...item } : old)
    );
    this.persist();
    this.notify('تم تحديث الصنف.');
  }

  deleteMenuItem(id: string): void {
    const usedInOrders = this.orders().some(order =>
      order.lines.some(line => line.itemId === id)
    );
    const usedInWaste = this.wasteRecords().some(record =>
      record.itemId === id
    );

    if (usedInOrders || usedInWaste) {
      this.notify('لا يمكن حذف صنف مرتبط بطلبات أو هالك.', 'error');
      return;
    }

    this.menu.update(items => items.filter(item => item.id !== id));
    this.persist();
    this.notify('تم حذف الصنف.');
  }

  createOrder(lines: { itemId: string; qty: number }[]): void {
    const validLines = lines.filter(line =>
      this.menu().some(item => item.id === line.itemId) &&
      Number.isInteger(line.qty) &&
      line.qty > 0
    );

    if (!validLines.length) {
      this.notify('أضيفي صنفًا واحدًا على الأقل.', 'error');
      return;
    }

    const total = validLines.reduce((sum, line) => {
      const item = this.menu().find(i => i.id === line.itemId);
      return sum + (item?.price ?? 0) * line.qty;
    }, 0);

    const order: Order = {
      id: this.makeId('order'),
      date: new Date().toISOString(),
      lines: validLines,
      total,
      status: 'completed'
    };

    this.orders.update(orders => [order, ...orders]);
    this.persist();
    this.notify('تم تسجيل الطلب.');
  }

  updateOrderStatus(id: string, status: OrderStatus): void {
    this.orders.update(orders =>
      orders.map(order => order.id === id ? { ...order, status } : order)
    );
    this.persist();
    this.notify('تم تحديث حالة الطلب.');
  }

  addWasteRecord(record: Omit<WasteRecord, 'id'>): void {
    if (!this.menu().some(item => item.id === record.itemId) ||
        !Number.isFinite(record.qty) || record.qty <= 0) {
      this.notify('اختاري صنفًا وأدخلي كمية صحيحة.', 'error');
      return;
    }

    this.wasteRecords.update(records => [
      { ...record, id: this.makeId('waste') },
      ...records
    ]);
    this.persist();
    this.notify('تم تسجيل الهالك.');
  }

  deleteWasteRecord(id: string): void {
    this.wasteRecords.update(records =>
      records.filter(record => record.id !== id)
    );
    this.persist();
    this.notify('تم حذف سجل الهالك.');
  }

  updateSettings(settings: AppSettings): void {
    if (settings.wasteAlertPercent < 0 ||
        settings.wasteAlertPercent > 100) {
      this.notify('نسبة التنبيه يجب أن تكون من 0 إلى 100.', 'error');
      return;
    }

    this.settings.set({ ...settings });
    this.persist();
    this.notify('تم حفظ الإعدادات.');
  }

  loadDemoData(): void {
    const menu = this.menu();
    if (!menu.length) {
      this.notify('أضيفي أصنافًا للمنيو أولًا.', 'error');
      return;
    }

    const orders: Order[] = [];
    const wasteRecords: WasteRecord[] = [];
    const today = new Date();
    const weekdayWeights = [0.65, 0.7, 0.8, 0.9, 1.5, 1.7, 0.85];

    for (let offset = 29; offset >= 0; offset--) {
      const day = new Date(today);
      day.setDate(today.getDate() - offset);

      const orderCount = Math.max(
        3,
        Math.round(7 * weekdayWeights[day.getDay()])
      );

      for (let n = 0; n < orderCount; n++) {
        const item = menu[Math.floor(Math.random() * menu.length)];
        const qty = 1 + Math.floor(Math.random() * 3);
        const orderDate = new Date(day);
        orderDate.setHours(10 + Math.floor(Math.random() * 12), 0, 0, 0);

        orders.push({
          id: this.makeId('demo-order'),
          date: orderDate.toISOString(),
          lines: [{ itemId: item.id, qty }],
          total: item.price * qty,
          status: 'completed'
        });
      }

      if (Math.random() < 0.7) {
        const item = menu[Math.floor(Math.random() * menu.length)];
        const wasteDate = new Date(day);
        wasteDate.setHours(14, 0, 0, 0);

        const reasons: WasteRecord['reason'][] = [
          'over-preparation', 'expired', 'damaged', 'returned'
        ];

        wasteRecords.push({
          id: this.makeId('demo-waste'),
          date: wasteDate.toISOString(),
          itemId: item.id,
          qty: 1 + Math.floor(Math.random() * 3),
          reason: reasons[Math.floor(Math.random() * reasons.length)]
        });
      }
    }

    this.orders.set(orders);
    this.wasteRecords.set(wasteRecords);
    this.demoData.set(true);
    this.persist();
    this.notify('تم إنشاء بيانات تجريبية لمدة 30 يومًا.');
  }

  clearAllData(): void {
    this.orders.set([]);
    this.wasteRecords.set([]);
    this.menu.set(INITIAL_MENU.map(item => ({ ...item })));
    this.settings.set({ wasteAlertPercent: 8, currency: 'ج.م' });
    this.demoData.set(false);

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // قد يكون التخزين المحلي غير متاح في المتصفح.
    }

    this.notify('تم مسح الطلبات والهالك وإعادة الأصناف الافتراضية.');
  }

  private makeId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
