import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MemberApiService } from '../../../../core/api/member-api.service';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';

type FieldType = 'text' | 'email' | 'number' | 'date' | 'textarea' | 'select';

interface MemberField {
  key: string;
  label: string;
  type: FieldType;
  section: string;
  required?: boolean;
  options?: string[];
}

const MEMBER_FIELDS: MemberField[] = [
  { key: 'fullName', label: 'Full Name', type: 'text', section: 'Basic Details', required: true },
  { key: 'email', label: 'Email Address', type: 'email', section: 'Basic Details', required: true },
  { key: 'phone', label: 'Phone Number', type: 'text', section: 'Basic Details' },
  { key: 'gender', label: 'Gender', type: 'select', section: 'Basic Details', required: true, options: ['Male', 'Female', 'Other'] },
  { key: 'dateOfBirth', label: 'Date of Birth', type: 'date', section: 'Basic Details' },
  { key: 'age', label: 'Age', type: 'number', section: 'Basic Details' },
  { key: 'country', label: 'Country', type: 'text', section: 'Basic Details' },
  { key: 'stateCityProvince', label: 'State/City/Province', type: 'text', section: 'Basic Details' },

  { key: 'heightCm', label: 'Height (cm)', type: 'number', section: 'Body Metrics' },
  { key: 'currentWeightKg', label: 'Current Weight (kg)', type: 'number', section: 'Body Metrics' },

  { key: 'mainTrainingGoal', label: 'Main Training Goal', type: 'text', section: 'Goals', required: true },
  { key: 'goal', label: 'Primary Goal (System)', type: 'select', section: 'Goals', required: true, options: ['Fat Loss', 'Muscle Gain', 'General Fitness'] },
  { key: 'previousWeightLoss', label: 'Reduced weight before?', type: 'textarea', section: 'Goals' },
  { key: 'weightRegain', label: 'Weight regain details', type: 'textarea', section: 'Goals' },
  { key: 'goalReward', label: 'Goal reward', type: 'textarea', section: 'Goals' },

  { key: 'priorTrainingExperience', label: 'Prior training experience', type: 'textarea', section: 'Training Profile' },
  { key: 'dailyTrainingCommitmentHours', label: 'Daily training commitment (hours)', type: 'text', section: 'Training Profile' },
  { key: 'preferredWorkoutTiming', label: 'Preferred workout timing', type: 'text', section: 'Training Profile' },
  { key: 'daysPerWeekTrain', label: 'Days per week to train', type: 'number', section: 'Training Profile' },
  { key: 'personalTrainingBefore', label: 'Personal training before?', type: 'text', section: 'Training Profile' },
  { key: 'additionalInfo', label: 'Anything else to know', type: 'textarea', section: 'Training Profile' },

  { key: 'activityLevel', label: 'Activity level', type: 'text', section: 'Lifestyle & Nutrition' },
  { key: 'stressLevel', label: 'Stress level (1-10)', type: 'number', section: 'Lifestyle & Nutrition' },
  { key: 'sleepHours', label: 'Sleep hours/night', type: 'number', section: 'Lifestyle & Nutrition' },
  { key: 'alcoholConsumption', label: 'Alcohol consumption', type: 'text', section: 'Lifestyle & Nutrition' },
  { key: 'smokingHabits', label: 'Smoking habits', type: 'text', section: 'Lifestyle & Nutrition' },
  { key: 'supplementsPast', label: 'Supplements used', type: 'textarea', section: 'Lifestyle & Nutrition' },
  { key: 'steroidUsage', label: 'Steroid usage', type: 'textarea', section: 'Lifestyle & Nutrition' },
  { key: 'pastSportsActivity', label: 'Past sports activity', type: 'textarea', section: 'Lifestyle & Nutrition' },
  { key: 'foodPreference', label: 'Food preference', type: 'text', section: 'Lifestyle & Nutrition' },
  { key: 'typicalDay', label: 'Typical day', type: 'textarea', section: 'Lifestyle & Nutrition' },
  { key: 'currentDietPlan', label: 'Current diet plan', type: 'textarea', section: 'Lifestyle & Nutrition' },
  { key: 'favoriteFoods', label: 'Favorite foods', type: 'textarea', section: 'Lifestyle & Nutrition' },
  { key: 'foodAllergies', label: 'Food intolerances/allergies', type: 'textarea', section: 'Lifestyle & Nutrition' },

  { key: 'medicalCondition', label: 'Medical condition', type: 'textarea', section: 'Health & Movement' },
  { key: 'medicalConditionsDetailed', label: 'Medical conditions (detailed)', type: 'textarea', section: 'Health & Movement' },
  { key: 'injuries', label: 'Past/current injuries', type: 'textarea', section: 'Health & Movement' },
  { key: 'pushUp', label: 'Push Up', type: 'text', section: 'Health & Movement' },
  { key: 'squat', label: 'Squat', type: 'text', section: 'Health & Movement' },
  { key: 'rowBandDumbbell', label: 'Row (Band/Dumbbell)', type: 'text', section: 'Health & Movement' },
  { key: 'overheadPressDumbbell', label: 'Overhead Press (Dumbbell)', type: 'text', section: 'Health & Movement' },
  { key: 'hipHingeRdl', label: 'Hip Hinge (RDL)', type: 'text', section: 'Health & Movement' },

  { key: 'frontView', label: 'Front View (link)', type: 'text', section: 'Progress Photos' },
  { key: 'sideView', label: 'Side View (link)', type: 'text', section: 'Progress Photos' },
  { key: 'backView', label: 'Back View (link)', type: 'text', section: 'Progress Photos' }
];

@Component({
  selector: 'app-member-edit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './member-edit.component.html',
  styleUrls: ['./member-edit.component.scss']
})
export class MemberEditComponent implements OnInit {

  memberId!: string;
  loading = true;
  saving = false;
  error: string | null = null;
  readonly fields = MEMBER_FIELDS;
  readonly sections = Array.from(new Set(MEMBER_FIELDS.map(f => f.section)));

  constructor(
    private route: ActivatedRoute,
    private memberApi: MemberApiService,
    private fb: FormBuilder,
    private router: Router
  ) {}

  form = this.fb.group(this.buildFormConfig());

  private buildFormConfig() {
    const config: Record<string, any> = {};

    this.fields.forEach(field => {
      const validators = [];
      if (field.required) validators.push(Validators.required);
      if (field.type === 'email') validators.push(Validators.email);
      config[field.key] = ['', validators];
    });

    return config;
  }

  getFieldsBySection(section: string) {
    return this.fields.filter(field => field.section === section);
  }

  trackByFieldKey(_index: number, field: MemberField) {
    return field.key;
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('memberId');
    if (id) {
      this.memberId = id;
      this.loadMember();
    } else {
      this.loading = false;
      this.error = 'Invalid member id';
    }
  }

  loadMember() {
    this.loading = true;
    this.error = null;

    this.memberApi.getMemberById(this.memberId).subscribe({
      next: (res: any) => {
        this.form.patchValue(res);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'Failed to load member details';
      }
    });
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.error = null;

    this.memberApi.updateMember(this.memberId, this.form.value)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          this.router.navigate(['/members', this.memberId]);
        },
        error: () => {
          this.error = 'Failed to save member changes';
        }
      });
  }
}
