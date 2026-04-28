import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkoutApiService } from '../../../../core/services/workout-api.service';
import { MemberApiService } from '../../../../core/api/member-api.service';
import { ExerciseLibraryApiService } from '../../../../core/api/exercise-library-api.service';
import { of, Observable } from 'rxjs';
import { concatMap, finalize, mapTo } from 'rxjs/operators';

interface WorkoutGridRow {
  dayName: string;
  exerciseName: string;
  muscleGroup: string;
  musclesTrained: string;
  setNumber: number | null;
  reps: string;        // e.g. "8-10"
  videoUrl: string;
}

interface WorkoutDayGroup {
  dayName: string;
  rows: WorkoutGridRow[];
}

interface MuscleGroupSummary {
  muscleGroup: string;
  totalSets: number;
  frequency: number;
  dayBreakdown: string[];
}

@Component({
  selector: 'app-workout-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './workout-create.component.html',
  styleUrls: ['./workout-create.component.scss']
})
export class WorkoutCreateComponent implements OnInit {
  private readonly rowIdentityMap = new WeakMap<WorkoutGridRow, number>();
  private rowIdentityCounter = 0;
  private draggedRowContext: { rows: WorkoutGridRow[]; row: WorkoutGridRow } | null = null;
  private readonly copyDaySelectionMap = new WeakMap<WorkoutGridRow[], Map<string, string>>();

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
exerciseLibraryItems: any[] = [];
loadingExerciseLibraryItems = false;

emptyRow(dayName = ''): WorkoutGridRow {
  return {
    dayName,
    exerciseName: '',
    muscleGroup: '',
    musclesTrained: '',
    setNumber: null,
    reps: '',
    videoUrl: ''
  };
}

  constructor(
    private workoutApi: WorkoutApiService,
    private memberApi: MemberApiService,
    private exerciseLibraryApi: ExerciseLibraryApiService,
    private router: Router,
    private route: ActivatedRoute
  ) {}
  

  ngOnInit() {
    this.loadMembers();
    this.loadExerciseLibraryItems();

    // optional preselect from query param
    const preselectedMemberId =
      this.route.snapshot.queryParamMap.get('memberId');

    if (preselectedMemberId) {
      this.memberId = preselectedMemberId;
    }
  }

  loadExerciseLibraryItems() {
    this.loadingExerciseLibraryItems = true;

    this.exerciseLibraryApi.getExercises().subscribe({
      next: (res: any[]) => {
        this.exerciseLibraryItems = [...(res || [])].sort((a, b) =>
          String(a?.exerciseName || '').localeCompare(String(b?.exerciseName || ''))
        );
        this.loadingExerciseLibraryItems = false;
      },
      error: () => {
        this.loadingExerciseLibraryItems = false;
      }
    });
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
      muscleGroup: '',
      musclesTrained: '',
      setNumber: null,
      reps: '',
      videoUrl: ''
  });
}

removeRow(index: number) {
  this.gridRows.splice(index, 1);
}

getGroupedRows(rows: WorkoutGridRow[]): WorkoutDayGroup[] {
  const orderedMap = new Map<string, WorkoutGridRow[]>();

  rows.forEach((row) => {
    const key = row.dayName?.trim() || 'Day';
    if (!orderedMap.has(key)) {
      orderedMap.set(key, []);
    }
    orderedMap.get(key)!.push(row);
  });

  return Array.from(orderedMap.entries()).map(([dayName, dayRows]) => ({
    dayName,
    rows: dayRows
  }));
}

updateDayName(rows: WorkoutGridRow[], previousDayName: string, nextDayName: string) {
  const normalizedDayName = nextDayName.trim() || previousDayName;

  rows.forEach((row) => {
    if (row.dayName === previousDayName) {
      row.dayName = normalizedDayName;
    }
  });
}

addDayToRows(rows: WorkoutGridRow[]) {
  rows.push(this.emptyRow(this.getNextDayLabel(rows)));
}

