import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthApiService {

  constructor(private http: HttpClient) {}

  login(payload: { email: string; password: string }) {
    return this.http.post(
      `${environment.authApi}/auth/login`,
      payload
    );
  }
}
