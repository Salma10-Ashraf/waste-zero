import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  WasteService,
  MenuItem,
  DemandPredictionResult,
  PredictionHistoryItem,
  AnalyticsSummary
} from '../../services/waste';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit {
  today = new Date();

  menuItems: MenuItem[] = [];
  menuCategories: string[] = [];
  availableItems: MenuItem[] = [];

  selectedCategory = '';
  selectedItemId: number | null = null;

  price = 0;
  prepared = 50;
  promotion = false;

  predictionResult: DemandPredictionResult | null = null;
  analyticsSummary: AnalyticsSummary | null = null;

  historyList: {
    id: number;
    itemName: string;
    prepared: number;
    expectedDemand: number;
    excess: number;
    shortage: number;
    time: string;
  }[] = [];

  searchQuery = '';

  loading = false;
  menuLoading = false;
  historyLoading = false;
  analyticsLoading = false;

  errorMessage = '';

  constructor(private wasteService: WasteService) {}

  ngOnInit(): void {
    this.loadMenu();
    this.loadPredictionHistory();
    this.loadAnalytics();
  }

  loadMenu(): void {
    this.menuLoading = true;

    this.wasteService.getMenu().subscribe({
      next: (items) => {
        this.menuItems = items;

        this.menuCategories = [
          ...new Set(items.map(item => item.category))
        ];

        this.menuLoading = false;
      },
      error: (error) => {
        console.error('Menu loading error:', error);

        this.errorMessage =
          'تعذر تحميل المنيو. تأكدي أن الـ Backend يعمل.';

        this.menuLoading = false;
      }
    });
  }

  onCategoryChange(): void {
    this.availableItems = this.menuItems.filter(
      item => item.category === this.selectedCategory
    );

    this.selectedItemId = null;
    this.price = 0;
    this.predictionResult = null;
    this.errorMessage = '';
  }

  onItemChange(): void {
    const item = this.menuItems.find(
      menuItem => menuItem.item_id === Number(this.selectedItemId)
    );

    this.price = item ? Number(item.price_egp) : 0;

    this.predictionResult = null;
    this.errorMessage = '';
  }

  onReset(): void {
    this.selectedCategory = '';
    this.availableItems = [];
    this.selectedItemId = null;

    this.price = 0;
    this.prepared = 50;
    this.promotion = false;

    this.predictionResult = null;
    this.errorMessage = '';
  }

  onPredict(): void {
    this.errorMessage = '';
    this.predictionResult = null;

    if (this.selectedItemId === null) {
      this.errorMessage = 'من فضلك اختاري صنفًا من المنيو.';
      return;
    }

    if (
      !Number.isFinite(Number(this.prepared)) ||
      Number(this.prepared) < 0
    ) {
      this.errorMessage =
        'الكمية المحضرة يجب أن تكون صفرًا أو أكثر.';
      return;
    }

    if (!Number.isInteger(Number(this.prepared))) {
      this.errorMessage =
        'الكمية المحضرة يجب أن تكون عددًا صحيحًا.';
      return;
    }

    const now = new Date();

    // Python: Monday = 0, Sunday = 6.
    const dayOfWeek = (now.getDay() + 6) % 7;

    const payload = {
      item_id: Number(this.selectedItemId),
      day_of_week: dayOfWeek,
      month: now.getMonth() + 1,
      prepared_quantity: Number(this.prepared),
      promotion: this.promotion
    };

    this.loading = true;

    this.wasteService.predictDemand(payload).subscribe({
      next: (result) => {
        this.predictionResult = result;
        this.loading = false;

        this.loadPredictionHistory();
        this.loadAnalytics();
      },
      error: (error) => {
        console.error('Demand prediction error:', error);

        this.loading = false;

        this.errorMessage =
          error.error?.detail ||
          'تعذر تنفيذ التوقع. تأكدي أن الـ Backend والموديل يعملان.';
      }
    });
  }

  loadPredictionHistory(): void {
    this.historyLoading = true;

    this.wasteService.getPredictionHistory(100).subscribe({
      next: (records: PredictionHistoryItem[]) => {
        this.historyList = records.map(record => {
          const predictedDemand =
            Number(record.predicted_demand) || 0;

          const preparedQuantity =
            Number(record.prepared_quantity) || 0;

          const excess =
            record.potential_excess_quantity != null
              ? Number(record.potential_excess_quantity)
              : Math.max(0, preparedQuantity - predictedDemand);

          const shortage =
            record.potential_shortage_quantity != null
              ? Number(record.potential_shortage_quantity)
              : Math.max(0, predictedDemand - preparedQuantity);

          return {
            id: record.id,
            itemName: record.item_name || (
              record.prediction_type === 'waste'
                ? 'حساب هدر'
                : 'صنف غير محدد'
            ),
            prepared: preparedQuantity,
            expectedDemand: predictedDemand,
            excess,
            shortage,
            time: this.formatDate(record.created_at)
          };
        });

        this.historyLoading = false;
      },
      error: (error) => {
        console.error('History loading error:', error);
        this.historyLoading = false;
      }
    });
  }

  loadAnalytics(): void {
    this.analyticsLoading = true;

    this.wasteService.getAnalyticsSummary().subscribe({
      next: (summary) => {
        this.analyticsSummary = summary;
        this.analyticsLoading = false;
      },
      error: (error) => {
        console.error('Analytics loading error:', error);
        this.analyticsLoading = false;
      }
    });
  }

  getBarWidth(value: number): number {
    const totalWaste = Number(
      this.analyticsSummary?.total_waste
    ) || 0;

    if (totalWaste <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.max(0, (Number(value) / totalWaste) * 100)
    );
  }

  getSurplusBarWidth(value: number): number {
    const items =
      this.analyticsSummary?.surplus_by_item ?? [];

    const maxValue = Math.max(
      0,
      ...items.map(
        item => Number(item.potential_excess_quantity) || 0
      )
    );

    if (maxValue <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.max(0, (Number(value) / maxValue) * 100)
    );
  }

  get filteredHistory(): typeof this.historyList {
    const query = this.searchQuery.trim().toLowerCase();

    if (!query) {
      return this.historyList;
    }

    return this.historyList.filter(item =>
      item.itemName.toLowerCase().includes(query)
    );
  }

  private formatDate(value: string | undefined): string {
    if (!value) {
      return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
