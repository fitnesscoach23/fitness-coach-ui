import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { from, of } from 'rxjs';
import { catchError, concatMap, finalize, toArray } from 'rxjs/operators';
import {
  ExerciseLibraryApiService,
  ExerciseLibraryPayload
} from '../../../../core/api/exercise-library-api.service';

declare const XLSX: any;

type ImportRow = {
  srNo: number;
  muscleGroup: string;
  exerciseName: string;
  musclesTrained: string;
  videoUrl: string;
};

type ExerciseFormRow = {
  muscleGroup: string;
  exerciseName: string;
  musclesTrained: string;
  videoUrl: string;
};

@Component({
  selector: 'app-exercise-library-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './exercise-library-home.component.html',
  styleUrls: ['./exercise-library-home.component.scss']
})
export class ExerciseLibraryHomeComponent implements OnInit {
  exercises: any[] = [];
  loadingExercises = true;
  searchTerm = '';
  selectedMuscleGroup = '';

  error: string | null = null;
  formError: string | null = null;
  importMessage: string | null = null;

  savingExercise = false;
  deletingExerciseId: string | null = null;
  importing = false;

  form: {
    id: string | null;
    srNo: number | null;
    muscleGroup: string;
    exerciseName: string;
    musclesTrained: string;
    videoUrl: string;
  } = {
    id: null,
    srNo: null,
    muscleGroup: '',
    exerciseName: '',
    musclesTrained: '',
    videoUrl: ''
  };
  formRows: ExerciseFormRow[] = [this.createEmptyRow()];

  constructor(private exerciseLibraryApi: ExerciseLibraryApiService) {}

  get filteredExercises(): any[] {
    const search = this.searchTerm.trim().toLowerCase();
    const selectedGroup = this.selectedMuscleGroup.trim().toLowerCase();

    return this.exercises.filter((exercise) => {
      const muscleGroup = String(exercise?.muscleGroup || '').toLowerCase();
      const exerciseName = String(exercise?.exerciseName || '').toLowerCase();
      const musclesTrained = String(exercise?.musclesTrained || '').toLowerCase();

      const matchesSearch =
        !search ||
        exerciseName.includes(search) ||
        muscleGroup.includes(search) ||
        musclesTrained.includes(search);

      const matchesGroup = !selectedGroup || muscleGroup === selectedGroup;

      return matchesSearch && matchesGroup;
    });
  }

  get muscleGroupOptions(): string[] {
    return Array.from(
      new Set(
        this.exercises
          .map((exercise) => String(exercise?.muscleGroup || '').trim())
          .filter((group) => !!group)
      )
    ).sort((a, b) => a.localeCompare(b));
  }

  ngOnInit(): void {
    this.loadExercises();
  }

  loadExercises() {
    this.loadingExercises = true;
    this.error = null;

    this.exerciseLibraryApi.getExercises().subscribe({
      next: (res: any[]) => {
        this.exercises = [...(res || [])].sort((a, b) => (a?.srNo || 0) - (b?.srNo || 0));
        this.loadingExercises = false;
      },
      error: () => {
        this.error = 'Failed to load exercise library';
        this.loadingExercises = false;
      }
    });
  }

  submitExercise() {
    this.formError = null;

    if (this.form.id) {
      this.submitEditExercise();
      return;
    }

    const rows = this.formRows.filter((row) => this.hasRowValue(row));
    if (!rows.length) {
      this.formError = 'Add at least one exercise row before saving.';
      return;
    }

    const invalidRowIndex = rows.findIndex((row) => !this.isRowValid(row));
    if (invalidRowIndex >= 0) {
      this.formError = `Row ${invalidRowIndex + 1}: Muscle Group and Exercise Name are required.`;
      return;
    }

    const invalidVideoRowIndex = rows.findIndex((row) => !this.isValidOptionalVideoUrl(this.normalizeVideoUrl(row.videoUrl)));
    if (invalidVideoRowIndex >= 0) {
      this.formError = `Row ${invalidVideoRowIndex + 1}: Video URL must be a valid http/https link.`;
      return;
    }

    const startingSrNo = this.getNextSrNo();
    const payloads = rows.map((row, index) => this.toPayload(row, startingSrNo + index));

    this.savingExercise = true;
    from(payloads)
      .pipe(
        concatMap((payload) => this.exerciseLibraryApi.createExercise(payload)),
        toArray(),
        finalize(() => (this.savingExercise = false))
      )
      .subscribe({
        next: () => {
          this.resetForm();
          this.loadExercises();
        },
        error: () => {
          this.formError = 'Failed to save exercise rows.';
        }
      });
  }

