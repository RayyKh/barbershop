import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService, Appointment, Barber } from '../../services/api.service';

@Component({
  selector: 'app-barber-history',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    MatTableModule,
    MatIconModule
  ],
  templateUrl: './barber-history.component.html',
  styleUrl: './barber-history.component.scss'
})
export class BarberHistoryComponent implements OnInit, OnDestroy {
  barbers: Barber[] = [];
  appointments: Appointment[] = [];
  filterForm: FormGroup;
  displayedColumns: string[] = ['date', 'time', 'client', 'service', 'price'];
  private appointmentsSub?: Subscription;

  constructor(private api: ApiService, private fb: FormBuilder) {
    this.filterForm = this.fb.group({
      barberId: [null],
      period: ['day'], // 'day', 'week', 'month'
      selectedDate: [new Date()]
    });
  }

  ngOnInit(): void {
    this.api.getBarbers().subscribe(b => {
      this.barbers = b;
      if (this.barbers.length > 0) {
        this.filterForm.patchValue({ barberId: this.barbers[0].id });
        this.loadHistory();
      }
    });

    this.filterForm.valueChanges.subscribe(() => {
      this.loadHistory();
    });

    // Écouter les mises à jour en temps réel via SSE
    this.appointmentsSub = this.api.appointmentsChanged$.subscribe(() => {
      console.log('Nouveau rendez-vous détecté, rafraîchissement de l\'historique...');
      this.loadHistory();
    });
  }

  ngOnDestroy(): void {
    if (this.appointmentsSub) {
      this.appointmentsSub.unsubscribe();
    }
  }

  loadHistory(): void {
    const { barberId, period, selectedDate } = this.filterForm.value;
    if (!barberId) return;

    // On utilise l'API de filtrage existante. 
    // Pour simplifier, on récupère tout et on filtre côté client pour la période complexe
    // (ou on pourrait étendre le backend si nécessaire).
    this.api.filterAppointments({ barberId }).subscribe(data => {
      const date = new Date(selectedDate);
      
      this.appointments = data.filter(app => {
        // Exclure les simples blocages (BLOCKED) sans client de l'historique financier
        if (app.status === 'BLOCKED' && !app.user) {
          return false;
        }

        const appDate = new Date(app.date);
        
        if (period === 'day') {
          return appDate.toDateString() === date.toDateString();
        } else if (period === 'week') {
          const tempDate = new Date(date);
          const firstDay = new Date(tempDate.setDate(tempDate.getDate() - tempDate.getDay()));
          const lastDay = new Date(tempDate.setDate(tempDate.getDate() - tempDate.getDay() + 6));
          // Reset hours for comparison
          firstDay.setHours(0, 0, 0, 0);
          lastDay.setHours(23, 59, 59, 999);
          return appDate >= firstDay && appDate <= lastDay;
        } else if (period === 'month') {
          return appDate.getMonth() === date.getMonth() && appDate.getFullYear() === date.getFullYear();
        }
        return true;
      });

      // Tri par date décroissante
      this.appointments.sort((a, b) => {
        const dA = new Date(a.date + 'T' + a.startTime);
        const dB = new Date(b.date + 'T' + b.startTime);
        return dB.getTime() - dA.getTime();
      });
    });
  }

  getTotalRevenue(): number {
    return this.appointments.reduce((sum, app) => sum + (app.totalPrice || 0), 0);
  }
}
