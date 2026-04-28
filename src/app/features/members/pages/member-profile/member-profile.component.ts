import { ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
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
import { DailyCheckinCalendarComponent } from '../../components/daily-checkin-calendar/daily-checkin-calendar.component';

declare const XLSX: any;

type OverviewField = { key: string; label: string; asLink?: boolean };
type OverviewSection = { title: string; items: OverviewField[] };
type BodyMetricSourceField =
  | 'heightCm'
  | 'currentWeightKg'
  | 'gender'
  | 'age'
  | 'isLean'
  | 'activityFactor'
  | 'ibwKg'
  | 'bmi'
  | 'bmr'
  | 'tdee'
  | 'targetGoal'
  | 'targetCalorieFactor'
  | 'targetCalories'
  | 'proteinRda'
  | 'proteinGrams'
  | 'carbFactor'
  | 'carbsGrams'
  | 'fatsGrams'
  | 'auto';

@Component({
  selector: 'app-member-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule, DailyCheckinCalendarComponent],
  templateUrl: './member-profile.component.html',
  styleUrls: ['./member-profile.component.scss']
})
export class MemberProfileComponent implements OnInit {
  private readonly expirySoonDays = 7;
  @ViewChild('comparisonModal') comparisonModalRef?: ElementRef<HTMLDivElement>;

  member: any = null;
  loading = true;
  error: string | null = null;
  subscription: any = null;
  subscriptionHistory: any[] = [];
  subscriptionLoading = true;
  payments: any[] = [];
  confirmPaymentDates: Record<string, string> = {};
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
  draggedPhoto: { checkinId: string; index: number } | null = null;
  currentCheckin: any | null = null;
  previousCheckin: any | null = null;
  showProgressComparisonModal = false;
  isProgressComparisonMaximized = false;
  comparisonZoomLevel = 1;
  activeSection: 'overview' | 'bodyMetrics' | 'billing' | 'progress' | 'dailyConsistency' | 'workout' | 'diet' = 'overview';
  totalPaid = 0;
  totalPending = 0;
  latestWeight = 0;
  weightChange = 0;
  avgDietAdherence = 0;
  avgSteps = 0;
  deletingMember = false;
  overrideActiveSince = '';
  overrideRenewalDate = '';
  overrideCycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' = 'MONTHLY';
  autoCalculateRenewal = true;
  overrideMessage: string | null = null;
  bodyMetricsAutoCalc = true;
  bodyMetricsManualOverride = false;
  bodyMetricsSaving = false;
  bodyMetricsMessage: string | null = null;
  private readonly targetGoalMap: Record<string, string> = {
    'Fat Loss': 'FAT_LOSS',
    'Maintenance': 'MAINTENANCE',
    'Gaining': 'GAINING'
  };
  private readonly targetGoalReverseMap: Record<string, 'Fat Loss' | 'Maintenance' | 'Gaining'> = {
    FAT_LOSS: 'Fat Loss',
    MAINTENANCE: 'Maintenance',
    GAINING: 'Gaining'
  };
  bodyMetrics = {
    heightCm: null as number | null,
    currentWeightKg: null as number | null,
    gender: '' as string,
    age: null as number | null,
    isLean: false,
    activityFactor: 1.2,
    trainingHistory: 'Sedentary' as 'Sedentary' | 'Beginner' | 'Intermediate' | 'Advance',
    proteinRda: 1.0,
    carbFactor: 3.0,
    targetGoal: 'Fat Loss' as 'Fat Loss' | 'Maintenance' | 'Gaining',
    targetCalorieFactor: 11,
    ibwKg: null as number | null,
    bmi: null as number | null,
    bmr: null as number | null,
    tdee: null as number | null,
    targetCalories: null as number | null,
    proteinGrams: null as number | null,
    carbsGrams: null as number | null,
    fatsGrams: null as number | null
  };

  readonly activityOptions = [
    { label: 'Sedentary (1.2)', value: 1.2 },
    { label: 'Lightly Active (1.375)', value: 1.375 },
    { label: 'Moderately Active (1.55)', value: 1.55 },
    { label: 'Very Active (1.725)', value: 1.725 },
    { label: 'Extremely Active (1.9)', value: 1.9 }
  ];

  readonly trainingHistoryOptions = [
    { label: 'Sedentary (0.8-1.0 g/kg)', value: 1.0 },
    { label: 'Beginner/Females (1.0-1.3 g/kg)', value: 1.2 },
    { label: 'Intermediate (1.5-1.8 g/kg)', value: 1.6 },
    { label: 'Advance (1.6-2.0 g/kg)', value: 1.8 }
  ];

  readonly targetGoalOptions = [
    { label: 'Fat Loss (10-12 x IBW lbs)', value: 'Fat Loss', defaultFactor: 11, min: 10, max: 12 },
    { label: 'Maintenance (12-14 x IBW lbs)', value: 'Maintenance', defaultFactor: 13, min: 12, max: 14 },
    { label: 'Gaining (14-16 x IBW lbs)', value: 'Gaining', defaultFactor: 15, min: 14, max: 16 }
  ];
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

  getDietItemDisplayName(foodName: any): string {
    return this.parseDietItemFoodName(foodName).primaryFoodName;
  }

  getDietItemOptionalAlternatives(foodName: any): string[] {
    return this.parseDietItemFoodName(foodName).optionalAlternatives;
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

  private applyBodyMetrics(source: any) {
    if (!source) return;

    this.bodyMetrics.heightCm = this.toNumberOrNull(source.heightCm);
    this.bodyMetrics.currentWeightKg = this.toNumberOrNull(source.currentWeightKg);
    this.bodyMetrics.gender = source.gender ?? this.bodyMetrics.gender;
    this.bodyMetrics.age = this.toNumberOrNull(source.age);
    this.bodyMetrics.isLean = Boolean(source.isLean);
    this.bodyMetrics.activityFactor =
      this.toNumberOrNull(source.activityFactor) ?? this.bodyMetrics.activityFactor;
    this.bodyMetrics.proteinRda = this.toNumberOrNull(source.proteinRda) ?? this.bodyMetrics.proteinRda;
    this.bodyMetrics.carbFactor = this.toNumberOrNull(source.carbFactor) ?? this.bodyMetrics.carbFactor;
    this.bodyMetrics.targetGoal =
      this.targetGoalReverseMap[source.targetGoal] ?? source.targetGoal ?? this.bodyMetrics.targetGoal;
    this.bodyMetrics.targetCalorieFactor =
      this.toNumberOrNull(source.targetCalorieFactor) ?? this.bodyMetrics.targetCalorieFactor;
    this.bodyMetrics.ibwKg = this.toNumberOrNull(source.ibwKg);
    this.bodyMetrics.bmi = this.toNumberOrNull(source.bmi);
    this.bodyMetrics.bmr = this.toNumberOrNull(source.bmr);
    this.bodyMetrics.tdee = this.toNumberOrNull(source.tdee);
    this.bodyMetrics.targetCalories = this.toNumberOrNull(source.targetCalories);
    this.bodyMetrics.proteinGrams = this.toNumberOrNull(source.proteinGrams);
    this.bodyMetrics.carbsGrams = this.toNumberOrNull(source.carbsGrams);
    this.bodyMetrics.fatsGrams = this.toNumberOrNull(source.fatsGrams);
  }

  initializeBodyMetrics() {
    const storedMetrics = this.member?.bodyMetrics;
    if (storedMetrics) {
      this.applyBodyMetrics(storedMetrics);
      this.bodyMetricsManualOverride = this.inferBodyMetricsManualOverride(storedMetrics);
    } else {
      this.bodyMetrics.heightCm = this.toNumberOrNull(this.member?.heightCm);
      this.bodyMetrics.currentWeightKg = this.toNumberOrNull(this.member?.currentWeightKg);
      this.bodyMetrics.gender = this.member?.gender || '';
      this.bodyMetrics.age = this.toNumberOrNull(this.member?.age);
      this.bodyMetrics.isLean = false;
      this.bodyMetricsManualOverride = false;
    }

    if (this.bodyMetricsAutoCalc && !this.bodyMetricsManualOverride) {
      this.recalculateBodyMetrics('auto');
    }
  }

  onBodyMetricInput(field: BodyMetricSourceField) {
    if (!this.bodyMetricsAutoCalc) return;
    this.recalculateBodyMetrics(field);
  }

  toggleBodyMetricsManualOverride() {
    this.bodyMetricsManualOverride = !this.bodyMetricsManualOverride;

    if (!this.bodyMetricsManualOverride && this.bodyMetricsAutoCalc) {
      this.recalculateBodyMetrics('auto');
    }
  }

  recalculateBodyMetrics(sourceField: BodyMetricSourceField = 'auto') {
    const heightCm = this.toNumberOrNull(this.bodyMetrics.heightCm);
    let weightKg = this.toNumberOrNull(this.bodyMetrics.currentWeightKg);
    const age = this.bodyMetrics.age ?? null;
    const gender = (this.bodyMetrics.gender || '').toLowerCase();

    if (heightCm == null || heightCm <= 0) {
      this.bodyMetrics.ibwKg = null;
      this.bodyMetrics.bmi = null;
      this.bodyMetrics.bmr = null;
      this.bodyMetrics.tdee = null;
      this.bodyMetrics.targetCalories = null;
      this.bodyMetrics.proteinGrams = null;
      this.bodyMetrics.carbsGrams = null;
      this.bodyMetrics.fatsGrams = null;
      return;
    }

    const isSenior = age != null && age >= 50;
    let ibwKg = this.getAutoIbwKg(heightCm, gender, age, weightKg, this.bodyMetrics.isLean);
    const manualIbwKg = this.toNumberOrNull(this.bodyMetrics.ibwKg);
    if (sourceField === 'ibwKg' && manualIbwKg != null && manualIbwKg > 0) {
      ibwKg = manualIbwKg;
    }

    const heightM = heightCm / 100;
    const manualBmi = this.toNumberOrNull(this.bodyMetrics.bmi);
    let bmi = weightKg && heightM ? weightKg / (heightM * heightM) : null;
    if (sourceField === 'bmi' && manualBmi != null && manualBmi > 0 && heightM > 0) {
      bmi = manualBmi;
      weightKg = bmi * heightM * heightM;
      this.bodyMetrics.currentWeightKg = this.roundTo(weightKg, 1);
    }

    const autoBmr = this.getAutoBmr(ibwKg, gender, age);
    const manualBmr = this.toNumberOrNull(this.bodyMetrics.bmr);
    const bmr = sourceField === 'bmr' && manualBmr != null && manualBmr > 0 ? manualBmr : autoBmr;

    let activityFactor = this.toNumberOrNull(this.bodyMetrics.activityFactor) ?? 1.2;
    let tdee = bmr * activityFactor;
    const manualTdee = this.toNumberOrNull(this.bodyMetrics.tdee);
    if (sourceField === 'tdee' && manualTdee != null && manualTdee > 0 && bmr > 0) {
      tdee = manualTdee;
      activityFactor = manualTdee / bmr;
    } else {
      tdee = bmr * activityFactor;
    }

    const ibwLb = ibwKg * 2.20462;
    const autoTargetCalorieFactor = this.toNumberOrNull(this.bodyMetrics.targetCalorieFactor) ?? 0;
    const autoTargetCalories = ibwLb * autoTargetCalorieFactor;
    let targetCalorieFactor = autoTargetCalorieFactor;
    let targetCalories = autoTargetCalories;
    let proteinRda = this.toNumberOrNull(this.bodyMetrics.proteinRda) ?? 0;
    let proteinGrams = ibwKg * proteinRda;
    let carbFactor = this.toNumberOrNull(this.bodyMetrics.carbFactor) ?? 0;
    let carbsGrams = ibwKg * carbFactor;
    let fatsGrams = autoTargetCalories
      ? Math.max(0, (autoTargetCalories - (proteinGrams * 4 + carbsGrams * 4)) / 9)
      : 0;

    if (this.bodyMetricsManualOverride) {
      targetCalories = this.toNumberOrNull(this.bodyMetrics.targetCalories) ?? autoTargetCalories;
      proteinGrams = this.toNumberOrNull(this.bodyMetrics.proteinGrams) ?? proteinGrams;
      carbsGrams = this.toNumberOrNull(this.bodyMetrics.carbsGrams) ?? carbsGrams;
      fatsGrams = this.toNumberOrNull(this.bodyMetrics.fatsGrams) ?? fatsGrams;
    } else {
      const manualTargetCalories = this.toNumberOrNull(this.bodyMetrics.targetCalories);
      if (sourceField === 'targetCalories' && manualTargetCalories != null && manualTargetCalories >= 0) {
        targetCalories = manualTargetCalories;
        targetCalorieFactor = ibwLb > 0 ? manualTargetCalories / ibwLb : targetCalorieFactor;
      } else {
        targetCalories = ibwLb * targetCalorieFactor;
      }

      const manualProteinGrams = this.toNumberOrNull(this.bodyMetrics.proteinGrams);
      if (sourceField === 'proteinGrams' && manualProteinGrams != null && manualProteinGrams >= 0) {
        proteinGrams = manualProteinGrams;
        proteinRda = ibwKg > 0 ? manualProteinGrams / ibwKg : proteinRda;
      } else {
        proteinGrams = ibwKg * proteinRda;
      }

      const manualCarbsGrams = this.toNumberOrNull(this.bodyMetrics.carbsGrams);
      if (sourceField === 'carbsGrams' && manualCarbsGrams != null && manualCarbsGrams >= 0) {
        carbsGrams = manualCarbsGrams;
        carbFactor = ibwKg > 0 ? manualCarbsGrams / ibwKg : carbFactor;
      } else {
        carbsGrams = ibwKg * carbFactor;
      }

      fatsGrams = targetCalories
        ? Math.max(0, (targetCalories - (proteinGrams * 4 + carbsGrams * 4)) / 9)
        : 0;
      const manualFatsGrams = this.toNumberOrNull(this.bodyMetrics.fatsGrams);
      if (sourceField === 'fatsGrams' && manualFatsGrams != null && manualFatsGrams >= 0) {
        fatsGrams = manualFatsGrams;
        targetCalories = proteinGrams * 4 + carbsGrams * 4 + fatsGrams * 9;
        targetCalorieFactor = ibwLb > 0 ? targetCalories / ibwLb : targetCalorieFactor;
      }

      const normalizedTarget = this.normalizeTargetCaloriesForGoal(targetCalorieFactor, ibwLb);
      targetCalorieFactor = normalizedTarget.factor;
      targetCalories = normalizedTarget.calories;
    }

    this.bodyMetrics.ibwKg = this.roundTo(ibwKg, 1);
    this.bodyMetrics.bmi = bmi != null ? this.roundTo(bmi, 1) : null;
    this.bodyMetrics.bmr = this.roundTo(bmr, 0);
    this.bodyMetrics.activityFactor = this.roundTo(activityFactor, 3);
    this.bodyMetrics.tdee = this.roundTo(tdee, 0);
    this.bodyMetrics.targetCalorieFactor = this.roundTo(targetCalorieFactor, 2);
    this.bodyMetrics.proteinRda = this.roundTo(proteinRda, 2);
    this.bodyMetrics.carbFactor = this.roundTo(carbFactor, 2);
    this.bodyMetrics.targetCalories = this.roundTo(targetCalories, 0);
    this.bodyMetrics.proteinGrams = this.roundTo(proteinGrams, 0);
    this.bodyMetrics.carbsGrams = this.roundTo(carbsGrams, 0);
    this.bodyMetrics.fatsGrams = this.roundTo(fatsGrams, 0);
  }

  onGoalChange() {
    const goalConfig = this.targetGoalOptions.find((g) => g.value === this.bodyMetrics.targetGoal);
    if (goalConfig) {
      this.bodyMetrics.targetCalorieFactor = goalConfig.defaultFactor;
      if (this.bodyMetricsAutoCalc) {
        this.recalculateBodyMetrics('targetCalorieFactor');
      }
    }
  }

  onTrainingHistoryChange() {
    if (this.bodyMetricsAutoCalc) {
      this.recalculateBodyMetrics('proteinRda');
    }
  }

  saveBodyMetrics() {
    if (!this.member?.id) return;

    this.bodyMetricsSaving = true;
    this.bodyMetricsMessage = null;

    const heightCm = this.toNumberOrNull(this.bodyMetrics.heightCm);
    const currentWeightKg = this.toNumberOrNull(this.bodyMetrics.currentWeightKg);
    const age = this.toNumberOrNull(this.bodyMetrics.age);
    const activityFactor = this.toNumberOrNull(this.bodyMetrics.activityFactor);
    const proteinRda = this.toNumberOrNull(this.bodyMetrics.proteinRda);
    const carbFactor = this.toNumberOrNull(this.bodyMetrics.carbFactor);
    const rawTargetCalorieFactor = this.toNumberOrNull(this.bodyMetrics.targetCalorieFactor);
    const gender = (this.bodyMetrics.gender || '').trim();
    const targetGoal = this.targetGoalMap[this.bodyMetrics.targetGoal] ?? null;
    const ibwKg = this.toNumberOrNull(this.bodyMetrics.ibwKg);
    const ibwLb = ibwKg != null ? ibwKg * 2.20462 : 0;
    const normalizedTarget = this.normalizeTargetCaloriesForGoal(rawTargetCalorieFactor ?? 0, ibwLb);
    const targetCalorieFactor = normalizedTarget.factor;
    const targetCalories = this.bodyMetricsManualOverride
      ? (this.toNumberOrNull(this.bodyMetrics.targetCalories) ?? normalizedTarget.calories)
      : normalizedTarget.calories;

    if (!heightCm || !currentWeightKg || !age || !gender || !activityFactor || !proteinRda || !targetGoal || !targetCalorieFactor) {
      this.bodyMetricsMessage = 'Please fill all required fields before saving';
      this.bodyMetricsSaving = false;
      return;
    }
    if (activityFactor <= 0) {
      this.bodyMetricsMessage = 'Activity factor must be greater than 0';
      this.bodyMetricsSaving = false;
      return;
    }
    if (proteinRda <= 0) {
      this.bodyMetricsMessage = 'Protein RDA must be greater than 0';
      this.bodyMetricsSaving = false;
      return;
    }
    if (carbFactor != null && carbFactor < 0) {
      this.bodyMetricsMessage = 'Carb factor must be 0 or greater';
      this.bodyMetricsSaving = false;
      return;
    }
    if (targetCalorieFactor <= 0) {
      this.bodyMetricsMessage = 'Target calorie factor must be greater than 0';
      this.bodyMetricsSaving = false;
      return;
    }

    const payload = {
      heightCm,
      currentWeightKg,
      gender,
      age: Math.round(age),
      isLean: !!this.bodyMetrics.isLean,
      activityFactor,
      proteinRda,
      carbFactor,
      targetGoal,
      targetCalorieFactor,
      ibwKg: this.toNumberOrNull(this.bodyMetrics.ibwKg),
      bmi: this.toNumberOrNull(this.bodyMetrics.bmi),
      bmr: this.toNumberOrNull(this.bodyMetrics.bmr),
      tdee: this.toNumberOrNull(this.bodyMetrics.tdee),
      targetCalories,
      proteinGrams: this.toNumberOrNull(this.bodyMetrics.proteinGrams),
      carbsGrams: this.toNumberOrNull(this.bodyMetrics.carbsGrams),
      fatsGrams: this.toNumberOrNull(this.bodyMetrics.fatsGrams)
    };

    this.bodyMetrics.targetCalorieFactor = this.roundTo(targetCalorieFactor, 2);
    if (!this.bodyMetricsManualOverride) {
      this.bodyMetrics.targetCalories = this.roundTo(targetCalories, 0);
    }

    this.memberApi.updateBodyMetrics(this.member.id, payload).subscribe({
      next: (res: any) => {
        const metrics = res?.bodyMetrics ?? res;
        if (metrics) {
          this.applyBodyMetrics(metrics);
          this.bodyMetricsManualOverride =
            this.bodyMetricsManualOverride || this.inferBodyMetricsManualOverride(metrics);
        }
        if (this.bodyMetricsAutoCalc && !this.bodyMetricsManualOverride) {
          this.recalculateBodyMetrics('auto');
        }
        if (this.member) {
          this.member.bodyMetrics = metrics ?? payload;
        }
        this.bodyMetricsMessage = 'Body metrics saved';
        this.bodyMetricsSaving = false;
      },
      error: (err) => {
        this.bodyMetricsMessage = err?.error?.message || 'Failed to save body metrics';
        this.bodyMetricsSaving = false;
      }
    });
  }

  private roundTo(value: number, decimals: number) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  private getAutoIbwKg(
    heightCm: number,
    gender: string,
    age: number | null,
    weightKg: number | null,
    isLean: boolean
  ): number {
    const isSenior = age != null && age >= 50;
    let ibwKg = heightCm - 105;

    if (isSenior) {
      ibwKg = heightCm - 100;
    } else if (gender === 'female') {
      ibwKg = heightCm - 107;
    }

    if (isLean && weightKg != null && weightKg > 0) {
      return weightKg;
    }

    return ibwKg;
  }

  private getAutoBmr(ibwKg: number, gender: string, age: number | null): number {
    const isSenior = age != null && age >= 50;
    if (!isSenior && gender === 'female') {
      return ibwKg * 22.5;
    }

    return ibwKg * 24;
  }

  private normalizeTargetCaloriesForGoal(
    factor: number,
    ibwLb: number
  ): { factor: number; calories: number } {
    const goalConfig = this.targetGoalOptions.find((g) => g.value === this.bodyMetrics.targetGoal);
    if (!goalConfig) {
      return {
        factor,
        calories: ibwLb > 0 ? ibwLb * factor : 0
      };
    }

    const clampedFactor = Math.min(goalConfig.max, Math.max(goalConfig.min, factor));
    return {
      factor: clampedFactor,
      calories: ibwLb > 0 ? ibwLb * clampedFactor : 0
    };
  }

  private inferBodyMetricsManualOverride(source: any): boolean {
    if (!source) return false;
    if (typeof source.manualOverride === 'boolean') {
      return source.manualOverride;
    }

    const heightCm = this.toNumberOrNull(source.heightCm);
    const currentWeightKg = this.toNumberOrNull(source.currentWeightKg);
    const age = this.toNumberOrNull(source.age);
    const gender = String(source.gender || '').toLowerCase();
    const isLean = Boolean(source.isLean);
    const targetGoal = this.targetGoalReverseMap[source.targetGoal] ?? source.targetGoal ?? this.bodyMetrics.targetGoal;
    const proteinRda = this.toNumberOrNull(source.proteinRda);
    const carbFactor = this.toNumberOrNull(source.carbFactor);
    const targetCalorieFactor = this.toNumberOrNull(source.targetCalorieFactor);
    const savedTargetCalories = this.toNumberOrNull(source.targetCalories);
    const savedProteinGrams = this.toNumberOrNull(source.proteinGrams);
    const savedCarbsGrams = this.toNumberOrNull(source.carbsGrams);
    const savedFatsGrams = this.toNumberOrNull(source.fatsGrams);

    if (
      heightCm == null ||
      currentWeightKg == null ||
      age == null ||
      !gender ||
      proteinRda == null ||
      carbFactor == null ||
      targetCalorieFactor == null
    ) {
      return false;
    }

    const ibwKg = this.getAutoIbwKg(heightCm, gender, age, currentWeightKg, isLean);
    const ibwLb = ibwKg * 2.20462;
    const goalConfig = this.targetGoalOptions.find((g) => g.value === targetGoal);
    const normalizedFactor = goalConfig
      ? Math.min(goalConfig.max, Math.max(goalConfig.min, targetCalorieFactor))
      : targetCalorieFactor;
    const autoTargetCalories = ibwLb > 0 ? ibwLb * normalizedFactor : 0;
    const autoProteinGrams = ibwKg * proteinRda;
    const autoCarbsGrams = ibwKg * carbFactor;
    const autoFatsGrams = autoTargetCalories
      ? Math.max(0, (autoTargetCalories - (autoProteinGrams * 4 + autoCarbsGrams * 4)) / 9)
      : 0;

    return (
      this.hasMeaningfulDifference(savedTargetCalories, autoTargetCalories, 1) ||
      this.hasMeaningfulDifference(savedProteinGrams, autoProteinGrams, 1) ||
      this.hasMeaningfulDifference(savedCarbsGrams, autoCarbsGrams, 1) ||
      this.hasMeaningfulDifference(savedFatsGrams, autoFatsGrams, 1)
    );
  }

  private hasMeaningfulDifference(
    current: number | null,
    expected: number | null,
    tolerance: number
  ): boolean {
    if (current == null || expected == null) return false;
    return Math.abs(current - expected) > tolerance;
  }

  private toNumberOrNull(value: any): number | null {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
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
      this.initializeBodyMetrics();
      this.loadSubscriptionOverride();
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
      this.subscriptionHistory = Array.isArray(res) ? res : [];
      this.subscription = this.subscriptionHistory.length ? this.subscriptionHistory[0] : null;
      const originalStartDate = this.getOriginalSubscriptionStartDate();
      if (!this.overrideActiveSince && originalStartDate) {
        this.overrideActiveSince = this.normalizeDateInput(originalStartDate);
      }
      if (!this.overrideRenewalDate && this.subscription?.endDate) {
        this.overrideRenewalDate = this.normalizeDateInput(this.subscription.endDate);
      }

      this.subscriptionLoading = false;
      this.loadPayments();
    },
    error: () => {
      this.subscriptionLoading = false;
    }
  });
}

