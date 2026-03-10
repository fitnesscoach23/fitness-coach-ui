import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { DietApiService } from '../../../../core/services/diet-api.service';
import { MemberApiService } from '../../../../core/api/member-api.service';
import { DietLibraryApiService } from '../../../../core/api/diet-library-api.service';


interface DietRow {
  mealType: string;
  foodName: string;
  dietLibraryFoodId?: string | null;
  libraryBaseQuantity?: number | null;
  libraryBaseUnit?: string | null;
  libraryBaseCalories?: number | null;
  libraryBaseCarbs?: number | null;
  libraryBaseProtein?: number | null;
  libraryBaseFat?: number | null;
  quantity: number | null;
  unit: string;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  calories: number | null;
}

interface DietMealGroup {
  mealType: string;
  rows: DietRow[];
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './diet-create.component.html',
  styleUrls: ['./diet-create.component.scss']
})


export class DietCreateComponent implements OnInit {

  memberId!: string;
  title = '';
  notes = '';
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;
  isEditing = true;
  planId: string | null = null;
  dietMeals: DietMealGroup[] = [];
  members: any[] = [];
  dietLibraryFoods: any[] = [];
  loadingDietLibraryFoods = false;
  selectedMemberId: string | null = null;
  hasPlan = false;
  memberSelected = false;
  targetCalories: number | null = null;
  targetProtein: number | null = null;
  targetCarbs: number | null = null;
  targetFats: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dietApi: DietApiService,
    private memberApi: MemberApiService,
    private dietLibraryApi: DietLibraryApiService
  ) {}
  

ngOnInit() {
  this.loadDietLibraryFoods();

  this.memberApi.getMembers().subscribe({
    next: (res) => this.members = res,
    error: () => {
      this.error = 'Failed to load members';
    }
  });
}

loadDietLibraryFoods() {
  this.loadingDietLibraryFoods = true;

  this.dietLibraryApi.getFoods().subscribe({
    next: (res) => {
      this.dietLibraryFoods = [...(res || [])].sort((a, b) =>
        String(a?.foodItem || '').localeCompare(String(b?.foodItem || ''))
      );
      this.loadingDietLibraryFoods = false;
    },
    error: () => {
      this.loadingDietLibraryFoods = false;
    }
  });
}



