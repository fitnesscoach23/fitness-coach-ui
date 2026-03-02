import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthApiService } from '../../../../core/api/auth-api.service';
import { TokenService } from '../../../../core/services/token.service';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  loading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authApi: AuthApiService,
    private tokenService: TokenService,
    private router: Router
  ) {}

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = null;

    this.authApi.login(this.form.value as any)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (res: any) => {
          this.tokenService.setTokens(
            res.accessToken,
            res.refreshToken
          );
          this.router.navigate(['/dashboard']);
        },
        error: () => {
          this.error = 'Invalid credentials. Please try again.';
        }
      });
  }

}
