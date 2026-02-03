import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { ApiService, Appointment } from '../../services/api.service';

@Component({
  selector: 'app-my-appointments',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatDatepickerModule, MatNativeDateModule, MatChipsModule, MatCardModule, MatSnackBarModule],
  template: `
    <div class="container">
      <mat-card class="client-card">
        <mat-card-header>
          <mat-card-title>Mes Rendez-vous</mat-card-title>
          <mat-card-subtitle>Consultez, annulez ou modifiez vos réservations</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
      
      
      <table mat-table [dataSource]="appointments" class="mat-elevation-z8">
        
        <ng-container matColumnDef="date">
          <th mat-header-cell *matHeaderCellDef> Date </th>
          <td mat-cell *matCellDef="let element"> {{element.date | date}} </td>
        </ng-container>

        <ng-container matColumnDef="time">
          <th mat-header-cell *matHeaderCellDef> Heure </th>
          <td mat-cell *matCellDef="let element"> {{element.startTime}} </td>
        </ng-container>

        <ng-container matColumnDef="service">
          <th mat-header-cell *matHeaderCellDef> Service </th>
          <td mat-cell *matCellDef="let element"> {{element.service.name}} </td>
        </ng-container>

        <ng-container matColumnDef="barber">
          <th mat-header-cell *matHeaderCellDef> Barbier </th>
          <td mat-cell *matCellDef="let element"> {{element.barber.name}} </td>
        </ng-container>

        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef> Statut </th>
          <td mat-cell *matCellDef="let element"> {{element.status}} </td>
        </ng-container>

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef> Actions </th>
          <td mat-cell *matCellDef="let element">
            <button mat-button color="warn" 
                    *ngIf="element.status === 'BOOKED'"
                    (click)="cancel(element.id)">
              Annuler
            </button>
            <button mat-button color="primary"
                    *ngIf="element.status === 'BOOKED'"
                    (click)="toggleModify(element.id)">
              Modifier
            </button>

            <div class="modify-panel" *ngIf="isModifying(element.id)">
              <mat-form-field appearance="outline">
                <mat-label>Nouvelle date</mat-label>
                <input matInput [matDatepicker]="picker" (dateChange)="onModifyDateChange(element)" [value]="getModifyDate(element.id)">
                <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
                <mat-datepicker #picker></mat-datepicker>
              </mat-form-field>

              <div class="hours">
                <mat-chip-listbox>
                  <mat-chip-option *ngFor="let h of getModifySlots(element.id)" [selected]="getModifyTime(element.id)===h" (click)="selectModifyTime(element.id, h)">
                    {{ h }}
                  </mat-chip-option>
                </mat-chip-listbox>
              </div>

              <button mat-raised-button color="primary" [disabled]="!getModifyTime(element.id)" (click)="applyModify(element)">Confirmer</button>
            </div>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      </table>
      
      <div *ngIf="appointments.length === 0">
          <p>Vous n'avez aucun rendez-vous (ou vous n'êtes pas connecté).</p>
      </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    :host { display: block; background: #000; min-height: 100vh; width: 100%; }
    .container { max-width: 1200px; margin: 0 auto; padding: 120px 20px 40px; }
    .client-card { color: #fff; background: #000 !important; border: 1px solid #d4af37 !important; }
    .client-card mat-card-header mat-card-title { color: #d4af37; font-size: 1.6rem; }
    .client-card mat-card-header mat-card-subtitle { color: #aaaaaa; }
    ::ng-deep .mat-mdc-table { background: #121212 !important; color: #fff !important; }
    ::ng-deep .mat-mdc-header-cell { color: #d4af37 !important; font-weight: bold; }
    ::ng-deep .mat-mdc-cell { color: #fff !important; }
    ::ng-deep .mat-mdc-form-field-flex { background-color: #121212 !important; }
    
    table { width: 100%; }
    .modify-panel { display: grid; grid-template-columns: 1fr; gap: 8px; margin-top: 8px; }
    .hours { margin: 4px 0 8px; }
    :host ::ng-deep .mat-mdc-table { background: #121212; }
  :host ::ng-deep .mat-mdc-header-cell { color: #d4af37; border-bottom: 1px solid #d4af37; }
  :host ::ng-deep .mat-mdc-cell { color: #ffffff; border-bottom: 1px solid rgba(255,255,255,0.1); }
  `]
})
export class MyAppointmentsComponent implements OnInit {
  appointments: Appointment[] = [];
  displayedColumns: string[] = ['date', 'time', 'service', 'barber', 'status', 'actions'];
  modifying: Record<number, { date: Date; slots: string[]; time?: string }> = {};
  contactEmail: string = '';
  contactPhone: string = '';

