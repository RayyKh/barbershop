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
      console.error(`HTTP Error ${error.status} on ${req.url}:`, error);
      
      if (error.status === 401 || error.status === 403) {
        // If we get a 401/403, the token is likely invalid or expired
        // Only redirect if we are trying to access an admin route
        // and NOT if it's a background push subscription request that might fail for other reasons
        if (router.url.startsWith('/admin') && !req.url.includes('/notifications/subscribe')) {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
          router.navigate(['/login']);
        }
      }
      return throwError(() => error);
    })
  );
};
