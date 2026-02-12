import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { ApiService, Appointment } from '../../services/api.service';

@Component({
  selector: 'app-my-appointments',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    ReactiveFormsModule,
    MatTableModule, 
    MatButtonModule, 
    MatFormFieldModule, 
    MatInputModule, 
    MatDatepickerModule, 
    MatNativeDateModule, 
    MatChipsModule, 
    MatCardModule, 
    MatSnackBarModule, 
    MatIconModule
  ],
  template: `
    <div class="container">
      <!-- Formulaire d'identification client -->
      <mat-card class="identification-card" *ngIf="!isAuthenticated">
        <mat-card-header>
          <mat-card-title>Consulter mes rendez-vous</mat-card-title>
          <mat-card-subtitle>Entrez vos coordonnées pour accéder à votre historique et vos points de fidélité</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="idForm" (ngSubmit)="identify()">
            <div class="id-form-row">
              <mat-form-field appearance="outline">
                <mat-label>Votre Prénom</mat-label>
                <input matInput formControlName="firstName">
                <mat-icon matPrefix>person_outline</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Votre Nom</mat-label>
                <input matInput formControlName="name" >
                <mat-icon matPrefix>person</mat-icon>
              </mat-form-field>
              
              <mat-form-field appearance="outline">
                <mat-label>Votre Numéro de Téléphone</mat-label>
                <input matInput formControlName="phone" >
                <mat-icon matPrefix>phone</mat-icon>
              </mat-form-field>
            </div>
            <button mat-raised-button color="primary" type="submit" [disabled]="idForm.invalid">
              Voir mes rendez-vous
            </button>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- Loyalty Progress Section -->
      <mat-card class="loyalty-card" *ngIf="isAuthenticated && user">
        <mat-card-content>
          <div class="loyalty-header">
            <h3>Votre Fidélité</h3>
            <div class="reward-badge" *ngIf="user.availableRewards > 0">
              <mat-icon>card_giftcard</mat-icon>
              <span>{{ user.availableRewards }} Récompense(s) disponible(s) !</span>
            </div>
          </div>
          
          <div class="loyalty-stats">
            <div class="stat-item">
              <span class="stat-value">{{ user.totalAppointments || 0 }}</span>
              <span class="stat-label">Rendez-vous terminés</span>
            </div>
            <div class="stat-item progress-container">
              <div class="progress-info">
                <span>Progression vers la prochaine récompense</span>
                <span>{{ (user.totalAppointments || 0) % 10 }}/10</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" [style.width.%]="((user.totalAppointments || 0) % 10) * 10"></div>
              </div>
              <p class="loyalty-tip" *ngIf="user.availableRewards > 0">
                Une "Coupe + Barbe" gratuite sera appliquée à votre prochaine réservation de ce service !
              </p>
              <p class="loyalty-tip" *ngIf="user.availableRewards === 0">
                Encore {{ 10 - ((user.totalAppointments || 0) % 10) }} rendez-vous pour votre prochaine récompense !
              </p>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ user.usedRewards || 0 }}</span>
              <span class="stat-label">Récompenses utilisées</span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="client-card" *ngIf="isAuthenticated">
        <mat-card-header>
          <mat-card-title>Mes Rendez-vous</mat-card-title>
          <mat-card-subtitle>Consultez, annulez ou modifiez vos réservations</mat-card-subtitle>
          <div class="user-identity-chip" *ngIf="user">
            <mat-icon>person</mat-icon>
            <span>{{ user.firstName }} {{ user.name }} ({{ user.phone }})</span>
            <button mat-icon-button (click)="logout()" title="Changer d'utilisateur">
              <mat-icon>logout</mat-icon>
            </button>
          </div>
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
            <td mat-cell *matCellDef="let element"> {{element.startTime.substring(0, 5)}} </td>
          </ng-container>

          <ng-container matColumnDef="service">
            <th mat-header-cell *matHeaderCellDef> Services </th>
            <td mat-cell *matCellDef="let element">
              <div *ngFor="let s of element.services">• {{s.name}}</div>
              <div class="total-price" [class.free]="element.rewardApplied">
                {{element.totalPrice}} DT
                <span class="reward-tag" *ngIf="element.rewardApplied">OFFERT (Fidélité)</span>
              </div>
            </td>
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
                      {{ h.substring(0, 5) }}
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
                <span class="value">{{element.startTime.substring(0, 5)}}</span>
              </div>
              <div class="card-row">
                <span class="label">Services:</span>
                <span class="value">
                  <div *ngFor="let s of element.services" style="text-align: right">• {{s.name}}</div>
                  <div style="text-align: right; font-weight: bold; color: #d4af37; margin-top: 4px;">{{element.totalPrice}} DT</div>
                </span>
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
                      {{ h.substring(0, 5) }}
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
    
    .loyalty-card { 
      color: #fff; 
      background: #121212 !important; 
      border: 1px solid #d4af37 !important; 
      border-radius: 12px; 
      margin-bottom: 24px;
      padding: 8px;
    }
    .loyalty-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; }
    .loyalty-header h3 { color: #d4af37; margin: 0; font-family: 'Playfair Display', serif; font-size: 1.5rem; }
    .reward-badge { 
      display: flex; 
      align-items: center; 
      gap: 8px; 
      background: rgba(212, 175, 55, 0.2); 
      color: #d4af37; 
      padding: 8px 16px; 
      border-radius: 20px; 
      border: 1px solid #d4af37;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.4); }
      70% { transform: scale(1.02); box-shadow: 0 0 0 10px rgba(212, 175, 55, 0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(212, 175, 55, 0); }
    }
    .loyalty-stats { display: flex; gap: 24px; align-items: flex-start; }
    .stat-item { display: flex; flex-direction: column; align-items: center; text-align: center; }
    .stat-value { font-size: 2rem; font-weight: bold; color: #d4af37; }
    .stat-label { font-size: 0.8rem; color: #aaa; text-transform: uppercase; letter-spacing: 1px; }
    .progress-container { flex: 1; align-items: stretch; text-align: left; }
    .progress-info { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.9rem; color: #fff; }
    .progress-bar-bg { background: rgba(255,255,255,0.1); height: 12px; border-radius: 6px; overflow: hidden; margin-bottom: 8px; }
    .progress-bar-fill { background: linear-gradient(90deg, #d4af37, #f1c40f); height: 100%; transition: width 0.5s ease-out; }
    .loyalty-tip { font-size: 0.85rem; color: #d4af37; font-style: italic; margin: 0; }

    .client-card mat-card-header { margin-bottom: 20px; }
    .client-card mat-card-header mat-card-title { color: #d4af37; font-size: 1.8rem; font-family: 'Playfair Display', serif; }
    
    .identification-card {
      color: #fff;
      background: #121212 !important;
      border: 1px solid #d4af37 !important;
      border-radius: 12px;
      margin-bottom: 24px;
      padding: 16px;
    }
    .identification-card mat-card-title { color: #d4af37; margin-bottom: 8px; }
    .id-form-row { display: flex; gap: 16px; margin-top: 20px; flex-wrap: wrap; }
    .id-form-row mat-form-field { flex: 1; min-width: 250px; }
    .identification-card form button { width: 100%; padding: 12px; font-weight: bold; }
    
    .user-identity-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(212, 175, 55, 0.1);
      color: #d4af37;
      padding: 4px 12px;
      border-radius: 20px;
      border: 1px solid rgba(212, 175, 55, 0.3);
      margin-left: auto;
      font-size: 0.9rem;
    }
    .user-identity-chip button { color: #d4af37; width: auto; padding: 0; }
    .client-card mat-card-header mat-card-subtitle { color: #aaaaaa; }
    
    .desktop-only { display: block; }
    .mobile-only { display: none; }

    ::ng-deep .mat-mdc-table { background: #121212 !important; color: #fff !important; }
    ::ng-deep .mat-mdc-header-cell { color: #d4af37 !important; font-weight: bold; border-bottom: 1px solid #d4af37 !important; }
    ::ng-deep .mat-mdc-cell { color: #fff !important; border-bottom: 1px solid rgba(255,255,255,0.1) !important; padding: 12px 8px !important; }
    
    .action-buttons { display: flex; gap: 8px; }
    .total-price { color: #d4af37; font-weight: bold; margin-top: 4px; font-size: 1.1rem; }
    .total-price.free { color: #2ecc71; text-decoration: line-through; opacity: 0.7; font-size: 0.9rem; }
    .reward-tag { 
      display: inline-block; 
      background: #2ecc71; 
      color: #fff; 
      padding: 2px 8px; 
      border-radius: 4px; 
      font-size: 0.75rem; 
      margin-left: 8px; 
      text-decoration: none !important;
      opacity: 1 !important;
    }
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
      .id-form-row mat-form-field { min-width: 100%; }
      .user-identity-chip { margin-left: 0; margin-top: 10px; width: 100%; justify-content: space-between; }
      .loyalty-header { flex-direction: column; align-items: flex-start; }
      .loyalty-stats { flex-direction: column; gap: 16px; width: 100%; }
      .stat-item { width: 100%; flex-direction: row; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; }
      .stat-value { font-size: 1.4rem; }
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
    ::ng-deep .mat-mdc-form-field-label, 
    ::ng-deep .mdc-floating-label,
    ::ng-deep .mat-mdc-form-field-label .mdc-floating-label { 
      color: #ffffff !important; 
    }
    ::ng-deep .mat-mdc-input-element { color: #ffffff !important; }
    ::ng-deep .mat-mdc-form-field-label .mdc-floating-label--float-above { 
      color: #d4af37 !important; 
    }
    ::ng-deep .mat-icon[matPrefix] { color: #d4af37 !important; }
    ::ng-deep .mat-mdc-form-field-hint { color: #ffffff !important; }
    ::ng-deep .mat-mdc-form-field-placeholder,
    ::ng-deep .mat-mdc-input-element::placeholder { 
      color: rgba(255, 255, 255, 0.7) !important; 
    }
    /* Pour la bordure quand on ne survole pas */
    ::ng-deep .mdc-outlined-record__outline {
      border-color: rgba(255, 255, 255, 0.3) !important;
    }
  `]
})
export class MyAppointmentsComponent implements OnInit, OnDestroy {
  appointments: Appointment[] = [];
  user: any = null;
  isAuthenticated: boolean = false;
  idForm: FormGroup;
  displayedColumns: string[] = ['date', 'time', 'service', 'barber', 'status', 'actions'];
  modifying: Record<number, { date: Date; slots: string[]; time?: string }> = {};
  contactEmail: string = '';
  contactPhone: string = '';
  private refreshInterval: any;

