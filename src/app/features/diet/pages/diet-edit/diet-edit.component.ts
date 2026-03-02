// import { Component, OnInit } from '@angular/core';
// import { ActivatedRoute } from '@angular/router';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { finalize } from 'rxjs/operators';
// import { DietApiService } from '../../../../core/services/diet-api.service';

// @Component({
//   standalone: true,
//   imports: [CommonModule, FormsModule],
//   templateUrl: './diet-edit.component.html'
// })
// export class DietEditComponent implements OnInit {

//   planId!: string;
//   diet: any;

//   mealName = '';
//   loading = true;
//   addingMeal = false;
//   error: string | null = null;
//   itemFormMap: Record<
//   string,
//   { foodName: string; quantity: number; unit: string; calories: number }
// > = {};

// addingItemMealId: string | null = null;
// mealEditNameMap: Record<string, string> = {};
// editingMealId: string | null = null;
// savingMealId: string | null = null;

// editableMealMap: Record<string, {
//   mealName: string;
//   items: Array<{
//     id?: string;
//     foodName: string;
//     quantity: number;
//     unit: string;
//     calories: number;
//   }>;
// }> = {};
// deletingMealId: string | null = null;




//   constructor(
//     private route: ActivatedRoute,
//     private dietApi: DietApiService
//   ) {}

//   ngOnInit() {
//     const id = this.route.snapshot.paramMap.get('planId');
//     if (!id) return;

//     this.planId = id;
//     this.loadDiet();
//   }

//   loadDiet() {
//     this.loading = true;

//     this.dietApi.getDietPlanById(this.planId).subscribe({
//       next: res => {
//         this.diet = res;
//         this.diet.meals.forEach((m: any) => {
//         if (!this.itemFormMap[m.id]) {
//           this.itemFormMap[m.id] = {
//             foodName: '',
//             quantity: 0,
//             unit: '',
//             calories: 0
//           };
//         }
//         this.mealEditNameMap[m.id] = m.mealName;
//       });
//         this.loading = false;
//       },
//       error: () => {
//         this.error = 'Failed to load diet';
//         this.loading = false;
//       }
//     });
//   }

//   addMeal() {
//     if (!this.mealName) return;

//     this.addingMeal = true;

//     this.dietApi
//       .addMeal(this.planId, { mealName: this.mealName })
//       .pipe(finalize(() => this.addingMeal = false))
//       .subscribe({
//         next: () => {
//           this.mealName = '';
//           this.loadDiet();
//         }
//       });
//   }

//   addItem(meal: any) {
//   const form = this.itemFormMap[meal.id];
//   if (!form || !form.foodName) return;

//   this.addingItemMealId = meal.id;

//   this.dietApi
//     .addMealItem(meal.id, form)
//     .pipe(finalize(() => this.addingItemMealId = null))
//     .subscribe({
//       next: () => {
//         this.itemFormMap[meal.id] = {
//           foodName: '',
//           quantity: 0,
//           unit: '',
//           calories: 0
//         };
//         this.loadDiet();
//       }
//     });
// }

// startEditMeal(meal: any) {
//   this.editingMealId = meal.id;

//   this.editableMealMap[meal.id] = {
//     mealName: meal.mealName,
//     items: meal.items.map((i: any) => ({ ...i }))
//   };
// }

// cancelEditMeal() {
//   this.editingMealId = null;
// }


// saveMealName(meal: any) {
//   const name = this.mealEditNameMap[meal.id];

//   if (!name || name === meal.mealName) {
//     this.cancelEditMeal();
//     return;
//   }

//   this.savingMealId = meal.id;

//   this.dietApi
//     .updateMeal(meal.id, { mealName: name })
//     .pipe(finalize(() => this.savingMealId = null))
//     .subscribe({
//       next: () => {
//         this.editingMealId = null;
//         this.loadDiet(); // 🔄 backend is source of truth
//       }
//     });
// }

// addLocalItem(mealId: string) {
//   this.editableMealMap[mealId].items.push({
//     foodName: '',
//     quantity: 0,
//     unit: '',
//     calories: 0
//   });
// }

// removeLocalItem(mealId: string, index: number) {
//   this.editableMealMap[mealId].items.splice(index, 1);
// }

// saveMeal(meal: any) {
//   const payload = this.editableMealMap[meal.id];

//   this.savingMealId = meal.id;

//   this.dietApi
//     .saveMeal(meal.id, payload)
//     .pipe(finalize(() => this.savingMealId = null))
//     .subscribe({
//       next: () => {
//         this.editingMealId = null;
//         this.loadDiet(); // 🔄 refresh-after-mutation
//       }
//     });
// }

// deleteMeal(meal: any) {

//   const confirmed = window.confirm(
//     `Delete meal "${meal.mealName}"? This cannot be undone.`
//   );

//   if (!confirmed) return;

//   this.deletingMealId = meal.id;

//   this.dietApi
//     .deleteMeal(meal.id)
//     .pipe(finalize(() => this.deletingMealId = null))
//     .subscribe({
//       next: () => {
//         this.loadDiet(); // 🔄 refresh-after-mutation
//       }
//     });
// }


// }
