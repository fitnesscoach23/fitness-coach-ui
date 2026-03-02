import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MemberApiService } from '../../../../core/api/member-api.service';
import { CommonModule } from '@angular/common';
import { BillingApiService } from '../../../../core/api/billing-api.service';
import { FormsModule } from '@angular/forms';
import { CheckinApiService } from '../../../../core/services/checkin-api.service';
import { FormArray, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { environment } from '../../../../../environments/environment';
import { Chart, registerables } from 'chart.js';
import { WorkoutApiService } from '../../../../core/services/workout-api.service';
import { DietApiService } from '../../../../core/services/diet-api.service';
import { ProgressCheckinApiService } from '../../../../core/services/progress-checkin-api.service';
import { ProgressCheckinPhotoApiService } from '../../../../core/api/progress-checkin-photo-api.service';

declare const XLSX: any;

type OverviewField = { key: string; label: string; asLink?: boolean };
type OverviewSection = { title: string; items: OverviewField[] };

@Component({
  selector: 'app-member-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule],
  templateUrl: './member-profile.component.html',
  styleUrls: ['./member-profile.component.scss']
})
export class MemberProfileComponent implements OnInit {

  member: any = null;
  loading = true;
  error: string | null = null;
  subscription: any = null;
  subscriptionLoading = true;
  payments: any[] = [];
  paymentsLoading = true;
  paymentAmount: number | null = null;
  paymentActionLoading = false;
  paymentActionError: string | null = null;
  onlineAmount: number | null = null;
  onlinePaymentLoading = false;
  onlinePaymentResult: any = null;
  onlinePaymentError: string | null = null;
  checkins: any[] = [];
  checkinsLoading = true;
  checkinSubmitting = false;
  checkinError: string | null = null;
  editingCheckinId: string | null = null;
  checkinPhotosMap: { [checkinId: string]: any[] } = {};
  env = environment;
  uploadingPhotosMap: { [checkinId: string]: boolean } = {};
  workoutPlan: any = null;
  workoutLoading = true;
  allWorkoutPlans: any[] = [];
  assigningWorkout = false;
  assignWorkoutError: string | null = null;
  selectedWorkoutPlanId: string | null = null;
  activeWorkoutPlan: any = null;
  pastWorkoutPlans: any[] = [];
  dietPlan: any = null;
  dietLoading = true;
  progressCheckins: any[] = [];
  progressCheckinsLoading = true;
  checkinPhotos: { [checkinId: string]: any[] } = {};
  currentCheckin: any | null = null;
  previousCheckin: any | null = null;
  activeSection: 'overview' | 'billing' | 'progress' | 'workout' | 'diet' = 'overview';
  totalPaid = 0;
  totalPending = 0;
  latestWeight = 0;
  weightChange = 0;
  avgDietAdherence = 0;
  avgEnergy = 0;
  deletingMember = false;
  readonly overviewSections: OverviewSection[] = [
    {
      title: 'Identity',
      items: [
        { key: 'dateOfBirth', label: 'Date of Birth' },
        { key: 'age', label: 'Age' },
        { key: 'country', label: 'Country' },
        { key: 'stateCityProvince', label: 'State/City/Province' }
      ]
    },
    {
      title: 'Body Metrics',
      items: [
        { key: 'heightCm', label: 'Height (cm)' },
        { key: 'currentWeightKg', label: 'Current Weight (kg)' }
      ]
    },
    {
      title: 'Goals',
      items: [
        { key: 'mainTrainingGoal', label: 'Main Training Goal' },
        { key: 'goal', label: 'Primary Goal (System)' },
        { key: 'previousWeightLoss', label: 'Reduced Weight Before?' },
        { key: 'weightRegain', label: 'Weight Regain Details' },
        { key: 'goalReward', label: 'Goal Reward' }
      ]
    },
    {
      title: 'Training Profile',
      items: [
        { key: 'priorTrainingExperience', label: 'Prior Training Experience' },
        { key: 'dailyTrainingCommitmentHours', label: 'Daily Training Commitment' },
        { key: 'preferredWorkoutTiming', label: 'Preferred Workout Timing' },
        { key: 'daysPerWeekTrain', label: 'Days/Week Can Train' },
        { key: 'personalTrainingBefore', label: 'Personal Training Before?' }
      ]
    },
    {
      title: 'Lifestyle',
      items: [
        { key: 'activityLevel', label: 'Activity Level' },
        { key: 'stressLevel', label: 'Stress Level' },
        { key: 'sleepHours', label: 'Sleep Hours/Night' },
        { key: 'alcoholConsumption', label: 'Alcohol Consumption' },
        { key: 'smokingHabits', label: 'Smoking Habits' },
        { key: 'supplementsPast', label: 'Supplements Used' },
        { key: 'steroidUsage', label: 'Steroid Usage' },
        { key: 'pastSportsActivity', label: 'Past Sports Activity' }
      ]
    },
    {
      title: 'Nutrition',
      items: [
        { key: 'foodPreference', label: 'Food Preference' },
        { key: 'currentDietPlan', label: 'Current Diet Plan' },
        { key: 'favoriteFoods', label: 'Favorite Foods' },
        { key: 'foodAllergies', label: 'Food Intolerances/Allergies' },
        { key: 'typicalDay', label: 'Typical Day' }
      ]
    },
    {
      title: 'Health',
      items: [
        { key: 'medicalCondition', label: 'Medical Condition' },
        { key: 'medicalConditionsDetailed', label: 'Medical Conditions (Detailed)' },
        { key: 'injuries', label: 'Past/Current Injuries' },
        { key: 'additionalInfo', label: 'Additional Information' }
      ]
    },
    {
      title: 'Movement Assessment',
      items: [
        { key: 'pushUp', label: 'Push Up' },
        { key: 'squat', label: 'Squat' },
        { key: 'rowBandDumbbell', label: 'Row (Band/Dumbbell)' },
        { key: 'overheadPressDumbbell', label: 'Overhead Press (Dumbbell)' },
        { key: 'hipHingeRdl', label: 'Hip Hinge (RDL)' }
      ]
    },
    {
      title: 'Progress Photo Links',
      items: [
        { key: 'frontView', label: 'Front View', asLink: true },
        { key: 'sideView', label: 'Side View', asLink: true },
        { key: 'backView', label: 'Back View', asLink: true }
      ]
    },
    {
      title: 'System Metadata',
      items: [
        { key: 'coachEmail', label: 'Coach Email' },
        { key: 'createdAt', label: 'Created At' },
        { key: 'updatedAt', label: 'Updated At' }
      ]
    }
  ];

  get groupedDietMeals(): Array<{ mealName: string; items: any[] }> {
    const meals = this.dietPlan?.meals || [];
    const grouped = new Map<string, any[]>();

    for (const meal of meals) {
      const mealName = (meal?.mealName || meal?.name || 'Other').trim();
      const key = mealName || 'Other';
      const items = meal?.items || [];

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }

      grouped.get(key)!.push(...items);
    }

    return Array.from(grouped.entries()).map(([mealName, items]) => ({
      mealName,
      items
    }));
  }

  getMemberValue(key: string): any {
    return this.member?.[key];
  }

  hasMemberValue(key: string): boolean {
    const value = this.getMemberValue(key);

    if (value == null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
  }

  formatMemberValue(value: any): string {
    if (value == null) return '-';
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
        const parsed = new Date(trimmed);
        if (!Number.isNaN(parsed.getTime())) {
          return new Intl.DateTimeFormat('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short'
          }).format(parsed);
        }
      }
      return trimmed || '-';
    }
    return String(value);
  }

  isExternalLink(value: any): boolean {
    return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
  }

  setSection(section: typeof this.activeSection) {
    this.activeSection = section;

    if (section === 'progress') {
      setTimeout(() => this.renderWeightChart(), 0);
    }
  }

  constructor(
    private route: ActivatedRoute,
    private memberApi: MemberApiService,
    private billingApi: BillingApiService,
    private cdr: ChangeDetectorRef,
    private checkinApi : CheckinApiService,
    private fb : FormBuilder,
    private workoutApi: WorkoutApiService,
    private router: Router,
    private dietApi: DietApiService,
    private progressCheckinApi: ProgressCheckinApiService,
    private photoApi : ProgressCheckinPhotoApiService
  ) {

    Chart.register(...registerables);
  }

  checkinForm = this.fb.group({
  checkInDate: [''],
  weight: [null],
  compliance: [5],
  energy: [5],
  notes: [''],
  measurements: this.fb.array([])
});