save() {
  if (!this.selectedMemberId || !this.title) {
    this.error = 'Please select member and enter title';
    return;
  }
  if (!this.title) return;

  this.loading = true;
  this.error = null;
  this.successMessage = null;

  const payload = {
    memberId: this.selectedMemberId,
    title: this.title,
    notes: this.notes,
    rows: this.toPayloadRows()
  };

  // if no plan exists → create first
  if (!this.planId) {
    this.dietApi.createDietPlan({
      memberId: this.selectedMemberId,
      title: this.title,
      notes: this.notes
    }).subscribe({
      next: (id: string) => {
        this.planId = this.normalizePlanId(id);
        this.hasPlan = !!this.planId;
        this.isEditing = true;
        this.saveFullPlan(payload);
      },
      error: () => {
        this.loading = false;
        this.error = 'Failed to create diet plan';
      }
    });
  } else {
    this.saveFullPlan(payload);
  }
}


  mapPlanToMeals(plan: any): DietMealGroup[] {
    const meals: DietMealGroup[] = [];

    for (const meal of plan.meals || []) {
      const rows: DietRow[] = [];
      for (const item of meal.items || []) {
        rows.push({
          mealType: meal.mealName,
          foodName: item.foodName,
          dietLibraryFoodId: null,
          libraryBaseQuantity: null,
          libraryBaseUnit: null,
          libraryBaseCalories: null,
          libraryBaseCarbs: null,
          libraryBaseProtein: null,
          libraryBaseFat: null,
          quantity: item.quantity,
          unit: item.unit,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          calories: item.calories ?? this.calculateCalories({
            mealType: meal.mealName,
            foodName: item.foodName,
            quantity: item.quantity,
            unit: item.unit,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            calories: null
          })
        });
      }
      meals.push({
        mealType: meal.mealName,
        rows
      });
    }

    return meals;
  }

  private createEmptyRow(mealType: string): DietRow {
    return {
      mealType,
      foodName: '',
      dietLibraryFoodId: null,
      libraryBaseQuantity: null,
      libraryBaseUnit: null,
      libraryBaseCalories: null,
      libraryBaseCarbs: null,
      libraryBaseProtein: null,
      libraryBaseFat: null,
      quantity: null,
      unit: '',
      protein: null,
      carbs: null,
      fat: null,
      calories: null
    };
  }

  addMeal() {
    this.dietMeals.push({
      mealType: '',
      rows: [this.createEmptyRow('')]
    });
    this.persistMealOrder();
  }

  addFoodRow(mealIndex: number) {
    const meal = this.dietMeals[mealIndex];
    if (!meal) return;
    meal.rows.push(this.createEmptyRow(meal.mealType));
  }

  updateMealName(mealIndex: number) {
    const meal = this.dietMeals[mealIndex];
    if (!meal) return;
    meal.rows.forEach((row) => {
      row.mealType = meal.mealType;
    });
    this.persistMealOrder();
  }

  removeFoodRow(mealIndex: number, rowIndex: number) {
    const meal = this.dietMeals[mealIndex];
    if (!meal) return;
    meal.rows.splice(rowIndex, 1);
    if (meal.rows.length === 0) {
      this.dietMeals.splice(mealIndex, 1);
      this.persistMealOrder();
    }
  }

  removeMeal(mealIndex: number) {
    this.dietMeals.splice(mealIndex, 1);
    this.persistMealOrder();
  }

calculateCalories(row: DietRow): number {
  const p = row.protein || 0;
  const c = row.carbs || 0;
  const f = row.fat || 0;
  return (p * 4) + (c * 4) + (f * 9);
}

displayCalories(row: DietRow): number {
  return row.calories ?? this.calculateCalories(row);
}

get totalCalories(): number {
  return this.allDietRows.reduce(
    (sum, row) => sum + this.displayCalories(row),
    0
  );
}

get totalProtein(): number {
  return this.allDietRows.reduce((sum, row) => sum + (row.protein || 0), 0);
}

get totalCarbs(): number {
  return this.allDietRows.reduce((sum, row) => sum + (row.carbs || 0), 0);
}

get totalFat(): number {
  return this.allDietRows.reduce((sum, row) => sum + (row.fat || 0), 0);
}

get pendingCalories(): number | null {
  if (this.targetCalories == null) return null;
  return this.targetCalories - this.totalCalories;
}

get pendingProtein(): number | null {
  if (this.targetProtein == null) return null;
  return this.targetProtein - this.totalProtein;
}

get pendingCarbs(): number | null {
  if (this.targetCarbs == null) return null;
  return this.targetCarbs - this.totalCarbs;
}

get pendingFats(): number | null {
  if (this.targetFats == null) return null;
  return this.targetFats - this.totalFat;
}

toPayloadRows() {
  return this.allDietRows.map(row => ({
    mealType: row.mealType,
    foodName: row.foodName,
    quantity: row.quantity,
    unit: row.unit,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    calories: row.calories ?? this.calculateCalories(row)
  }));
}

get allDietRows(): DietRow[] {
  return this.dietMeals.flatMap((meal) => meal.rows);
}

saveFullPlan(payload: any) {
  this.dietApi.saveDietPlanFull(this.planId!, payload)
    .pipe(finalize(() => this.loading = false))
    .subscribe({
      next: () => {
        this.successMessage = 'Diet plan saved successfully';
        this.isEditing = false;
        this.persistMealOrder();
      },
      error: () => {
        this.error = 'Failed to save diet plan';
      }
    });
}

onFoodNameInput(row: DietRow) {
  this.applyLibraryFoodByName(row);
}

