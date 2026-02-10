import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { Subscription } from 'rxjs';
import { ApiService, Appointment, Barber, BlockedSlot, Service } from '../../services/api.service';

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
  allAvailableHours: string[] = [
    "09:00:00", "09:30:00", "10:00:00", "10:30:00", "11:00:00", "11:30:00",
    "12:00:00", "12:30:00", "13:00:00", "13:30:00", "14:00:00", "14:30:00",
    "15:00:00", "15:30:00", "16:00:00", "16:30:00", "17:00:00", "17:30:00",
    "18:00:00", "18:30:00", "19:00:00", "19:30:00"
  ];
  activeTab: 'manual' | 'block' = 'manual';
  hasNew = false;
  isPushEnabled = false;
  selectedBarberForPush: number | null = null;
  readonly VAPID_PUBLIC_KEY = "BP07gvsy0ylgW-4T7ch1FOGdTUfPSKKOmsTOzA-ybaHq54q7zovWbzOynSUVQY_7nAg7WAFMS_WfSrgT_yoW2S4";

  private sub?: Subscription;

  constructor(
    private api: ApiService, 
    private fb: FormBuilder, 
    private router: Router,
    private swPush: SwPush,
    private snackBar: MatSnackBar
  ) {
    this.lockForm = this.fb.group({
      barber: [null, Validators.required],
      services: [[]],
      date: [new Date(), Validators.required],
      time: [null, Validators.required],
      name: [''],
      phone: ['']
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

    this.generateAvailableHours();
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

    // Mettre à jour les réservations quand la date du filtre change
    this.filterForm.get('date')?.valueChanges.subscribe(() => {
      this.applyFilters();
    });

    // Check push status
    this.checkPushStatus();

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
          this.snackBar.open('Erreur: ' + err.message, 'Fermer', { duration: 3000 });
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
    
    if (!barber || !date) {
      this.availableHours = [];
      return;
    }
    
    const dateStr = this.formatDateLocal(new Date(date));
    this.api.getAvailableSlots(barber.id, dateStr).subscribe(slots => {
      // Filtrer les créneaux déjà réservés par des clients
      // On compare avec la liste des rendez-vous actuelle (this.appointments)
      // car getAvailableSlots du backend ne prend peut-être pas en compte les rendez-vous "BOOKED" 
      // si c'est une simple vérification de blocage admin.
      // Cependant, le backend getAvailableSlots est censé retourner uniquement les vrais créneaux libres.
      // Par sécurité, on s'assure que le créneau n'est pas dans nos rendez-vous actifs.
      
      const reservedSlots = this.appointments
        .filter(a => 
          a.barber?.id === barber.id && 
          a.date === dateStr && 
          (a.status === 'BOOKED' || a.status === 'MODIFIED' || a.status === 'DONE')
        )
        .map(a => a.startTime.substring(0, 5));

      this.availableHours = slots.filter(s => !reservedSlots.includes(s.substring(0, 5)));
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
      this.hasNew = list.some(a => (a.status === 'BOOKED' || a.status === 'MODIFIED') && !a.adminViewed);
    });
  }

  lockSlot() {
    if (this.lockForm.valid) {
      const barberId = this.lockForm.value.barber.id;
      const dateStr = this.formatDateLocal(this.lockForm.value.date as Date);
      const timeStr = this.lockForm.value.time;
      const name = this.lockForm.value.name;
      const phone = this.lockForm.value.phone;
      const serviceIds = (this.lockForm.value.services || []).map((s: Service) => s.id);

      this.api.lockSlot(barberId, dateStr, timeStr, name, phone, serviceIds).subscribe({
        next: () => {
          this.applyFilters(); // Re-charger la liste filtrée
          this.generateAvailableHours(); // Re-charger les créneaux libres
          this.lockForm.patchValue({ name: '', phone: '', time: null, services: [] });
          alert('Opération réussie');
        },
        error: (err) => alert('Erreur: ' + err.message)
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
          this.hasNew = this.appointments.some(x => (x.status === 'BOOKED' || x.status === 'MODIFIED') && !x.adminViewed);
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
      this.hasNew = list.some(a => (a.status === 'BOOKED' || a.status === 'MODIFIED') && !a.adminViewed);
    });
  }

  clearFilters() {
    this.filterForm.reset({ barberId: null, date: null, status: null, q: '', sort: 'date,startTime' });
    this.loadAppointments();
  }
}