get measurements() {
  return this.checkinForm.get('measurements') as FormArray;
}

addMeasurement() {
  this.measurements.push(
    this.fb.group({
      name: [''],
      value: [null]
    })
  );
}

removeMeasurement(index: number) {
  this.measurements.removeAt(index);
}
  ngOnInit() {
  const memberId = this.route.snapshot.paramMap.get('memberId');

  if (memberId) {
    this.loadMember(memberId);
  } else {
    this.error = 'Invalid member id';
    this.loading = false;
  }
}

  loadMember(id: string) {
  this.memberApi.getMemberById(id).subscribe({
    next: (res: any) => {
      this.member = res;
      this.loading = false;
      this.loadSubscription();
      this.loadCheckins();
      this.loadWorkout();
      this.loadAllWorkoutPlans();
      this.loadDiet();
      this.loadProgressCheckins();
    },
    error: () => {
      this.error = 'Failed to load member';
      this.loading = false;
    }
  });
}

loadCheckins() {
  this.checkinApi.getCheckins(this.member.id).subscribe({
    next: (res: any[]) => {
      this.checkins = [...(res || [])];
      this.checkinsLoading = false;

      // 🔥 load photos per check-in
      this.checkins.forEach(c => {
        this.loadCheckinPhotos(c.id);
      });

    },
    error: () => {
      this.checkinsLoading = false;
    }
  });
}



