
import { Injectable, computed, inject } from '@angular/core';
import { DataService } from './data.service';
import { DailyChartPoint, HeatmapCell, ItemPerformance, PreparationRecommendation } from './models';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly data = inject(DataService);

  readonly performance = computed(() => this.calculatePerformance());

  readonly totalWasteCost = computed(() =>
    this.performance().reduce((sum, item) => sum + item.wasteCost, 0)
  );

  readonly todaySales = computed(() => {
    const today = this.dateKey(new Date());

    return this.data.orders()
      .filter(order =>
        order.status === 'completed' &&
        this.dateKey(new Date(order.date)) === today
      )
      .reduce((sum, order) => sum + order.total, 0);
  });

  readonly todayOrderCount = computed(() => {
    const today = this.dateKey(new Date());

    return this.data.orders().filter(order =>
      order.status === 'completed' &&
      this.dateKey(new Date(order.date)) === today
    ).length;
  });

  readonly averageOrderValue = computed(() =>
    this.todayOrderCount()
      ? this.todaySales() / this.todayOrderCount()
      : 0
  );

  getDailyChart(days: number): DailyChartPoint[] {
    const result: DailyChartPoint[] = [];
    const today = new Date();

    for (let offset = days - 1; offset >= 0; offset--) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);

      const key = this.dateKey(date);

      const sales = this.data.orders()
        .filter(order =>
          order.status === 'completed' &&
          this.dateKey(new Date(order.date)) === key
        )
        .reduce((sum, order) => sum + order.total, 0);

      const waste = this.data.wasteRecords()
        .filter(record => this.dateKey(new Date(record.date)) === key)
        .reduce((sum, record) => {
          const item = this.data.menu().find(i => i.id === record.itemId);
          return sum + (item?.cost ?? 0) * record.qty;
        }, 0);

      result.push({
        date: key,
        label: `${date.getDate()}/${date.getMonth() + 1}`,
        sales,
        waste
      });
    }

    return result;
  }

  calculatePerformance(): ItemPerformance[] {
    return this.data.menu().map(item => {
      const soldQty = this.data.orders()
        .filter(order => order.status === 'completed')
        .reduce((sum, order) =>
          sum + order.lines
            .filter(line => line.itemId === item.id)
            .reduce((subtotal, line) => subtotal + line.qty, 0), 0);

      const wasteQty = this.data.wasteRecords()
        .filter(record => record.itemId === item.id)
        .reduce((sum, record) => sum + record.qty, 0);

      const revenue = soldQty * item.price;
      const wasteCost = wasteQty * item.cost;
      const profit = soldQty * (item.price - item.cost) - wasteCost;

      return {
        item,
        soldQty,
        wasteQty,
        revenue,
        wasteCost,
        profit,
        marginPercent: item.price > 0
          ? (item.price - item.cost) / item.price * 100
          : 0,
        wastePercent: soldQty + wasteQty > 0
          ? wasteQty / (soldQty + wasteQty) * 100
          : 0
      };
    });
  }

  getTopSelling(limit = 5): ItemPerformance[] {
    return [...this.performance()]
      .sort((a, b) => b.soldQty - a.soldQty)
      .slice(0, limit);
  }

  getTopWaste(limit = 5): ItemPerformance[] {
    return [...this.performance()]
      .sort((a, b) => b.wasteCost - a.wasteCost)
      .slice(0, limit);
  }

  getWasteAlerts(): ItemPerformance[] {
    return this.performance().filter(item =>
      item.wasteQty > 0 &&
      item.wastePercent >= this.data.settings().wasteAlertPercent
    );
  }

  getHeatmap(): HeatmapCell[] {
    const dayNames = [
      'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء',
      'الخميس', 'الجمعة', 'السبت'
    ];
    const hours = [10, 12, 14, 16, 18, 20];
    const cells: HeatmapCell[] = [];
    let maximum = 1;

    for (let day = 0; day < 7; day++) {
      for (const hour of hours) {
        const quantity = this.data.orders()
          .filter(order => order.status === 'completed')
          .reduce((sum, order) => {
            const date = new Date(order.date);
            const matches = date.getDay() === day &&
              Math.abs(date.getHours() - hour) <= 1;

            return matches
              ? sum + order.lines.reduce((s, line) => s + line.qty, 0)
              : sum;
          }, 0);

        maximum = Math.max(maximum, quantity);

        cells.push({
          dayIndex: day,
          dayName: dayNames[day],
          hour,
          quantity,
          intensity: 0
        });
      }
    }

    return cells.map(cell => ({
      ...cell,
      intensity: cell.quantity / maximum
    }));
  }

  getPreparationRecommendations(
    dayIndex: number
  ): PreparationRecommendation[] {
    return this.data.menu().map(item => {
      const orders = this.data.orders().filter(order =>
        order.status === 'completed' &&
        new Date(order.date).getDay() === dayIndex
      );

      const activeDates = new Set(
        orders.map(order => this.dateKey(new Date(order.date)))
      );

      const daysRecorded = activeDates.size;

      const sold = orders.reduce((sum, order) =>
        sum + order.lines
          .filter(line => line.itemId === item.id)
          .reduce((subtotal, line) => subtotal + line.qty, 0), 0);

      const waste = this.data.wasteRecords()
        .filter(record =>
          record.itemId === item.id &&
          new Date(record.date).getDay() === dayIndex
        )
        .reduce((sum, record) => sum + record.qty, 0);

      const historicalAverage = daysRecorded ? sold / daysRecorded : 0;
      const averageWaste = daysRecorded ? waste / daysRecorded : 0;

      return {
        item,
        historicalAverage,
        averageWaste,
        recommendedQty: Math.max(
          0,
          Math.ceil(historicalAverage * 1.1 - averageWaste)
        ),
        daysRecorded
      };
    }).sort((a, b) => b.recommendedQty - a.recommendedQty);
  }

  getHighSalesLowMargin(): ItemPerformance[] {
    const items = this.performance();
    const maxSales = Math.max(0, ...items.map(item => item.soldQty));

    return items.filter(item =>
      item.soldQty > 0 &&
      item.marginPercent < 35 &&
      item.soldQty >= maxSales * 0.5
    );
  }

  private dateKey(date: Date): string {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');
  }
}