  editExercise(ex: any) {
    this.formError = null;
    this.form = {
      id: ex.id,
      srNo: ex.srNo ?? null,
      muscleGroup: ex.muscleGroup || '',
      exerciseName: ex.exerciseName || '',
      musclesTrained: ex.musclesTrained || '',
      videoUrl: ex.videoUrl || ''
    };
  }

  addRow() {
    this.formRows = [...this.formRows, this.createEmptyRow()];
  }

  removeRow(index: number) {
    if (this.formRows.length === 1) {
      this.formRows = [this.createEmptyRow()];
      return;
    }

    this.formRows = this.formRows.filter((_, rowIndex) => rowIndex !== index);
  }

  cancelEdit() {
    this.resetForm();
  }

  deleteExercise(exerciseId: string) {
    const confirmed = window.confirm('Delete this exercise?');
    if (!confirmed) return;

    this.deletingExerciseId = exerciseId;
    this.exerciseLibraryApi
      .deleteExercise(exerciseId)
      .pipe(finalize(() => (this.deletingExerciseId = null)))
      .subscribe({
        next: () => this.loadExercises(),
        error: () => {
          this.error = 'Failed to delete exercise.';
        }
      });
  }

  onExcelSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.importMessage = null;
    this.error = null;

    if (typeof XLSX === 'undefined') {
      this.error = 'Excel parser is not loaded. Please refresh and try again.';
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result, { type: 'array' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const matrix: any[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          raw: false,
          defval: ''
        });

        const parsedRows = this.parseLibraryRows(matrix);
        if (!parsedRows.length) {
          this.error = 'No valid exercise rows found in the uploaded file.';
          input.value = '';
          return;
        }

        this.importRows(parsedRows, () => {
          input.value = '';
        });
      } catch {
        this.error = 'Failed to parse Excel file.';
        input.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  }

  private importRows(rows: ImportRow[], done: () => void) {
    this.importing = true;

    from(rows)
      .pipe(
        concatMap((row) => {
          const payload: ExerciseLibraryPayload = {
            srNo: row.srNo,
            muscleGroup: row.muscleGroup,
            exerciseName: row.exerciseName,
            musclesTrained: row.musclesTrained,
            videoUrl: this.normalizeVideoUrl(row.videoUrl)
          };

          return this.exerciseLibraryApi.createExercise(payload).pipe(
            catchError(() => of(null))
          );
        }),
        toArray(),
        finalize(() => {
          this.importing = false;
          done();
        })
      )
      .subscribe((results) => {
        const successCount = results.filter((v) => v != null).length;
        const failCount = rows.length - successCount;

        this.importMessage = `Imported ${successCount} row(s)` + (failCount ? `, failed ${failCount} row(s).` : '.');
        this.loadExercises();
      });
  }

