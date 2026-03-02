import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ProgressCheckinPhotoApiService {

  constructor(private http: HttpClient) {}

  upload(
    checkInId: string,
    type: 'FRONT' | 'SIDE' | 'BACK',
    file: File
  ) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    return this.http.post(
      `${environment.checkinApi}/progress/checkins/photos/${checkInId}`,
      formData,
      { responseType: 'text' }
    );
  }

  list(checkInId: string) {
    return this.http.get<any[]>(
      `${environment.checkinApi}/progress/checkins/photos/${checkInId}`
    );
  }
}
