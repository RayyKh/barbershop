import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withInMemoryScrolling, withRouterConfig } from '@angular/router';

import { provideServiceWorker } from '@angular/service-worker';
import player from 'lottie-web';
import { provideLottieOptions } from 'ngx-lottie';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withInMemoryScrolling({
        anchorScrolling: 'disabled', // Disable native to use our manual logic in app.component.ts
        scrollPositionRestoration: 'enabled'
    }), withRouterConfig({
        onSameUrlNavigation: 'reload'
    })),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideAnimations(),
    provideLottieOptions({
        player: () => player,
    }),
    provideServiceWorker('ngsw-worker.js', {
        enabled: true, // Force enabled for local Push testing
        registrationStrategy: 'registerImmediately'
    })
]
};
