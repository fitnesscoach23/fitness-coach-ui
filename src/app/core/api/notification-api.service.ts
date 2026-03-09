import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type NotificationChannel = 'EMAIL' | 'SMS';
export type NotificationType = 'WELCOME' | 'PAYMENT_REMINDER' | 'GENERIC';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface SendNotificationPayload {
  memberId: string;
  channel: NotificationChannel;
  type: NotificationType;
  recipient: string;
  subject?: string;
  message: string;
}

export interface NotificationListItem {
  id: string;
  memberId: string;
  channel: NotificationChannel;
  type: NotificationType;
  recipient: string;
  subject?: string | null;
  message: string;
  status: NotificationStatus;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationApiService {
  constructor(private http: HttpClient) {}

  send(payload: SendNotificationPayload) {
    return this.http.post<{ id: string; status: NotificationStatus }>(
      `${environment.notificationApi}/notifications/send`,
      payload
    );
  }

  getById(notificationId: string) {
    return this.http.get<NotificationListItem>(
      `${environment.notificationApi}/notifications/${notificationId}`
    );
  }

  getAll(filters?: {
    memberId?: string | null;
    channel?: NotificationChannel | null;
    status?: NotificationStatus | null;
  }) {
    let params = new HttpParams();
    if (filters?.memberId) {
      params = params.set('memberId', filters.memberId);
    }
    if (filters?.channel) {
      params = params.set('channel', filters.channel);
    }
    if (filters?.status) {
      params = params.set('status', filters.status);
    }

    return this.http.get<NotificationListItem[]>(
      `${environment.notificationApi}/notifications`,
      { params }
    );
  }
}

