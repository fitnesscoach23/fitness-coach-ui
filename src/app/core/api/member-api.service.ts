import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MemberApiService {

  constructor(private http: HttpClient) { }

  getMembers() {
  return this.http.get<any[]>(
    `${environment.memberApi}/members`
  );
}

createMember(payload: any) {
  return this.http.post(
    `${environment.memberApi}/members`,
    payload
  );
}

getMemberById(memberId: string) {
  return this.http.get(
    `${environment.memberApi}/members/${memberId}`
  );
}

updateMember(memberId: string, payload: any) {
  return this.http.put(
    `${environment.memberApi}/members/${memberId}`,
    payload
  );
}

deleteMember(memberId: string) {
  return this.http.delete(
    `${environment.memberApi}/members/${memberId}`
  );
}




}
