import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkoutApiService } from '../../../../core/services/workout-api.service';
import { MemberApiService } from '../../../../core/api/member-api.service';
import { of, Observable } from 'rxjs';
import { concatMap, finalize, mapTo } from 'rxjs/operators';

interface WorkoutGridRow {
  dayName: string;
  exerciseName: string;
  setNumber: number;
  reps: string;        // e.g. "8-10"
}

@Component({
  selector: 'app-workout-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './workout-create.component.html',
  styleUrls: ['./workout-create.component.scss']
})
export class WorkoutCreateComponent implements OnInit {

  members: any[] = [];

  memberId: string | null = null;
  title = '';
  notes = '';

  loading = false;
  loadingMembers = true;
  error: string | null = null;
  planId: string | null = null;
  memberPlans: any[] = [];
  loadingPlans = false;
  plansError: string | null = null;
  // which plan is currently open in the builder
  activePlanId: string | null = null;

  // mode helps us control UI intent (optional but clean)
  builderMode: 'CREATE' | 'EDIT' | null = null;
  gridRows: WorkoutGridRow[] = [];
  editablePlanId: string | null = null;
  savingPlanId: string | null = null;
  // phase-5 state
deletingPlanId: string | null = null;
mode: 'VIEW' | 'EDIT' = 'VIEW';
// create mode
creatingNewPlan = false;
newPlanRows: WorkoutGridRow[] = [];

emptyRow(): WorkoutGridRow {
  return {
    dayName: '',
    exerciseName: '',
    setNumber: 1,
    reps: ''
  };
}

  constructor(
    private workoutApi: WorkoutApiService,
    private memberApi: MemberApiService,
    private router: Router,
    private route: ActivatedRoute
  ) {}
  

  ngOnInit() {
    this.loadMembers();

    // optional preselect from query param
    const preselectedMemberId =
      this.route.snapshot.queryParamMap.get('memberId');

    if (preselectedMemberId) {
      this.memberId = preselectedMemberId;
    }
  }

  loadMembers() {
    this.loadingMembers = true;

    this.memberApi.getMembers().subscribe({
      next: (res: any[]) => {
        this.members = res || [];
        this.loadingMembers = false;
      },
      error: () => {
        this.error = 'Failed to load members';
        this.loadingMembers = false;
      }
    });
  }

  create() {
    if (!this.title || !this.memberId) return;

    this.loading = true;
    this.error = null;

    this.workoutApi
      .createWorkoutPlan({
        memberId: this.memberId,
        title: this.title,
        notes: this.notes
      })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (planId: string) => {
        const cleanId = planId.replace(/"/g, '');
        this.builderMode = 'CREATE';
        this.planId = cleanId;
        this.activePlanId = null;
      },
        error: () => {
          this.error = 'Failed to create workout plan';
        }
      });
  }

  loadMemberPlans(memberId: string) {
  this.loadingPlans = true;
  this.plansError = null;

  this.workoutApi.getWorkoutPlan(memberId).subscribe({
    next: res => {
  const plans = Array.isArray(res) ? res : res ? [res] : [];

  this.memberPlans = plans.map(p => ({
    ...p,
    gridRows: this.mapPlanToGridLocal(p) // NEW
  }));

  this.loadingPlans = false;
},
    error: () => {
      this.plansError = 'Failed to load workout plans';
      this.loadingPlans = false;
      this.memberPlans = [];
    }
  });
}

onMemberChange() {
  if (!this.memberId) {
    this.memberPlans = [];
    return;
  }

  this.loadMemberPlans(this.memberId);
}

editPlan(planId: string) {
  this.builderMode = 'EDIT';
  this.planId = null;
  this.activePlanId = planId;

  const plan = this.memberPlans.find(p => p.id === planId);
  if (plan) {
    this.mapPlanToGrid(plan);
  }
}


addEmptyRow() {
  this.gridRows.push({
    dayName: '',
    exerciseName: '',
    setNumber: this.nextSetNumber(),
    reps: ''
  });
}

removeRow(index: number) {
  this.gridRows.splice(index, 1);
}

private nextSetNumber(): number {
  if (!this.gridRows.length) return 1;
  const max = Math.max(...this.gridRows.map(r => r.setNumber || 0));
  return max + 1;
}