get displayedActiveSince(): string {
  return this.overrideActiveSince || this.getOriginalSubscriptionStartDate() || this.subscription?.startDate || '-';
}

get displayedRenewalDate(): string {
  return this.overrideRenewalDate || this.subscription?.endDate || '-';
}

get renewalDaysRemaining(): number | null {
  if (!this.displayedRenewalDate || this.displayedRenewalDate === '-') return null;

  const renewal = new Date(`${this.displayedRenewalDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(renewal.getTime())) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = renewal.getTime() - today.getTime();

  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

get renewalDaysRemainingLabel(): string {
  const days = this.renewalDaysRemaining;
  if (days == null) return '-';
  if (days < 0) return `${Math.abs(days)} day(s) overdue`;
  if (days === 0) return 'Due today';
  return `${days} day(s) left`;
}

get memberExpiringSoon(): boolean {
  const days = this.renewalDaysRemaining;
  return days != null && days >= 0 && days <= this.expirySoonDays;
}

get memberExpired(): boolean {
  const days = this.renewalDaysRemaining;
  return days != null && days < 0;
}

onOverrideActiveSinceChange() {
  if (this.autoCalculateRenewal) {
    this.applyCycleToRenewal();
  }
}

onOverrideCycleChange() {
  if (this.autoCalculateRenewal) {
    this.applyCycleToRenewal();
  }
}

saveSubscriptionOverride() {
  this.overrideMessage = null;

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

  localStorage.setItem(this.getOverrideStorageKey(), JSON.stringify(payload));
  this.overrideMessage = 'Subscription override saved';
}

clearSubscriptionOverride() {
  localStorage.removeItem(this.getOverrideStorageKey());
  this.overrideMessage = 'Subscription override cleared';
  this.overrideCycle = 'MONTHLY';
  this.autoCalculateRenewal = true;
  this.overrideActiveSince = this.subscription?.startDate
    ? this.normalizeDateInput(this.subscription.startDate)
    : '';
  this.overrideRenewalDate = this.subscription?.endDate
    ? this.normalizeDateInput(this.subscription.endDate)
    : '';
}

private applyCycleToRenewal() {
  if (!this.overrideActiveSince) return;

  const cycleMonths =
    this.overrideCycle === 'MONTHLY'
      ? 1
      : this.overrideCycle === 'QUARTERLY'
      ? 3
      : 12;

  const start = new Date(`${this.overrideActiveSince}T00:00:00`);
  if (Number.isNaN(start.getTime())) return;
  start.setMonth(start.getMonth() + cycleMonths);
  this.overrideRenewalDate = start.toISOString().slice(0, 10);
}

private getOverrideStorageKey() {
  return `member_subscription_override_${this.member?.id}`;
}

private loadSubscriptionOverride() {
  const raw = localStorage.getItem(this.getOverrideStorageKey());
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    this.overrideActiveSince = parsed.activeSince || '';
    this.overrideRenewalDate = parsed.renewalDate || '';
    this.overrideCycle = parsed.cycle || 'MONTHLY';
    this.autoCalculateRenewal = parsed.autoCalculate ?? true;
  } catch {
    // ignore invalid local storage payload
  }
}

private normalizeDateInput(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

  loadPayments() {
    this.paymentsLoading = true;
    this.billingApi.getPaymentHistory(this.member.id).subscribe({
      next: (res: any[]) => {
        this.payments = [...(res || [])];
        this.initializeConfirmPaymentDates();
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

  this.billingApi.confirmPayment(
    paymentId,
    this.confirmPaymentDates[paymentId] || this.getTodayDateInput()
  ).subscribe({
    next: () => {
      this.clearStoredSubscriptionOverride();

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
      this.getCheckinDateValue(a.submittedAt) -
      this.getCheckinDateValue(b.submittedAt)
  );

  const labels = sorted.map(c => this.formatProgressCheckinDate(c.submittedAt));
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
  const videoCells: Array<{ rowIndex: number; colIndex: number; url: string }> = [];
  const rows: any[][] = [
    [`Exercise Plan for ${this.member?.fullName || 'Member'} (${dateLabel})`],
    [`Notes: ${this.activeWorkoutPlan?.notes?.trim() || '-'}`],
    ['Daily 10 mins General Warmup + 1-2 light sets of first exercise'],
    ['Section', 'Exercise', 'Sets', 'Reps', 'Video']
  ];

  this.activeWorkoutPlan.days?.forEach((day: any, dayIndex: number) => {
    if (dayIndex > 0) {
      rows.push(['', '', '', '', '']);
    }

    rows.push([day.dayName || `Day ${dayIndex + 1}`, '', '', '', '']);

    const groupedExercises = this.groupExercisesForExport(day.exercises || []);

    groupedExercises.forEach((exercise, exIndex) => {
      const repsValues = exercise.sets
        .map((s: any) => s?.reps)
        .filter((v: any) => v != null && v !== '');
      const uniqueReps = Array.from(new Set(repsValues));
      const numericSetNumbers = exercise.sets
        .map((s: any) => Number(s?.setNumber))
        .filter((n: number) => Number.isFinite(n) && n > 0);
      const derivedSetCount = numericSetNumbers.length
        ? Math.max(...numericSetNumbers)
        : exercise.sets.length;

      rows.push([
        exIndex + 1,
        exercise.name || '',
        derivedSetCount || '',
        uniqueReps.length === 1 ? uniqueReps[0] : uniqueReps.join(', '),
        exercise.videoUrl ? 'Open Video' : ''
      ]);

      if (exercise.videoUrl) {
        videoCells.push({
          rowIndex: rows.length - 1,
          colIndex: 4,
          url: exercise.videoUrl
        });
      }
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  videoCells.forEach(({ rowIndex, colIndex, url }) => {
    const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
    ws[cellRef] = {
      t: 's',
      v: 'Open Video',
      l: { Target: url, Tooltip: 'Open workout video' }
    };
  });

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } }
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

private groupExercisesForExport(exercises: any[]): Array<{ name: string; videoUrl: string | null; sets: any[] }> {
  const grouped = new Map<string, { name: string; videoUrl: string | null; sets: any[] }>();

  (exercises || []).forEach((exercise: any) => {
    const name = (exercise?.name || '').trim();
    const videoUrl = this.getWorkoutVideoUrl(exercise);
    const key = `${name}__${videoUrl || ''}`;

    if (!grouped.has(key)) {
      grouped.set(key, { name, videoUrl, sets: [] });
    }

    const bucket = grouped.get(key)!;
    const sets = Array.isArray(exercise?.sets) ? exercise.sets : [];
    bucket.sets.push(...sets);
  });

  return Array.from(grouped.values()).map((item) => ({
    ...item,
    sets: item.sets.sort((a: any, b: any) => (a?.setNumber || 0) - (b?.setNumber || 0))
  }));
}

getWorkoutVideoUrl(exercise: any): string | null {
  const raw = (exercise?.videoUrl || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
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
        this.getDietItemDisplayName(item.foodName),
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
            this.getCheckinDateValue(b.submittedAt) -
            this.getCheckinDateValue(a.submittedAt)
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
      this.getCheckinDateValue(b.submittedAt) -
      this.getCheckinDateValue(a.submittedAt)
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

onPhotoDragStart(checkinId: string, index: number): void {
  this.draggedPhoto = { checkinId, index };
}

onPhotoDragOver(event: DragEvent): void {
  event.preventDefault();
}

onPhotoDrop(checkinId: string, targetIndex: number): void {
  if (!this.draggedPhoto || this.draggedPhoto.checkinId !== checkinId) return;

  const photos = this.checkinPhotos[checkinId];
  if (!photos?.length) return;

  const { index: sourceIndex } = this.draggedPhoto;
  if (sourceIndex === targetIndex || sourceIndex < 0 || targetIndex < 0) {
    this.draggedPhoto = null;
    return;
  }

  const reordered = [...photos];
  const [movedPhoto] = reordered.splice(sourceIndex, 1);
  reordered.splice(targetIndex, 0, movedPhoto);
  this.checkinPhotos[checkinId] = reordered;
  this.draggedPhoto = null;
}

onPhotoDragEnd(): void {
  this.draggedPhoto = null;
}

openProgressComparison() {
  if (!this.currentCheckin || !this.previousCheckin) return;
  this.showProgressComparisonModal = true;
  this.isProgressComparisonMaximized = false;
  this.comparisonZoomLevel = 1;
}

closeProgressComparison() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => undefined);
  }
  this.showProgressComparisonModal = false;
  this.isProgressComparisonMaximized = false;
  this.comparisonZoomLevel = 1;
}

toggleProgressComparisonMaximize() {
  const modalElement = this.comparisonModalRef?.nativeElement;
  if (!modalElement) return;

  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => undefined);
    this.isProgressComparisonMaximized = false;
    return;
  }

  modalElement.requestFullscreen().then(() => {
    this.isProgressComparisonMaximized = true;
  }).catch(() => {
    this.isProgressComparisonMaximized = false;
  });
}

zoomInComparison() {
  this.comparisonZoomLevel = Math.min(2.5, this.roundTo(this.comparisonZoomLevel + 0.25, 2));
}

zoomOutComparison() {
  this.comparisonZoomLevel = Math.max(0.5, this.roundTo(this.comparisonZoomLevel - 0.25, 2));
}

resetComparisonZoom() {
  this.comparisonZoomLevel = 1;
}

@HostListener('document:fullscreenchange')
onFullscreenChange() {
  this.isProgressComparisonMaximized = !!document.fullscreenElement;
}

get canCompareProgress(): boolean {
  return !!this.currentCheckin && !!this.previousCheckin;
}

get currentDietPlanSummary(): string {
  const calories = this.toNumberOrNull(this.bodyMetrics.targetCalories);
  const carbs = this.toNumberOrNull(this.bodyMetrics.carbsGrams);
  const protein = this.toNumberOrNull(this.bodyMetrics.proteinGrams);
  const fats = this.toNumberOrNull(this.bodyMetrics.fatsGrams);

  const macroParts = [
    carbs != null ? `${carbs}g Carbs` : null,
    protein != null ? `${protein}g Protein` : null,
    fats != null ? `${fats}g Fats` : null
  ].filter((value): value is string => !!value);

  if (calories != null && macroParts.length) {
    return `${calories} Calories (${macroParts.join(', ')})`;
  }

  if (this.dietPlan?.title) {
    return this.dietPlan.title;
  }

  return 'NA';
}

getComparisonValue(checkin: any, field: 'weight' | 'stepsAvg' | 'dietAdherence' | 'energy' | 'exerciseRating'): string {
  const value = field === 'exerciseRating'
    ? (checkin?.exerciseRating ?? checkin?.energy)
    : checkin?.[field];

  if (value == null || value === '') return 'NA';
  if (field === 'weight') return `${value} kg`;
  return `${value}`;
}

getComparisonDelta(field: 'weight' | 'stepsAvg' | 'dietAdherence' | 'energy' | 'exerciseRating'): string {
  if (!this.currentCheckin || !this.previousCheckin) return 'NA';

  const current = Number(
    field === 'exerciseRating'
      ? (this.currentCheckin?.exerciseRating ?? this.currentCheckin?.energy)
      : this.currentCheckin?.[field]
  );
  const previous = Number(
    field === 'exerciseRating'
      ? (this.previousCheckin?.exerciseRating ?? this.previousCheckin?.energy)
      : this.previousCheckin?.[field]
  );
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 'NA';

  const diff = this.roundToTwo(current - previous);
  const prefix = diff > 0 ? '+' : '';
  const suffix = field === 'weight' ? ' kg' : '';
  return `${prefix}${diff}${suffix}`;
}

getComparisonNotes(checkin: any): string {
  const notes = String(checkin?.notes || '').trim();
  return notes || 'NA';
}

calculateProgressSummary() {
  if (!this.progressCheckins?.length) return;

  const sorted = [...this.progressCheckins]
    .sort((a, b) => this.getCheckinDateValue(a.submittedAt) - this.getCheckinDateValue(b.submittedAt));

  const last = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  this.latestWeight = last.weight || 0;
  this.weightChange = this.roundToTwo((last.weight || 0) - (previous?.weight || 0));

  const validDiet = sorted.filter(c => c.dietAdherence);
  const validSteps = sorted.filter(c => c.stepsAvg != null);

  this.avgDietAdherence =
    validDiet.reduce((sum, c) => sum + c.dietAdherence, 0) / (validDiet.length || 1);

  this.avgSteps = this.roundToTwo(
    validSteps.reduce((sum, c) => sum + c.stepsAvg, 0) / (validSteps.length || 1)
  );
}

formatProgressCheckinDate(value: string | null | undefined): string {
  if (!value) return '-';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(parsed);
}

private getCheckinDateValue(value: string | null | undefined): number {
  if (!value) return 0;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

private roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

private initializeConfirmPaymentDates(): void {
  const today = this.getTodayDateInput();
  const nextDates: Record<string, string> = {};

  (this.payments || []).forEach((payment) => {
    if (payment?.status === 'PENDING' && payment?.mode === 'MANUAL') {
      nextDates[payment.id] = this.normalizeDateInput(payment.paymentDate) || today;
    }
  });

  this.confirmPaymentDates = nextDates;
}

private getTodayDateInput(): string {
  return new Date().toISOString().slice(0, 10);
}

private clearStoredSubscriptionOverride(): void {
  localStorage.removeItem(this.getOverrideStorageKey());
  this.overrideActiveSince = '';
  this.overrideRenewalDate = '';
  this.overrideMessage = null;
}

private getOriginalSubscriptionStartDate(): string | null {
  if (!this.subscriptionHistory.length) {
    return this.subscription?.startDate || null;
  }

  const startDates = this.subscriptionHistory
    .map((item) => String(item?.startDate || '').trim())
    .filter(Boolean)
    .sort();

  return startDates[0] || null;
}

private parseDietItemFoodName(foodName: any): { primaryFoodName: string; optionalAlternatives: string[] } {
  const rawValue = String(foodName || '').trim();
  const match = rawValue.match(/^(.*?)(?:\s*\[\[OPT:(.*?)\]\])?$/);
  const primaryFoodName = String(match?.[1] || rawValue).trim();
  const optionalAlternatives = String(match?.[2] || '')
    .split('|')
    .map((item) => item.trim())
    .filter((item, index, list) => !!item && list.findIndex((entry) => entry.toLowerCase() === item.toLowerCase()) === index);

  return {
    primaryFoodName,
    optionalAlternatives
  };
}

}
