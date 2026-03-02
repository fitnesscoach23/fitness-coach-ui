import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { ProgressCheckinApiService } from '../../../../core/services/progress-checkin-api.service';
import { MemberApiService } from '../../../../core/api/member-api.service';
import { ProgressCheckinPhotoApiService } from '../../../../core/api/progress-checkin-photo-api.service';

declare const XLSX: any;

interface CheckinImportRow {
  memberName: string;
  weight: number | null;
  stepsAvg: number | null;
  dietAdherence: number | null;
  notes: string;
  frontViewUrl: string;
  sideViewUrl: string;
  backViewUrl: string;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './checkin-create.component.html',
  styleUrls: ['./checkin-create.component.scss']
})
export class CheckinCreateComponent implements OnInit {

  loading = false;
  error: string | null = null;
  success = false;
  submitAttempted = false;
  excelError: string | null = null;
  importWarning: string | null = null;
  excelFileName = '';
  parsedResponses: CheckinImportRow[] = [];
  selectedResponseIndex: string = '';

  // form fields
  memberId: string | null = null;
  weight: number | null = null;
  dietAdherence: number | null = null;
  stepsAvg: number | null = null;
  notes = '';
  frontViewUrl = '';
  sideViewUrl = '';
  backViewUrl = '';

  members: any[] = [];

  // photos (MANDATORY)
  frontPhoto: File | null = null;
  sidePhoto: File | null = null;
  backPhoto: File | null = null;
  readonly MAX_FILE_SIZE_MB = 5;
  readonly MAX_FILE_SIZE_BYTES = this.MAX_FILE_SIZE_MB * 1024 * 1024;
  photoError: string | null = null;

  constructor(
    private api: ProgressCheckinApiService,
    private memberApi: MemberApiService,
    private photoApi: ProgressCheckinPhotoApiService
  ) {}

  ngOnInit() {
    this.memberApi.getMembers().subscribe({
      next: res => this.members = res,
      error: () => {
        this.error = 'Failed to load members';
      }
    });
  }

  onMemberChange() {
    if (!this.memberId) {
      this.frontViewUrl = '';
      this.sideViewUrl = '';
      this.backViewUrl = '';
      return;
    }

    this.memberApi.getMemberById(this.memberId).subscribe({
      next: (member: any) => {
        this.frontViewUrl = member?.frontView || '';
        this.sideViewUrl = member?.sideView || '';
        this.backViewUrl = member?.backView || '';
      },
      error: () => {
        // keep current values if lookup fails
      }
    });
  }

  async onExcelUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    this.excelError = null;
    this.importWarning = null;
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
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      this.parsedResponses = rawRows
        .map((row: any) => this.mapExcelRow(row))
        .filter((row: CheckinImportRow) => !!row.memberName || row.weight != null);

      if (!this.parsedResponses.length) {
        this.excelError = 'No valid check-in rows found in uploaded Excel.';
        return;
      }