addRowToDay(rows: WorkoutGridRow[], dayName: string) {
  rows.push({
    ...this.emptyRow(dayName)
  });
}

removeRowFromRows(rows: WorkoutGridRow[], rowToRemove: WorkoutGridRow) {
  const index = rows.indexOf(rowToRemove);
  if (index >= 0) {
    rows.splice(index, 1);
  }
}

removeDayFromRows(rows: WorkoutGridRow[], dayName: string) {
  const remainingRows = rows.filter((row) => row.dayName !== dayName);
  rows.splice(0, rows.length, ...remainingRows);
}

getCopySourceOptions(rows: WorkoutGridRow[], targetDayName: string): string[] {
  return this.getGroupedRows(rows)
    .map((group) => group.dayName)
    .filter((dayName) => dayName !== targetDayName);
}

getCopySourceValue(rows: WorkoutGridRow[], targetDayName: string): string {
  return this.getDayCopySelections(rows).get(targetDayName) || '';
}

setCopySourceValue(rows: WorkoutGridRow[], targetDayName: string, sourceDayName: string): void {
  this.getDayCopySelections(rows).set(targetDayName, sourceDayName);
}

copyDayRows(rows: WorkoutGridRow[], targetDayName: string): void {
  const sourceDayName = this.getCopySourceValue(rows, targetDayName);
  if (!sourceDayName || sourceDayName === targetDayName) return;

  const sourceRows = rows
    .filter((row) => row.dayName === sourceDayName)
    .map((row) => ({
      ...row,
      dayName: targetDayName
    }));

  if (!sourceRows.length) return;

  const hasTargetRows = rows.some((row) => row.dayName === targetDayName);
  if (hasTargetRows) {
    const confirmed = window.confirm(
      `Replace all rows in "${targetDayName}" with exercises from "${sourceDayName}"?`
    );
    if (!confirmed) return;
  }

  const firstTargetIndex = rows.findIndex((row) => row.dayName === targetDayName);
  const insertIndex =
    firstTargetIndex >= 0
      ? rows.slice(0, firstTargetIndex).filter((row) => row.dayName !== targetDayName).length
      : rows.length;

  const remainingRows = rows.filter((row) => row.dayName !== targetDayName);
  remainingRows.splice(insertIndex, 0, ...sourceRows);
  rows.splice(0, rows.length, ...remainingRows);
}

trackByDayGroup(_index: number, group: WorkoutDayGroup) {
  return group.dayName;
}

trackByWorkoutRow(_index: number, row: WorkoutGridRow) {
  return this.getRowIdentity(row);
}

onWorkoutRowDragStart(rows: WorkoutGridRow[], row: WorkoutGridRow): void {
  this.draggedRowContext = { rows, row };
}

onWorkoutRowDragOver(event: DragEvent): void {
  event.preventDefault();
}

onWorkoutRowDrop(rows: WorkoutGridRow[], targetRow: WorkoutGridRow): void {
  if (!this.draggedRowContext || this.draggedRowContext.rows !== rows) return;

  const sourceRow = this.draggedRowContext.row;
  if (sourceRow === targetRow || sourceRow.dayName !== targetRow.dayName) {
    this.draggedRowContext = null;
    return;
  }

  const sourceIndex = rows.indexOf(sourceRow);
  const targetIndex = rows.indexOf(targetRow);
  if (sourceIndex < 0 || targetIndex < 0) {
    this.draggedRowContext = null;
    return;
  }

  const reordered = [...rows];
  const [movedRow] = reordered.splice(sourceIndex, 1);
  reordered.splice(targetIndex, 0, movedRow);
  rows.splice(0, rows.length, ...reordered);
  this.draggedRowContext = null;
}

onWorkoutRowDragEnd(): void {
  this.draggedRowContext = null;
}

