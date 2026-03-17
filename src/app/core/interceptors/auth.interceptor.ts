import { HttpBackend, HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenService } from '../services/token.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);
  const router = inject(Router);
  const backend = inject(HttpBackend);
  const http = new HttpClient(backend);
  const token = tokenService.getAccessToken();
  const refreshToken = tokenService.getRefreshToken();
  const isAuthRequest =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/refresh');

  const authorizedRequest = token && !isAuthRequest
    ? req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    })
    : req;

  return next(authorizedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (
        error.status !== 401 ||
        isAuthRequest ||
        !refreshToken
      ) {
        return throwError(() => error);
      }

      return http.post<any>(
        `${environment.authApi}/auth/refresh`,
        refreshToken,
        {
          headers: {
            'Content-Type': 'text/plain'
          }
        }
      ).pipe(
        switchMap((res: any) => {
          tokenService.setTokens(res.accessToken, res.refreshToken);

          const retryRequest = req.clone({
            setHeaders: {
              Authorization: `Bearer ${res.accessToken}`
            }
          });

          return next(retryRequest);
        }),
        catchError((refreshError: HttpErrorResponse) => {
          tokenService.clear();
          router.navigate(['/login']);
          return throwError(() => refreshError);
        })
      );
    })
  );
};