private mapPlanToGrid(plan: any) {
  const rows: WorkoutGridRow[] = [];

  plan.days.forEach((day: any) => {
    day.exercises.forEach((ex: any) => {
      ex.sets.forEach((set: any) => {
        rows.push({
          dayName: day.dayName,
          exerciseName: ex.name,
          setNumber: set.setNumber,
          reps: set.reps?.toString() ?? ''
        });
      });
    });
  });

  this.gridRows = rows;
}

get hasExistingPlan(): boolean {
  return this.memberPlans && this.memberPlans.length > 0;
}

private mapPlanToGridLocal(plan: any): WorkoutGridRow[] {
  const rows: WorkoutGridRow[] = [];

  plan.days.forEach((day: any) => {
    day.exercises.forEach((ex: any) => {
      ex.sets.forEach((set: any) => {
        rows.push({
          dayName: day.dayName,
          exerciseName: ex.name,
          setNumber: set.setNumber,
          reps: set.reps?.toString() ?? ''
        });
      });
    });
  });

  return rows;
}

enableEdit(plan: any) {
  this.editablePlanId = plan.id;
}

cancelEdit(plan: any) {
  // reset grid rows from original plan data
  plan.gridRows = this.mapPlanToGridLocal(plan);
  this.editablePlanId = null;
}

removeRowFromPlan(plan: any, index: number) {
  plan.gridRows.splice(index, 1);
}

private validateGrid(rows: WorkoutGridRow[]): boolean {
  return rows.every(r =>
    r.dayName?.trim() &&
    r.exerciseName?.trim() &&
    r.setNumber != null &&
    r.reps?.trim()
  );
}

private groupGrid(rows: WorkoutGridRow[]) {
  const dayMap = new Map<
    string,
    Map<string, WorkoutGridRow[]>
  >();

  rows.forEach(row => {
    if (!dayMap.has(row.dayName)) {
      dayMap.set(row.dayName, new Map());
    }

    const exMap = dayMap.get(row.dayName)!;

    if (!exMap.has(row.exerciseName)) {
      exMap.set(row.exerciseName, []);
    }

    exMap.get(row.exerciseName)!.push(row);
  });

  return dayMap;
}

savePlan(plan: any) {

  if (!this.validateGrid(plan.gridRows)) {
    alert('Please fill Day, Exercise, Set Number and Reps for all rows.');
    return;
  }

  this.savingPlanId = plan.id;

  const dayMap = this.groupGrid(plan.gridRows);

const delete$: Observable<void> = plan.days.reduce(
  (obs: Observable<void>, day: any) =>
    obs.pipe(
      concatMap(() =>
        this.workoutApi
          .deleteWorkoutDay(day.id)
          .pipe(mapTo(void 0))
      )
    ),
  of(void 0)
);


delete$
  .pipe(
    concatMap(() => {

      let chain$: Observable<void> = of(void 0);
      const dayMap = this.groupGrid(plan.gridRows);

      dayMap.forEach((exerciseMap, dayName) => {

        chain$ = chain$.pipe(

          // 1️⃣ CREATE DAY (KEEP dayId)
          concatMap(() =>
            this.workoutApi.addWorkoutDay(plan.id, { dayName })
          ),

          // 2️⃣ USE dayId TO CREATE EXERCISES
          concatMap((dayId: string) => {

            let exChain$: Observable<void> = of(void 0);

            exerciseMap.forEach((sets, exerciseName) => {

              exChain$ = exChain$.pipe(

                // CREATE EXERCISE (KEEP exerciseId)
                concatMap(() =>
                  this.workoutApi.addExerciseToDay(dayId, {
                    name: exerciseName
                  })
                ),

                // USE exerciseId TO CREATE SETS
                concatMap((exerciseId: string) => {

                  let setChain$: Observable<void> = of(void 0);

                  sets
                    .sort((a, b) => a.setNumber - b.setNumber)
                    .forEach(s => {
                      setChain$ = setChain$.pipe(
                        concatMap(() =>
                          this.workoutApi
                            .addSetToExercise(exerciseId, {
                              setNumber: s.setNumber,
                              reps: s.reps
                            })
                            .pipe(mapTo(void 0))
                        )
                      );
                    });

                  return setChain$;
                }),

                // collapse exercise chain
                mapTo(void 0)
              );
            });

            return exChain$;
          }),

          // collapse day chain
          mapTo(void 0)
        );
      });

      return chain$;
    }),
    finalize(() => {
      this.savingPlanId = null;
    })
  )
  .subscribe({
    next: () => {
      this.editablePlanId = null;
      this.loadMemberPlans(this.memberId!);
    },
    error: () => {
      alert('Failed to save workout plan');
    }
  });

}

