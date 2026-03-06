import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { from, of } from 'rxjs';
import { catchError, concatMap, finalize, toArray } from 'rxjs/operators';
import {
  DietLibraryApiService,
  DietLibraryFoodPayload
} from '../../../../core/api/diet-library-api.service';

declare const XLSX: any;

type ImportRow = {
  foodItem: string;
  calories: number;
  carbs: number;
  protein: number;
  fats: number;
  category: string;
};

@Component({
  selector: 'app-diet-library-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './diet-library-home.component.html',
  styleUrls: ['./diet-library-home.component.scss']
})
export class DietLibraryHomeComponent implements OnInit {
  readonly canonicalCategories = ['CARBOHYDRATES', 'PROTEINS', 'FATS'];

  foods: any[] = [];
  categories: string[] = [...this.canonicalCategories];
  selectedCategory: string | null = null;

  loadingFoods = true;
  loadingCategories = true;
  importing = false;
  savingFood = false;
  deletingFoodId: string | null = null;

  error: string | null = null;
  formError: string | null = null;
  importMessage: string | null = null;

  form: {
    id: string | null;
    foodItem: string;
    calories: number | null;
    carbs: number | null;
    protein: number | null;
    fats: number | null;
    category: string;
  } = {
    id: null,
    foodItem: '',
    calories: null,
    carbs: null,
    protein: null,
    fats: null,
    category: 'CARBOHYDRATES'
  };

