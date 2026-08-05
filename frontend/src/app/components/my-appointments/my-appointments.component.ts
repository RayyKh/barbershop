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
import { BookingTranslatePipe } from '../../i18n/booking-translate.pipe';
import { BookingTranslationService } from '../../i18n/booking-translation.service';
import { ApiService, Appointment, Service } from '../../services/api.service';

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
    MatIconModule,
    BookingTranslatePipe
  ],
  template: `
    <div class="container">
      <mat-card class="client-card">
        <mat-card-header>
          <mat-card-title>{{ t('my.title') }}</mat-card-title>
          <mat-card-subtitle>{{ t('my.subtitle') }}</mat-card-subtitle>
          
          <div class="user-identity-chip" *ngIf="isAuthenticated && user">
            <mat-icon>person</mat-icon>
            <span>{{ user.name }} ({{ user.phone }})</span>
            <button mat-icon-button (click)="logout()" [title]="t('my.changeUser')">
              <mat-icon>logout</mat-icon>
            </button>
          </div>
        </mat-card-header>
        <mat-card-content>
        
        <!-- Search/Login Form (Inline) -->
        <div class="search-section" *ngIf="!isAuthenticated">
           <form [formGroup]="idForm" (ngSubmit)="identify()" class="inline-search-form">
              <mat-form-field appearance="outline" class="search-field">
                <mat-label>{{ t('my.phone.label') }}</mat-label>
                <input matInput formControlName="phone" [placeholder]="t('my.phone.placeholder')">
                <mat-icon matPrefix>phone</mat-icon>
                <button mat-icon-button matSuffix type="submit" [disabled]="idForm.invalid">
                  <mat-icon>arrow_forward</mat-icon>
                </button>
              </mat-form-field>
              <p class="search-hint">{{ t('my.phone.hint') }}</p>
           </form>
        </div>
      
      <!-- Affichage Tableau pour Desktop -->
      <div class="desktop-only" *ngIf="isAuthenticated">
        <table mat-table [dataSource]="appointments" class="mat-elevation-z8">
          
          <ng-container matColumnDef="date">
            <th mat-header-cell *matHeaderCellDef> {{ t('my.table.date') }} </th>
            <td mat-cell *matCellDef="let element"> {{formatDisplayDate(element.date) | date}} </td>
          </ng-container>

          <ng-container matColumnDef="time">
            <th mat-header-cell *matHeaderCellDef> {{ t('my.table.time') }} </th>
            <td mat-cell *matCellDef="let element"> {{element.startTime.substring(0, 5)}} </td>
          </ng-container>

          <ng-container matColumnDef="service">
            <th mat-header-cell *matHeaderCellDef> {{ t('my.table.services') }} </th>
            <td mat-cell *matCellDef="let element">
              <div *ngFor="let s of element.services">• {{ translateServiceName(s.name) }}</div>
              <div class="total-price">
                {{element.totalPrice}} DT
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="barber">
            <th mat-header-cell *matHeaderCellDef> {{ t('my.table.barber') }} </th>
            <td mat-cell *matCellDef="let element"> {{element.barber.name}} </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef> {{ t('my.table.status') }} </th>
            <td mat-cell *matCellDef="let element"> {{ translateStatus(element.status) }} </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef> {{ t('my.table.actions') }} </th>
            <td mat-cell *matCellDef="let element">
              <div class="action-buttons">
                <button mat-button color="warn" 
                        *ngIf="element.status === 'BOOKED' || element.status === 'MODIFIED'"
                        (click)="cancel(element.id)">
                  {{ t('my.action.cancel') }}
                </button>
                <button mat-button color="primary"
                        *ngIf="element.status === 'BOOKED' || element.status === 'MODIFIED'"
                        (click)="toggleModify(element.id)">
                  {{ t('my.action.modify') }}
                </button>
              </div>

              <div class="modify-panel" *ngIf="isModifying(element.id)">
                
                <div class="services-selection" *ngIf="services.length > 0">
                    <label class="grid-label">{{ t('my.modify.services') }}</label>
                    <div class="service-chips">
                        <div *ngFor="let s of services" 
                             class="service-chip"
                             [class.selected]="isServiceSelected(element.id, s.id)"
                             (click)="toggleService(element.id, s.id)">
                            {{ translateServiceName(s.name) }}
                        </div>
                    </div>
                </div>

                <div class="warning-msg" *ngIf="isOriginalTimeInvalid(element.id)">
                    <mat-icon inline>error_outline</mat-icon>
                    <span>{{ t('my.modify.warning') }}</span>
                </div>

                <mat-form-field appearance="outline">
                  <mat-label>{{ t('my.modify.newDate') }}</mat-label>
                  <input matInput [matDatepicker]="picker" (dateChange)="onModifyDateChange($event, element)" [value]="getModifyDate(element.id)">
                  <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
                  <mat-datepicker #picker></mat-datepicker>
                </mat-form-field>

                <div class="hours-grid-container" *ngIf="getModifyUiSlots(element.id).length > 0">
                  <label class="grid-label">{{ t('my.modify.slots') }}</label>
                  <div class="slots-grid">
                    <div *ngFor="let slot of getModifyUiSlots(element.id)" 
                         class="slot-item"
                         [class.available]="slot.isAvailable"
                         [class.unavailable]="!slot.isAvailable"
                         [class.selected]="slot.isSelected"
                         (click)="selectModifyTime(element.id, slot)">
                      {{ slot.display }}
                    </div>
                  </div>
                </div>
                
                <div *ngIf="getModifyUiSlots(element.id).length === 0" class="no-slots-msg">
                   {{ t('my.modify.pickDate') }}
                </div>

                <button mat-raised-button color="primary" [disabled]="!getModifyTime(element.id)" (click)="applyModify(element)">{{ t('my.action.confirm') }}</button>
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      </div>

      <!-- Affichage Cartes pour Mobile -->
      <div class="mobile-only" *ngIf="isAuthenticated">
        <div class="appointment-cards">
          <mat-card class="mobile-appointment-card" *ngFor="let element of appointments">
            <mat-card-content>
              <div class="card-row">
                <span class="label">{{ t('my.mobile.date') }}</span>
                <span class="value">{{formatDisplayDate(element.date) | date}}</span>
              </div>
              <div class="card-row">
                <span class="label">{{ t('my.mobile.time') }}</span>
                <span class="value">{{element.startTime.substring(0, 5)}}</span>
              </div>
              <div class="card-row">
                <span class="label">{{ t('my.mobile.services') }}</span>
                <span class="value">
                  <div *ngFor="let s of element.services" style="text-align: right">• {{ translateServiceName(s.name) }}</div>
                  <div style="text-align: right; font-weight: bold; color: #d4af37; margin-top: 4px;">{{element.totalPrice}} DT</div>
                </span>
              </div>
              <div class="card-row">
                <span class="label">{{ t('my.mobile.barber') }}</span>
                <span class="value">{{element.barber.name}}</span>
              </div>
              <div class="card-row">
                <span class="label">{{ t('my.mobile.status') }}</span>
                <span class="value status-badge" [ngClass]="element.status.toLowerCase()">{{ translateStatus(element.status) }}</span>
              </div>
              
              <div class="card-actions" *ngIf="element.status === 'BOOKED' || element.status === 'MODIFIED'">
                <button mat-raised-button color="warn" (click)="cancel(element.id)">{{ t('my.action.cancel') }}</button>
                <button mat-raised-button color="primary" (click)="toggleModify(element.id)">{{ t('my.action.modify') }}</button>
              </div>

              <div class="modify-panel mobile" *ngIf="isModifying(element.id)">
                
                <div class="services-selection" *ngIf="services.length > 0">
                    <label class="grid-label">{{ t('my.modify.services') }}</label>
                    <div class="service-chips">
                        <div *ngFor="let s of services" 
                             class="service-chip"
                             [class.selected]="isServiceSelected(element.id, s.id)"
                             (click)="toggleService(element.id, s.id)">
                            {{ translateServiceName(s.name) }}
                        </div>
                    </div>
                </div>

                <div class="warning-msg" *ngIf="isOriginalTimeInvalid(element.id)">
                    <mat-icon inline>error_outline</mat-icon>
                    <span>{{ t('my.modify.warning') }}</span>
                </div>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>{{ t('my.modify.newDate') }}</mat-label>
                  <input matInput [matDatepicker]="mobilePicker" (dateChange)="onModifyDateChange($event, element)" [value]="getModifyDate(element.id)">
                  <mat-datepicker-toggle matIconSuffix [for]="mobilePicker"></mat-datepicker-toggle>
                  <mat-datepicker #mobilePicker></mat-datepicker>
                </mat-form-field>

                <div class="hours-grid-container" *ngIf="getModifyUiSlots(element.id).length > 0">
                  <label class="grid-label">{{ t('my.modify.slots') }}</label>
                  <div class="slots-grid">
                    <div *ngFor="let slot of getModifyUiSlots(element.id)" 
                         class="slot-item"
                         [class.available]="slot.isAvailable"
                         [class.unavailable]="!slot.isAvailable"
                         [class.selected]="slot.isSelected"
                         (click)="selectModifyTime(element.id, slot)">
                      {{ slot.display }}
                    </div>
                  </div>
                </div>
                
                <div *ngIf="getModifyUiSlots(element.id).length === 0" class="no-slots-msg">
                   {{ t('my.modify.pickDate') }}
                </div>

                <button mat-raised-button color="primary" class="full-width" [disabled]="!getModifyTime(element.id)" (click)="applyModify(element)">{{ t('my.action.confirm') }}</button>
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      </div>
      
      <div *ngIf="appointments.length === 0" class="empty-state">
          <p>{{ t('my.empty') }}</p>
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
    .modify-panel { display: grid; grid-template-columns: 1fr; gap: 8px; margin-top: 12px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; }
    
    .services-selection { margin-bottom: 12px; }
    .services-locked-msg {
      color: #888;
      font-size: 0.85rem;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-style: italic;
    }
    .warning-msg {
        background: rgba(244, 67, 54, 0.1);
        color: #f44336;
        border: 1px solid #f44336;
        padding: 8px 12px;
        border-radius: 4px;
        margin: 10px 0;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 8px;
        line-height: 1.4;
    }
    .service-chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .service-chip {
        padding: 6px 12px;
        border-radius: 20px;
        border: 1px solid rgba(255,255,255,0.2);
        cursor: pointer;
        font-size: 0.85rem;
        transition: all 0.2s;
        color: #fff;
    }
    .service-chip:hover {
        border-color: #d4af37;
        background: rgba(212, 175, 55, 0.1);
    }
    .service-chip.selected {
        background: #d4af37;
        color: #000;
        border-color: #d4af37;
        font-weight: bold;
    }

    .hours-grid-container {
      margin-top: 12px;
    }
    .grid-label {
      display: block;
      color: #d4af37;
      margin-bottom: 8px;
      font-size: 0.9rem;
    }
    .slots-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
      gap: 6px;
      max-height: 200px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .slot-item {
      padding: 6px 2px;
      text-align: center;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.2s;
    }
    .slot-item.available {
      background-color: rgba(76, 175, 80, 0.2);
      border: 1px solid #4caf50;
      color: #4caf50;
    }
    .slot-item.available:hover {
      background-color: rgba(76, 175, 80, 0.4);
    }
    .slot-item.available.selected {
      background-color: #4caf50;
      color: #000;
      font-weight: bold;
      box-shadow: 0 0 8px rgba(76, 175, 80, 0.5);
    }
    .slot-item.unavailable {
      background-color: rgba(244, 67, 54, 0.1);
      border: 1px solid rgba(244, 67, 54, 0.3);
      color: rgba(244, 67, 54, 0.5);
      cursor: not-allowed;
      text-decoration: line-through;
    }
    .no-slots-msg {
      color: #888;
      font-style: italic;
      margin-top: 8px;
    }
    .full-width { width: 100%; }
    .empty-state { text-align: center; padding: 40px; color: #aaa; }

    /* Mobile Styles */
    @media (max-width: 768px) {
      .desktop-only { display: none; }
      .mobile-only { display: block; }
      .slots-grid { max-height: 120px; }
      .container { padding: 100px 10px 20px; }
      .client-card mat-card-header mat-card-title { font-size: 1.4rem; }
      .id-form-row mat-form-field { min-width: 100%; }
      .user-identity-chip { margin-left: 0; margin-top: 10px; width: 100%; justify-content: space-between; }
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

    .search-section {
       padding: 24px;
       display: flex;
       justify-content: center;
       background: rgba(255, 255, 255, 0.03);
       border-bottom: 1px solid rgba(212, 175, 55, 0.1);
    }
    .inline-search-form {
       width: 100%;
       max-width: 500px;
       text-align: center;
    }
    .search-field {
       width: 100%;
       font-size: 1.1rem;
    }
    .search-hint {
       color: #888;
       margin-top: -10px;
       font-size: 0.9rem;
    }
  `]
})
export class MyAppointmentsComponent implements OnInit, OnDestroy {
  appointments: Appointment[] = [];
  services: Service[] = [];
  user: any = null;
  isAuthenticated: boolean = false;
  idForm: FormGroup;
  displayedColumns: string[] = ['date', 'time', 'service', 'barber', 'status', 'actions'];
  modifying: { [key: number]: { date: Date; slots: string[]; time?: string; uiSlots?: any[]; serviceIds?: number[]; originalTimeInvalid?: boolean } } = {};
  contactEmail: string = '';
  contactPhone: string = '';
  private refreshInterval: any;

