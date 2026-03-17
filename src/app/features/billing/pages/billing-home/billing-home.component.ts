import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { BillingApiService } from '../../../../core/api/billing-api.service';
import { MemberApiService, MemberStatus } from '../../../../core/api/member-api.service';

declare const Razorpay: any;

type OverrideCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

type BillingRow = {
  id: string;
  fullName: string;
  email: string;
  planName: string;
  status: string;
  memberStatus: MemberStatus;
  renewalDate: string;
  totalPaid: number;
  totalPending: number;
};

@Component({
  selector: 'app-billing-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './billing-home.component.html',
  styleUrls: ['./billing-home.component.scss']
})
export class BillingHomeComponent implements OnInit {
  private readonly expirySoonDays = 7;
  members: any[] = [];
  membersLoading = true;
  membersError: string | null = null;

  selectedMemberId = '';
  selectedMember: any = null;

  billingRows: BillingRow[] = [];
  billingRowsLoading = true;

  subscription: any = null;
  subscriptionLoading = false;
  payments: any[] = [];
  paymentsLoading = false;

  paymentAmount: number | null = null;
  paymentActionLoading = false;
  paymentActionError: string | null = null;
  deletingPaymentId: string | null = null;
  deletePaymentError: string | null = null;

  onlineAmount: number | null = null;
  onlinePaymentLoading = false;
  onlinePaymentError: string | null = null;

  totalPaid = 0;
  totalPending = 0;

  overrideActiveSince = '';
  overrideRenewalDate = '';
  overrideCycle: OverrideCycle = 'MONTHLY';
  autoCalculateRenewal = true;
  overrideMessage: string | null = null;
  memberStatusUpdating = false;

  constructor(
    private memberApi: MemberApiService,
    private billingApi: BillingApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadMembers();
  }

  get displayedActiveSince(): string {
    return this.overrideActiveSince || this.subscription?.startDate || '-';
  }

  get displayedRenewalDate(): string {
    return this.overrideRenewalDate || this.subscription?.endDate || '-';
  }

  get selectedMemberSystemStatus(): 'ACTIVE' | 'INACTIVE' {
    return this.selectedMember?.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  }

  loadMembers(): void {
    this.membersLoading = true;
    this.membersError = null;

    this.memberApi.getMembers().subscribe({
      next: (res: any[]) => {
        this.members = res || [];
        this.membersLoading = false;

        if (this.members.length > 0) {
          this.selectedMemberId = this.members[0].id;
          this.onMemberChange();
        } else {
          this.billingRows = [];
          this.billingRowsLoading = false;
        }

        this.loadAllMemberBilling();
      },
      error: () => {
        this.membersLoading = false;
        this.billingRowsLoading = false;
        this.membersError = 'Failed to load members';
      }
    });
  }

  onMemberChange(): void {
    if (!this.selectedMemberId) {
      this.selectedMember = null;
      this.subscription = null;
      this.payments = [];
      return;
    }

    this.selectedMember = this.members.find((m) => m.id === this.selectedMemberId) || null;
    this.loadSubscriptionOverride();
    this.loadSelectedMemberBilling();
  }

  private fetchBillingBundle(memberId: string) {
    const subscription$ = this.billingApi.getSubscription(memberId).pipe(
      map((res: any[]) => (res?.length ? res[0] : null)),
      catchError(() => of(null))
    );

    const payments$ = this.billingApi.getPaymentHistory(memberId).pipe(
      catchError(() => of([]))
    );

    return forkJoin({ subscription: subscription$, payments: payments$ });
  }

  private loadSelectedMemberBilling(): void {
    if (!this.selectedMemberId) return;

    this.subscriptionLoading = true;
    this.paymentsLoading = true;

    this.fetchBillingBundle(this.selectedMemberId).subscribe({
      next: ({ subscription, payments }) => {
        this.subscription = subscription;
        this.payments = [...(payments || [])];
        this.calculatePaymentSummary();

        if (!this.overrideActiveSince && this.subscription?.startDate) {
          this.overrideActiveSince = this.normalizeDateInput(this.subscription.startDate);
        }
        if (!this.overrideRenewalDate && this.subscription?.endDate) {
          this.overrideRenewalDate = this.normalizeDateInput(this.subscription.endDate);
        }

        this.subscriptionLoading = false;
        this.paymentsLoading = false;
      },
      error: () => {
        this.subscriptionLoading = false;
        this.paymentsLoading = false;
      }
    });
  }

