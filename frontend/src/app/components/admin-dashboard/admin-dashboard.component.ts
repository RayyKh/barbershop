import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService, Appointment, Barber } from '../../services/api.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatChipsModule
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  appointments: Appointment[] = [];
  barbers: Barber[] = [];
  lockForm: FormGroup;
  filterForm: FormGroup;
  availableHours: string[] = [
    '09:00:00','10:00:00','11:00:00','12:00:00','13:00:00','14:00:00','15:00:00','16:00:00','17:00:00','18:00:00','19:00:00','20:00:00'
  ];
  hasNew = false;
  private sub?: Subscription;

  constructor(private api: ApiService, private fb: FormBuilder, private router: Router) {
    this.lockForm = this.fb.group({
      barber: [null, Validators.required],
      date: [new Date(), Validators.required],
      time: [null, Validators.required]
    });
    this.filterForm = this.fb.group({
      barberId: [null],
      date: [null],
      status: [null],
      q: [''],
      sort: ['date,startTime']
    });
  }

  ngOnInit(): void {
    this.api.getBarbers().subscribe(b => { this.barbers = b; });
    this.loadAppointments();
    
    // Listen to changes from central ApiService (SSE or local)
    this.sub = this.api.appointmentsChanged$.subscribe(() => {
      this.loadAppointments();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  loadAppointments() {
    this.api.getAllAppointments().subscribe(list => {
      // sort by date then time ascending
      list.sort((a,b) => {
        if (a.date === b.date) {
          return a.startTime.localeCompare(b.startTime);
        }
        return a.date.localeCompare(b.date);
      });
      // align barber names with our displayed barbers
      const byId = new Map<number, Barber>(this.barbers.map(b => [b.id, b] as [number, Barber]));
      list.forEach(a => {
        if (a.barber && byId.has(a.barber.id)) {
          a.barber.name = byId.get(a.barber.id)!.name;
        }
      });
      this.appointments = list;
      this.hasNew = list.some(a => a.status === 'BOOKED' && !a.adminViewed);
    });
  }

  lockSlot() {
    if (this.lockForm.valid) {
      const barberId = this.lockForm.value.barber.id;
      const dateStr = this.formatDateLocal(this.lockForm.value.date as Date);
      const timeStr = this.lockForm.value.time;
      this.api.lockSlot(barberId, dateStr, timeStr).subscribe({
        next: () => {
          this.loadAppointments();
          alert('Créneau verrouillé');
        },
        error: (err) => alert('Erreur lors du verrouillage: ' + err.message)
      });
    }
  }

  unlock(a: Appointment) {
    const barberId = a.barber?.id as number;
    const dateStr = a.date;
    const timeStr = a.startTime;
    this.api.unlockSlot(barberId, dateStr, timeStr).subscribe({
      next: () => {
        this.loadAppointments();
        alert('Créneau déverrouillé');
      },
      error: (err) => alert('Erreur lors du déverrouillage: ' + err.message)
    });
  }

  private formatDateLocal(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  filterByBarber(barberId: number): Appointment[] {
    return this.appointments.filter(a => a.barber?.id === barberId);
  }

  markViewed(a: Appointment) {
    if (!a.adminViewed) {
      this.api.markAdminViewed(a.id).subscribe({
        next: (updated) => {
          a.adminViewed = true;
          this.hasNew = this.appointments.some(x => x.status === 'BOOKED' && !x.adminViewed);
        }
      });
    }
  }

  logout() {
    try {
      this.api.stopSseListener();
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
    } catch {}
    this.router.navigate(['/']);
  }

  applyFilters() {
    const val = this.filterForm.value;
    const dateStr = val.date ? this.formatDateLocal(val.date as Date) : undefined;
    this.api.filterAppointments({
      barberId: val.barberId ? (val.barberId.id ?? val.barberId) : undefined,
      date: dateStr,
      status: val.status ?? undefined,
      q: val.q ?? undefined,
      sort: val.sort ?? undefined
    }).subscribe(list => {
      // align barber names for display
      const byId = new Map<number, Barber>(this.barbers.map(b => [b.id, b] as [number, Barber]));
      list.forEach(a => {
        if (a.barber && byId.has(a.barber.id)) {
          a.barber.name = byId.get(a.barber.id)!.name;
        }
      });
      this.appointments = list;
      this.hasNew = list.some(a => a.status === 'BOOKED' && !a.adminViewed);
    });
  }

  clearFilters() {
    this.filterForm.reset({ barberId: null, date: null, status: null, q: '', sort: 'date,startTime' });
    this.loadAppointments();
  }
}