onQuantityChanged(row: DietRow) {
  this.applyScaledMacros(row);
}

applyLibraryFoodByName(row: DietRow) {
  const typed = row.foodName?.trim().toLowerCase();
  if (!typed) return;

  const match = this.dietLibraryFoods.find(
    (f: any) => String(f?.foodItem || '').trim().toLowerCase() === typed
  );

  if (!match) return;
  row.dietLibraryFoodId = match.id || null;
  this.applyLibraryFoodToRow(row, match);
}

private applyLibraryFoodToRow(row: DietRow, selected: any) {
  const serving = this.parseServingFromFoodName(selected.foodItem || '');
  const baseQuantity = serving.quantity > 0 ? serving.quantity : 1;
  const baseUnit = serving.unit || 'serving';

  row.dietLibraryFoodId = selected.id || row.dietLibraryFoodId || null;
  row.libraryBaseQuantity = baseQuantity;
  row.libraryBaseUnit = baseUnit;
  row.libraryBaseCalories = this.toNumberOrNull(selected.calories);
  row.libraryBaseCarbs = this.toNumberOrNull(selected.carbs);
  row.libraryBaseProtein = this.toNumberOrNull(selected.protein);
  row.libraryBaseFat = this.toNumberOrNull(selected.fats);

  row.foodName = selected.foodItem || row.foodName;

  if (row.quantity == null) {
    row.quantity = baseQuantity;
  }
  if (!row.unit?.trim()) {
    row.unit = baseUnit;
  }

  this.applyScaledMacros(row);
}

private applyScaledMacros(row: DietRow) {
  const baseQuantity = row.libraryBaseQuantity;
  const quantity = row.quantity;

  if (baseQuantity == null || baseQuantity <= 0 || quantity == null || quantity < 0) {
    return;
  }

  const factor = quantity / baseQuantity;
  const round = (value: number | null | undefined) => {
    const safe = Number(value ?? 0);
    return Math.round(safe * factor * 100) / 100;
  };

  row.calories = round(row.libraryBaseCalories);
  row.carbs = round(row.libraryBaseCarbs);
  row.protein = round(row.libraryBaseProtein);
  row.fat = round(row.libraryBaseFat);
}

private parseServingFromFoodName(foodName: string): { quantity: number; unit: string } {
  const text = String(foodName || '').trim();
  if (!text) {
    return { quantity: 1, unit: 'serving' };
  }

  const compactMatch = text.match(/^(\d+(?:\.\d+)?)\s*(kg|g|gm|mg|ml|l)\b/i);
  if (compactMatch) {
    let quantity = Number(compactMatch[1]);
    const rawUnit = compactMatch[2].toLowerCase();
    let unit = rawUnit;

    if (rawUnit === 'kg') {
      quantity = quantity * 1000;
      unit = 'g';
    } else if (rawUnit === 'l') {
      quantity = quantity * 1000;
      unit = 'ml';
    } else if (rawUnit === 'gm') {
      unit = 'g';
    }

    return { quantity, unit };
  }

  const tokenMatch = text.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/);
  if (tokenMatch) {
    return {
      quantity: Number(tokenMatch[1]) || 1,
      unit: tokenMatch[2]
    };
  }

  return { quantity: 1, unit: 'serving' };
}

private toNumberOrNull(value: any): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}


onMemberChange() {
  if (!this.selectedMemberId) {
    this.memberSelected = false;
    return;
  }

  this.memberSelected = true;
  this.resetPlan();
  this.loadMemberTargets();

  const memberId = this.selectedMemberId;

  this.dietApi.getDietPlanByMember(memberId).subscribe({
    next: (plan) => {
      const resolvedPlanId = this.normalizePlanId(plan?.id ?? null);
      this.hasPlan = !!resolvedPlanId;
      this.planId = resolvedPlanId;
      this.title = plan?.title || '';
      this.notes = plan?.notes || '';
      this.dietMeals = this.hasPlan ? this.mapPlanToMeals(plan) : [];
      this.applyStoredMealOrder();
      this.isEditing = !this.hasPlan;
    },
    error: () => {
      // no plan exists
      this.hasPlan = false;
      this.isEditing = true;
    }
  });
}

