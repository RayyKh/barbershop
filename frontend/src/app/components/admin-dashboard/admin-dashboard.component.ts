import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { interval, Subscription } from 'rxjs';
import { AdminMessage, ApiService, Appointment, Barber, BlockedSlot, Service, User } from '../../services/api.service';
import { EditAppointmentDialogComponent } from '../edit-appointment-dialog/edit-appointment-dialog.component';

export interface SlotUI {
  time: string;
  isAvailable: boolean;
  isPast: boolean;
}

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
    MatChipsModule,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
    RouterLink
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  appointments: Appointment[] = [];
  barbers: Barber[] = [];
  services: Service[] = [];
  blockedSlots: BlockedSlot[] = [];
  lockForm: FormGroup;
  filterForm: FormGroup;
  adminBlockForm: FormGroup;
  availableHours: string[] = [];
  allSlotsUI: SlotUI[] = [];
  allAvailableHours: string[] = []; // Sera généré dynamiquement
  activeTab: 'manual' | 'block' = 'manual';
  hasNew = false;
  isPushEnabled = false;
  selectedBarberForPush: number | null = null;
  
  currentUser: User | null = null;

  // Chat properties
  chatMessages: AdminMessage[] = [];
  newMessageContent: string = '';
  chatExpanded: boolean = false;
  chatRefreshSub?: Subscription;
  selectedChatIdentity: string = '';
  availableIdentities: string[] = ['Aladin', 'Hamouda', 'Ahmed', 'Admin'];

  readonly VAPID_PUBLIC_KEY = "BP07gvsy0ylgW-4T7ch1FOGdTUfPSKKOmsTOzA-ybaHq54q7zovWbzOynSUVQY_7nAg7WAFMS_WfSrgT_yoW2S4";

  private sub?: Subscription;
  private refreshSub?: Subscription;

  constructor(
    private api: ApiService, 
    private fb: FormBuilder, 
    private router: Router,
    private swPush: SwPush,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.lockForm = this.fb.group({
      barber: [null, Validators.required],
      services: [[]],
      date: [new Date(), Validators.required],
      time: [null, Validators.required],
      firstName: [''], // Gardé pour compatibilité mais non affiché
      name: [''],
      phone: ['', [Validators.pattern(/^[0-9]{8,}$/)]]
    });
    this.filterForm = this.fb.group({
      barberId: [null],
      date: [new Date()], // Aujourd'hui par défaut
      status: [null],
      q: [''],
      sort: ['date,startTime']
    });
    this.adminBlockForm = this.fb.group({
      barberId: [null],
      date: [new Date(), Validators.required],
      startTime: [null], // null means whole day
      endTime: [{ value: null, disabled: true }],
      reason: ['']
    });
    
    // Get current user from session storage
    const userStr = sessionStorage.getItem('user');
    if (userStr) {
      this.currentUser = JSON.parse(userStr);
    }

    this.generateAllHours();
    this.generateAvailableHours();
  }

  generateAllHours() {
    // Génère les heures de 10h00 à 22h00 par pas de 15 minutes
    this.allAvailableHours = [];
    const startHour = 10;
    const endHour = 22;
    
    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += 15) {
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
        this.allAvailableHours.push(time);
      }
    }
    // Ajouter 22:00:00 comme dernière heure possible de fin (ou de début si on veut)
    this.allAvailableHours.push("22:00:00");
  }

  ngOnInit(): void {

    this.api.getServices().subscribe(s => this.services = s);
    this.api.getBarbers().subscribe(b => { 
      this.barbers = b; 
      // Sélectionner le premier barbier par défaut si disponible
      if (this.barbers.length > 0) {
        this.lockForm.patchValue({ barber: this.barbers[0] });
      }
    });
    this.applyFilters(); // Utiliser applyFilters au lieu de loadAppointments pour respecter la date par défaut
    this.loadBlockedSlots();
    
    // Update hours when date changes
    this.lockForm.get('date')?.valueChanges.subscribe(() => {
      this.generateAvailableHours();
    });

    // Update hours when barber changes
    this.lockForm.get('barber')?.valueChanges.subscribe(() => {
      this.generateAvailableHours();
    });

    // Update hours when services change
    this.lockForm.get('services')?.valueChanges.subscribe(() => {
      this.generateAvailableHours();
    });

    // Mettre à jour les réservations quand la date du filtre change
    this.filterForm.get('date')?.valueChanges.subscribe(() => {
      this.applyFilters();
    });

    // Check push status
    this.checkPushStatus();

    // Auto-refresh slots every minute to handle past slots
    this.refreshSub = interval(60000).subscribe(() => {
      this.generateAvailableHours();
    });

    // Listen to changes from central ApiService (SSE or local)
    this.sub = this.api.appointmentsChanged$.subscribe(() => {
      this.applyFilters(); // Re-appliquer les filtres lors d'un changement
      this.generateAvailableHours(); // Mettre à jour les créneaux disponibles pour le verrouillage
    });

    this.api.blockedSlotsChanged$.subscribe(() => {
      this.loadBlockedSlots();
    });

    // Handle enable/disable of endTime based on startTime
    this.adminBlockForm.get('startTime')?.valueChanges.subscribe(val => {
      const endTimeCtrl = this.adminBlockForm.get('endTime');
      if (val) {
        endTimeCtrl?.enable();
      } else {
        endTimeCtrl?.setValue(null);
        endTimeCtrl?.disable();
      }
    });

    // Chat Init
    const savedIdentity = localStorage.getItem('chatIdentity');
    if (savedIdentity) {
      this.selectedChatIdentity = savedIdentity;
    }

    this.loadChatMessages();
    this.chatRefreshSub = interval(3000).subscribe(() => {
      if (this.chatExpanded) {
        this.loadChatMessages();
      }
    });
  }

  loadChatMessages() {
    this.api.getAdminMessages().subscribe(msgs => {
      this.chatMessages = msgs;
      // Scroll to bottom logic if needed
      if (this.chatExpanded) {
        setTimeout(() => this.scrollToBottom(), 100);
      }
    });
  }

  sendChatMessage() {
    if (!this.newMessageContent.trim() || !this.currentUser || !this.currentUser.id) return;
    
    // Si l'identité n'est pas encore choisie, on ne peut pas envoyer
    if (!this.selectedChatIdentity) return;

    this.api.sendAdminMessage(
      this.newMessageContent, 
      this.currentUser.id, 
      this.selectedChatIdentity
    ).subscribe(msg => {
      this.chatMessages.push(msg);
      this.newMessageContent = '';
      setTimeout(() => this.scrollToBottom(), 100);
    });
  }

  selectIdentity(name: string) {
    this.selectedChatIdentity = name;
    localStorage.setItem('chatIdentity', name);
  }

  toggleChat() {
    this.chatExpanded = !this.chatExpanded;
    if (this.chatExpanded) {
      this.loadChatMessages();
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  scrollToBottom(): void {
    try {
      const chatContainer = document.getElementById('chat-messages-container');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    } catch(err) { }
  }

  loadBlockedSlots() {
    this.api.getBlockedSlots().subscribe(slots => {
      this.blockedSlots = slots;
    });
  }

  addAdminBlock() {
    if (this.adminBlockForm.valid) {
      const val = this.adminBlockForm.value;
      const dateStr = this.formatDateLocal(val.date as Date);
      this.api.blockSlot(dateStr, val.startTime, val.endTime, val.barberId, val.reason).subscribe({
        next: () => {
          this.snackBar.open('Blocage ajouté avec succès', 'OK', { duration: 3000 });
          this.adminBlockForm.reset({ date: new Date(), barberId: null, startTime: null, endTime: null, reason: '' });
        },
        error: (err) => {
          let errorMsg = 'Erreur lors du blocage';
          if (err.error && typeof err.error === 'string') {
            errorMsg = err.error;
          } else if (err.error && err.error.message) {
            errorMsg = err.error.message;
          } else if (err.message) {
            errorMsg = err.message;
          }
          this.snackBar.open(errorMsg, 'Fermer', { duration: 5000 });
        }
      });
    }
  }

  deleteBlockedSlot(id: number) {
    if (confirm('Voulez-vous supprimer ce blocage ?')) {
      this.api.deleteBlockedSlot(id).subscribe({
        next: () => {
          this.snackBar.open('Blocage supprimé', 'OK', { duration: 3000 });
        },
        error: (err) => {
          this.snackBar.open('Erreur: ' + err.message, 'Fermer', { duration: 3000 });
        }
      });
    }
  }

  generateAvailableHours() {
    const barber = this.lockForm.get('barber')?.value;
    const date = this.lockForm.get('date')?.value;
    const selectedServices = this.lockForm.get('services')?.value as Service[];
    
    if (!barber || !date) {
      this.allSlotsUI = [];
      this.availableHours = [];
      return;
    }
    
    const dateStr = this.formatDateLocal(new Date(date));
    const totalDuration = selectedServices && selectedServices.length > 0 
      ? selectedServices.reduce((acc, s) => acc + s.duration, 0)
      : 30; // Durée par défaut si aucun service sélectionné

    this.api.getAvailableSlots(barber.id, dateStr).subscribe(slots => {
      const now = new Date();
      const todayStr = this.formatDateLocal(now);
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Logique de génération des créneaux de 15 min identique au client
      const dayOfWeek = new Date(date).getDay();
      let startHour = 10;
      let endHour = 21;

      const name = barber.name.toLowerCase();
      if (dayOfWeek === 1) { // Lundi
        startHour = 12;
        endHour = 18;
      } else {
        if (name.includes("hamouda")) startHour = 12;
        else if (name.includes("ahmed")) startHour = 11;
        else startHour = 10;
      }

      const fullDaySlots: number[] = [];
      for (let h = startHour; h < endHour; h++) {
        for (let m = 0; m < 60; m += 15) {
          fullDaySlots.push(h * 60 + m);
        }
      }

      // Convertir les slots reçus du backend (libres) en minutes
      const freeSlotsInMinutes = slots.map(s => {
        if (Array.isArray(s)) return s[0] * 60 + s[1];
        const cleanTime = s.split(':');
        return parseInt(cleanTime[0], 10) * 60 + parseInt(cleanTime[1], 10);
      });

      const slotsNeeded = Math.ceil(totalDuration / 15);
      const newSlotsUI: SlotUI[] = [];

      fullDaySlots.forEach((totalMin, index) => {
        const isPast = (dateStr === todayStr && totalMin <= (currentHour * 60 + currentMinute + 5));
        
        if (isPast) return; // Masquer les créneaux passés

        const isLastSlot = index === fullDaySlots.length - 1;
        
        let canFit = true;
        
        // Vérifier si toute la durée du service rentre
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
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        newSlotsUI.push({
          time: timeStr,
          isAvailable: canFit,
          isPast: isPast
        });
      });

      this.allSlotsUI = newSlotsUI;
      this.availableHours = newSlotsUI.filter(s => s.isAvailable).map(s => s.time);
      
      // Reset selected time if it's no longer available
      const currentTime = this.lockForm.get('time')?.value;
      if (currentTime && !this.availableHours.includes(currentTime)) {
        this.lockForm.patchValue({ time: null });
      }
    });
  }

  checkPushStatus() {
    this.swPush.subscription.subscribe(sub => {
      this.isPushEnabled = !!sub;
    });
  }

  togglePush() {
    if (this.isPushEnabled) {
      this.unsubscribeFromPush();
    } else {
      this.subscribeToPush();
    }
  }

  subscribeToPush() {
    // Vérification du contexte sécurisé (HTTPS)
    if (!window.isSecureContext) {
      this.snackBar.open('Les notifications Push nécessitent impérativement HTTPS sur mobile. HTTP n\'est pas supporté par les navigateurs pour cette fonctionnalité.', 'Compris', { duration: 10000 });
      console.error('Push notifications are only available in secure contexts (HTTPS).');
      return;
    }

    if (!this.swPush.isEnabled) {
      this.snackBar.open('Le Service Worker n\'est pas activé ou n\'est pas supporté par ce navigateur.', 'Fermer', { duration: 5000 });
      return;
    }

    this.swPush.requestSubscription({
      serverPublicKey: this.VAPID_PUBLIC_KEY
    })
      .then(sub => {
        console.log('Push Subscription Object:', sub);
        // Conversion explicite en JSON pour s'assurer que l'objet est sérialisable
        const subscriptionJson = sub.toJSON();
        console.log('Push Subscription JSON:', subscriptionJson);
        
        this.api.subscribeToPush(subscriptionJson, this.selectedBarberForPush || undefined).subscribe({
          next: () => {
            console.log('Successfully subscribed to push on backend');
            this.isPushEnabled = true;
            const barberName = this.selectedBarberForPush 
              ? this.barbers.find(b => b.id === this.selectedBarberForPush)?.name 
              : 'Tous les barbiers';
            this.snackBar.open(`Notifications activées pour: ${barberName}`, 'OK', { duration: 3000 });
          },
          error: (err) => {
            console.error('Backend subscription error:', err);
            let msg = 'Erreur lors de l\'activation des notifications.';
            if (err.status === 401) msg = 'Erreur d\'authentification (401).';
            if (err.status === 404) msg = 'Route non trouvée (404).';
            this.snackBar.open(msg, 'Fermer', { duration: 5000 });
          }
        });
      })
      .catch(err => {
        console.error('Browser Push Request Error:', err);
        let msg = 'Permission de notification refusée ou non supportée.';
        if (err.message) msg += ' Détails: ' + err.message;
        this.snackBar.open(msg, 'Fermer', { duration: 7000 });
      });
  }

  unsubscribeFromPush() {
    this.swPush.subscription.subscribe(sub => {
      if (sub) {
        this.api.unsubscribeFromPush(sub.endpoint).subscribe({
          next: () => {
            sub.unsubscribe().then(() => {
              this.isPushEnabled = false;
              this.snackBar.open('Notifications désactivées sur cet appareil.', 'OK', { duration: 3000 });
            });
          }
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.refreshSub?.unsubscribe();
    this.chatRefreshSub?.unsubscribe();
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
      this.hasNew = list.some(a => (a.status === 'BOOKED' || a.status === 'MODIFIED' || a.status === 'BLOCKED') && !a.adminViewed);
    });
  }

  lockSlot() {
    if (this.lockForm.valid) {
      const val = this.lockForm.value;
      const dateStr = this.formatDateLocal(val.date as Date);
      const serviceIds = val.services.map((s: any) => s.id);
      
      this.api.lockSlot(val.barber.id, dateStr, val.time, val.firstName, val.name, val.phone, serviceIds).subscribe({
        next: () => {
          this.snackBar.open('Créneau verrouillé avec succès', 'OK', { duration: 3000 });
          this.lockForm.reset({ barber: this.barbers[0], date: new Date(), services: [], time: null, firstName: '', name: '', phone: '' });
          this.applyFilters();
          this.generateAvailableHours();
        },
        error: (err) => {
          let errorMsg = 'Erreur lors du verrouillage';
          if (err.error && typeof err.error === 'string') {
            errorMsg = err.error;
          } else if (err.error && err.error.message) {
            errorMsg = err.error.message;
          } else if (err.message) {
            errorMsg = err.message;
          }
          this.snackBar.open(errorMsg, 'Fermer', { duration: 5000 });
        }
      });
    }
  }

  unlock(a: Appointment) {
    const barberId = a.barber?.id as number;
    const dateStr = a.date;
    const timeStr = a.startTime;
    this.api.unlockSlot(barberId, dateStr, timeStr).subscribe({
      next: () => {
        this.applyFilters(); // Re-charger la liste filtrée
        this.generateAvailableHours(); // Re-charger les créneaux libres
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
          this.hasNew = this.appointments.some(x => (x.status === 'BOOKED' || x.status === 'MODIFIED' || x.status === 'BLOCKED') && !x.adminViewed);
        }
      });
    }
  }

  markDone(a: Appointment) {
    this.api.updateAppointmentStatus(a.id, 'DONE').subscribe({
      next: () => {
        this.snackBar.open('Rendez-vous marqué comme terminé', 'OK', { duration: 3000 });
        this.applyFilters();
      },
      error: (err) => {
        this.snackBar.open('Erreur: ' + err.message, 'Fermer', { duration: 3000 });
      }
    });
  }

  deleteAppointment(a: Appointment) {
    if (confirm('Voulez-vous vraiment supprimer cette réservation ?')) {
      this.api.deleteAppointment(a.id).subscribe({
        next: () => {
          this.snackBar.open('Réservation supprimée', 'Fermer', { duration: 3000 });
          this.applyFilters(); // Refresh the list
        },
        error: (err) => {
          console.error('Delete failed', err);
          this.snackBar.open('Erreur lors de la suppression', 'Fermer', { duration: 3000 });
        }
      });
    }
  }

  editAppointment(a: Appointment) {
    const dialogRef = this.dialog.open(EditAppointmentDialogComponent, {
      width: '500px',
      data: { appointment: a, barbers: this.barbers, services: this.services },
      panelClass: 'gold-theme-dialog',
      position: { top: '30px' },
      maxHeight: '90vh'
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (result) {
        this.api.updateAppointment(a.id, result).subscribe({
          next: () => {
            this.snackBar.open('Rendez-vous mis à jour', 'OK', { duration: 3000 });
            this.applyFilters();
          },
          error: (err) => {
            let errorMsg = 'Erreur lors de la modification';
            if (err.error) {
              if (typeof err.error === 'string') errorMsg = err.error;
              else if (err.error.message) errorMsg = err.error.message;
            } else if (err.message) {
              errorMsg = err.message;
            }
            this.snackBar.open(errorMsg, 'Fermer', { duration: 5000 });
          }
        });
      }
    });
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
      this.hasNew = list.some(a => (a.status === 'BOOKED' || a.status === 'MODIFIED' || a.status === 'BLOCKED') && !a.adminViewed);
    });
  }

  clearFilters() {
    this.filterForm.reset({ barberId: null, date: null, status: null, q: '', sort: 'date,startTime' });
    this.loadAppointments();
  }
}