getMuscleGroupSummary(rows: WorkoutGridRow[]): MuscleGroupSummary[] {
  const summaryMap = new Map<
    string,
    {
      totalSets: number;
      days: Map<string, number>;
    }
  >();

  rows.forEach((row) => {
    const muscleGroup = row.muscleGroup?.trim();
    const dayName = row.dayName?.trim();
    const setCount = Number(row.setNumber) || 0;

    if (!muscleGroup || !dayName || setCount <= 0) {
      return;
    }

    if (!summaryMap.has(muscleGroup)) {
      summaryMap.set(muscleGroup, {
        totalSets: 0,
        days: new Map<string, number>()
      });
    }

    const summary = summaryMap.get(muscleGroup)!;
    summary.totalSets += setCount;
    summary.days.set(dayName, (summary.days.get(dayName) || 0) + setCount);
  });

  return Array.from(summaryMap.entries())
    .map(([muscleGroup, summary]) => ({
      muscleGroup,
      totalSets: summary.totalSets,
      frequency: summary.days.size,
      dayBreakdown: Array.from(summary.days.entries()).map(
        ([dayName, sets]) => `${dayName}: ${sets}`
      )
    }))
    .sort((a, b) => b.totalSets - a.totalSets || a.muscleGroup.localeCompare(b.muscleGroup));
}

private getNextDayLabel(rows: WorkoutGridRow[]): string {
  const dayNumbers = this.getGroupedRows(rows)
    .map((group) => {
      const match = group.dayName.match(/^day\s*(\d+)$/i);
      return match ? Number(match[1]) : null;
    })
    .filter((value): value is number => value != null && Number.isFinite(value));

  const nextNumber = dayNumbers.length ? Math.max(...dayNumbers) + 1 : this.getGroupedRows(rows).length + 1;
  return `Day ${nextNumber}`;
}

private mapPlanToGrid(plan: any) {
  const rows: WorkoutGridRow[] = [];

  plan.days.forEach((day: any) => {
    day.exercises.forEach((ex: any) => {
      ex.sets.forEach((set: any) => {
        rows.push({
          dayName: day.dayName,
          exerciseName: ex.name,
          muscleGroup: ex.muscleGroup || '',
          musclesTrained: ex.musclesTrained || '',
          setNumber: set.setNumber,
          reps: set.reps?.toString() ?? '',
          videoUrl: ex.videoUrl || ''
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
          muscleGroup: ex.muscleGroup || '',
          musclesTrained: ex.musclesTrained || '',
          setNumber: set.setNumber,
          reps: set.reps?.toString() ?? '',
          videoUrl: ex.videoUrl || ''
        });
      });
    });
  });

  return rows;
}

enableEdit(plan: any) {
  this.editablePlanId = plan.id;

  if (!plan.gridRows?.length) {
    plan.gridRows = [this.emptyRow('Day 1')];
  }
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
    r.reps?.trim() &&
    this.isValidOptionalVideoUrl(r.videoUrl)
  );
}

