import { Component, OnInit } from '@angular/core';
import { MemberApiService } from '../../../../core/api/member-api.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {

  totalMembers = 0;
  loading = true;

  constructor(private memberApi: MemberApiService) {}

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    this.memberApi.getMembers().subscribe({
      next: (res: any) => {
        this.totalMembers = res?.length || 0;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }
}