  constructor(private apiService: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit() {
    this.apiService.appointmentBooked$.subscribe(() => {
      this.snackBar.open('Nouveau rendez-vous ajouté', 'OK', { duration: 3000 });
      this.reloadAppointments();
    });
    this.reloadAppointments();
  }

  reloadAppointments() {
    const token = sessionStorage.getItem('token');
    const savedEmail = localStorage.getItem('lastUserEmail');
    const savedPhone = localStorage.getItem('lastUserPhone');
    
    this.contactEmail = savedEmail || '';
    this.contactPhone = savedPhone || '';

    if (token) {
      this.apiService.getMyAppointments().subscribe({
        next: (data) => {
          this.appointments = data;
          // Also fetch by contact to merge guest bookings if they exist
          if (savedEmail || savedPhone) {
            this.fetchByContact(savedEmail || undefined, savedPhone || undefined);
          }
        },
        error: () => {
          if (savedEmail || savedPhone) {
            this.fetchByContact(savedEmail || undefined, savedPhone || undefined);
          }
        }
      });
    } else if (savedEmail || savedPhone) {
      this.fetchByContact(savedEmail || undefined, savedPhone || undefined);
    }
  }

  private fetchByContact(email?: string, phone?: string) {
    this.apiService.getAppointmentsByContact(email, phone).subscribe({
      next: (list) => {
        // Merge results and avoid duplicates
        const currentIds = new Set(this.appointments.map(a => a.id));
        const newItems = list.filter(a => !currentIds.has(a.id));
        this.appointments = [...this.appointments, ...newItems];
        // Sort by date and time
        this.appointments.sort((a, b) => {
          const dateA = new Date(a.date + 'T' + a.startTime);
          const dateB = new Date(b.date + 'T' + b.startTime);
          return dateB.getTime() - dateA.getTime(); // Newest first
        });
      },
      error: (err) => {
        console.error('Error fetching appointments by contact', err);
      }
    });
  }

  

  cancel(id: number) {
    if (confirm('Voulez-vous vraiment annuler ce rendez-vous ?')) {
      this.apiService.cancelAppointment(id).subscribe(() => {
        this.snackBar.open('Rendez-vous annulé', 'OK', { duration: 3000 });
        this.reloadAppointments();
      });
    }
  }

  toggleModify(id: number) {
    if (this.modifying[id]) {
      delete this.modifying[id];
      return;
    }
    this.modifying[id] = { date: new Date(), slots: [] };
  }

  isModifying(id: number): boolean {
    return !!this.modifying[id];
  }

  getModifyDate(id: number): Date | null {
    return this.modifying[id]?.date || null;
  }

  onModifyDateChange(a: Appointment) {
    const state = this.modifying[a.id];
    if (!state) return;
    const d = state.date;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    this.apiService.getAvailableSlots(a.barber.id, dateStr).subscribe(slots => {
      state.slots = slots;
    });
  }

  getModifySlots(id: number): string[] {
    return this.modifying[id]?.slots || [];
  }

  getModifyTime(id: number): string | undefined {
    return this.modifying[id]?.time;
  }

  selectModifyTime(id: number, h: string) {
    if (this.modifying[id]) {
      this.modifying[id].time = h;
    }
  }

  applyModify(a: Appointment) {
    const state = this.modifying[a.id];
    if (!state || !state.time) return;
    const yyyy = state.date.getFullYear();
    const mm = String(state.date.getMonth() + 1).padStart(2, '0');
    const dd = String(state.date.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const request = {
      serviceId: a.service.id,
      barberId: a.barber.id,
      date: dateStr,
      startTime: state.time
    };
      this.apiService.bookAppointment(request as any).subscribe({
        next: () => {
          this.apiService.cancelAppointment(a.id).subscribe(() => {
          delete this.modifying[a.id];
          this.snackBar.open('Rendez-vous modifié', 'OK', { duration: 3000 });
          this.reloadAppointments();
        });
      },
      error: (err) => {
        this.snackBar.open('Erreur modification: ' + err.message, 'OK', { duration: 3500 });
      }
    });
  }
}