loadSubscription() {
  this.billingApi.getSubscription(this.member.id).subscribe({
    next: (res: any[]) => {

      // API returns array → take first
      this.subscription = res?.length ? res[0] : null;

      this.subscriptionLoading = false;
      this.loadPayments();
    },
    error: () => {
      this.subscriptionLoading = false;
    }
  });
}

loadPayments() {
  this.paymentsLoading = true;
  this.billingApi.getPaymentHistory(this.member.id).subscribe({
    next: (res: any[]) => {
      this.payments = [...(res || [])];
      this.calculatePaymentSummary();
      this.paymentsLoading = false;
      this.cdr.detectChanges();
    },
    error: () => {
      this.paymentsLoading = false;
    }
  });
}

startManualPayment() {

  if (!this.paymentAmount) return;

  this.paymentActionLoading = true;
  this.paymentActionError = null;

  this.billingApi
    .startManualPayment(this.member.id, this.paymentAmount)
    .subscribe({
      next: () => {
        this.paymentActionLoading = false;
        this.paymentAmount = null;

        // refresh payments
        this.paymentsLoading = true;
        this.loadPayments();
      },
      error: () => {
        this.paymentActionLoading = false;
        this.paymentActionError = 'Failed to start payment';
      }
    });
}

confirmPayment(paymentId: string) {

  this.billingApi.confirmPayment(paymentId).subscribe({
    next: () => {

      // refresh everything
      this.subscriptionLoading = true;
      this.paymentsLoading = true;

      this.loadSubscription();
    }
  });
}

trackByPaymentId(index: number, payment: any): string {
  return payment.id;
}

startOnlinePayment() {
  if (!this.onlineAmount) return;

  this.onlinePaymentLoading = true;
  this.onlinePaymentError = null;
  this.onlinePaymentResult = null;

  this.billingApi
    .startOnlinePayment(this.member.id, this.onlineAmount)
    .subscribe({
      next: (res: any) => {
        this.onlinePaymentLoading = false;
        this.onlinePaymentResult = res;
        this.onlineAmount = null;

        this.openRazorpayCheckout(res);
      },
      error: () => {
        this.onlinePaymentLoading = false;
        this.onlinePaymentError = 'Failed to start online payment';
      }
    });
}


openRazorpayCheckout(order: any) {
  const options = {
    key: order.razorpayKeyId,
    amount: order.amount, // paise
    currency: order.currency,
    name: 'Fitness Coach',
    description: 'Subscription Payment',
    order_id: order.razorpayOrderId,

    handler: () => {
      // Payment success will be handled by webhook
      // Just inform user & refresh later
      alert('Payment completed. Updating status shortly.');

      // Optional soft refresh
      setTimeout(() => {
        this.paymentsLoading = true;
        this.subscriptionLoading = true;
        this.loadPayments();
        this.loadSubscription();
      }, 3000);
    },

    prefill: {
      email: this.member.email,
      contact: this.member.phone
    },

    theme: {
      color: '#2563eb'
    }
  };

  const rzp = new Razorpay(options);
  rzp.open();
}

