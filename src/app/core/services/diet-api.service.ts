import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface DietReviewMetricTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DietReviewRowPayload {
  mealType: string;
  foodName: string;
  quantity: number | null;
  unit: string | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  calories: number | null;
}

export interface DietReviewRequest {
  memberId: string;
  member?: {
    id: string;
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  targetTotals: DietReviewMetricTotals;
  currentTotals: DietReviewMetricTotals;
  rows: DietReviewRowPayload[];
  planTitle?: string | null;
  notes?: string | null;
}

export interface DietReviewMetricGap {
  target: number | null;
  current: number | null;
  gap: number | null;
}

export interface DietReviewSuggestionImpact {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export interface DietReviewSuggestionObject {
  type: 'add_item' | 'modify_item' | 'remove_item';
  mealType: string | null;
  foodName: string | null;
  suggestedQuantity: number | null;
  unit: string | null;
  reason: string;
  impact: DietReviewSuggestionImpact | null;
}

export type DietReviewSuggestion = string | DietReviewSuggestionObject;

export interface DietReviewRowSuggestion {
  mealType?: string | null;
  foodName?: string | null;
  currentQuantity?: number | null;
  suggestedQuantity?: number | null;
  unit?: string | null;
  action?: string | null;
  suggestion?: string | null;
  reason?: string | null;
}

export interface DietReviewMacroGaps {
  calories?: DietReviewMetricGap | null;
  protein?: DietReviewMetricGap | null;
  carbs?: DietReviewMetricGap | null;
  fats?: DietReviewMetricGap | null;
  fat?: DietReviewMetricGap | null;
}

export interface DietReviewResponse {
  summary?: string | null;
  macroGaps?: DietReviewMacroGaps | null;
  suggestions: DietReviewSuggestion[];
  warnings: string[];
  rowSuggestions?: DietReviewRowSuggestion[] | null;
  disclaimer?: string | null;
  reviewSource?: string | null;
}

@Injectable({ providedIn: 'root' })
export class DietApiService {

  constructor(private http: HttpClient) {}

  getDietPlanByMember(memberId: string) {
    return this.http.get<any>(
      `${environment.dietApi}/diet/member/${memberId}`
    );
  }

  createDietPlan(payload: {
    memberId: string;
    title: string;
    notes?: string;
  }) {
    return this.http.post(
      `${environment.dietApi}/diet`,
      payload,
      { responseType: 'text' }
    );
  }

  getDietPlanById(planId: string) {
    return this.http.get<any>(
      `${environment.dietApi}/diet/${planId}`
    );
  }

  addMeal(planId: string, payload: { mealName: string }) {
    return this.http.post(
      `${environment.dietApi}/diet/${planId}/meals`,
      payload,
      { responseType: 'text' }
    );
  }

  addMealItem(
    mealId: string,
    payload: {
      foodName: string;
      quantity: number;
      unit: string;
      calories: number;
    }
  ) {
    return this.http.post(
      `${environment.dietApi}/diet/meals/${mealId}/items`,
      payload,
      { responseType: 'text' }
    );
  }

  updateMeal(mealId: string, payload: { mealName: string }) {
    return this.http.put(
      `${environment.dietApi}/diet/meals/${mealId}`,
      payload,
      { responseType: 'text' }
    );
  }

  saveDietPlanFull(planId: string, payload: any) {
    return this.http.put(
      `${environment.dietApi}/diet/plan/${planId}/full`,
      payload,
      { responseType: 'text' }
    );
  }

  deleteMeal(mealId: string) {
    return this.http.delete(
      `${environment.dietApi}/diet/meals/${mealId}`,
      { responseType: 'text' }
    );
  }

  deleteDietPlan(planId: string) {
    return this.http.delete(
      `${environment.dietApi}/diet/plan/${planId}`,
      { responseType: 'text' }
    );
  }

  reviewDietPlan(payload: DietReviewRequest) {
    return this.http.post<DietReviewResponse>(
      `${environment.dietApi}/diet/review`,
      payload
    );
  }
}