loadMemberTargets() {
  if (!this.selectedMemberId) {
    this.targetCalories = null;
    this.targetProtein = null;
    this.targetCarbs = null;
    this.targetFats = null;
    return;
  }

  this.memberApi.getMemberById(this.selectedMemberId).subscribe({
    next: (res: any) => {
      this.targetCalories = this.toNumberOrNull(res?.bodyMetrics?.targetCalories);
      this.targetProtein = this.toNumberOrNull(res?.bodyMetrics?.proteinGrams);
      this.targetCarbs = this.toNumberOrNull(res?.bodyMetrics?.carbsGrams);
      this.targetFats = this.toNumberOrNull(res?.bodyMetrics?.fatsGrams);
    },
    error: () => {
      this.targetCalories = null;
      this.targetProtein = null;
      this.targetCarbs = null;
      this.targetFats = null;
    }
  });
}


  resetPlan() {
  this.planId = null;
  this.title = '';
  this.notes = '';
  this.dietMeals = [];
  this.hasPlan = false;
  this.error = null;
  this.successMessage = null;
  this.isEditing = true;
}

startEditing() {
  if (!this.hasPlan) return;
  this.isEditing = true;
}

moveMealUp(index: number) {
  if (index <= 0) return;
  const [meal] = this.dietMeals.splice(index, 1);
  this.dietMeals.splice(index - 1, 0, meal);
  this.persistMealOrder();
}

moveMealDown(index: number) {
  if (index >= this.dietMeals.length - 1) return;
  const [meal] = this.dietMeals.splice(index, 1);
  this.dietMeals.splice(index + 1, 0, meal);
  this.persistMealOrder();
}


deletePlan() {
  if (!this.planId) return;

  const ok = confirm('Are you sure you want to delete this diet plan?');
  if (!ok) return;

  this.loading = true;

  this.dietApi.deleteDietPlan(this.planId)
    .pipe(finalize(() => this.loading = false))
    .subscribe({
      next: () => {
        // reset to "no plan" state for selected member
        this.resetPlan();
        this.hasPlan = false;
        // keep memberSelected = true
      },
      error: () => {
        this.error = 'Failed to delete diet plan';
      }
    });
}

  private normalizePlanId(rawId: any): string | null {
    if (rawId == null) return null;
    const normalized = String(rawId).replace(/"/g, '').trim();
    return normalized || null;
  }

  private getMealOrderStorageKey(): string | null {
    if (!this.selectedMemberId || !this.planId) return null;
    return `dietMealOrder:${this.selectedMemberId}:${this.planId}`;
  }

  private persistMealOrder() {
    const key = this.getMealOrderStorageKey();
    if (!key || typeof window === 'undefined') return;
    const order = this.dietMeals
      .map((meal) => meal.mealType)
      .filter((name) => typeof name === 'string' && name.trim().length > 0);
    try {
      window.localStorage.setItem(key, JSON.stringify(order));
    } catch {
      // ignore storage failures
    }
  }

  private applyStoredMealOrder() {
    const key = this.getMealOrderStorageKey();
    if (!key || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const order: string[] = JSON.parse(raw);
      if (!Array.isArray(order) || order.length === 0) return;
      const orderIndex = new Map(order.map((name, idx) => [name, idx]));
      this.dietMeals.sort((a, b) => {
        const ai = orderIndex.get(a.mealType);
        const bi = orderIndex.get(b.mealType);
        if (ai == null && bi == null) return 0;
        if (ai == null) return 1;
        if (bi == null) return -1;
        return ai - bi;
      });
    } catch {
      // ignore storage failures
    }
  }



  
}
