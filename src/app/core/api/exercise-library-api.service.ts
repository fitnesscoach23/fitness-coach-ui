import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface ExerciseLibraryPayload {
  srNo: number;
  muscleGroup: string;
  exerciseName: string;
  videoUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExerciseLibraryApiService {
  constructor(private http: HttpClient) {}

  createExercise(payload: ExerciseLibraryPayload) {
    return this.http.post(
      `${environment.workoutApi}/exercise-library`,
      payload,
      { responseType: 'text' }
    );
  }

  getExercises() {
    return this.http.get<any[]>(
      `${environment.workoutApi}/exercise-library`
    );
  }

  getExerciseById(exerciseId: string) {
    return this.http.get<any>(
      `${environment.workoutApi}/exercise-library/${exerciseId}`
    );
  }

  updateExercise(exerciseId: string, payload: ExerciseLibraryPayload) {
    return this.http.put(
      `${environment.workoutApi}/exercise-library/${exerciseId}`,
      payload
    );
  }

  deleteExercise(exerciseId: string) {
    return this.http.delete(
      `${environment.workoutApi}/exercise-library/${exerciseId}`
    );
  }

  assignExerciseToMember(exerciseId: string, memberId: string) {
    return this.http.post(
      `${environment.workoutApi}/exercise-library/${exerciseId}/assign/${memberId}`,
      {},
      { responseType: 'text' }
    );
  }

  getAssignedExercisesByMember(memberId: string) {
    return this.http.get<any[]>(
      `${environment.workoutApi}/exercise-library/member/${memberId}`
    );
  }

  unassignExerciseFromMember(exerciseId: string, memberId: string) {
    return this.http.delete(
      `${environment.workoutApi}/exercise-library/${exerciseId}/member/${memberId}`
    );
  }
}