  loadAllMemberBilling(): void {
    if (!this.members.length) {
      this.billingRows = [];
      this.billingRowsLoading = false;
      return;
    }

    this.billingRowsLoading = true;

    const requests = this.members.map((member) =>
      this.fetchBillingBundle(member.id).pipe(
        map(({ subscription, payments }) => {
          const totalPaid = (payments || [])
            .filter((p: any) => p.status === 'SUCCESS')
            .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
          const totalPending = (payments || [])
            .filter((p: any) => p.status === 'PENDING')
            .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

          return {
            id: member.id,
            fullName: member.fullName,
            email: member.email,
            planName: subscription?.planName || 'No Plan',
            status: subscription?.status || 'NO_PLAN',
            renewalDate: this.resolveRenewalDate(member.id, subscription),
            memberStatus: member.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
            totalPaid,
            totalPending
          } as BillingRow;
        })
      )
    );

    forkJoin(requests).subscribe({
      next: (rows) => {
        this.billingRows = rows.sort((a, b) => b.totalPending - a.totalPending);
        this.autoMarkOverdueMembersInactive(this.billingRows);
        this.billingRowsLoading = false;
      },
      error: () => {
        this.billingRowsLoading = false;
      }
    });
  }

  onOverrideActiveSinceChange(): void {
    if (this.autoCalculateRenewal) {
      this.applyCycleToRenewal();
    }
  }

  onOverrideCycleChange(): void {
    if (this.autoCalculateRenewal) {
      this.applyCycleToRenewal();
    }
  }

  saveSubscriptionOverride(): void {
    this.overrideMessage = null;

    if (!this.selectedMemberId) {
      this.overrideMessage = 'Select a member first';
      return;
    }

    if (!this.overrideActiveSince) {
      this.overrideMessage = 'Active Since is required';
      return;
    }

    if (this.autoCalculateRenewal) {
      this.applyCycleToRenewal();
    }

    if (!this.overrideRenewalDate) {
      this.overrideMessage = 'Renewal Date is required';
      return;
    }

    const payload = {
      activeSince: this.overrideActiveSince,
      renewalDate: this.overrideRenewalDate,
      cycle: this.overrideCycle,
      autoCalculate: this.autoCalculateRenewal
    };

    localStorage.setItem(this.getOverrideStorageKey(this.selectedMemberId), JSON.stringify(payload));
    this.overrideMessage = 'Subscription override saved';
    this.loadAllMemberBilling();
  }

  clearSubscriptionOverride(): void {
    if (!this.selectedMemberId) return;

    localStorage.removeItem(this.getOverrideStorageKey(this.selectedMemberId));
    this.overrideMessage = 'Subscription override cleared';
    this.overrideCycle = 'MONTHLY';
    this.autoCalculateRenewal = true;
    this.overrideActiveSince = this.subscription?.startDate
      ? this.normalizeDateInput(this.subscription.startDate)
      : '';
    this.overrideRenewalDate = this.subscription?.endDate
      ? this.normalizeDateInput(this.subscription.endDate)
      : '';

    this.loadAllMemberBilling();
  }

  private applyCycleToRenewal(): void {
    if (!this.overrideActiveSince) return;

    const cycleMonths =
      this.overrideCycle === 'MONTHLY' ? 1 : this.overrideCycle === 'QUARTERLY' ? 3 : 12;

    const start = new Date(`${this.overrideActiveSince}T00:00:00`);
    if (Number.isNaN(start.getTime())) return;

    start.setMonth(start.getMonth() + cycleMonths);
    this.overrideRenewalDate = start.toISOString().slice(0, 10);
  }