deletePlan(plan: any) {

  const confirmed = window.confirm(
    `Delete workout plan "${plan.title}"?\n\nThis cannot be undone.`
  );

  if (!confirmed) return;

  this.deletingPlanId = plan.id;

  this.workoutApi
    .deleteWorkoutPlan(plan.id)
    .pipe(finalize(() => this.deletingPlanId = null))
    .subscribe({
      next: () => {
        this.activePlanId = null;
        this.builderMode = null;
        this.mode = 'VIEW';
        this.loadMemberPlans(this.memberId!);
      },
      error: () => alert('Failed to delete workout plan')
    });
}

startCreate() {
  this.creatingNewPlan = true;
  this.mode = 'EDIT';
  this.title = '';
  this.notes = '';
  this.newPlanRows = [this.emptyRow()];
}

saveAndAssign() {

  if (!this.memberId || !this.title) {
    alert('Title and Member are required');
    return;
  }

  if (!this.validateGrid(this.newPlanRows)) {
    alert('Please complete all rows');
    return;
  }

  this.loading = true;

  this.workoutApi.createWorkoutPlan({
    memberId: this.memberId,
    title: this.title,
    notes: this.notes
  })
  .pipe(
    concatMap((planId: string) => {
      const finalPlanId = planId.replace(/"/g, '');

      return this.rebuildPlanFromGrid(finalPlanId, this.newPlanRows).pipe(
        concatMap(() =>
          this.workoutApi.assignWorkoutPlan(finalPlanId, this.memberId!)
        )
      );
    }),
    finalize(() => {
      this.loading = false;
      this.creatingNewPlan = false;
    })
  )
  .subscribe({
    next: () => {
      this.mode = 'VIEW';
      this.loadMemberPlans(this.memberId!);
    },
    error: () => alert('Failed to create & assign workout plan')
  });
}


cancelCreate() {
  this.creatingNewPlan = false;
  this.newPlanRows = [];
  this.mode = 'VIEW';
}

private rebuildPlanFromGrid(
  planId: string,
  rows: WorkoutGridRow[]
): Observable<void> {

  const dayMap = this.groupGrid(rows);
  let chain$: Observable<void> = of(void 0);

  dayMap.forEach((exerciseMap, dayName) => {

    chain$ = chain$.pipe(

      concatMap(() =>
        this.workoutApi.addWorkoutDay(planId, { dayName })
      ),

      concatMap((dayId: string) => {

        let exChain$: Observable<void> = of(void 0);

        exerciseMap.forEach((sets, exerciseName) => {

          exChain$ = exChain$.pipe(

            concatMap(() =>
              this.workoutApi.addExerciseToDay(dayId, {
                name: exerciseName
              })
            ),

            concatMap((exerciseId: string) => {

              let setChain$: Observable<void> = of(void 0);

              sets
                .sort((a, b) => a.setNumber - b.setNumber)
                .forEach(s => {
                  setChain$ = setChain$.pipe(
                    concatMap(() =>
                      this.workoutApi
                        .addSetToExercise(exerciseId, {
                          setNumber: s.setNumber,
                          reps: s.reps
                        })
                        .pipe(mapTo(void 0))
                    )
                  );
                });

              return setChain$;
            }),

            mapTo(void 0)
          );
        });

        return exChain$;
      }),

      mapTo(void 0)
    );
  });

  return chain$;
}

addRowToPlan(plan: any) {
  plan.gridRows.push({
    dayName: '',
    exerciseName: '',
    setNumber: this.nextSetNumberFromPlan(plan),
    reps: ''
  });
}

private nextSetNumberFromPlan(plan: any): number {
  if (!plan.gridRows.length) return 1;
  const max = Math.max(...plan.gridRows.map((r: any) => r.setNumber || 0));
  return max + 1;
}


}
