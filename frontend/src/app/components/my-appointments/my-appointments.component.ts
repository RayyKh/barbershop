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
      
      <!-- Affichage Tableau pour Desktop -->
      <div class="desktop-only">
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
              <div class="action-buttons">
                <button mat-button color="warn" 
                        *ngIf="element.status === 'BOOKED' || element.status === 'MODIFIED'"
                        (click)="cancel(element.id)">
                  Annuler
                </button>
                <button mat-button color="primary"
                        *ngIf="element.status === 'BOOKED' || element.status === 'MODIFIED'"
                        (click)="toggleModify(element.id)">
                  Modifier
                </button>
              </div>

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
      </div>

      <!-- Affichage Cartes pour Mobile -->
      <div class="mobile-only">
        <div class="appointment-cards">
          <mat-card class="mobile-appointment-card" *ngFor="let element of appointments">
            <mat-card-content>
              <div class="card-row">
                <span class="label">Date:</span>
                <span class="value">{{element.date | date}}</span>
              </div>
              <div class="card-row">
                <span class="label">Heure:</span>
                <span class="value">{{element.startTime}}</span>
              </div>
              <div class="card-row">
                <span class="label">Service:</span>
                <span class="value">{{element.service.name}}</span>
              </div>
              <div class="card-row">
                <span class="label">Barbier:</span>
                <span class="value">{{element.barber.name}}</span>
              </div>
              <div class="card-row">
                <span class="label">Statut:</span>
                <span class="value status-badge" [ngClass]="element.status.toLowerCase()">{{element.status}}</span>
              </div>
              
              <div class="card-actions" *ngIf="element.status === 'BOOKED' || element.status === 'MODIFIED'">
                <button mat-raised-button color="warn" (click)="cancel(element.id)">Annuler</button>
                <button mat-raised-button color="primary" (click)="toggleModify(element.id)">Modifier</button>
              </div>

              <div class="modify-panel mobile" *ngIf="isModifying(element.id)">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Nouvelle date</mat-label>
                  <input matInput [matDatepicker]="mobilePicker" (dateChange)="onModifyDateChange(element)" [value]="getModifyDate(element.id)">
                  <mat-datepicker-toggle matIconSuffix [for]="mobilePicker"></mat-datepicker-toggle>
                  <mat-datepicker #mobilePicker></mat-datepicker>
                </mat-form-field>

                <div class="hours">
                  <mat-chip-listbox class="mobile-chips">
                    <mat-chip-option *ngFor="let h of getModifySlots(element.id)" [selected]="getModifyTime(element.id)===h" (click)="selectModifyTime(element.id, h)">
                      {{ h }}
                    </mat-chip-option>
                  </mat-chip-listbox>
                </div>

                <button mat-raised-button color="primary" class="full-width" [disabled]="!getModifyTime(element.id)" (click)="applyModify(element)">Confirmer</button>
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      </div>
      
      <div *ngIf="appointments.length === 0" class="empty-state">
          <p>Vous n'avez aucun rendez-vous (ou vous n'êtes pas connecté).</p>
      </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    :host { display: block; background: #000; min-height: 100vh; width: 100%; }
    .container { max-width: 1200px; margin: 0 auto; padding: 120px 20px 40px; }
    .client-card { color: #fff; background: #000 !important; border: 1px solid #d4af37 !important; border-radius: 12px; }
    .client-card mat-card-header { margin-bottom: 20px; }
    .client-card mat-card-header mat-card-title { color: #d4af37; font-size: 1.8rem; font-family: 'Playfair Display', serif; }
    .client-card mat-card-header mat-card-subtitle { color: #aaaaaa; }
    
    .desktop-only { display: block; }
    .mobile-only { display: none; }

    ::ng-deep .mat-mdc-table { background: #121212 !important; color: #fff !important; }
    ::ng-deep .mat-mdc-header-cell { color: #d4af37 !important; font-weight: bold; border-bottom: 1px solid #d4af37 !important; }
    ::ng-deep .mat-mdc-cell { color: #fff !important; border-bottom: 1px solid rgba(255,255,255,0.1) !important; padding: 12px 8px !important; }
    
    .action-buttons { display: flex; gap: 8px; }
    .modify-panel { display: grid; grid-template-columns: 1fr; gap: 8px; margin-top: 12px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; }
    .hours { margin: 8px 0; }
    .full-width { width: 100%; }
    .empty-state { text-align: center; padding: 40px; color: #aaa; }

    /* Mobile Styles */
    @media (max-width: 768px) {
      .desktop-only { display: none; }
      .mobile-only { display: block; }
      .container { padding: 100px 10px 20px; }
      .client-card mat-card-header mat-card-title { font-size: 1.4rem; }
    }

    .appointment-cards { display: flex; flex-direction: column; gap: 16px; }
    .mobile-appointment-card { background: #121212 !important; border: 1px solid rgba(212, 175, 55, 0.3) !important; color: #fff; }
    .card-row { display: flex; justify-content: space-between; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .card-row:last-of-type { border-bottom: none; }
    .label { color: #d4af37; font-weight: 600; font-size: 0.9rem; }
    .value { color: #fff; font-size: 0.95rem; }
    .card-actions { display: flex; gap: 12px; margin-top: 16px; }
    .card-actions button { flex: 1; }
    
    .status-badge { padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; }
    .status-badge.booked { background: rgba(0, 123, 255, 0.2); color: #007bff; border: 1px solid #007bff; }
    .status-badge.modified { background: rgba(212, 175, 55, 0.2); color: #d4af37; border: 1px solid #d4af37; }
    .status-badge.cancelled { background: rgba(220, 53, 69, 0.2); color: #dc3545; border: 1px solid #dc3545; }

    .modify-panel.mobile { background: rgba(0,0,0,0.3); padding: 12px; border: 1px solid rgba(212, 175, 55, 0.2); margin-top: 16px; }
    .mobile-chips { display: flex; flex-wrap: wrap; gap: 4px; }

    ::ng-deep .mat-mdc-form-field-flex { background-color: #1a1a1a !important; }
    ::ng-deep .mat-mdc-form-field-label { color: #aaa !important; }
    ::ng-deep .mat-mdc-input-element { color: #fff !important; }
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
    
    this.apiService.modifyAppointment(a.id, dateStr, state.time).subscribe({
      next: () => {
        delete this.modifying[a.id];
        this.snackBar.open('Rendez-vous modifié', 'OK', { duration: 3000 });
        this.reloadAppointments();
      },
      error: (err) => {
        this.snackBar.open('Erreur modification: ' + err.message, 'OK', { duration: 3500 });
      }
    });
  }
}