  private loadSubscriptionOverride(): void {
    if (!this.selectedMemberId) return;

    const stored = this.getStoredOverride(this.selectedMemberId);
    if (!stored) {
      this.overrideCycle = 'MONTHLY';
      this.autoCalculateRenewal = true;
      this.overrideActiveSince = '';
      this.overrideRenewalDate = '';
      this.overrideMessage = null;
      return;
    }

    this.overrideActiveSince = stored.activeSince || '';
    this.overrideRenewalDate = stored.renewalDate || '';
    this.overrideCycle = stored.cycle || 'MONTHLY';
    this.autoCalculateRenewal = stored.autoCalculate ?? true;
    this.overrideMessage = null;
  }

  private getStoredOverride(memberId: string): any | null {
    const raw = localStorage.getItem(this.getOverrideStorageKey(memberId));
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private getOverrideStorageKey(memberId: string): string {
    return `member_subscription_override_${memberId}`;
  }

  private resolveRenewalDate(memberId: string, subscription: any): string {
    const override = this.getStoredOverride(memberId);
    if (override?.renewalDate) {
      return override.renewalDate;
    }

    if (memberId === this.selectedMemberId && this.displayedRenewalDate && this.displayedRenewalDate !== '-') {
      return this.displayedRenewalDate;
    }

    return subscription?.endDate || '-';
  }

  private normalizeDateInput(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  }

  startManualPayment(): void {
    if (!this.selectedMemberId || !this.paymentAmount) return;

    this.paymentActionLoading = true;
    this.paymentActionError = null;

    this.billingApi.startManualPayment(this.selectedMemberId, this.paymentAmount).subscribe({
      next: () => {
        this.paymentActionLoading = false;
        this.paymentAmount = null;
        this.loadSelectedMemberBilling();
        this.loadAllMemberBilling();
      },
      error: () => {
        this.paymentActionLoading = false;
        this.paymentActionError = 'Failed to start payment';
      }
    });
  }

  confirmPayment(paymentId: string): void {
    this.billingApi.confirmPayment(paymentId).subscribe({
      next: () => {
        this.loadSelectedMemberBilling();
        this.loadAllMemberBilling();
      }
    });
  }

  deletePayment(paymentId: string): void {
    const confirmed = window.confirm('Delete this payment history entry? This action cannot be undone.');
    if (!confirmed) return;

    this.deletingPaymentId = paymentId;
    this.deletePaymentError = null;

    this.billingApi.deletePayment(paymentId).subscribe({
      next: () => {
        this.deletingPaymentId = null;
        this.loadSelectedMemberBilling();
        this.loadAllMemberBilling();
      },
      error: () => {
        this.deletingPaymentId = null;
        this.deletePaymentError = 'Failed to delete payment history';
      }
    });
  }

  startOnlinePayment(): void {
    if (!this.selectedMemberId || !this.onlineAmount) return;

    this.onlinePaymentLoading = true;
    this.onlinePaymentError = null;

    this.billingApi.startOnlinePayment(this.selectedMemberId, this.onlineAmount).subscribe({
      next: (order: any) => {
        this.onlinePaymentLoading = false;
        this.onlineAmount = null;
        this.openRazorpayCheckout(order);
      },
      error: () => {
        this.onlinePaymentLoading = false;
        this.onlinePaymentError = 'Failed to start online payment';
      }
    });
  }

  private openRazorpayCheckout(order: any): void {
    const options = {
      key: order.razorpayKeyId,
      amount: order.amount,
      currency: order.currency,
      name: 'Fitness Coach',
      description: 'Subscription Payment',
      order_id: order.razorpayOrderId,
      handler: () => {
        alert('Payment completed. Updating status shortly.');
        setTimeout(() => {
          this.loadSelectedMemberBilling();
          this.loadAllMemberBilling();
        }, 3000);
      },
      prefill: {
        email: this.selectedMember?.email,
        contact: this.selectedMember?.phone
      },
      theme: {
        color: '#2563eb'
      }
    };

    const rzp = new Razorpay(options);
    rzp.open();
  }

  calculatePaymentSummary(): void {
    this.totalPaid = this.payments
      .filter((p) => p.status === 'SUCCESS')
      .reduce((sum, p) => sum + p.amount, 0);

    this.totalPending = this.payments
      .filter((p) => p.status === 'PENDING')
      .reduce((sum, p) => sum + p.amount, 0);
  }

  openMemberProfile(memberId: string): void {
    this.router.navigate(['/members', memberId]);
  }

  openReminderForSelectedMember(): void {
    if (!this.selectedMember) return;

    const subject = 'Payment reminder';
    const message = `Hi ${this.selectedMember.fullName || ''}, your payment is due. Pending amount: ₹${this.totalPending}.`;

    this.router.navigate(['/notifications'], {
      queryParams: {
        memberId: this.selectedMember.id,
        channel: 'EMAIL',
        type: 'PAYMENT_REMINDER',
        recipient: this.selectedMember.email || '',
        subject,
        message
      }
    });
  }

  openReminderForMember(row: BillingRow): void {
    const subject = 'Payment reminder';
    const message = `Hi ${row.fullName || ''}, your payment is due. Pending amount: ₹${row.totalPending}.`;

    this.router.navigate(['/notifications'], {
      queryParams: {
        memberId: row.id,
        channel: 'EMAIL',
        type: 'PAYMENT_REMINDER',
        recipient: row.email || '',
        subject,
        message
      }
    });
  }

  formatDate(value: string): string {
    if (!value || value === '-') return '-';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(parsed);
  }

  getDaysRemaining(renewalDate: string): number | null {
    if (!renewalDate || renewalDate === '-') return null;

    const renewal = new Date(`${renewalDate.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(renewal.getTime())) return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = renewal.getTime() - today.getTime();

    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  getDaysRemainingLabel(renewalDate: string): string {
    const days = this.getDaysRemaining(renewalDate);
    if (days == null) return '-';
    if (days < 0) return `${Math.abs(days)} day(s) overdue`;
    if (days === 0) return 'Due today';
    return `${days} day(s) left`;
  }

  isExpiringSoon(renewalDate: string): boolean {
    const days = this.getDaysRemaining(renewalDate);
    return days != null && days >= 0 && days <= this.expirySoonDays;
  }

  isExpired(renewalDate: string): boolean {
    const days = this.getDaysRemaining(renewalDate);
    return days != null && days < 0;
  }

  setMemberStatus(memberId: string, status: 'ACTIVE' | 'INACTIVE') {
    const row = this.billingRows.find((item) => item.id === memberId);
    if (!row) return;
    if (status === 'ACTIVE' && this.isExpired(row.renewalDate)) return;

    this.memberStatusUpdating = true;
    this.memberApi.patchMemberStatus(memberId, status).subscribe({
      next: () => {
        this.applyMemberStatusLocally(memberId, status);
        this.memberStatusUpdating = false;
      },
      error: () => {
        this.memberStatusUpdating = false;
      }
    });
  }

  canActivateMember(row: BillingRow): boolean {
    return !this.isExpired(row.renewalDate);
  }

  private autoMarkOverdueMembersInactive(rows: BillingRow[]) {
    const overdueMembers = rows.filter(
      (row) => this.isExpired(row.renewalDate) && row.memberStatus !== 'INACTIVE'
    );

    if (!overdueMembers.length) {
      return;
    }

    const calls = overdueMembers.map((row) =>
      this.memberApi.patchMemberStatus(row.id, 'INACTIVE').pipe(
        map(() => row.id),
        catchError(() => of(null))
      )
    );

    forkJoin(calls).subscribe({
      next: (updatedIds) => {
        updatedIds.filter((id): id is string => !!id).forEach((id) => {
          this.applyMemberStatusLocally(id, 'INACTIVE');
        });
      }
    });
  }

  private applyMemberStatusLocally(memberId: string, status: MemberStatus) {
    this.members = this.members.map((member) =>
      member.id === memberId ? { ...member, status } : member
    );
    this.billingRows = this.billingRows.map((row) =>
      row.id === memberId ? { ...row, memberStatus: status } : row
    );
    if (this.selectedMemberId === memberId && this.selectedMember) {
      this.selectedMember = { ...this.selectedMember, status };
    }
  }

  trackByPaymentId(index: number, payment: any): string {
    return payment?.id || String(index);
  }

  trackByMemberId(index: number, row: BillingRow): string {
    return row.id;
  }
}
