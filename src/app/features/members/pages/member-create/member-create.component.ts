import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MemberApiService } from '../../../../core/api/member-api.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

declare const XLSX: any;

type FieldType = 'text' | 'email' | 'number' | 'date' | 'textarea' | 'select';

interface OnboardingField {
  key: string;
  label: string;
  header: string;
  type: FieldType;
  section: string;
  required?: boolean;
  options?: string[];
}

const ONBOARDING_FIELDS: OnboardingField[] = [
  { key: 'fullName', label: 'Full Name', header: 'Full Name', type: 'text', section: 'Basic Details', required: true },
  { key: 'email', label: 'Email Address', header: 'Email Address', type: 'email', section: 'Basic Details', required: true },
  { key: 'phone', label: 'Phone Number', header: 'Phone Number (WhatsApp preferred)', type: 'text', section: 'Basic Details' },
  { key: 'gender', label: 'Gender', header: 'Gender', type: 'select', section: 'Basic Details', required: true, options: ['Male', 'Female', 'Other'] },
  { key: 'dateOfBirth', label: 'Date of Birth', header: 'Date of Birth', type: 'date', section: 'Basic Details' },
  { key: 'age', label: 'Age', header: 'Age', type: 'number', section: 'Basic Details' },
  { key: 'country', label: 'Country', header: 'Country', type: 'text', section: 'Basic Details' },
  { key: 'stateCityProvince', label: 'State/City/Province', header: 'State/City/Province', type: 'text', section: 'Basic Details' },
  { key: 'heightCm', label: 'Height (cm)', header: 'Height (cm)', type: 'number', section: 'Body Metrics' },
  { key: 'currentWeightKg', label: 'Current Weight (kg)', header: 'Current Weight (kg)', type: 'number', section: 'Body Metrics' },
  { key: 'mainTrainingGoal', label: 'Main Training Goal', header: 'Main Training Goal', type: 'text', section: 'Goals', required: true },
  { key: 'goal', label: 'Primary Goal (System)', header: 'Main Training Goal', type: 'select', section: 'Goals', required: true, options: ['Fat Loss', 'Muscle Gain', 'General Fitness'] },
  { key: 'previousWeightLoss', label: 'Reduced weight before?', header: 'Have you reduced body weight before? If yes, how much?', type: 'textarea', section: 'Goals' },
  { key: 'weightRegain', label: 'Weight regain details', header: 'Did you regain any of that weight? ', type: 'textarea', section: 'Goals' },
  { key: 'priorTrainingExperience', label: 'Prior training experience', header: 'Any prior training experience? If yes, how many years?', type: 'textarea', section: 'Training Profile' },
  { key: 'dailyTrainingCommitmentHours', label: 'Daily training commitment (hours)', header: 'Daily training commitment (hours)', type: 'text', section: 'Training Profile' },
  { key: 'preferredWorkoutTiming', label: 'Preferred workout timing', header: 'Preferred workout timing', type: 'text', section: 'Training Profile' },
  { key: 'daysPerWeekTrain', label: 'Days per week to train', header: 'How many days per week can you train?', type: 'number', section: 'Training Profile' },
  { key: 'personalTrainingBefore', label: 'Personal training before?', header: 'Have you taken Personal Training before?', type: 'text', section: 'Training Profile' },
  { key: 'goalReward', label: 'Goal reward', header: 'How would you reward yourself once you achieve your goal?', type: 'textarea', section: 'Training Profile' },
  { key: 'additionalInfo', label: 'Anything else to know', header: 'Anything else you want us to know?', type: 'textarea', section: 'Training Profile' },
  { key: 'alcoholConsumption', label: 'Alcohol consumption', header: 'Alcohol consumption? If yes, how many days/week?', type: 'text', section: 'Lifestyle' },
  { key: 'smokingHabits', label: 'Smoking habits', header: 'Smoking habits? If yes, how many/day?', type: 'text', section: 'Lifestyle' },
  { key: 'supplementsPast', label: 'Supplements used', header: 'Have you used supplements in the past? If yes, list them.', type: 'textarea', section: 'Lifestyle' },
  { key: 'steroidUsage', label: 'Steroid usage', header: 'Steroid usage (if any) — compounds + duration?', type: 'textarea', section: 'Lifestyle' },
  { key: 'stressLevel', label: 'Stress level (1-10)', header: 'Current stress level (1–10)', type: 'number', section: 'Lifestyle' },
  { key: 'sleepHours', label: 'Sleep hours/night', header: 'Hours of sleep per night', type: 'number', section: 'Lifestyle' },
  { key: 'pastSportsActivity', label: 'Past sports activity', header: 'Past sports activity (School/College/Club)', type: 'textarea', section: 'Lifestyle' },
  { key: 'foodPreference', label: 'Food preference', header: 'Food preference', type: 'text', section: 'Nutrition' },
  { key: 'activityLevel', label: 'Activity level', header: 'Activity level', type: 'text', section: 'Nutrition' },
  { key: 'typicalDay', label: 'Typical day', header: 'Describe your typical day(ex : waking time, meals, work, sleep, steps, water intake etc)', type: 'textarea', section: 'Nutrition' },
  { key: 'currentDietPlan', label: 'Current diet plan', header: 'Current Diet Plan (if any)', type: 'textarea', section: 'Nutrition' },
  { key: 'favoriteFoods', label: 'Favorite foods', header: 'List of favorite foods', type: 'textarea', section: 'Nutrition' },
  { key: 'foodAllergies', label: 'Food intolerances/allergies', header: 'Food intolerances / allergies', type: 'textarea', section: 'Nutrition' },
  { key: 'medicalCondition', label: 'Medical condition', header: 'Any medical condition?', type: 'textarea', section: 'Health' },
  { key: 'injuries', label: 'Past/current injuries', header: 'Past or current injuries?', type: 'textarea', section: 'Health' },
  { key: 'medicalConditionsDetailed', label: 'Medical conditions (detailed)', header: 'Do you suffer from any medical conditions?', type: 'textarea', section: 'Health' },
  { key: 'pushUp', label: 'Push Up', header: 'Push Up', type: 'text', section: 'Movement Assessment' },
  { key: 'squat', label: 'Squat', header: 'Squat', type: 'text', section: 'Movement Assessment' },
  { key: 'rowBandDumbbell', label: 'Row (Band/Dumbbell)', header: 'Row (Band/Dumbbell)', type: 'text', section: 'Movement Assessment' },
  { key: 'overheadPressDumbbell', label: 'Overhead Press (Dumbbell)', header: 'Overhead Press (Dumbbell)', type: 'text', section: 'Movement Assessment' },
  { key: 'hipHingeRdl', label: 'Hip Hinge (RDL)', header: 'Hip Hinge (RDL)', type: 'text', section: 'Movement Assessment' },
  { key: 'frontView', label: 'Front View (link)', header: 'Front View', type: 'text', section: 'Photos' },
  { key: 'sideView', label: 'Side View (link)', header: 'Side View', type: 'text', section: 'Photos' },
  { key: 'backView', label: 'Back View (link)', header: 'Back View', type: 'text', section: 'Photos' }
];

