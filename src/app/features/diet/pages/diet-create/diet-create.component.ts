import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { DietApiService } from '../../../../core/services/diet-api.service';
import { MemberApiService } from '../../../../core/api/member-api.service';


interface DietRow {
  mealType: string;
  foodName: string;
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
  selectedMemberId: string | null = null;
  hasPlan = false;
  memberSelected = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dietApi: DietApiService,
    private memberApi: MemberApiService 
  ) {}
  

ngOnInit() {
  this.memberApi.getMembers().subscribe({
    next: (res) => this.members = res,
    error: () => {
      this.error = 'Failed to load members';
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

get totalCalories(): number {
  return this.dietRows.reduce(
    (sum, row) => sum + this.calculateCalories(row),
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