  constructor(
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private fb: FormBuilder,
    private i18n: BookingTranslationService
  ) {
    // Initialisation du formulaire d'identification
    this.idForm = this.fb.group({
      firstName: [''], // Optionnel, gardé pour la forme
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{8,}$/)]]
    });
  }

  ngOnInit() {
    this.apiService.getServices().subscribe(services => {
      this.services = services;
    });

    this.apiService.appointmentBooked$.subscribe(() => {
      this.snackBar.open(this.t('my.snack.added'), this.t('common.ok'), { duration: 3000 });
      this.reloadAppointments();
    });

    this.apiService.appointmentsChanged$.subscribe(() => {
      this.reloadAppointments();
    });
    
    // Check if user is already identified in session or local storage
    const savedFirstName = localStorage.getItem('lastUserFirstName');
    const savedPhone = localStorage.getItem('lastUserPhone');
    const token = sessionStorage.getItem('token');

    if (token) {
      this.isAuthenticated = true;
    } else if (savedPhone) {
      this.isAuthenticated = true;
      this.idForm.patchValue({ 
        firstName: savedFirstName || '',
        phone: savedPhone 
      });
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
      const phone = this.idForm.value.phone;
      // firstName n'est plus utilisé pour l'identification, on passe une chaîne vide ou on adapte le backend
      // Pour l'instant on garde la signature de la méthode mais on ignore le prénom
      this.apiService.getAppointmentsByPhone(phone).subscribe({
        next: (data) => {
          this.appointments = data;
          this.isAuthenticated = true;
          if (data.length > 0) {
            this.user = data[0].user; // On récupère les infos du client depuis le premier rdv
          } else {
             // Si pas de rdv, on crée un objet user temporaire avec juste le téléphone
             this.user = { 
               name: 'Client', 
               firstName: '', 
               phone: phone, 
               email: '', 
               id: 0 
             }; 
          }
          this.snackBar.open(this.t('my.snack.welcome'), this.t('common.close'), { duration: 3000 });
        },
        error: (err) => {
          console.error('Erreur lors de la récupération des rendez-vous', err);
          this.snackBar.open(this.t('my.snack.none'), this.t('common.close'), { duration: 3000 });
        }
      });
    }
  }

  formatDisplayDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    // Utiliser des slashes et forcer l'heure à midi pour éviter tout décalage de fuseau horaire
    return new Date(dateStr.replace(/-/g, '/') + ' 12:00:00');
  }

  logout() {
    localStorage.removeItem('lastUserFirstName');
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

    // Refresh user profile if logged in
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
    
    // Si pas de téléphone, on ne fait rien car c'est le seul identifiant fiable maintenant
    if (!phone) return;

    this.apiService.getAppointmentsByPhone(phone).subscribe({
      next: (list: Appointment[]) => {
        // Merge results and avoid duplicates, but update existing ones with fresh data
        const updatedAppointments = [...this.appointments];
        list.forEach((newApp: Appointment) => {
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

        // Extract latest user info from the most recent appointment.
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
      error: (err: any) => {
        console.error('Error fetching appointments by contact', err);
      }
    });
  }

  

  cancel(id: number) {
    if (confirm(this.t('my.confirm.cancel'))) {
      this.apiService.cancelAppointment(id).subscribe(() => {
        this.snackBar.open(this.t('my.snack.cancelled'), this.t('common.ok'), { duration: 3000 });
        this.reloadAppointments();
      });
    }
  }

  toggleModify(id: number) {
    if (this.modifying[id]) {
      delete this.modifying[id];
      return;
    }
    // Initialiser avec la date du jour par défaut
    const now = new Date();
    
    // Charger les créneaux pour aujourd'hui immédiatement
    const appt = this.appointments.find(a => a.id === id);
    if (appt) {
      this.modifying[id] = { 
        date: now, 
        slots: [], 
        uiSlots: [],
        serviceIds: appt.services.map(s => s.id) 
      };
      this.loadModifySlots(appt, now);
    }
  }

  isModifying(id: number): boolean {
    return !!this.modifying[id];
  }

  isOriginalTimeInvalid(id: number): boolean {
    return this.modifying[id]?.originalTimeInvalid || false;
  }

  getAppointmentDuration(appt: Appointment): number {
    if (!appt || !appt.services) return 0;
    const isIslem = (appt.barber?.name || '').toLowerCase() === 'islem';
    return appt.services.reduce((total, s) => {
      let d = s.duration || 0;
      const n = (s.name || '').toLowerCase();
      if (isIslem) {
        if (n === 'coupe') d = 75;
        else if (n === 'coupe + barbe dégradé + fixation') d = 90;
      }
      return total + d;
    }, 0);
  }

  getModifyDate(id: number): Date | null {
    return this.modifying[id]?.date || null;
  }

  onModifyDateChange(event: any, a: Appointment) {
    const d = event.value;
    if (!d) return;
    
    const state = this.modifying[a.id];
    if (!state) return;
    
    state.date = d;
    this.loadModifySlots(a, d);
  }
  
  isServiceSelected(apptId: number, serviceId: number): boolean {
    return this.modifying[apptId]?.serviceIds?.includes(serviceId) || false;
  }

  toggleService(apptId: number, serviceId: number) {
    const state = this.modifying[apptId];
    if (!state || !state.serviceIds) return;

    const index = state.serviceIds.indexOf(serviceId);
    if (index > -1) {
      if (state.serviceIds.length > 1) {
        state.serviceIds.splice(index, 1);
      } else {
        // Prevent deselecting all services (at least one required)
        this.snackBar.open(this.t('my.snack.selectOneService'), this.t('common.ok'), { duration: 2000 });
        return;
      }
    } else {
      state.serviceIds.push(serviceId);
    }
    
    // Reload slots because duration might have changed
    const appt = this.appointments.find(a => a.id === apptId);
    if (appt) {
      this.loadModifySlots(appt, state.date);
    }
  }
  
  loadModifySlots(a: Appointment, date: Date) {
    const state = this.modifying[a.id];
    if (!state) return;
    
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    this.apiService.getAvailableSlots(a.barber.id, dateStr).subscribe(slots => {
      state.slots = slots;
      
      // --- LOGIC FOR GREEN/RED SLOTS (Similar to EditAppointmentDialog) ---
      
      // 1. Raw free slots in minutes
      let freeSlotsInMinutes: number[] = slots.map(s => {
        const parts = s.split(':');
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
      });

      // Inject the current appointment's original slots into available slots (if date matches)
      // This allows the user to re-select their current time or use it as part of a new duration
      if (dateStr === a.date) {
        const [h, m] = a.startTime.split(':').map(Number);
        const startMin = h * 60 + m;
        // Use the original duration of the appointment
        const duration = this.getAppointmentDuration(a);
        const slotsCount = Math.ceil(duration / 15);
        
        for (let i = 0; i < slotsCount; i++) {
            const slot = startMin + (i * 15);
            if (!freeSlotsInMinutes.includes(slot)) {
                freeSlotsInMinutes.push(slot);
            }
        }
      }
      
      // 3. Generate full day slots based on barber schedule
      const dayOfWeek = date.getDay();
      const barberName = a.barber.name.toLowerCase();
      
      let startHour = 10;
      let endHour = 21;

      if (dayOfWeek === 1) { // Monday
        startHour = 12;
        endHour = 18;
      } else {
        if (barberName.includes("hamouda")) startHour = 12;
        else if (barberName.includes("ahmed")) startHour = 11;
        else startHour = 10;
      }

      const fullDaySlots: number[] = [];
      for (let h = startHour; h < endHour; h++) {
        for (let m = 0; m < 60; m += 15) {
          fullDaySlots.push(h * 60 + m);
        }
      }
      
      // 4. Calculate needed duration based on SELECTED services
      let totalDuration = 0;
      const selectedServiceIds = state.serviceIds || [];
      
      const isIslem = (a.barber?.name || '').toLowerCase() === 'islem';

      if (selectedServiceIds.length > 0 && this.services.length > 0) {
        // Calculate from selected services
        selectedServiceIds.forEach(sid => {
          const s = this.services.find(srv => srv.id === sid);
          if (s) {
            let d = s.duration || 0;
            const n = (s.name || '').toLowerCase();
            if (isIslem) {
              if (n === 'coupe') d = 75;
              else if (n === 'coupe + barbe dégradé + fixation') d = 90;
            }
            totalDuration += d;
          }
        });
      } else if (a.services && a.services.length > 0) {
        // Fallback to appointment services if something is wrong
        totalDuration = a.services.reduce((acc, s) => acc + s.duration, 0);
      }
      
      if (totalDuration === 0) totalDuration = 30; // Default min duration
      
      const slotsNeeded = Math.ceil(totalDuration / 15);
      
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      const newSlotsUI: any[] = [];
      
      fullDaySlots.forEach((totalMin) => {
        const isPast = (dateStr === todayStr && totalMin <= (currentHour * 60 + currentMinute + 5));
        
        if (isPast) return; // Masquer les créneaux passés
        
        let canFit = true;
        
        /*
        // Best Effort Logic (Disabled for Strict User Requirement)
        if (!freeSlotsInMinutes.includes(totalMin)) {
            canFit = false;
        }
        */

        // Strict Check: Ensure ALL needed slots are available.
        // This prevents a 15-min slot from expanding into a booked slot.
        for (let j = 0; j < slotsNeeded; j++) {
          const targetMinutes = totalMin + (j * 15);
          if (!freeSlotsInMinutes.includes(targetMinutes)) {
            canFit = false;
            break;
          }
        }

        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`; 
        const displayTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        newSlotsUI.push({
          time: timeStr,
          display: displayTime,
          isAvailable: canFit,
          isPast: isPast,
          isSelected: timeStr === state.time
        });
      });
      
      state.uiSlots = newSlotsUI;

      // Check if original time is invalidated
      state.originalTimeInvalid = false;
      if (dateStr === a.date) {
        // Normalize a.startTime to match slot format (HH:mm:00)
        const originalTimeStr = a.startTime.length === 5 ? a.startTime + ":00" : a.startTime;
        const originalSlot = newSlotsUI.find(s => s.time === originalTimeStr);
        
        // If the original slot exists but is not available, then it's invalid
        if (originalSlot && !originalSlot.isAvailable) {
            state.originalTimeInvalid = true;
        }
      }
    });
  }

  getModifyUiSlots(id: number): any[] {
    return this.modifying[id]?.uiSlots || [];
  }

  getModifyTime(id: number): string | undefined {
    return this.modifying[id]?.time;
  }

  selectModifyTime(id: number, slot: any) {
    if (!slot.isAvailable) return;
    
    const state = this.modifying[id];
    if (state) {
      state.time = slot.time;
      // Update selection UI
      if (state.uiSlots) {
        state.uiSlots.forEach(s => s.isSelected = (s.time === slot.time));
      }
    }
  }

  private formatDateLocal(d: any): string {
    if (!d) return '';
    
    // Si c'est déjà une chaîne YYYY-MM-DD simple (10 caractères, sans T ou Z)
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return d;
    }

    // Sinon, on convertit en objet Date et on extrait les composants LOCAUX
    const date = (d instanceof Date) ? d : new Date(d);
    if (isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  applyModify(a: Appointment) {
    const state = this.modifying[a.id];
    if (!state || !state.time) return;
    const dateStr = this.formatDateLocal(state.date);
    
    this.apiService.modifyAppointment(a.id, dateStr, state.time, state.serviceIds).subscribe({
      next: () => {
        delete this.modifying[a.id];
        this.snackBar.open(this.t('my.snack.modified'), this.t('common.ok'), { duration: 3000 });
        this.reloadAppointments();
      },
      error: (err) => {
        let errorMsg = this.t('my.snack.modifyError');
        if (err.error && typeof err.error === 'string') errorMsg = err.error;
        else if (err.error && err.error.message) errorMsg = err.error.message;
        else if (err.message) errorMsg = err.message;
        
        this.snackBar.open(errorMsg, this.t('common.ok'), { duration: 5000 });
      }
    });
  }

  t(key: string): string {
    return this.i18n.t(key);
  }

  translateServiceName(name: string): string {
    const map: Record<string, string> = {
      'coupe': 'service.coupe',
      'barbe': 'service.barbe',
      'barbe (courte)': 'service.barbeCourte',
      'coupe + barbe': 'service.coupeBarbe',
      'coupe + barbe + brushing': 'service.coupeBarbeBrushing',
      'coupe + barbe dégradé + fixation': 'service.coupeBarbeDegradeFixation',
      'tresse': 'service.tresse',
      'mèches': 'service.meches',
      'meches': 'service.meches',
      'epilation à la cire': 'service.epilationCire',
      'épilation à la cire': 'service.epilationCire',
      'masque noir': 'service.masqueNoir',
      'fixation': 'service.fixation',
      'brushing': 'service.brushing'
    };
    const key = map[(name || '').trim().toLowerCase()];
    return key ? this.t(key) : name;
  }

  translateStatus(status: string): string {
    return this.t(`status.${status}`) || status;
  }
}