calculatePaymentSummary() {
  this.totalPaid = this.payments
    .filter(p => p.status === 'SUCCESS')
    .reduce((sum, p) => sum + p.amount, 0);

  this.totalPending = this.payments
    .filter(p => p.status === 'PENDING')
    .reduce((sum, p) => sum + p.amount, 0);
}

submitCheckin() {

  if (this.checkinForm.invalid) return;

  this.checkinSubmitting = true;
  this.checkinError = null;

  const payload = {
    memberId: this.member.id,
    ...this.checkinForm.value
  };

  const request$ = this.editingCheckinId
    ? this.checkinApi.updateCheckin(this.editingCheckinId, payload)
    : this.checkinApi.createCheckin(payload);

  request$.subscribe({
    next: () => {
      this.checkinSubmitting = false;

      // reset edit mode
      this.editingCheckinId = null;

      // reset form
      this.checkinForm.reset({
        compliance: 5,
        energy: 5
      });
      this.measurements.clear();

      // refresh list
      this.checkinsLoading = true;
      // this.loadCheckins();
    },
    error: () => {
      this.checkinSubmitting = false;
      this.checkinError = 'Failed to save check-in';
    }
  });
}


editCheckin(c: any) {

  this.editingCheckinId = c.id;

  // reset measurements first
  this.measurements.clear();

  // patch main fields
  this.checkinForm.patchValue({
    checkInDate: c.checkInDate,
    weight: c.weight,
    compliance: c.compliance,
    energy: c.energy,
    notes: c.notes
  });

  // patch measurements
  if (c.measurements?.length) {
    c.measurements.forEach((m: any) => {
      this.measurements.push(
        this.fb.group({
          name: [m.name],
          value: [m.value]
        })
      );
    });
  }

  // scroll to form (optional UX polish)
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

cancelEdit() {
  this.editingCheckinId = null;
  this.checkinForm.reset({
    compliance: 5,
    energy: 5
  });
  this.measurements.clear();
}

loadCheckinPhotos(checkInId: string) {
  this.photoApi.list(checkInId).subscribe({
    next: res => {
      this.checkinPhotos[checkInId] = res || [];
    },
    error: () => {
      this.checkinPhotos[checkInId] = [];
    }
  });
}


// onPhotosSelected(checkinId: string, event: Event) {
//   const input = event.target as HTMLInputElement;
//   if (!input.files || input.files.length === 0) return;

//   const files = Array.from(input.files);
//   this.uploadingPhotosMap[checkinId] = true;

//   this.checkinApi.uploadCheckinPhotos(checkinId, files).subscribe({
//     next: () => {
//       this.uploadingPhotosMap[checkinId] = false;

//       // 🔄 refresh photos for this check-in only
//       this.loadCheckinPhotos(checkinId);

//       // reset input
//       input.value = '';
//     },
//     error: () => {
//       this.uploadingPhotosMap[checkinId] = false;
//       alert('Failed to upload photos');
//     }
//   });
// }

getCheckinPhotoUrl(fileName: string): string {
  return `${this.env.checkinApi}/checkin/photos/file/${(fileName)}`;
}

getSortedCheckins() {
  return [...this.checkins].sort(
    (a, b) => new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime()
  );
}

renderCharts() {
  const sorted = this.getSortedCheckins();

  if (sorted.length === 0) return;

  const labels = sorted.map(c => c.checkInDate);
  const weights = sorted.map(c => c.weight);
  const compliance = sorted.map(c => c.compliance);
  const energy = sorted.map(c => c.energy);

  // Weight Chart
  new Chart('weightChart', {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Weight (kg)',
          data: weights,
          borderColor: '#2563eb',
          tension: 0.3
        }
      ]
    }
  });

  // Compliance & Energy Chart
  new Chart('scoreChart', {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Compliance',
          data: compliance,
          borderColor: '#16a34a',
          tension: 0.3
        },
        {
          label: 'Energy',
          data: energy,
          borderColor: '#f97316',
          tension: 0.3
        }
      ]
    }
  });
}

