
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MenuItem {
  item_id: number;
  name: string;
  category: string;
  price_egp: number;
}

export interface DemandPredictionRequest {
  item_id: number;
  day_of_week: number;
  month: number;
  prepared_quantity: number;
  promotion: boolean;
}

export interface DemandPredictionResult {
  id?: number;
  item_id: number;
  item_name: string;
  prepared_quantity: number;
  predicted_demand: number;
  potential_excess_quantity: number;
  potential_shortage_quantity: number;
  promotion?: boolean;
  recommendation: string;
  data_note: string;
  created_at?: string;
}

export interface PredictionHistoryItem {
  id: number;
  prediction_type: 'demand' | 'waste';
  item_id: number | null;
  item_name: string | null;
  predicted_demand: number | null;
  prepared_quantity: number | null;
  sold_quantity: number | null;
  predicted_waste: number | null;
  potential_excess_quantity?: number | null;
  potential_shortage_quantity?: number | null;
  loss_cost: number | null;
  recommendation: string | null;
  created_at: string;
}

export interface WasteAnalyticsItem {
  item_id: number | null;
  item_name: string;
  prediction_count: number;
  potential_excess_quantity: number;
}

export interface AnalyticsSummary {
  total_predictions: number;
  total_waste: number;
  total_loss_cost: number;
  demand_predictions: number;
  surplus_by_item: WasteAnalyticsItem[];
}

@Injectable({
  providedIn: 'root'
})
export class WasteService {
  private readonly apiUrl = 'http://127.0.0.1:8000';

  constructor(private http: HttpClient) {}

  getMenu(): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(
      `${this.apiUrl}/api/menu`
    );
  }

  predictDemand(
    data: DemandPredictionRequest
  ): Observable<DemandPredictionResult> {
    return this.http.post<DemandPredictionResult>(
      `${this.apiUrl}/api/predict-demand`,
      data
    );
  }

  getPredictionHistory(
    limit = 100
  ): Observable<PredictionHistoryItem[]> {
    return this.http.get<PredictionHistoryItem[]>(
      `${this.apiUrl}/api/prediction-history?limit=${limit}`
    );
  }

  getAnalyticsSummary(): Observable<AnalyticsSummary> {
    return this.http.get<AnalyticsSummary>(
      `${this.apiUrl}/api/analytics/summary`
    );
  }

  predictWaste(data: {
    price: number;
    prepared_quantity: number;
    sold_quantity: number;
  }): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/predict-waste`,
      data
    );
  }

  addMenuItem(item: {
    name: string;
    category: string;
    price_egp: number;
  }): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/api/menu`,
      item
    );
  }

  updateMenuItem(
    itemId: number,
    item: {
      name: string;
      category: string;
      price_egp: number;
    }
  ): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/api/menu/${itemId}`,
      item
    );
  }

  deleteMenuItem(itemId: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/api/menu/${itemId}`
    );
  }
}
