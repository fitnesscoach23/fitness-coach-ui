import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

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

// diet-api.service.ts
deleteDietPlan(planId: string) {
  return this.http.delete(
    `${environment.dietApi}/diet/plan/${planId}`,
    { responseType: 'text' }
  );
}


}
