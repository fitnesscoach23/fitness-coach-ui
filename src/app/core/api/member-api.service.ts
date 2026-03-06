import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type MemberStatus = 'ACTIVE' | 'INACTIVE';

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

patchMemberStatus(memberId: string, status: MemberStatus) {
  return this.http.patch(
    `${environment.memberApi}/members/${memberId}/status`,
    { status }
  );
}

deleteMember(memberId: string) {
  return this.http.delete(
    `${environment.memberApi}/members/${memberId}`
  );
}




}