      this.applyResponseAtIndex('0');
    } catch {
      this.excelError = 'Failed to parse Excel. Please upload a valid .xlsx/.xls file.';
    }
  }

  applyResponseAtIndex(index: string) {
    this.selectedResponseIndex = index;
    this.importWarning = null;

    const row = this.parsedResponses[Number(index)];
    if (!row) return;

    const member = this.members.find(
      m => this.normalizeText(m.fullName) === this.normalizeText(row.memberName)
    );

    if (member) {
      this.memberId = member.id;
    } else {
      this.memberId = null;
      this.importWarning = `Could not auto-match member "${row.memberName}". Please select member manually.`;
    }

    this.weight = row.weight;
    this.stepsAvg = row.stepsAvg;
    this.dietAdherence = row.dietAdherence;
    this.notes = row.notes;
    this.frontViewUrl = row.frontViewUrl || this.frontViewUrl;
    this.sideViewUrl = row.sideViewUrl || this.sideViewUrl;
    this.backViewUrl = row.backViewUrl || this.backViewUrl;
  }

  private mapExcelRow(row: any): CheckinImportRow {
    const memberName =
      this.getByHeaderContains(row, ['Member Name']) ||
      this.getByHeaderContains(row, ['Full Name']) ||
      '';

    const weight = this.parseNumber(
      this.getByHeaderContains(row, ['Current Weight'])
    );

    const stepsAvg = this.parseNumber(
      this.getByHeaderContains(row, ['Step Count average last week'])
    );

    const dietAdherence = this.parseNumber(
      this.getByHeaderContains(row, ['How close are you following the diet plan'])
    );

    const frontViewUrl = String(
      this.getByHeaderContains(row, ['Front Pose while standing straight']) || ''
    );
    const sideViewUrl = String(
      this.getByHeaderContains(row, ['Side pose while standing straight']) || ''
    );
    const backViewUrl = String(
      this.getByHeaderContains(row, ['Back pose while standing straight']) || ''
    );

    const notesParts: string[] = [];
    const fitnessLevel = this.getByHeaderContains(row, ['current fitness level']);
    const primaryGoals = this.getByHeaderContains(row, ['primary fitness goals']);
    const workoutDays = this.getByHeaderContains(row, ['days per week are you currently exercising']);
    const workoutDuration = this.getByHeaderContains(row, ['typical workout session']);
    const medicalInfo = this.getByHeaderContains(row, ['pre-existing medical conditions or injuries']);
    const dietPlan = this.getByHeaderContains(row, ['specific diet or nutrition plan']);
    const nutritionOther = this.getByHeaderContains(row, ['Other\' for nutrition']);
    const confidence = this.getByHeaderContains(row, ['confident are you in achieving your fitness goals']);

    if (fitnessLevel) notesParts.push(`Fitness level: ${fitnessLevel}`);
    if (primaryGoals) notesParts.push(`Primary goals: ${primaryGoals}`);
    if (workoutDays) notesParts.push(`Workout days/week: ${workoutDays}`);
    if (workoutDuration) notesParts.push(`Workout duration: ${workoutDuration}`);
    if (medicalInfo) notesParts.push(`Medical/injuries: ${medicalInfo}`);
    if (dietPlan) notesParts.push(`Current nutrition plan: ${dietPlan}`);
    if (nutritionOther) notesParts.push(`Nutrition other: ${nutritionOther}`);
    if (confidence) notesParts.push(`Goal confidence: ${confidence}`);

    return {
      memberName: String(memberName || ''),
      weight,
      stepsAvg,
      dietAdherence,
      notes: notesParts.join('\n'),
      frontViewUrl,
      sideViewUrl,
      backViewUrl
    };
  }

  private getByHeaderContains(row: any, keywords: string[]): any {
    const rowKeys = Object.keys(row || {});
    const normalizedKeys = rowKeys.map(key => this.normalizeText(key));
    const normalizedKeywords = keywords.map(keyword => this.normalizeText(keyword));

    const index = normalizedKeys.findIndex(key =>
      normalizedKeywords.some(keyword => key.includes(keyword))
    );

    if (index === -1) return '';
    return row[rowKeys[index]];
  }

  private normalizeText(value: any): string {
    return String(value || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private parseNumber(value: any): number | null {
    if (value == null || value === '') return null;
    const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
    return Number.isNaN(numeric) ? null : numeric;
  }

  // 🔐 single source of truth
 get photosValid(): boolean {
  return !!(
    this.frontPhoto &&
    this.sidePhoto &&
    this.backPhoto &&
    !this.photoError
  );
}


  submit() {
    this.submitAttempted = true;

    if (!this.memberId || !this.weight) {
      this.error = 'Member and weight are required';
      return;
    }

    if (!this.photosValid) {
      this.error = 'Front, side and back photos are mandatory';
      return;
    }

    this.loading = true;
    this.error = null;

    this.api.createCheckin({
      memberId: this.memberId,
      weight: this.weight,
      dietAdherence: this.dietAdherence,
      stepsAvg: this.stepsAvg,
      notes: this.notes
    }).subscribe({
      next: (checkInId: string) => {
        const cleanId = checkInId.replace(/"/g, '');
        this.uploadPhotos(cleanId);
      },
      error: () => {
        this.loading = false;
        this.error = 'Failed to submit check-in';
      }
    });
  }

  private uploadPhotos(checkInId: string) {
    const uploads = [
      this.photoApi.upload(checkInId, 'FRONT', this.frontPhoto!),
      this.photoApi.upload(checkInId, 'SIDE', this.sidePhoto!),
      this.photoApi.upload(checkInId, 'BACK', this.backPhoto!)
    ];

    forkJoin(uploads).subscribe({
      next: () => this.finish(),
      error: () => {
        this.loading = false;
        this.error = 'Check-in saved, but photo upload failed';
      }
    });
  }

  private finish() {
    this.loading = false;
    this.success = true;
    this.submitAttempted = false;
    this.reset();
  }

  private reset() {
    this.memberId = null;
    this.weight = null;
    this.dietAdherence = null;
    this.stepsAvg = null;
    this.notes = '';
    this.frontViewUrl = '';
    this.sideViewUrl = '';
    this.backViewUrl = '';

    this.frontPhoto = null;
    this.sidePhoto = null;
    this.backPhoto = null;
  }

  // =====================
  // FILE HANDLERS (SAFE)
  // =====================

onPhotoSelected(
  event: Event,
  type: 'FRONT' | 'SIDE' | 'BACK'
) {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;

  const file = input.files[0];

  // 🔒 FILE SIZE VALIDATION
  if (file.size > this.MAX_FILE_SIZE_BYTES) {
    this.photoError = `Each photo must be under ${this.MAX_FILE_SIZE_MB} MB`;
    input.value = ''; // reset file input
    return;
  }

  this.photoError = null;

  if (type === 'FRONT') this.frontPhoto = file;
  if (type === 'SIDE') this.sidePhoto = file;
  if (type === 'BACK') this.backPhoto = file;
}

get photoStatus() {
  return {
    front: !!this.frontPhoto,
    side: !!this.sidePhoto,
    back: !!this.backPhoto
  };
}

}
