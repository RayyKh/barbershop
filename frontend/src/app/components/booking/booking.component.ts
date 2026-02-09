import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { Router } from '@angular/router';
import { AnimationOptions, LottieComponent } from 'ngx-lottie';
import { ApiService, AppointmentRequest, Barber, Service, User } from '../../services/api.service';
import { LoaderComponent } from '../loader/loader.component';

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatStepperModule,
    MatButtonModule,
    MatListModule,
    MatCardModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatSnackBarModule,
    MatIconModule,
    MatCheckboxModule,
    LottieComponent,
    LoaderComponent
  ],
  templateUrl: './booking.component.html',
  styleUrls: ['./booking.component.scss']
})
export class BookingComponent implements OnInit {
  services: Service[] = [];
  barbers: Barber[] = [];
  availableSlots: string[] = [];
  isBookingSuccess = false;
  isLoading = false;
  errorMessage = '';
  minDate = new Date();
  user: User | null = null;

  bookingFormGroup: FormGroup;

  options: AnimationOptions = {
    path: 'assets/lottie/success.json',
  };

  constructor(
    private _formBuilder: FormBuilder,
    private apiService: ApiService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.bookingFormGroup = this._formBuilder.group({
      servicesCtrl: [[], Validators.required],
      barberCtrl: ['', Validators.required],
      dateCtrl: [new Date(), Validators.required],
      timeCtrl: ['', Validators.required],
      useRewardCtrl: [false],
      userCtrl: this._formBuilder.group({
        name: ['', Validators.required],
        phone: ['', Validators.required]
      })
    });
  }

  ngOnInit() {
    this.apiService.getServices().subscribe(data => {
      this.services = data;
    });
    this.apiService.getBarbers().subscribe(data => this.barbers = data);

    // Load user from session storage
    const userJson = sessionStorage.getItem('user');
    if (userJson) {
      this.user = JSON.parse(userJson);
      if (this.user) {
        this.bookingFormGroup.get('userCtrl')?.patchValue({
          name: this.user.name,
          phone: this.user.phone
        });
      }
    }
  }

  get canApplyReward(): boolean {
    if (!this.user || (this.user.availableRewards || 0) <= 0) return false;
    
    const selected = this.bookingFormGroup.get('servicesCtrl')?.value as Service[];
    if (!selected || !selected.length) return false;
    
    return selected.some(s => s.name.toLowerCase().includes('coupe') && s.name.toLowerCase().includes('barbe'));
  }

  get totalSelectedPrice(): number {
    const selected = this.bookingFormGroup.get('servicesCtrl')?.value as Service[];
    if (!selected || !selected.length) return 0;
    
    let total = selected.reduce((acc, s) => acc + s.price, 0);
    
    if (this.bookingFormGroup.get('useRewardCtrl')?.value && this.canApplyReward) {
      // Find the "Coupe + Barbe" service and subtract its price
      const coupeBarbe = selected.find(s => s.name.toLowerCase().includes('coupe') && s.name.toLowerCase().includes('barbe'));
      if (coupeBarbe) {
        total -= coupeBarbe.price;
      }
    }
    
    return total;
  }

  onDateChange() {
    this.fetchSlots();
  }
  
  onBarberChange() {
      this.fetchSlots();
  }

  fetchSlots() {
    const barber = this.bookingFormGroup.get('barberCtrl')?.value;
    const date = this.bookingFormGroup.get('dateCtrl')?.value;

    if (barber && date) {
      const dateStr = this.formatDateLocal(date);
      this.apiService.getAvailableSlots(barber.id, dateStr).subscribe(slots => {
        const now = new Date();
        const todayStr = this.formatDateLocal(now);

        // 1. Filtrer les heures passées si c'est aujourd'hui
        let filteredSlots = slots;
        if (dateStr === todayStr) {
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();

          filteredSlots = slots.filter(slot => {
            const [hour, minute] = slot.split(':').map(Number);
            if (hour > currentHour) return true;
            if (hour === currentHour && minute > currentMinute) return true;
            return false;
          });
        }

        // 2. Les blocages admin sont déjà filtrés par le backend dans apiService.getAvailableSlots
        this.availableSlots = filteredSlots;
      });
    }
  }

  selectSlot(slot: string) {
      this.bookingFormGroup.patchValue({ timeCtrl: slot });
  }

  book() {
    if (this.bookingFormGroup.valid) {
      const formValue = this.bookingFormGroup.value;
      const request: AppointmentRequest = {
        serviceIds: formValue.servicesCtrl.map((s: Service) => s.id),
        barberId: formValue.barberCtrl.id,
        date: this.formatDateLocal(formValue.dateCtrl),
        startTime: formValue.timeCtrl,
        userName: formValue.userCtrl.name,
        userPhone: formValue.userCtrl.phone,
        useReward: formValue.useRewardCtrl
      };

      this.isLoading = true;
      this.apiService.bookAppointment(request).subscribe({
        next: (res) => {
          this.isLoading = false;
          this.apiService.notifyAppointmentBooked(res);
          try {
            localStorage.setItem('lastUserPhone', request.userPhone || '');
          } catch {}
          this.snackBar.open('Rendez-vous confirmé !', 'OK', { duration: 3000 });
          
          // Update user rewards in session storage if used
          if (request.useReward && this.user) {
            this.user.availableRewards = (this.user.availableRewards || 0) - 1;
            this.user.usedRewards = (this.user.usedRewards || 0) + 1;
            sessionStorage.setItem('user', JSON.stringify(this.user));
          }

          this.isBookingSuccess = true;
          setTimeout(() => {
            this.router.navigate(['/'], { fragment: 'top' }).then(() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            });
          }, 3000);
        },
        error: (err) => {
          this.isLoading = false;
          this.snackBar.open('Erreur lors de la réservation: ' + err.message, 'OK', { duration: 3500 });
        }
      });
    }
  }

  private formatDateLocal(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
