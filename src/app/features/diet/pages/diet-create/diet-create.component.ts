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
  planId: string | null = null;
  dietRows: DietRow[] = [];
  members: any[] = [];
  dietLibraryFoods: any[] = [];
  loadingDietLibraryFoods = false;
  selectedMemberId: string | null = null;
  hasPlan = false;
  memberSelected = false;

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


  mapPlanToRows(plan: any): DietRow[] {
  const rows: DietRow[] = [];

  for (const meal of plan.meals || []) {
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
  }

  return rows;
}

addRow() {
  this.dietRows.push({
    mealType: '',
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
  });
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
  return this.dietRows.reduce(
    (sum, row) => sum + this.displayCalories(row),
    0
  );
}

toPayloadRows() {
  return this.dietRows.map(row => ({
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

saveFullPlan(payload: any) {
  this.dietApi.saveDietPlanFull(this.planId!, payload)
    .pipe(finalize(() => this.loading = false))
    .subscribe({
      next: () => {
        // success — stay on page
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

  const memberId = this.selectedMemberId;

  this.dietApi.getDietPlanByMember(memberId).subscribe({
    next: (plan) => {
      const resolvedPlanId = this.normalizePlanId(plan?.id ?? null);
      this.hasPlan = !!resolvedPlanId;
      this.planId = resolvedPlanId;
      this.title = plan?.title || '';
      this.notes = plan?.notes || '';
      this.dietRows = this.hasPlan ? this.mapPlanToRows(plan) : [];
    },
    error: () => {
      // no plan exists
      this.hasPlan = false;
    }
  });
}


resetPlan() {
  this.planId = null;
  this.title = '';
  this.notes = '';
  this.dietRows = [];
  this.hasPlan = false;
  this.error = null;
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



  
}
