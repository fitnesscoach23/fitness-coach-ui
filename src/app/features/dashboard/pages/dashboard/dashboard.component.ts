import { Component, OnInit } from '@angular/core';
import { MemberApiService } from '../../../../core/api/member-api.service';
import { CommonModule } from '@angular/common';
import { BillingApiService } from '../../../../core/api/billing-api.service';
import { catchError, forkJoin, map, of } from 'rxjs';

type DueSoonMember = {
  id: string;
  fullName: string;
  email: string;
  renewalDate: string;
  daysRemaining: number;
  totalPending: number;
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  private readonly dueSoonDays = 7;

  totalMembers = 0;
  loading = true;
  dueSoonMembers: DueSoonMember[] = [];
  dueSoonLoading = true;

  constructor(
    private memberApi: MemberApiService,
    private billingApi: BillingApiService
  ) {}

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    this.memberApi.getMembers().subscribe({
      next: (res: any) => {
        const members = res || [];
        this.totalMembers = members.length || 0;
        this.loading = false;
        this.loadDueSoonBilling(members);
      },
      error: () => {
        this.loading = false;
        this.dueSoonLoading = false;
      }
    });
  }

  formatDate(value: string): string {
    if (!value || value === '-') return '-';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(parsed);
  }

  private loadDueSoonBilling(members: any[]): void {
    if (!members.length) {
      this.dueSoonMembers = [];
      this.dueSoonLoading = false;
      return;
    }

    const requests = members.map((member) =>
      forkJoin({
        subscription: this.billingApi.getSubscription(member.id).pipe(
          map((res: any[]) => (res?.length ? res[0] : null)),
          catchError(() => of(null))
        ),
        payments: this.billingApi.getPaymentHistory(member.id).pipe(
          catchError(() => of([]))
        )
      }).pipe(
        map(({ subscription, payments }) => {
          const override = this.getStoredOverride(member.id);
          const totalPending = (payments || [])
            .filter((payment: any) => payment.status === 'PENDING')
            .reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0);
          const renewalDate = override?.renewalDate || subscription?.endDate || '';
          const daysRemaining = this.getDaysRemaining(renewalDate);

          return {
            id: member.id,
            fullName: member.fullName,
            email: member.email,
            renewalDate,
            daysRemaining,
            totalPending
          } as DueSoonMember;
        })
      )
    );

    forkJoin(requests).subscribe({
      next: (rows) => {
        this.dueSoonMembers = rows
          .filter((row) => row.daysRemaining >= 0 && row.daysRemaining <= this.dueSoonDays)
          .sort((a, b) => a.daysRemaining - b.daysRemaining);
        this.dueSoonLoading = false;
      },
      error: () => {
        this.dueSoonMembers = [];
        this.dueSoonLoading = false;
      }
    });
  }

  private getDaysRemaining(value: string): number {
    if (!value) return Number.POSITIVE_INFINITY;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = new Date(value);
    if (Number.isNaN(target.getTime())) return Number.POSITIVE_INFINITY;
    target.setHours(0, 0, 0, 0);

    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  private getStoredOverride(memberId: string): any | null {
    const raw = localStorage.getItem(`member_subscription_override_${memberId}`);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