private groupGrid(rows: WorkoutGridRow[]) {
  const dayMap = new Map<
    string,
    Map<string, { exerciseName: string; muscleGroup: string; musclesTrained: string; videoUrl: string; rows: WorkoutGridRow[] }>
  >();

  rows.forEach(row => {
    if (!dayMap.has(row.dayName)) {
      dayMap.set(row.dayName, new Map());
    }

    const exMap = dayMap.get(row.dayName)!;
    const normalizedMuscleGroup = (row.muscleGroup || '').trim();
    const normalizedMusclesTrained = (row.musclesTrained || '').trim();
    const normalizedVideoUrl = this.normalizeVideoUrl(row.videoUrl);
    const exerciseKey = `${row.exerciseName}__${normalizedMuscleGroup}__${normalizedMusclesTrained}__${normalizedVideoUrl}`;

    if (!exMap.has(exerciseKey)) {
      exMap.set(exerciseKey, {
        exerciseName: row.exerciseName,
        muscleGroup: normalizedMuscleGroup,
        musclesTrained: normalizedMusclesTrained,
        videoUrl: normalizedVideoUrl,
        rows: []
      });
    }

    exMap.get(exerciseKey)!.rows.push({
      ...row,
      muscleGroup: normalizedMuscleGroup,
      musclesTrained: normalizedMusclesTrained,
      videoUrl: normalizedVideoUrl
    });
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
    concatMap(() =>
      this.workoutApi
        .updateWorkoutPlan(plan.id, {
          title: plan.title,
          notes: plan.notes
        })
        .pipe(mapTo(void 0))
    ),
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

            exerciseMap.forEach(({ rows: sets, exerciseName, muscleGroup, musclesTrained, videoUrl }) => {

              exChain$ = exChain$.pipe(

                // CREATE EXERCISE (KEEP exerciseId)
                concatMap(() =>
                  this.workoutApi.addExerciseToDay(dayId, {
                    name: exerciseName,
                    muscleGroup,
                    musclesTrained,
                    videoUrl
                  })
                ),

                // USE exerciseId TO CREATE SETS
                concatMap((exerciseId: string) => {

                  let setChain$: Observable<void> = of(void 0);

                  sets
                    .filter((s) => s.setNumber != null)
                    .sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0))
                    .forEach(s => {
                      setChain$ = setChain$.pipe(
                        concatMap(() =>
                          this.workoutApi
                            .addSetToExercise(exerciseId, {
                              setNumber: s.setNumber!,
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
  this.newPlanRows = [this.emptyRow('Day 1')];
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

        exerciseMap.forEach(({ rows: sets, exerciseName, muscleGroup, musclesTrained, videoUrl }) => {

          exChain$ = exChain$.pipe(

            concatMap(() =>
              this.workoutApi.addExerciseToDay(dayId, {
                name: exerciseName,
                muscleGroup,
                musclesTrained,
                videoUrl
              })
            ),

            concatMap((exerciseId: string) => {

              let setChain$: Observable<void> = of(void 0);

              sets
                .filter((s) => s.setNumber != null)
                .sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0))
                .forEach(s => {
                  setChain$ = setChain$.pipe(
                    concatMap(() =>
                      this.workoutApi
                        .addSetToExercise(exerciseId, {
                          setNumber: s.setNumber!,
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
  const fallbackDayName = this.getGroupedRows(plan.gridRows)[0]?.dayName || 'Day 1';
  this.addRowToDay(plan.gridRows, fallbackDayName);
}

private nextSetNumberFromPlan(plan: any): number {
  if (!plan.gridRows.length) return 1;
  const max = Math.max(...plan.gridRows.map((r: any) => r.setNumber || 0));
  return max + 1;
}

normalizeVideoUrl(url: string | null | undefined): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

onExerciseInput(row: WorkoutGridRow) {
  this.applyExerciseLibraryByName(row);
}

applyExerciseLibraryByName(row: WorkoutGridRow) {
  const typed = row.exerciseName?.trim().toLowerCase();
  if (!typed) return;

  const match = this.exerciseLibraryItems.find(
    (ex: any) => String(ex?.exerciseName || '').trim().toLowerCase() === typed
  );

  if (!match) return;

  row.exerciseName = match.exerciseName || row.exerciseName;
  row.muscleGroup = match.muscleGroup || '';
  row.musclesTrained = match.musclesTrained || '';
  row.videoUrl = this.normalizeVideoUrl(match.videoUrl || '');
}

private isValidOptionalVideoUrl(url: string | null | undefined): boolean {
  const normalized = this.normalizeVideoUrl(url);
  if (!normalized) return true;
  return /^(https?:\/\/)[^\s]+$/i.test(normalized);
}

private getRowIdentity(row: WorkoutGridRow): number {
  let identity = this.rowIdentityMap.get(row);

  if (!identity) {
    this.rowIdentityCounter += 1;
    identity = this.rowIdentityCounter;
    this.rowIdentityMap.set(row, identity);
  }

  return identity;
}

private getDayCopySelections(rows: WorkoutGridRow[]): Map<string, string> {
  let selections = this.copyDaySelectionMap.get(rows);

  if (!selections) {
    selections = new Map<string, string>();
    this.copyDaySelectionMap.set(rows, selections);
  }

  return selections;
}

}