renderWeightChart() {
  if (this.progressCheckins.length === 0) return;

  const canvas = document.getElementById('weightChart') as HTMLCanvasElement | null;
  if (!canvas) return;

  const existing = Chart.getChart(canvas);
  if (existing) {
    existing.destroy();
  }

  const sorted = [...this.progressCheckins].sort(
    (a, b) =>
      new Date(a.submittedAt).getTime() -
      new Date(b.submittedAt).getTime()
  );

  const labels = sorted.map(c =>
    new Date(c.submittedAt).toLocaleDateString()
  );
  const weights = sorted.map(c => c.weight);

  new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Weight (kg)',
          data: weights,
          borderWidth: 2,
          tension: 0.3
        }
      ]
    }
  });
}


loadWorkout() {
  this.workoutLoading = true;

  this.workoutApi.getWorkoutPlan(this.member.id).subscribe({
    next: res => {
      // Case 1: backend returns list
      if (Array.isArray(res)) {
        this.activeWorkoutPlan = res.find(p => p.status === 'ACTIVE') || null;
        this.pastWorkoutPlans = res.filter(p => p.status !== 'ACTIVE');
      }
      // Case 2: backend returns single active plan
      else {
        this.activeWorkoutPlan = res;
        this.pastWorkoutPlans = [];
      }

      this.workoutLoading = false;
    },
    error: () => {
      this.activeWorkoutPlan = null;
      this.pastWorkoutPlans = [];
      this.workoutLoading = false;
    }
  });
}


loadAllWorkoutPlans() {
  this.workoutApi.getAllWorkoutPlans().subscribe({
    next: res => {
      this.allWorkoutPlans = res || [];
    }
  });
}

assignWorkoutPlan() {

  if (!this.selectedWorkoutPlanId) return;

  this.assigningWorkout = true;
  this.assignWorkoutError = null;

  this.workoutApi
    .assignWorkoutPlan(this.selectedWorkoutPlanId, this.member.id)
    .subscribe({
      next: () => {
        this.assigningWorkout = false;
        this.selectedWorkoutPlanId = null;

        // 🔄 refresh workout plan
        this.loadWorkout();
      },
      error: () => {
        this.assigningWorkout = false;
        this.assignWorkoutError = 'Failed to assign workout plan';
      }
    });
}

goToCreateWorkout() {
  console.log('Navigating to create workout', this.member.id);

  this.router.navigate([
    '/members',
    this.member.id,
    'workouts',
    'create'
  ]);
}

loadDiet() {
  this.dietLoading = true;

  this.dietApi.getDietPlanByMember(this.member.id).subscribe({
    next: res => {
      this.dietPlan = res;
      this.dietLoading = false;
    },
    error: () => {
      this.dietPlan = null;
      this.dietLoading = false;
    }
  });
}

goToCreateDiet() {
  console.log('Navigating to create diet', this.member.id);

  this.router.navigate([
    '/members',
    this.member.id,
    'diet',
    'create'
  ]);
}

