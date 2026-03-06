import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface DietLibraryFoodPayload {
  foodItem: string;
  calories: number;
  carbs: number;
  protein: number;
  fats: number;
  category: string;
}

@Injectable({
  providedIn: 'root'
})
export class DietLibraryApiService {
  constructor(private http: HttpClient) {}

  createFood(payload: DietLibraryFoodPayload) {
    return this.http.post(
      `${environment.dietApi}/diet-library/foods`,
      payload
    );
  }

  getFoods(category?: string | null) {
    let params = new HttpParams();
    if (category) {
      params = params.set('category', category);
    }

    return this.http.get<any[]>(
      `${environment.dietApi}/diet-library/foods`,
      { params }
    );
  }

  getFoodById(foodId: string) {
    return this.http.get<any>(
      `${environment.dietApi}/diet-library/foods/${foodId}`
    );
  }

  updateFood(foodId: string, payload: DietLibraryFoodPayload) {
    return this.http.put(
      `${environment.dietApi}/diet-library/foods/${foodId}`,
      payload
    );
  }

  deleteFood(foodId: string) {
    return this.http.delete(
      `${environment.dietApi}/diet-library/foods/${foodId}`
    );
  }

  getCategories() {
    return this.http.get<string[]>(
      `${environment.dietApi}/diet-library/categories`
    );
  }
}
