import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withInMemoryScrolling, withRouterConfig } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, 
      withInMemoryScrolling({ 
        anchorScrolling: 'disabled', // Disable native to use our manual logic in app.component.ts
        scrollPositionRestoration: 'enabled'
      }),
      withRouterConfig({
        onSameUrlNavigation: 'reload'
      })
    ),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor])
    ),
    provideAnimations()
  ]
};
