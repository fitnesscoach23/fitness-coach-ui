import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class WorkoutApiService {

  constructor(private http: HttpClient) {}

  getWorkoutPlan(memberId: string) {
    return this.http.get<any>(
      `${environment.workoutApi}/workouts/member/${memberId}`
    );
  }

  getAllWorkoutPlans() {
  return this.http.get<any[]>(
    `${environment.workoutApi}/workouts`
  );
}

assignWorkoutPlan(planId: string, memberId: string) {
  return this.http.post(
    `${environment.workoutApi}/workouts/${planId}/assign/${memberId}`,
    {},
    { responseType: 'text' }
  );
}

createWorkoutPlan(payload: any) {
  return this.http.post(
    `${environment.workoutApi}/workouts`,
    payload,
    { responseType: 'text' }   // REQUIRED
  );
}

getWorkoutPlanById(planId: string) {
  return this.http.get<any>(
    `${environment.workoutApi}/workouts/${planId}`
  );
}


saveExercise(
  exerciseId: string,
  payload: {
    name: string;
    musclesTrained?: string;
    notes?: string;
    sets: Array<{
      id?: string;
      setNumber: number;
      reps: number;
      weight?: number;
      rpe?: number;
      tempo?: string;
      rest?: string;
    }>;
  }
) {
  return this.http.put(
    `${environment.workoutApi}/workouts/exercises/${exerciseId}/full`,
    payload,
    { responseType: 'text' }
  );
}

deleteExercise(exerciseId: string) {
  return this.http.delete(
    `${environment.workoutApi}/workouts/exercises/${exerciseId}`,
    { responseType: 'text' }
  );
}


addWorkoutDay(planId: string, payload: { dayName: string }) {
  return this.http.post<string>(
    `${environment.workoutApi}/workouts/${planId}/days`,
    payload
  );
}

addExerciseToDay(
  dayId: string,
  payload: { name: string; musclesTrained?: string; notes?: string; videoUrl?: string }
) {
  return this.http.post<string>(
    `${environment.workoutApi}/workouts/days/${dayId}/exercises`,
    payload
  );
}

addSetToExercise(
  exerciseId: string,
  payload: {
    setNumber: number;
    reps: string;     // ✅ FIXED
    weight?: number;
    rpe?: number;
    tempo?: string;
    rest?: string;
  }
) {
  return this.http.post(
    `${environment.workoutApi}/workouts/exercises/${exerciseId}/sets`,
    payload
  );
}


deleteWorkoutDay(dayId: string) {
  return this.http.delete<void>(
    `${environment.workoutApi}/workouts/days/${dayId}`
  );
}

deleteWorkoutPlan(planId: string) {
  return this.http.delete<void>(
    `${environment.workoutApi}/workouts/${planId}`
  );
}



}
