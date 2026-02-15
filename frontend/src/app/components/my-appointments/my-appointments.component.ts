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
                <span>{{ (user.totalAppointments || 0) % 5 }}/5</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" [style.width.%]="((user.totalAppointments || 0) % 5) * 20"></div>
              </div>
              <p class="loyalty-tip" *ngIf="user.availableRewards > 0">
                Une "Coupe + Barbe" gratuite sera appliquée à votre prochaine réservation de ce service !
              </p>
              <p class="loyalty-tip" *ngIf="user.availableRewards === 0">
                Encore {{ 5 - ((user.totalAppointments || 0) % 5) }} rendez-vous pour votre prochaine récompense !
              </p>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ user.usedRewards || 0 }}</span>
              <span class="stat-label">Récompenses utilisées</span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="client-card">
        <mat-card-header>
          <mat-card-title>Mes Rendez-vous</mat-card-title>
          <mat-card-subtitle>Consultez, annulez ou modifiez vos réservations</mat-card-subtitle>
          
          <div class="user-identity-chip" *ngIf="isAuthenticated && user">
            <mat-icon>person</mat-icon>
            <span>{{ user.name }} ({{ user.phone }})</span>
            <button mat-icon-button (click)="logout()" title="Changer d'utilisateur">
              <mat-icon>logout</mat-icon>
            </button>
          </div>
        </mat-card-header>
        <mat-card-content>
        
        <!-- Search/Login Form (Inline) -->
        <div class="search-section" *ngIf="!isAuthenticated">
           <form [formGroup]="idForm" (ngSubmit)="identify()" class="inline-search-form">
              <mat-form-field appearance="outline" class="search-field">
                <mat-label>Votre Numéro de Téléphone</mat-label>
                <input matInput formControlName="phone" placeholder="Ex: 20123456">
                <mat-icon matPrefix>phone</mat-icon>
                <button mat-icon-button matSuffix type="submit" [disabled]="idForm.invalid">
                  <mat-icon>arrow_forward</mat-icon>
                </button>
              </mat-form-field>
              <p class="search-hint">Saisissez votre numéro pour accéder à vos rendez-vous.</p>
           </form>
        </div>
      
      <!-- Affichage Tableau pour Desktop -->
      <div class="desktop-only" *ngIf="isAuthenticated">
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
                  <input matInput [matDatepicker]="picker" (dateChange)="onModifyDateChange($event, element)" [value]="getModifyDate(element.id)">
                  <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
                  <mat-datepicker #picker></mat-datepicker>
                </mat-form-field>

                <div class="hours-grid-container" *ngIf="getModifyUiSlots(element.id).length > 0">
                  <label class="grid-label">Créneaux horaires:</label>
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
                   Veuillez sélectionner une date.
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
      <div class="mobile-only" *ngIf="isAuthenticated">
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
                  <input matInput [matDatepicker]="mobilePicker" (dateChange)="onModifyDateChange($event, element)" [value]="getModifyDate(element.id)">
                  <mat-datepicker-toggle matIconSuffix [for]="mobilePicker"></mat-datepicker-toggle>
                  <mat-datepicker #mobilePicker></mat-datepicker>
                </mat-form-field>

                <div class="hours-grid-container" *ngIf="getModifyUiSlots(element.id).length > 0">
                  <label class="grid-label">Créneaux horaires:</label>
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
                   Veuillez sélectionner une date.
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
  user: any = null;
  isAuthenticated: boolean = false;
  idForm: FormGroup;
  displayedColumns: string[] = ['date', 'time', 'service', 'barber', 'status', 'actions'];
  modifying: { [key: number]: { date: Date; slots: string[]; time?: string; uiSlots?: any[] } } = {};
  contactEmail: string = '';
  contactPhone: string = '';
  private refreshInterval: any;

  constructor(private apiService: ApiService, private snackBar: MatSnackBar, private fb: FormBuilder) {
    // Initialisation du formulaire d'identification
    this.idForm = this.fb.group({
      firstName: [''], // Optionnel, gardé pour la forme
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
          this.snackBar.open('Bienvenue !', 'Fermer', { duration: 3000 });
        },
        error: (err) => {
          console.error('Erreur lors de la récupération des rendez-vous', err);
          this.snackBar.open('Aucun rendez-vous trouvé pour ce numéro.', 'Fermer', { duration: 3000 });
        }
      });
    }
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
      error: (err: any) => {
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
    // Initialiser avec la date du jour par défaut
    const now = new Date();
    this.modifying[id] = { date: now, slots: [], uiSlots: [] };
    
    // Charger les créneaux pour aujourd'hui immédiatement
    const appt = this.appointments.find(a => a.id === id);
    if (appt) {
      this.loadModifySlots(appt, now);
    }
  }

  isModifying(id: number): boolean {
    return !!this.modifying[id];
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
      
      // 2. If same day as original appointment, add original time to free slots
      // (So user can keep same time or see it as available)
      if (dateStr === a.date) {
         const apptStartParts = a.startTime.split(':');
         const apptStartMin = parseInt(apptStartParts[0]) * 60 + parseInt(apptStartParts[1]);
         
         const apptEndParts = a.endTime.split(':');
         const apptEndMin = parseInt(apptEndParts[0]) * 60 + parseInt(apptEndParts[1]);
         
         for (let m = apptStartMin; m < apptEndMin; m += 15) {
           if (!freeSlotsInMinutes.includes(m)) {
             freeSlotsInMinutes.push(m);
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
      
      // 4. Calculate needed duration based on appointment services
      let totalDuration = 30; // Default
      if (a.services && a.services.length > 0) {
          totalDuration = a.services.reduce((acc, s) => acc + s.duration, 0);
      }
      const slotsNeeded = Math.ceil(totalDuration / 15);
      
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      const newSlotsUI: any[] = [];
      
      fullDaySlots.forEach((totalMin, index) => {
        const isPast = (dateStr === todayStr && totalMin <= (currentHour * 60 + currentMinute + 5));
        
        if (isPast) return; // Masquer les créneaux passés

        const isLastSlot = index === fullDaySlots.length - 1;
        
        let canFit = true;
        
        const effectiveSlotsNeeded = isLastSlot ? 1 : slotsNeeded;
        for (let j = 0; j < effectiveSlotsNeeded; j++) {
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
        let errorMsg = 'Erreur modification';
        if (err.error && typeof err.error === 'string') errorMsg = err.error;
        else if (err.error && err.error.message) errorMsg = err.error.message;
        else if (err.message) errorMsg = err.message;
        
        this.snackBar.open(errorMsg, 'OK', { duration: 5000 });
      }
    });
  }
}
