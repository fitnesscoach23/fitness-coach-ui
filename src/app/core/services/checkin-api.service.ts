import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CheckinApiService {

  constructor(private http: HttpClient) {}

  getCheckins(memberId: string) {
    return this.http.get<any[]>(
      `${environment.checkinApi}/checkins/member/${memberId}`
    );
  }

  createCheckin(payload: any) {
  return this.http.post(
    `${environment.checkinApi}/checkins`,
    payload
  );
}

updateCheckin(checkinId: string, payload: any) {
  return this.http.put(
    `${environment.checkinApi}/checkins/${checkinId}`,
    payload
  );
}

getCheckinPhotos(checkinId: string) {
  return this.http.get<any[]>(
    `${environment.checkinApi}/checkin/photos/${checkinId}`
  );
}

uploadCheckinPhotos(checkinId: string, files: File[]) {
  const formData = new FormData();
  files.forEach(file => formData.append('file', file));

  return this.http.post(
    `${environment.checkinApi}/checkin/photos/${checkinId}`,
    formData
  );
}

getCheckinPhotoUrl(fileName: string): string {
  return `${environment.checkinApi}/checkin/photos/file/${fileName}`;
}


}
