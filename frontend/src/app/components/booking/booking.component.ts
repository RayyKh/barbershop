import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { Router } from '@angular/router';
import { ApiService, AppointmentRequest, Barber, Service } from '../../services/api.service';

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
    MatSnackBarModule
  ],
  templateUrl: './booking.component.html',
  styleUrls: ['./booking.component.scss']
})
export class BookingComponent implements OnInit {
  services: Service[] = [];
  barbers: Barber[] = [];
  availableSlots: string[] = [];

  bookingFormGroup: FormGroup;

  constructor(
    private _formBuilder: FormBuilder,
    private apiService: ApiService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.bookingFormGroup = this._formBuilder.group({
      serviceCtrl: ['', Validators.required],
      barberCtrl: ['', Validators.required],
      dateCtrl: [new Date(), Validators.required],
      timeCtrl: ['', Validators.required],
      userCtrl: this._formBuilder.group({
        name: ['', Validators.required],
        phone: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]]
      })
    });
  }

  ngOnInit() {
    this.apiService.getServices().subscribe(data => {
      this.services = data;
      // Auto-select the first service or a default one since the step is removed
      if (this.services.length > 0) {
        this.bookingFormGroup.patchValue({ serviceCtrl: this.services[0] });
      }
    });
    this.apiService.getBarbers().subscribe(data => this.barbers = data);
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
        this.availableSlots = slots;
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
        serviceId: formValue.serviceCtrl.id,
        barberId: formValue.barberCtrl.id,
        date: this.formatDateLocal(formValue.dateCtrl),
        startTime: formValue.timeCtrl,
        userName: formValue.userCtrl.name,
        userPhone: formValue.userCtrl.phone,
        userEmail: formValue.userCtrl.email
      };

      this.apiService.bookAppointment(request).subscribe({
        next: (res) => {
          this.apiService.notifyAppointmentBooked(res);
          try {
            localStorage.setItem('lastUserEmail', request.userEmail || '');
            localStorage.setItem('lastUserPhone', request.userPhone || '');
          } catch {}
          this.snackBar.open('Rendez-vous confirmé !', 'OK', { duration: 3000 });
          this.router.navigate(['/']);
        },
        error: (err) => {
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