  constructor(private dietLibraryApi: DietLibraryApiService) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadFoods();
  }

  loadCategories() {
    this.loadingCategories = true;

    this.dietLibraryApi.getCategories().subscribe({
      next: (res: string[]) => {
        const normalized = (res || [])
          .map((c) => this.normalizeCategory(c))
          .filter((c): c is string => !!c);

        const merged = Array.from(new Set([...this.canonicalCategories, ...normalized]));
        this.categories = merged;
        this.loadingCategories = false;
      },
      error: () => {
        this.categories = [...this.canonicalCategories];
        this.loadingCategories = false;
      }
    });
  }

  onCategoryFilterChange() {
    this.loadFoods(this.selectedCategory);
  }

  loadFoods(category?: string | null) {
    this.loadingFoods = true;
    this.error = null;

    this.dietLibraryApi.getFoods(category || null).subscribe({
      next: (res: any[]) => {
        this.foods = [...(res || [])].sort((a, b) =>
          String(a?.foodItem || '').localeCompare(String(b?.foodItem || ''))
        );
        this.loadingFoods = false;
      },
      error: () => {
        this.error = 'Failed to load diet library foods';
        this.loadingFoods = false;
      }
    });
  }

  submitFood() {
    this.formError = null;

    const normalizedCategory = this.normalizeCategory(this.form.category);

    if (
      !this.form.foodItem.trim() ||
      this.form.calories == null ||
      this.form.carbs == null ||
      this.form.protein == null ||
      this.form.fats == null ||
      !normalizedCategory
    ) {
      this.formError = 'Food Item, calories, carbs, protein, fats, and category are required.';
      return;
    }

    if (
      this.form.calories < 0 ||
      this.form.carbs < 0 ||
      this.form.protein < 0 ||
      this.form.fats < 0
    ) {
      this.formError = 'Calories and macros must be >= 0.';
      return;
    }

    const payload: DietLibraryFoodPayload = {
      foodItem: this.form.foodItem.trim(),
      calories: this.form.calories,
      carbs: this.form.carbs,
      protein: this.form.protein,
      fats: this.form.fats,
      category: normalizedCategory
    };

    const request$ = this.form.id
      ? this.dietLibraryApi.updateFood(this.form.id, payload)
      : this.dietLibraryApi.createFood(payload);

    this.savingFood = true;
    request$
      .pipe(finalize(() => (this.savingFood = false)))
      .subscribe({
        next: () => {
          this.resetForm();
          this.loadFoods(this.selectedCategory);
        },
        error: () => {
          this.formError = 'Failed to save food item.';
        }
      });
  }

  editFood(food: any) {
    this.formError = null;
    this.form = {
      id: food.id,
      foodItem: food.foodItem || '',
      calories: this.toNumberOrNull(food.calories),
      carbs: this.toNumberOrNull(food.carbs),
      protein: this.toNumberOrNull(food.protein),
      fats: this.toNumberOrNull(food.fats),
      category: this.normalizeCategory(food.category) || 'CARBOHYDRATES'
    };
  }

  deleteFood(foodId: string) {
    const confirmed = window.confirm('Delete this food item?');
    if (!confirmed) return;

    this.deletingFoodId = foodId;
    this.dietLibraryApi
      .deleteFood(foodId)
      .pipe(finalize(() => (this.deletingFoodId = null)))
      .subscribe({
        next: () => this.loadFoods(this.selectedCategory),
        error: () => {
          this.error = 'Failed to delete food item.';
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

        const parsedRows = this.parseFoodRows(matrix);
        if (!parsedRows.length) {
          this.error = 'No valid food rows found in the uploaded file.';
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
          const category = this.normalizeCategory(row.category);
          if (!category) {
            return of(null);
          }

          const payload: DietLibraryFoodPayload = {
            foodItem: row.foodItem,
            calories: row.calories,
            carbs: row.carbs,
            protein: row.protein,
            fats: row.fats,
            category
          };

          return this.dietLibraryApi.createFood(payload).pipe(catchError(() => of(null)));
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
        this.loadFoods(this.selectedCategory);
      });
  }

  private parseFoodRows(matrix: any[][]): ImportRow[] {
    if (!matrix.length) return [];

    const norm = (v: any) =>
      String(v || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

    const headerIndex = matrix.findIndex((row) => {
      const headers = (row || []).map(norm);
      return headers.some((h: string) => h.includes('food')) && headers.some((h: string) => h.includes('cal'));
    });

    if (headerIndex < 0) return [];

    const header = (matrix[headerIndex] || []).map(norm);

    const foodIdx = header.findIndex((h: string) => h.includes('fooditem') || h === 'food' || h.includes('foodname'));
    const caloriesIdx = header.findIndex((h: string) => h === 'calories' || h === 'kcal' || h.includes('energy'));
    const carbsIdx = header.findIndex((h: string) => h.includes('carb'));
    const proteinIdx = header.findIndex((h: string) => h.includes('protein'));
    const fatsIdx = header.findIndex((h: string) => h === 'fats' || h === 'fat' || h.includes('lipid'));
    const categoryIdx = header.findIndex((h: string) => h.includes('category') || h.includes('group'));

    if (foodIdx < 0 || caloriesIdx < 0 || carbsIdx < 0 || proteinIdx < 0 || fatsIdx < 0 || categoryIdx < 0) {
      return [];
    }

    const rows: ImportRow[] = [];

    for (let i = headerIndex + 1; i < matrix.length; i++) {
      const row = matrix[i] || [];
      const foodItem = String(row[foodIdx] ?? '').trim();
      const calories = Number(String(row[caloriesIdx] ?? '').trim());
      const carbs = Number(String(row[carbsIdx] ?? '').trim());
      const protein = Number(String(row[proteinIdx] ?? '').trim());
      const fats = Number(String(row[fatsIdx] ?? '').trim());
      const category = String(row[categoryIdx] ?? '').trim();

      if (!foodItem) continue;
      if (![calories, carbs, protein, fats].every((n) => Number.isFinite(n) && n >= 0)) continue;
      if (!this.normalizeCategory(category)) continue;

      rows.push({
        foodItem,
        calories,
        carbs,
        protein,
        fats,
        category
      });
    }

    return rows;
  }

  private normalizeCategory(value: string | null | undefined): string | null {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return null;

    const aliases: Record<string, string> = {
      CARBS: 'CARBOHYDRATES',
      CARBOHYDRATE: 'CARBOHYDRATES',
      CARBOHYDRATES: 'CARBOHYDRATES',
      PROTEIN: 'PROTEINS',
      PROTEINS: 'PROTEINS',
      FAT: 'FATS',
      FATS: 'FATS'
    };

    return aliases[raw] || null;
  }

  private toNumberOrNull(value: any): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  resetForm() {
    this.formError = null;
    this.form = {
      id: null,
      foodItem: '',
      calories: null,
      carbs: null,
      protein: null,
      fats: null,
      category: 'CARBOHYDRATES'
    };
  }
}