exportWorkoutPlanToExcel() {
  if (!this.activeWorkoutPlan) {
    alert('No active workout plan found to export.');
    return;
  }

  if (typeof XLSX === 'undefined') {
    alert('Excel exporter not loaded. Please refresh and try again.');
    return;
  }

  const dateLabel = new Intl.DateTimeFormat('en-GB').format(new Date());
  const rows: any[][] = [
    [`Exercise Plan for ${this.member?.fullName || 'Member'} (${dateLabel})`],
    ['Daily 10 mins General Warmup + 1-2 light sets of first exercise'],
    ['Section', 'Exercise', 'Sets', 'Reps', 'Video']
  ];

  this.activeWorkoutPlan.days?.forEach((day: any, dayIndex: number) => {
    if (dayIndex > 0) {
      rows.push(['', '', '', '', '']);
    }

    rows.push([day.dayName || `Day ${dayIndex + 1}`, '', '', '', '']);

    (day.exercises || []).forEach((exercise: any, exIndex: number) => {
      const sets = exercise.sets || [];
      const repsValues = sets
        .map((s: any) => s?.reps)
        .filter((v: any) => v != null && v !== '');
      const uniqueReps = Array.from(new Set(repsValues));

      rows.push([
        exIndex + 1,
        exercise.name || '',
        sets.length || '',
        uniqueReps.length === 1 ? uniqueReps[0] : uniqueReps.join(', '),
        exercise.videoUrl || ''
      ]);
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }
  ];
  ws['!cols'] = [
    { wch: 16 },
    { wch: 36 },
    { wch: 10 },
    { wch: 14 },
    { wch: 54 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet 1');
  const fileName = `Exercise-Plan-${(this.member?.fullName || 'Member').replace(/\s+/g, '-')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

exportDietPlanToExcel() {
  if (!this.dietPlan) {
    alert('No diet plan found to export.');
    return;
  }

  if (typeof XLSX === 'undefined') {
    alert('Excel exporter not loaded. Please refresh and try again.');
    return;
  }

  const dateLabel = new Intl.DateTimeFormat('en-GB').format(new Date());
  const rows: any[][] = [
    [`Diet Plan for ${this.member?.fullName || 'Member'} (${dateLabel})`],
    [this.dietPlan?.title || 'Diet Plan'],
    ['Meal', 'Food', 'Qty', 'Unit', 'Calories']
  ];

  this.groupedDietMeals.forEach((mealGroup: any, mealIndex: number) => {
    if (mealIndex > 0) rows.push(['', '', '', '', '']);

    mealGroup.items?.forEach((item: any, itemIndex: number) => {
      rows.push([
        itemIndex === 0 ? mealGroup.mealName : '',
        item.foodName || '',
        item.quantity ?? '',
        item.unit || '',
        item.calories ?? ''
      ]);
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }
  ];
  ws['!cols'] = [
    { wch: 18 },
    { wch: 30 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet 1');
  const fileName = `Diet-Plan-${(this.member?.fullName || 'Member').replace(/\s+/g, '-')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

deleteMember() {
  if (!this.member?.id) return;

  const confirmed = window.confirm(
    `Delete member "${this.member.fullName}"?\n\nThis action cannot be undone.`
  );

  if (!confirmed) return;

  this.deletingMember = true;

  this.memberApi.deleteMember(this.member.id).subscribe({
    next: () => {
      this.router.navigate(['/members']);
    },
    error: () => {
      this.deletingMember = false;
      alert('Failed to delete member');
    }
  });
}


loadProgressCheckins() {
  this.progressCheckinsLoading = true;

  this.progressCheckinApi
    .getCheckinsByMember(this.member.id)
    .subscribe({
      next: res => {
        // newest first
        this.progressCheckins = (res || []).sort(
          (a, b) =>
            new Date(b.submittedAt).getTime() -
            new Date(a.submittedAt).getTime()
        );
        this.calculateProgressSummary();
        this.progressCheckinsLoading = false;
        this.progressCheckins.forEach(c => {
        this.loadCheckinPhotos(c.id);
        });
        this.prepareComparison();

        if (this.activeSection === 'progress') {
          setTimeout(() => this.renderWeightChart(), 0);
        }
      },
      error: () => {
        this.progressCheckins = [];
        this.progressCheckinsLoading = false;
      }
    });
}

getPhotoUrl(fileName: string) {
  return `${this.env.checkinApi}/checkin/photos/file/${fileName}`;
}

prepareComparison() {
  if (!this.progressCheckins || this.progressCheckins.length === 0) return;

  const sorted = [...this.progressCheckins].sort(
    (a, b) =>
      new Date(b.submittedAt).getTime() -
      new Date(a.submittedAt).getTime()
  );

  this.currentCheckin = sorted[0] || null;
  this.previousCheckin = sorted[1] || null;
}

getDelta(current?: number, previous?: number): string {
  if (current == null || previous == null) return '-';

  const diff = current - previous;

  if (diff > 0) return `+${diff}`;
  if (diff < 0) return `${diff}`;
  return '0';
}

getPhotoByType(checkinId: string, type: 'FRONT' | 'SIDE' | 'BACK'): string | null {
  const photos = this.checkinPhotos[checkinId];
  if (!photos || photos.length === 0) return null;

  const photo = photos.find((p: any) => p.type === type);
  return photo ? photo.fileName : null;
}

calculateProgressSummary() {
  if (!this.progressCheckins?.length) return;

  const sorted = [...this.progressCheckins]
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  this.latestWeight = last.weight || 0;
  this.weightChange = (last.weight || 0) - (first.weight || 0);

  const validDiet = sorted.filter(c => c.dietAdherence);
  const validEnergy = sorted.filter(c => c.energy);

  this.avgDietAdherence =
    validDiet.reduce((sum, c) => sum + c.dietAdherence, 0) / (validDiet.length || 1);

  this.avgEnergy =
    validEnergy.reduce((sum, c) => sum + c.energy, 0) / (validEnergy.length || 1);
}

}
