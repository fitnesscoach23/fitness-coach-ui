import { Component, OnInit } from '@angular/core';
import { MemberApiService } from '../../../../core/api/member-api.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BillingApiService } from '../../../../core/api/billing-api.service';
import { catchError, forkJoin, map, of } from 'rxjs';
import { WorkoutApiService } from '../../../../core/services/workout-api.service';
import { DietApiService } from '../../../../core/services/diet-api.service';
import { ProgressCheckinApiService } from '../../../../core/services/progress-checkin-api.service';

type DueSoonMember = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  planName: string;
  activeSince: string;
  renewalDate: string;
  daysRemaining: number;
  totalPending: number;
  amountSource: string;
};

type CheckinReminderRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  cadenceDays: number;
  lastCheckinDate: string;
  nextCheckinDate: string;
  daysUntilDue: number;
  checkinCount: number;
  cadenceConfigured: boolean;
  latestCheckin: any | null;
  previousCheckin: any | null;
  latestWeight: number | null;
  weightDelta: number | null;
  latestSteps: number | null;
  stepsDelta: number | null;
  latestDietAdherence: number | null;
  latestEnergy: number | null;
  latestExerciseRating: number | null;
  latestNotes: string;
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  private readonly dueSoonDays = 7;

  totalMembers = 0;
  loading = true;
  kpiLoading = true;
  activePlanCount = 0;
  activeWorkoutPlanCount = 0;
  activeDietPlanCount = 0;
  monthlyRevenue = 0;
  revenueTrendLabel = 'No revenue last month';
  weeklyCheckinCount = 0;
  pendingReviewCount = 0;
  dueSoonMembers: DueSoonMember[] = [];
  selectedDueMember: DueSoonMember | null = null;
  snapshotDraftAmount: number | null = null;
  snapshotDraftRenewalDate = '';
  dueSoonLoading = true;
  members: any[] = [];
  checkinReminderRows: CheckinReminderRow[] = [];
  checkinReminderLoading = true;
  checkinCadenceMemberId = '';
  checkinCadenceDays = 7;
  activeSmartPanel: 'checkins' | 'billing' = 'checkins';
  selectedCheckinMember: CheckinReminderRow | null = null;

  constructor(
    private memberApi: MemberApiService,
    private billingApi: BillingApiService,
    private workoutApi: WorkoutApiService,
    private dietApi: DietApiService,
    private progressCheckinApi: ProgressCheckinApiService
  ) {}

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    this.memberApi.getMembers().subscribe({
      next: (res: any) => {
        const members = res || [];
        this.members = members;
        this.totalMembers = members.length || 0;
        if (!this.checkinCadenceMemberId && members.length) {
          this.checkinCadenceMemberId = members[0].id;
          this.checkinCadenceDays = this.getStoredCheckinCadenceDays(members[0].id) || 7;
        }
        this.loading = false;
        this.loadDueSoonBilling(members);
        this.loadDashboardKpis(members);
      },
      error: () => {
        this.loading = false;
        this.kpiLoading = false;
        this.dueSoonLoading = false;
        this.checkinReminderLoading = false;
      }
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value || 0);
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

  getBillingAttentionLabel(daysRemaining: number): string {
    if (!Number.isFinite(daysRemaining)) return '-';
    if (daysRemaining < 0) return `${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} overdue`;
    if (daysRemaining === 0) return 'Due today';
    return `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`;
  }

  isOverdue(daysRemaining: number): boolean {
    return Number.isFinite(daysRemaining) && daysRemaining < 0;
  }

  selectDueMember(member: DueSoonMember): void {
    this.selectedDueMember = member;
    this.snapshotDraftAmount = member.totalPending;
    this.snapshotDraftRenewalDate = this.normalizeDateInput(member.renewalDate);
  }

  clearSelectedDueMember(): void {
    this.selectedDueMember = null;
    this.snapshotDraftAmount = null;
    this.snapshotDraftRenewalDate = '';
  }

  saveSnapshotEdits(): void {
    if (!this.selectedDueMember) return;

    const amount = Number(this.snapshotDraftAmount) || 0;
    const renewalDate = this.snapshotDraftRenewalDate || this.selectedDueMember.renewalDate;
    const daysRemaining = this.getDaysRemaining(renewalDate);

    const updatedMember = {
      ...this.selectedDueMember,
      totalPending: amount,
      renewalDate,
      daysRemaining,
      amountSource: 'Edited'
    };

    this.dueSoonMembers = this.dueSoonMembers
      .map((member) => member.id === updatedMember.id ? updatedMember : member)
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
    this.selectedDueMember = updatedMember;

    localStorage.setItem(
      this.getSnapshotOverrideStorageKey(updatedMember.id),
      JSON.stringify({ pendingAmount: amount, renewalDate })
    );
  }

  resetSnapshotEdits(): void {
    if (!this.selectedDueMember) return;

    const memberId = this.selectedDueMember.id;
    localStorage.removeItem(this.getSnapshotOverrideStorageKey(memberId));
    this.clearSelectedDueMember();
    this.loadStats();
  }

  onCheckinCadenceMemberChange(): void {
    this.checkinCadenceDays = this.getStoredCheckinCadenceDays(this.checkinCadenceMemberId) || 7;
  }

  saveCheckinCadence(): void {
    if (!this.checkinCadenceMemberId) return;

    localStorage.setItem(
      this.getCheckinCadenceStorageKey(this.checkinCadenceMemberId),
      String(Number(this.checkinCadenceDays) || 7)
    );
    this.loadStats();
  }

  clearCheckinCadence(): void {
    if (!this.checkinCadenceMemberId) return;

    localStorage.removeItem(this.getCheckinCadenceStorageKey(this.checkinCadenceMemberId));
    this.loadStats();
  }

  getCheckinDueLabel(daysUntilDue: number): string {
    if (!Number.isFinite(daysUntilDue)) return '-';
    if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? '' : 's'} overdue`;
    if (daysUntilDue === 0) return 'Due today';
    return `${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'} left`;
  }

  isCheckinOverdue(daysUntilDue: number): boolean {
    return Number.isFinite(daysUntilDue) && daysUntilDue < 0;
  }

  get dueCheckinCount(): number {
    return this.checkinReminderRows.filter((member) =>
      member.cadenceConfigured && member.daysUntilDue <= 0
    ).length;
  }

  get billingAttentionCount(): number {
    return this.dueSoonMembers.length;
  }

  setSmartPanel(panel: 'checkins' | 'billing'): void {
    this.activeSmartPanel = panel;
  }

  selectCheckinMember(member: CheckinReminderRow): void {
    this.selectedCheckinMember = member;
  }

  getCheckinMetricValue(value: number | null, suffix = ''): string {
    if (value == null || !Number.isFinite(value)) return 'NA';
    return `${this.formatSmartNumber(value)}${suffix}`;
  }

  getCheckinDeltaLabel(value: number | null, suffix = ''): string {
    if (value == null || !Number.isFinite(value)) return 'NA';
    const prefix = value > 0 ? '+' : '';
    return `${prefix}${this.formatSmartNumber(value)}${suffix}`;
  }

  getCheckinTrendClass(value: number | null, preferDecrease = false): string {
    if (value == null || !Number.isFinite(value) || value === 0) return '';
    const improved = preferDecrease ? value < 0 : value > 0;
    return improved ? 'trend-positive' : 'trend-negative';
  }

  private loadDueSoonBilling(members: any[]): void {
    if (!members.length) {
      this.dueSoonMembers = [];
      this.clearSelectedDueMember();
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
          const snapshotOverride = this.getSnapshotOverride(member.id);
          const pendingTotal = (payments || [])
            .filter((payment: any) => payment.status === 'PENDING')
            .reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0);
          const previousMonthAmount = this.getPreviousMonthSuccessfulAmount(payments || []);
          const latestPaidAmount = this.getLatestSuccessfulPaymentAmount(payments || []);
          const subscriptionAmount = this.getSubscriptionAmount(subscription);
          const fallbackAmount = previousMonthAmount || latestPaidAmount || subscriptionAmount;
          const totalPending = snapshotOverride?.pendingAmount ?? (pendingTotal || fallbackAmount);
          const amountSource = snapshotOverride?.pendingAmount != null
            ? 'Edited'
            : pendingTotal > 0
              ? 'Pending payment'
              : previousMonthAmount > 0
                ? 'Last month paid'
                : latestPaidAmount > 0
                  ? 'Last paid amount'
                  : subscriptionAmount > 0
                    ? 'Plan amount'
                    : 'No amount found';
          const renewalDate = snapshotOverride?.renewalDate || override?.renewalDate || subscription?.endDate || '';
          const daysRemaining = this.getDaysRemaining(renewalDate);

          return {
            id: member.id,
            fullName: member.fullName,
            email: member.email,
            phone: member.phone || '',
            planName: subscription?.planName || 'No Plan',
            activeSince: override?.activeSince || subscription?.startDate || '',
            renewalDate,
            daysRemaining,
            totalPending,
            amountSource
          } as DueSoonMember;
        })
      )
    );

    forkJoin(requests).subscribe({
      next: (rows) => {
        this.dueSoonMembers = rows
          .filter((row) => row.daysRemaining <= this.dueSoonDays)
          .sort((a, b) => a.daysRemaining - b.daysRemaining);
        const refreshedSelectedMember = this.dueSoonMembers.find(
          (row) => row.id === this.selectedDueMember?.id
        ) || null;
        if (refreshedSelectedMember) {
          this.selectDueMember(refreshedSelectedMember);
        }
        this.dueSoonLoading = false;
      },
      error: () => {
        this.dueSoonMembers = [];
        this.clearSelectedDueMember();
        this.dueSoonLoading = false;
      }
    });
  }

  private loadDashboardKpis(members: any[]): void {
    if (!members.length) {
      this.resetKpis();
      this.kpiLoading = false;
      this.checkinReminderRows = [];
      this.checkinReminderLoading = false;
      return;
    }

    this.kpiLoading = true;
    this.checkinReminderLoading = true;

    const requests = members.map((member) =>
      forkJoin({
        workoutPlans: this.workoutApi.getWorkoutPlan(member.id).pipe(
          catchError(() => of(null))
        ),
        dietPlan: this.dietApi.getDietPlanByMember(member.id).pipe(
          catchError(() => of(null))
        ),
        payments: this.billingApi.getPaymentHistory(member.id).pipe(
          catchError(() => of([]))
        ),
        progressCheckins: this.progressCheckinApi.getCheckinsByMember(member.id).pipe(
          catchError(() => of([]))
        )
      }).pipe(
        map(({ workoutPlans, dietPlan, payments, progressCheckins }) => ({
          workoutCount: this.countActiveWorkoutPlans(workoutPlans),
          dietCount: this.countDietPlans(dietPlan),
          currentMonthRevenue: this.sumPaymentsForMonth(payments || [], 0),
          previousMonthRevenue: this.sumPaymentsForMonth(payments || [], -1),
          weeklyCheckins: (progressCheckins || []).filter((checkin: any) =>
            this.isCurrentWeek(checkin.submittedAt || checkin.checkInDate || checkin.createdAt)
          ),
          checkinReminder: this.buildCheckinReminderRow(member, progressCheckins || []),
        }))
      )
    );

    forkJoin(requests).subscribe({
      next: (rows) => {
        this.activeWorkoutPlanCount = rows.reduce((sum, row) => sum + row.workoutCount, 0);
        this.activeDietPlanCount = rows.reduce((sum, row) => sum + row.dietCount, 0);
        this.activePlanCount = this.activeWorkoutPlanCount + this.activeDietPlanCount;
        this.monthlyRevenue = rows.reduce((sum, row) => sum + row.currentMonthRevenue, 0);
        const previousMonthRevenue = rows.reduce((sum, row) => sum + row.previousMonthRevenue, 0);
        const weeklyCheckins = rows.flatMap((row) => row.weeklyCheckins);

        this.revenueTrendLabel = this.getRevenueTrendLabel(this.monthlyRevenue, previousMonthRevenue);
        this.weeklyCheckinCount = weeklyCheckins.length;
        this.pendingReviewCount = weeklyCheckins.filter((checkin: any) => this.isPendingReview(checkin)).length;
        this.checkinReminderRows = rows
          .map((row) => row.checkinReminder)
          .filter((row): row is CheckinReminderRow => !!row)
          .sort((a, b) => {
            if (a.cadenceConfigured !== b.cadenceConfigured) {
              return a.cadenceConfigured ? -1 : 1;
            }
            return a.daysUntilDue - b.daysUntilDue;
          });
        this.selectedCheckinMember = this.checkinReminderRows.find(
          (member) => member.id === this.selectedCheckinMember?.id
        ) || this.checkinReminderRows[0] || null;
        this.kpiLoading = false;
        this.checkinReminderLoading = false;
      },
      error: () => {
        this.resetKpis();
        this.kpiLoading = false;
        this.checkinReminderRows = [];
        this.selectedCheckinMember = null;
        this.checkinReminderLoading = false;
      }
    });
  }

  private resetKpis(): void {
    this.activePlanCount = 0;
    this.activeWorkoutPlanCount = 0;
    this.activeDietPlanCount = 0;
    this.monthlyRevenue = 0;
    this.revenueTrendLabel = 'No revenue last month';
    this.weeklyCheckinCount = 0;
    this.pendingReviewCount = 0;
  }

  private countActiveWorkoutPlans(value: any): number {
    if (!value) return 0;

    const plans = Array.isArray(value) ? value : [value];
    return plans.filter((plan) => !plan?.status || plan.status === 'ACTIVE').length;
  }

  private countDietPlans(value: any): number {
    if (!value) return 0;

    const plans = Array.isArray(value) ? value : [value];
    return plans.filter((plan) => !plan?.status || plan.status === 'ACTIVE').length;
  }

  private sumPaymentsForMonth(payments: any[], monthOffset: number): number {
    const target = new Date();
    target.setMonth(target.getMonth() + monthOffset);
    const targetMonth = target.getMonth();
    const targetYear = target.getFullYear();

    return payments
      .filter((payment: any) => payment.status === 'SUCCESS')
      .filter((payment: any) => {
        const parsed = new Date(payment.paymentDate || payment.createdAt || payment.updatedAt);
        return !Number.isNaN(parsed.getTime())
          && parsed.getMonth() === targetMonth
          && parsed.getFullYear() === targetYear;
      })
      .reduce((sum: number, payment: any) => sum + (Number(payment.amount) || 0), 0);
  }

  private getRevenueTrendLabel(current: number, previous: number): string {
    if (!previous) {
      return current ? 'No revenue last month' : 'No revenue this month';
    }

    const percentage = Math.round(((current - previous) / previous) * 100);
    const sign = percentage >= 0 ? '+' : '';
    return `${sign}${percentage}% vs last month`;
  }

  private isCurrentWeek(value: string): boolean {
    if (!value) return false;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    return parsed >= weekStart && parsed < weekEnd;
  }

  private isPendingReview(checkin: any): boolean {
    const status = String(checkin?.status || checkin?.reviewStatus || '').toUpperCase();
    if (['REVIEWED', 'APPROVED', 'DONE', 'COMPLETED'].includes(status)) return false;
    if (['PENDING', 'PENDING_REVIEW', 'SUBMITTED', 'NEW'].includes(status)) return true;
    if (typeof checkin?.reviewed === 'boolean') return !checkin.reviewed;
    if (typeof checkin?.isReviewed === 'boolean') return !checkin.isReviewed;
    return !checkin?.reviewedAt;
  }

  private buildCheckinReminderRow(member: any, checkins: any[]): CheckinReminderRow | null {
    const cadenceDays = this.getStoredCheckinCadenceDays(member.id);
    const lastCheckinDate = this.getLatestProgressCheckinDate(checkins);
    const nextCheckinDate = cadenceDays && lastCheckinDate
      ? this.addDays(lastCheckinDate, cadenceDays)
      : cadenceDays
        ? this.getTodayDateInput()
        : '';
    const daysUntilDue = cadenceDays ? this.getDaysRemaining(nextCheckinDate) : Number.POSITIVE_INFINITY;
    const sortedCheckins = [...checkins].sort(
      (a, b) =>
        this.getCheckinDateValue(b.submittedAt || b.checkInDate || b.createdAt) -
        this.getCheckinDateValue(a.submittedAt || a.checkInDate || a.createdAt)
    );
    const latestCheckin = sortedCheckins[0] || null;
    const previousCheckin = sortedCheckins[1] || null;
    const latestWeight = this.getNumericValue(latestCheckin?.weight);
    const previousWeight = this.getNumericValue(previousCheckin?.weight);
    const latestSteps = this.getNumericValue(latestCheckin?.stepsAvg);
    const previousSteps = this.getNumericValue(previousCheckin?.stepsAvg);
    const latestDietAdherence = this.getNumericValue(latestCheckin?.dietAdherence);
    const latestEnergy = this.getNumericValue(latestCheckin?.energy);
    const latestExerciseRating = this.getNumericValue(
      latestCheckin?.exerciseRating ?? latestCheckin?.energy
    );

    return {
      id: member.id,
      fullName: member.fullName,
      email: member.email,
      phone: member.phone || '',
      cadenceDays,
      lastCheckinDate,
      nextCheckinDate,
      daysUntilDue,
      checkinCount: checkins.length,
      cadenceConfigured: cadenceDays > 0,
      latestCheckin,
      previousCheckin,
      latestWeight,
      weightDelta: latestWeight != null && previousWeight != null
        ? this.roundToTwo(latestWeight - previousWeight)
        : null,
      latestSteps,
      stepsDelta: latestSteps != null && previousSteps != null
        ? this.roundToTwo(latestSteps - previousSteps)
        : null,
      latestDietAdherence,
      latestEnergy,
      latestExerciseRating,
      latestNotes: String(latestCheckin?.notes || '').trim()
    };
  }

  private getLatestProgressCheckinDate(checkins: any[]): string {
    const latest = [...checkins]
      .map((checkin) => checkin.submittedAt || checkin.checkInDate || checkin.createdAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

    return latest || '';
  }

  private getCheckinDateValue(value: string | null | undefined): number {
    if (!value) return 0;

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
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

  private getPreviousMonthSuccessfulAmount(payments: any[]): number {
    const target = new Date();
    target.setMonth(target.getMonth() - 1);
    const targetMonth = target.getMonth();
    const targetYear = target.getFullYear();

    return payments
      .filter((payment: any) => payment.status === 'SUCCESS')
      .filter((payment: any) => {
        const parsed = new Date(payment.paymentDate || payment.createdAt || payment.updatedAt);
        return !Number.isNaN(parsed.getTime())
          && parsed.getMonth() === targetMonth
          && parsed.getFullYear() === targetYear;
      })
      .reduce((sum: number, payment: any) => sum + (Number(payment.amount) || 0), 0);
  }

  private getLatestSuccessfulPaymentAmount(payments: any[]): number {
    const latestPayment = payments
      .filter((payment: any) => payment.status === 'SUCCESS')
      .sort((a: any, b: any) => {
        const first = new Date(a.paymentDate || a.createdAt || a.updatedAt).getTime() || 0;
        const second = new Date(b.paymentDate || b.createdAt || b.updatedAt).getTime() || 0;
        return second - first;
      })[0];

    return Number(latestPayment?.amount) || 0;
  }

  private getSubscriptionAmount(subscription: any): number {
    return Number(
      subscription?.amount
      || subscription?.price
      || subscription?.monthlyAmount
      || subscription?.planAmount
      || 0
    );
  }

  private normalizeDateInput(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  }

  private addDays(value: string, days: number): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    parsed.setHours(0, 0, 0, 0);
    parsed.setDate(parsed.getDate() + days);
    return parsed.toISOString().slice(0, 10);
  }

  private getTodayDateInput(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private getNumericValue(value: any): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private roundToTwo(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private formatSmartNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
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

  private getSnapshotOverride(memberId: string): any | null {
    const raw = localStorage.getItem(this.getSnapshotOverrideStorageKey(memberId));
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private getSnapshotOverrideStorageKey(memberId: string): string {
    return `dashboard_billing_snapshot_override_${memberId}`;
  }

  private getStoredCheckinCadenceDays(memberId: string): number {
    const raw = localStorage.getItem(this.getCheckinCadenceStorageKey(memberId));
    const value = Number(raw);
    return value === 7 || value === 14 ? value : 0;
  }

  private getCheckinCadenceStorageKey(memberId: string): string {
    return `dashboard_progress_checkin_cadence_${memberId}`;
  }
}
