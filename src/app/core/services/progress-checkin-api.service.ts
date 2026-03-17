import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export interface ProgressCheckin {
  id: string;
  memberId: string;
  weight?: number;
  dietAdherence?: number;
  energy?: number;
  stepsAvg?: number;
  notes?: string;
  submittedAt: string;
}

@Injectable({ providedIn: 'root' })
export class ProgressCheckinApiService {

  constructor(private http: HttpClient) {}

  createCheckin(payload: {
    memberId: string;
    weight: number;
    dietAdherence?: number | null;
    energy?: number | null;
    stepsAvg?: number | null;
    notes?: string;
    submittedAt?: string | null;
  }) {
    return this.http.post(
      `${environment.checkinApi}/progress/checkins`,
      payload,
      { responseType: 'text' }
    );
  }

  /** ✅ ADD THIS */
  getCheckinsByMember(memberId: string): Observable<ProgressCheckin[]> {
    return this.http.get<ProgressCheckin[]>(
      `${environment.checkinApi}/progress/checkins/member/${memberId}`
    );
  }

  deleteCheckin(checkInId: string) {
    return this.http.delete(
      `${environment.checkinApi}/progress/checkins/${checkInId}`,
      { responseType: 'text' }
    );
  }
}