  private parseLibraryRows(matrix: any[][]): ImportRow[] {
    if (!matrix.length) return [];

    const normalizeHeader = (v: any) =>
      String(v || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

    const headerIndex = matrix.findIndex((row) => {
      const normalized = (row || []).map(normalizeHeader);
      return normalized.includes('srno') && normalized.includes('exercisename');
    });

    if (headerIndex < 0) return [];

    const header = (matrix[headerIndex] || []).map(normalizeHeader);
    const srIdx = header.findIndex((h: string) => h === 'srno');
    const groupIdx = header.findIndex((h: string) => h === 'musclegroup');
    const exerciseIdx = header.findIndex((h: string) => h === 'exercisename');
    const musclesTrainedIdx = header.findIndex((h: string) => h === 'musclestrained');
    const videoIdx = header.findIndex((h: string) => h === 'videourl');

    if (srIdx < 0 || groupIdx < 0 || exerciseIdx < 0) return [];

    const parsed: ImportRow[] = [];
    let lastMuscleGroup = '';

    for (let i = headerIndex + 1; i < matrix.length; i++) {
      const row = matrix[i] || [];
      const srRaw = String(row[srIdx] ?? '').trim();
      const exerciseName = String(row[exerciseIdx] ?? '').trim();
      const muscleGroupRaw = String(row[groupIdx] ?? '').trim();
      const videoUrl = videoIdx >= 0 ? String(row[videoIdx] ?? '').trim() : '';
      const musclesTrained = musclesTrainedIdx >= 0 ? String(row[musclesTrainedIdx] ?? '').trim() : '';

      const srNo = Number(srRaw);
      if (!Number.isFinite(srNo) || srNo <= 0 || !exerciseName) {
        continue;
      }

      if (muscleGroupRaw) {
        lastMuscleGroup = muscleGroupRaw;
      }

      parsed.push({
        srNo,
        muscleGroup: muscleGroupRaw || lastMuscleGroup,
        exerciseName,
        musclesTrained,
        videoUrl
      });
    }

    return parsed;
  }

  resetForm() {
    this.formError = null;
    this.form = {
      id: null,
      srNo: null,
      muscleGroup: '',
      exerciseName: '',
      musclesTrained: '',
      videoUrl: ''
    };
    this.formRows = [this.createEmptyRow()];
  }

  normalizeVideoUrl(url: string | null | undefined): string {
    const trimmed = (url || '').trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  private isValidOptionalVideoUrl(url: string): boolean {
    if (!url) return true;
    return /^(https?:\/\/)[^\s]+$/i.test(url);
  }

  private submitEditExercise() {
    if (this.form.srNo == null || !this.form.muscleGroup.trim() || !this.form.exerciseName.trim()) {
      this.formError = 'Sr No, Muscle Group, and Exercise Name are required.';
      return;
    }

    const normalizedVideoUrl = this.normalizeVideoUrl(this.form.videoUrl);
    if (!this.isValidOptionalVideoUrl(normalizedVideoUrl)) {
      this.formError = 'Video URL must be a valid http/https link.';
      return;
    }

    const payload: ExerciseLibraryPayload = {
      srNo: this.form.srNo,
      muscleGroup: this.form.muscleGroup.trim(),
      exerciseName: this.form.exerciseName.trim(),
      musclesTrained: this.form.musclesTrained.trim(),
      videoUrl: normalizedVideoUrl
    };

    this.savingExercise = true;
    this.exerciseLibraryApi.updateExercise(this.form.id!, payload)
      .pipe(finalize(() => (this.savingExercise = false)))
      .subscribe({
        next: () => {
          this.resetForm();
          this.loadExercises();
        },
        error: () => {
          this.formError = 'Failed to save exercise.';
        }
      });
  }

  private toPayload(row: ExerciseFormRow, srNo: number): ExerciseLibraryPayload {
    return {
      srNo,
      muscleGroup: row.muscleGroup.trim(),
      exerciseName: row.exerciseName.trim(),
      musclesTrained: row.musclesTrained.trim(),
      videoUrl: this.normalizeVideoUrl(row.videoUrl)
    };
  }

  private isRowValid(row: ExerciseFormRow): boolean {
    return !!row.muscleGroup.trim() && !!row.exerciseName.trim();
  }

  private hasRowValue(row: ExerciseFormRow): boolean {
    return !!row.muscleGroup.trim() ||
      !!row.exerciseName.trim() ||
      !!row.musclesTrained.trim() ||
      !!row.videoUrl.trim();
  }

  private createEmptyRow(): ExerciseFormRow {
    return {
      muscleGroup: '',
      exerciseName: '',
      musclesTrained: '',
      videoUrl: ''
    };
  }

  private getNextSrNo(): number {
    const maxSrNo = this.exercises.reduce((max, exercise) => {
      const currentSrNo = Number(exercise?.srNo || 0);
      return currentSrNo > max ? currentSrNo : max;
    }, 0);

    return maxSrNo + 1;
  }
}
