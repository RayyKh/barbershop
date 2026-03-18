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
  filteredAppointments: Appointment[] = [];
  filterForm: FormGroup;
  displayedColumns: string[] = ['date', 'time', 'client', 'service', 'price'];
  private appointmentsSub?: Subscription;

  constructor(private api: ApiService, private fb: FormBuilder) {
    this.filterForm = this.fb.group({
      barberId: [null],
      period: ['day'], // 'day', 'week', 'month'
      selectedDate: [new Date()],
      searchTerm: ['']
    });
  }

  ngOnInit(): void {
    this.api.getBarbers(true).subscribe(b => {
      this.barbers = b;
      if (this.barbers.length > 0) {
        this.filterForm.patchValue({ barberId: this.barbers[0].id });
        this.loadHistory();
      }
    });

    this.filterForm.valueChanges.subscribe((vals) => {
      // Si seul searchTerm a changé, on filtre localement
      // Sinon on recharge tout
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

  formatDisplayDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    // Utiliser des slashes et forcer l'heure à midi pour éviter tout décalage de fuseau horaire
    return new Date(dateStr.replace(/-/g, '/') + ' 12:00:00');
  }

  formatDateLocal(d: any): string {
    if (!d) return '';
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const date = (d instanceof Date) ? d : new Date(d);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  loadHistory(): void {
    const { barberId, period, selectedDate, searchTerm } = this.filterForm.value;
    if (!barberId) return;

    const selectedDateStr = this.formatDateLocal(selectedDate);

    // On utilise l'API de filtrage existante. 
    this.api.filterAppointments({ barberId }).subscribe(data => {
      // Utiliser formatDisplayDate pour éviter le décalage de timezone
      const selectedDateObj = this.formatDisplayDate(selectedDateStr);
      
      this.appointments = data.filter(app => {
        // Exclure les simples blocages (BLOCKED) sans client de l'historique financier
        if (app.status === 'BLOCKED' && !app.user) {
          return false;
        }

        const appDate = this.formatDisplayDate(app.date);
        
        if (period === 'day') {
          return appDate.getFullYear() === selectedDateObj.getFullYear() &&
                 appDate.getMonth() === selectedDateObj.getMonth() &&
                 appDate.getDate() === selectedDateObj.getDate();
        } else if (period === 'week') {
          const tempDate = new Date(selectedDateObj);
          const day = tempDate.getDay();
          const diff = tempDate.getDate() - day + (day === 0 ? -6 : 1); // Lundi
          const firstDay = new Date(tempDate.setDate(diff));
          firstDay.setHours(0, 0, 0, 0);
          
          const lastDay = new Date(firstDay);
          lastDay.setDate(firstDay.getDate() + 6);
          lastDay.setHours(23, 59, 59, 999);
          
          return appDate >= firstDay && appDate <= lastDay;
        } else if (period === 'month') {
          return appDate.getMonth() === selectedDateObj.getMonth() && 
                 appDate.getFullYear() === selectedDateObj.getFullYear();
        }
        return true;
      });

      // Tri par date décroissante
      this.appointments.sort((a, b) => {
        const dA = new Date(a.date.replace(/-/g, '/') + ' ' + a.startTime);
        const dB = new Date(b.date.replace(/-/g, '/') + ' ' + b.startTime);
        return dB.getTime() - dA.getTime();
      });

      this.applySearch();
    });
  }

  applySearch(): void {
    const term = this.filterForm.value.searchTerm?.toLowerCase().trim();
    if (!term) {
      this.filteredAppointments = [...this.appointments];
      return;
    }

    this.filteredAppointments = this.appointments.filter(app => {
      const user = app.user;
      if (!user) return false;
      
      const firstName = (user.firstName || '').toLowerCase();
      const name = (user.name || '').toLowerCase();
      const phone = (user.phone || '').toLowerCase();
      
      return firstName.includes(term) || 
             name.includes(term) || 
             phone.includes(term);
    });
  }

  getTotalRevenue(): number {
    return this.filteredAppointments.reduce((sum, app) => sum + (app.totalPrice || 0), 0);
  }
}
