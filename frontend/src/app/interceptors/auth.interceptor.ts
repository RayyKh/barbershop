import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = sessionStorage.getItem('token');

  let authReq = req;
  if (token) {
    authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 || error.status === 403) {
        // If we get a 401/403, the token is likely invalid or expired
        // Only redirect if we are trying to access an admin route
        if (router.url.startsWith('/admin')) {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
          router.navigate(['/login']);
        }
      }
      return throwError(() => error);
    })
  );
};