@Component({
  selector: 'app-member-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './member-create.component.html',
  styleUrls: ['./member-create.component.scss']
})
export class MemberCreateComponent {

  loading = false;
  error: string | null = null;
  excelError: string | null = null;
  excelFileName = '';
  parsedResponses: any[] = [];
  selectedResponseIndex: string = '';

  readonly onboardingFields = ONBOARDING_FIELDS;
  readonly sections = Array.from(new Set(ONBOARDING_FIELDS.map(f => f.section)));

  constructor(
    private fb: FormBuilder,
    private memberApi: MemberApiService,
    private router: Router
  ) {}

  form = this.fb.group(this.buildFormConfig());

  private buildFormConfig() {
    const config: Record<string, any> = {};

    this.onboardingFields.forEach(field => {
      const validators = [];

      if (field.required) validators.push(Validators.required);
      if (field.type === 'email') validators.push(Validators.email);

      config[field.key] = ['', validators];
    });

    return config;
  }

  getFieldsBySection(section: string) {
    return this.onboardingFields.filter(field => field.section === section);
  }

  trackByFieldKey(_index: number, field: OnboardingField) {
    return field.key;
  }

  async onExcelUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    this.excelError = null;
    this.excelFileName = file.name;
    this.parsedResponses = [];
    this.selectedResponseIndex = '';

    if (typeof XLSX === 'undefined') {
      this.excelError = 'Excel parser not loaded. Refresh and try again.';
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      this.parsedResponses = rawRows.map((row: any) => this.mapExcelRowToForm(row));

      if (!this.parsedResponses.length) {
        this.excelError = 'No rows found in the uploaded Excel.';
        return;
      }

      this.applyResponseAtIndex('0');
    } catch {
      this.excelError = 'Failed to read Excel. Please upload a valid .xlsx file.';
    }
  }

  applyResponseAtIndex(index: string) {
    this.selectedResponseIndex = index;
    const idx = Number(index);

    if (Number.isNaN(idx) || !this.parsedResponses[idx]) return;

    this.form.patchValue(this.parsedResponses[idx]);
  }

  private mapExcelRowToForm(row: any) {
    const mapped: Record<string, any> = {};

    this.onboardingFields.forEach(field => {
      mapped[field.key] = this.normalizeFieldValue(field, row[field.header]);
    });

    return mapped;
  }

  private normalizeFieldValue(field: OnboardingField, rawValue: any) {
    if (rawValue == null) return '';

    if (field.type === 'date') {
      return this.normalizeDateValue(rawValue);
    }

    if (field.type === 'number') {
      return this.normalizeNumberValue(rawValue);
    }

    return rawValue;
  }

  private normalizeDateValue(value: any): string {
    // Excel numeric serial date
    if (typeof value === 'number') {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
      return date.toISOString().slice(0, 10);
    }

    // Date object from parser
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }

    // String date: try parsing and reformatting for input[type="date"]
    const parsed = new Date(String(value));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }

    return '';
  }

  private normalizeNumberValue(value: any): number | '' {
    if (value == null || value === '') return '';

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    const cleaned = String(value).replace(/[^0-9.-]/g, '');
    if (!cleaned) return '';

    const numeric = Number(cleaned);
    return Number.isFinite(numeric) ? numeric : '';
  }

  submit() {

  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  this.loading = true;
  this.error = null;

  const payload = this.form.getRawValue();

  this.memberApi.createMember(payload).subscribe({
    next: () => {
      this.router.navigate(['/members']);
    },
    error: () => {
      this.loading = false;
      this.error = 'Failed to create member';
    }
  });
}
}
