import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DailyCheckinDay {
  id: string;
  checkInDate: string;
  exerciseDone: boolean;
  stepsCount: number;
  active: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyCheckinSummary {
  daysInMonth: number;
  recordedDays: number;
  activeDays: number;
  exerciseDays: number;
  totalSteps: number;
}

export interface DailyCheckinCalendar {
  memberId: string;
  month: string;
  days: DailyCheckinDay[];
  summary: DailyCheckinSummary;
}

export interface DailyCheckinUpsertRequest {
  memberId: string;
  checkInDate: string;
  exerciseDone: boolean;
  stepsCount: number;
  notes?: string | null;
}

@Injectable({ providedIn: 'root' })
export class DailyCheckinApiService {
  constructor(private http: HttpClient) {}

  upsertDailyCheckin(payload: DailyCheckinUpsertRequest): Observable<DailyCheckinDay> {
    return this.http.post<DailyCheckinDay>(
      `${environment.checkinApi}/daily-checkins`,
      payload
    );
  }

  getMemberCalendar(memberId: string, month: string): Observable<DailyCheckinCalendar> {
    return this.http.get<DailyCheckinCalendar>(
      `${environment.checkinApi}/daily-checkins/member/${memberId}/calendar`,
      { params: { month } }
    );
  }

  getMemberSummary(memberId: string, month: string): Observable<DailyCheckinSummary> {
    return this.http.get<DailyCheckinSummary>(
      `${environment.checkinApi}/daily-checkins/member/${memberId}/summary`,
      { params: { month } }
    );
  }

  deleteDailyCheckin(checkInId: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.checkinApi}/daily-checkins/${checkInId}`
    );
  }
}
