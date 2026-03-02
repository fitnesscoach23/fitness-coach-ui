// import { Component, OnInit, Input } from '@angular/core';
// import { ActivatedRoute } from '@angular/router';
// import { CommonModule } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { WorkoutApiService } from '../../../../core/services/workout-api.service';
// import { finalize } from 'rxjs/operators';

// @Component({
//   selector: 'app-workout-edit',
//   standalone: true,
//   imports: [CommonModule, FormsModule],
//   templateUrl: './workout-edit.component.html'
// })
// export class WorkoutEditComponent implements OnInit {

//   @Input() planId?: string;
//   workout: any = null;

//   dayName = '';
//   loading = true;
//   addingDay = false;
//   error: string | null = null;
//   exerciseNameMap: Record<string, string> = {};
//   exerciseNotesMap: Record<string, string> = {};
//   addingExerciseDayId: string | null = null;
//   setFormMap: Record<
//   string,
//   { setNumber: number; reps: number; weight?: number; rpe?: number }
// > = {};

// addingSetExerciseId: string | null = null;

// editingExerciseId: string | null = null;
// savingExerciseId: string | null = null;

// editableExerciseMap: Record<
//   string,
//   {
//     name: string;
//     notes?: string;
//     sets: Array<{
//       id?: string;
//       setNumber: number;
//       reps: number;
//       weight?: number;
//       rpe?: number;
//       tempo?: string;
//       rest?: string;
//     }>;
//   }
// > = {};

// deletingExerciseId: string | null = null;

// deletingDayId: string | null = null;

// resolvedPlanId!: string;


//   constructor(
//     private route: ActivatedRoute,
//     private workoutApi: WorkoutApiService
//   ) {}

//   ngOnInit() {
//   // 1️⃣ Input provided (create page)
//   if (this.planId) {
//     this.resolvedPlanId = this.planId;
//     this.loadWorkout();
//     return;
//   }

//   // 2️⃣ Fallback to route param (edit page)
//   const id = this.route.snapshot.paramMap.get('planId');

//   if (!id) {
//     this.error = 'Invalid workout plan';
//     return;
//   }

//   this.resolvedPlanId = id;
//   this.loadWorkout();
// }



//   loadWorkout() {
//     this.loading = true;

//     this.workoutApi.getWorkoutPlanById(this.resolvedPlanId).subscribe({
//       next: res => {
//         this.workout = res;
//         this.workout.days.forEach((d: any) => {
//   d.exercises.forEach((ex: any) => {
//     if (!this.setFormMap[ex.id]) {
//       this.setFormMap[ex.id] = {
//         setNumber: ex.sets?.length
//           ? ex.sets.length + 1
//           : 1,
//         reps: 0
//       };
//     }
//   });
// });

//         this.loading = false;
//       },
//       error: () => {
//         this.error = 'Failed to load workout plan';
//         this.loading = false;
//       }
//     });
//   }

//   addDay() {
//     if (!this.dayName) return;

//     this.addingDay = true;

//     this.workoutApi
//       .addWorkoutDay(this.resolvedPlanId, { dayName: this.dayName })
//       .pipe(finalize(() => {
//         this.addingDay = false;
//       }))
//       .subscribe({
//         next: () => {
//           this.dayName = '';
//           this.loadWorkout(); // refresh days
//         }
//       });
//   }

//   addExercise(dayId: string) {
//   const name = this.exerciseNameMap[dayId];
//   if (!name) return;

//   this.addingExerciseDayId = dayId;

//   this.workoutApi
//     .addExerciseToDay(dayId, {
//       name,
//       notes: this.exerciseNotesMap[dayId]
//     })
//     .pipe(finalize(() => {
//       this.addingExerciseDayId = null;
//     }))
//     .subscribe({
//       next: () => {
//         this.exerciseNameMap[dayId] = '';
//         this.exerciseNotesMap[dayId] = '';
//         this.loadWorkout(); // refresh
//       }
//     });
// }

// addSet(exercise: any) {
//   const form = this.setFormMap[exercise.id];
//   if (!form || !form.reps || !form.setNumber) return;

//   this.addingSetExerciseId = exercise.id;

//   this.workoutApi
//     .addSetToExercise(exercise.id, form)
//     .pipe(finalize(() => {
//       this.addingSetExerciseId = null;
//     }))
//     .subscribe({
//       next: () => {
//         this.setFormMap[exercise.id] = {
//           setNumber: form.setNumber + 1,
//           reps: 0,
//           weight: undefined,
//           rpe: undefined
//         };
//         this.loadWorkout();
//       }
//     });
// }

// addLocalSet(exerciseId: string) {
//   this.editableExerciseMap[exerciseId].sets.push({
//     setNumber: this.editableExerciseMap[exerciseId].sets.length + 1,
//     reps: 0,
//     weight: undefined,
//     rpe: undefined,
//     tempo: '',
//     rest: ''
//   });
// }
// removeLocalSet(exerciseId: string, index: number) {
//   this.editableExerciseMap[exerciseId].sets.splice(index, 1);
// }
// cancelEditExercise() {
//   this.editingExerciseId = null;
// }
// startEditExercise(ex: any) {
//   this.editingExerciseId = ex.id;

//   this.editableExerciseMap[ex.id] = {
//     name: ex.name,
//     notes: ex.notes,
//     sets: ex.sets.map((s: any) => ({ ...s }))
//   };
// }

// saveExercise(ex: any) {
//   const payload = this.editableExerciseMap[ex.id];

//   this.savingExerciseId = ex.id;

//   this.workoutApi
//     .saveExercise(ex.id, payload)
//     .pipe(finalize(() => this.savingExerciseId = null))
//     .subscribe({
//       next: () => {
//         this.editingExerciseId = null;
//         this.loadWorkout();
//       }
//     });
// }

// deleteExercise(ex: any) {

//   const confirmed = window.confirm(
//     `Delete exercise "${ex.name}"? All sets will be removed.`
//   );

//   if (!confirmed) return;

//   this.deletingExerciseId = ex.id;

//   this.workoutApi
//     .deleteExercise(ex.id)
//     .pipe(finalize(() => this.deletingExerciseId = null))
//     .subscribe({
//       next: () => {
//         // If this exercise was in edit mode, exit edit mode
//         if (this.editingExerciseId === ex.id) {
//           this.editingExerciseId = null;
//         }

//         this.loadWorkout(); // 🔄 refresh-after-mutation
//       }
//     });
// }

// deleteDay(day: any) {

//   const confirmed = window.confirm(
//     `Delete workout day "${day.dayName}"? All exercises and sets will be removed.`
//   );

//   if (!confirmed) return;

//   this.deletingDayId = day.id;

//   this.workoutApi
//     .deleteWorkoutDay(day.id)
//     .pipe(finalize(() => this.deletingDayId = null))
//     .subscribe({
//       next: () => {
//         this.loadWorkout(); // 🔄 refresh-after-mutation
//       }
//     });
// }



// }
