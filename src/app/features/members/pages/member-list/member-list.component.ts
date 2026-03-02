import { Component, OnInit } from '@angular/core';
import { MemberApiService } from '../../../../core/api/member-api.service';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-member-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './member-list.component.html',
  styleUrls: ['./member-list.component.scss']
})
export class MemberListComponent implements OnInit {

  members: any[] = [];

  loading = true;
  error: string | null = null;

  constructor(private memberApi: MemberApiService) {}

  ngOnInit() {
    this.loadMembers();
  }

  loadMembers() {
    this.loading = true;
    this.error = null;

    this.memberApi.getMembers().subscribe({
      next: (res: any) => {
        this.members = res || [];
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.error = 'Failed to load members';
        this.loading = false;
      }
    });
  }
}
