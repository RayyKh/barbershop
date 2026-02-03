import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AdminDashboardComponent } from './components/admin-dashboard/admin-dashboard.component';
import { BarberListComponent } from './components/barber-list/barber-list.component';
import { BookingComponent } from './components/booking/booking.component';
import { HomeComponent } from './components/home/home.component';
import { LoginComponent } from './components/login/login.component';
import { MyAppointmentsComponent } from './components/my-appointments/my-appointments.component';
import { ServiceListComponent } from './components/service-list/service-list.component';

export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = sessionStorage.getItem('token');
  
  // If token is missing or is the old hardcoded one, redirect to login
  if (!token || token === 'ADMIN_SUPER') {
    sessionStorage.removeItem('token');
    return router.parseUrl('/login');
  }
  
  return true;
};

export const routes: Routes = [
    { path: '', component: HomeComponent },
    { path: 'services', component: ServiceListComponent },
    { path: 'barbers', component: BarberListComponent },
    { path: 'booking', component: BookingComponent },
    { path: 'my-appointments', component: MyAppointmentsComponent },
    { path: 'login', component: LoginComponent },
    { path: 'admin', component: AdminDashboardComponent, canActivate: [adminGuard] },
    { path: '**', redirectTo: '' }
];