  constructor(private apiService: ApiService, private snackBar: MatSnackBar, private fb: FormBuilder) {
    this.idForm = this.fb.group({
      firstName: ['', Validators.required],
      name: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{8,}$/)]]
    });
  }

  ngOnInit() {
    this.apiService.appointmentBooked$.subscribe(() => {
      this.snackBar.open('Nouveau rendez-vous ajouté', 'OK', { duration: 3000 });
      this.reloadAppointments();
    });

    this.apiService.appointmentsChanged$.subscribe(() => {
      this.reloadAppointments();
    });
    
    // Check if user is already identified in session or local storage
    const savedPhone = localStorage.getItem('lastUserPhone');
    const savedName = localStorage.getItem('lastUserName');
    const savedFirstName = localStorage.getItem('lastUserFirstName');
    const token = sessionStorage.getItem('token');

    if (token) {
      this.isAuthenticated = true;
    } else if (savedPhone && savedName) {
      this.isAuthenticated = true;
      this.idForm.patchValue({ firstName: savedFirstName || '', name: savedName, phone: savedPhone });
    }

    this.reloadAppointments();

    // Refresh every 30 seconds to catch status updates from admin
    this.refreshInterval = setInterval(() => {
      this.reloadAppointments();
    }, 30000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  identify() {
    if (this.idForm.valid) {
      const { firstName, name, phone } = this.idForm.value;
      localStorage.setItem('lastUserFirstName', firstName);
      localStorage.setItem('lastUserName', name);
      localStorage.setItem('lastUserPhone', phone);
      this.isAuthenticated = true;
      this.reloadAppointments();
      this.snackBar.open(`Bienvenue ${firstName} ${name}`, 'OK', { duration: 2000 });
    }
  }

  logout() {
    localStorage.removeItem('lastUserFirstName');
    localStorage.removeItem('lastUserName');
    localStorage.removeItem('lastUserPhone');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    this.isAuthenticated = false;
    this.user = null;
    this.appointments = [];
    this.idForm.reset();
  }

  reloadAppointments() {
    if (!this.isAuthenticated) return;

    const token = sessionStorage.getItem('token');
    const savedEmail = localStorage.getItem('lastUserEmail');
    const savedPhone = localStorage.getItem('lastUserPhone');
    
    this.contactEmail = savedEmail || '';
    this.contactPhone = savedPhone || '';

    // Refresh user profile if logged in to get latest loyalty points
    if (token) {
      console.log('Refreshing user profile for logged in user...');
      this.apiService.getCurrentUser().subscribe({
        next: (user) => {
          console.log('User profile refreshed:', user);
          this.user = user;
          sessionStorage.setItem('user', JSON.stringify(user));
        },
        error: (err) => console.error('Error refreshing user profile', err)
      });
    }

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
    const token = sessionStorage.getItem('token');
    this.apiService.getAppointmentsByContact(email, phone).subscribe({
      next: (list) => {
        // Merge results and avoid duplicates, but update existing ones with fresh data
        const updatedAppointments = [...this.appointments];
        list.forEach(newApp => {
          const index = updatedAppointments.findIndex(a => a.id === newApp.id);
          if (index > -1) {
            updatedAppointments[index] = newApp;
          } else {
            updatedAppointments.push(newApp);
          }
        });

        // Sort by date and time
        updatedAppointments.sort((a, b) => {
          const dateA = new Date(a.date + 'T' + a.startTime);
          const dateB = new Date(b.date + 'T' + b.startTime);
          return dateB.getTime() - dateA.getTime(); // Newest first
        });

        this.appointments = updatedAppointments;

        // Extract latest user info from the most recent appointment to ensure loyalty points are updated.
        // We do this if we are not logged in, OR if the logged-in user is an ADMIN (to allow testing the client dashboard).
        const isGuestMode = !token;
        const isAdminMode = this.user && (this.user.role === 'ADMIN' || (this.user.roles && this.user.roles.includes('ROLE_ADMIN')));
        
        if ((isGuestMode || isAdminMode) && this.appointments.length > 0) {
          console.log('Extracting user from latest appointment (Mode: ' + (isGuestMode ? 'Guest' : 'Admin Test') + ')...');
          // Sort locally first to find the most recent one with user data
          const sorted = [...this.appointments].sort((a, b) => b.id - a.id);
          const latestWithUser = sorted.find(a => a.user);
          if (latestWithUser && latestWithUser.user) {
            console.log('Found user in appointment:', latestWithUser.user);
            this.user = { ...latestWithUser.user };
            // Also update session storage if in guest mode
            if (isGuestMode) {
              sessionStorage.setItem('user', JSON.stringify(this.user));
            }
          }
        }
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
