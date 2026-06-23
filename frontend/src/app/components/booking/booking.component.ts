import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { Router } from '@angular/router';
import { AnimationOptions, LottieComponent } from 'ngx-lottie';
import { Subscription, interval } from 'rxjs';
import { ApiService, AppointmentRequest, Barber, Service, User } from '../../services/api.service';
import { LoaderComponent } from '../loader/loader.component';

export interface SlotUI {
  time: string;
  isAvailable: boolean;
  isPast: boolean;
}

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatStepperModule,
    MatButtonModule,
    MatListModule,
    MatCardModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatSnackBarModule,
    MatIconModule,
    MatCheckboxModule,
    LottieComponent,
    LoaderComponent
  ],
  templateUrl: './booking.component.html',
  styleUrls: ['./booking.component.scss']
})
export class BookingComponent implements OnInit, OnDestroy {
  @ViewChild('stepper') stepper!: MatStepper;
  services: Service[] = [];
  barbers: Barber[] = [];
  availableSlots: string[] = [];
  allSlotsUI: SlotUI[] = [];
  isBookingSuccess = false;
  isLoading = false;
  errorMessage = '';
  minDate = new Date();
  user: User | null = null;

  bookingFormGroup: FormGroup;

  options: AnimationOptions = {
    path: 'assets/lottie/success.json',
  };

  private cdr = inject(ChangeDetectorRef);
  private slotsRefreshSub?: Subscription;

  isAdmin = false;

  get visibleSlotsUI(): SlotUI[] {
    return this.allSlotsUI.filter(slot => slot.isAvailable);
  }

  constructor(
    private _formBuilder: FormBuilder,
    private apiService: ApiService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.bookingFormGroup = this._formBuilder.group({
      servicesCtrl: [[], Validators.required],
      barberCtrl: ['', Validators.required],
      dateCtrl: [new Date(), Validators.required],
      timeCtrl: ['', Validators.required],
      useRewardCtrl: [false],
      userCtrl: this._formBuilder.group({
        name: ['', Validators.required],
        firstName: [''], // Optionnel ou retiré, mais gardé pour compatibilité backend si nécessaire
        phone: ['', [Validators.required, Validators.pattern(/^[0-9]{8,}$/)]]
      })
    });
  }

  ngOnInit() {
    // Check if user is admin
    const token = sessionStorage.getItem('token');
    if (token) {
      this.apiService.getCurrentUser().subscribe({
        next: (user) => {
          this.isAdmin = user?.role === 'ADMIN';
        },
        error: () => {
          this.isAdmin = false;
        }
      });
    } else {
      this.isAdmin = false;
    }

    this.apiService.getServices().subscribe(data => {
      this.services = data;
    });
    this.apiService.getBarbers().subscribe(data => this.barbers = data);

    // Refresh slots when services change
    this.bookingFormGroup.get('servicesCtrl')?.valueChanges.subscribe(() => {
      this.fetchSlots();
    });

    // Load user from session storage
    const userJson = sessionStorage.getItem('user');
    if (userJson) {
      this.user = JSON.parse(userJson);
      if (this.user) {
        this.bookingFormGroup.get('userCtrl')?.patchValue({
          name: this.user.name,
          phone: this.user.phone
        });
      }
    }

    this.slotsRefreshSub = interval(10000).subscribe(() => {
      this.fetchSlots();
    });
  }

  ngOnDestroy() {
    this.slotsRefreshSub?.unsubscribe();
  }

  get canApplyReward(): boolean {
    if (!this.user || (this.user.availableRewards || 0) <= 0) return false;
    const selected = this.bookingFormGroup.get('servicesCtrl')?.value as Service[];
    return !!selected && selected.length > 0;
  }

  get totalSelectedPrice(): number {
    const selected = this.bookingFormGroup.get('servicesCtrl')?.value as Service[];
    if (!selected || !selected.length) return 0;
    
    let total = 0;
    const useReward = this.bookingFormGroup.get('useRewardCtrl')?.value && this.canApplyReward;

    if (useReward) {
      selected.forEach(s => {
        if (s.name.toLowerCase().includes('masque noir')) {
          // Free
          total += 0;
        } else {
          // 50% off
          total += (s.price * 0.5);
        }
      });
    } else {
      total = selected.reduce((acc, s) => acc + s.price, 0);
    }
    
    return total;
  }

  get totalSelectedDuration(): number {
    const selected = this.bookingFormGroup.get('servicesCtrl')?.value as Service[];
    if (!selected || !selected.length) return 0;
    const barber = this.bookingFormGroup.get('barberCtrl')?.value as Barber;
    return this.totalDurationForBarber(selected, barber?.name);
  }

  updateValidators() {
    const timeCtrl = this.bookingFormGroup.get('timeCtrl');
    
    if (this.isAdmin) {
      timeCtrl?.clearValidators();
    } else {
      timeCtrl?.setValidators([Validators.required]);
    }
    timeCtrl?.updateValueAndValidity();
  }

  onDateChange() {
    this.updateValidators();
    this.fetchSlots();
  }
  
  onBarberChange() {
      const selectedServices = (this.bookingFormGroup.get('servicesCtrl')?.value as Service[]) || [];
      const allowedServices = selectedServices.filter(service => !this.isServiceDisabledForSelectedBarber(service));

      if (allowedServices.length !== selectedServices.length) {
        this.bookingFormGroup.patchValue({
          servicesCtrl: allowedServices,
          timeCtrl: ''
        });
      }

      this.fetchSlots();
  }

  onServicesChange() {
    // Force la validation et détecte les changements immédiatement pour Angular
    const ctrl = this.bookingFormGroup.get('servicesCtrl');
    if (ctrl) {
      ctrl.markAsDirty();
      ctrl.markAsTouched();
      ctrl.updateValueAndValidity();
      // Forcer la détection de changement pour que le bouton [disabled] se mette à jour
      this.cdr.detectChanges();
    }
  }

  onStepChange(event: any) {
    // Scroll fluide vers le haut du formulaire avec un léger délai pour laisser le stepper finir sa transition
    /*
    setTimeout(() => {
      const bookingElement = document.getElementById('booking');
      if (bookingElement) {
        const headerOffset = 80; 
        const elementPosition = bookingElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }, 50);
    */

    // Si on arrive à l'étape de confirmation (index 4)
    if (event.selectedIndex === 4) {
      this.validateSlotAvailability();
    }
  }

  validateSlotAvailability() {
    const barber = this.bookingFormGroup.get('barberCtrl')?.value;
    const date = this.bookingFormGroup.get('dateCtrl')?.value;
    const selectedTime = this.bookingFormGroup.get('timeCtrl')?.value;
    const selectedServices = this.bookingFormGroup.get('servicesCtrl')?.value as Service[];

    if (barber && date && selectedTime && selectedServices && selectedServices.length > 0) {
      const dateStr = this.formatDateLocal(date);
      const totalDuration = this.totalDurationForBarber(selectedServices, barber?.name);
      const slotsNeeded = Math.ceil(totalDuration / 15);

      this.apiService.getAvailableSlots(barber.id, dateStr).subscribe(slots => {
        // Convertir les slots reçus en minutes pour une comparaison fiable
        const slotsInMinutes = slots.map(s => {
          if (Array.isArray(s)) return s[0] * 60 + s[1];
          if (typeof s === 'string') {
            const cleanTime = s.split(':');
            return parseInt(cleanTime[0], 10) * 60 + parseInt(cleanTime[1], 10);
          }
          return 0;
        });

        // Convertir le créneau sélectionné en minutes
        const [h, m] = selectedTime.split(':').map(Number);
        const startMinutes = h * 60 + m;

        // Vérifier si TOUS les créneaux nécessaires sont encore disponibles
        let isStillAvailable = true;
        for (let j = 0; j < slotsNeeded; j++) {
          const targetMinutes = startMinutes + (j * 15);
          if (!slotsInMinutes.includes(targetMinutes)) {
            isStillAvailable = false;
            break;
          }
        }
        
        if (!isStillAvailable) {
          this.snackBar.open('Désolé, ce créneau n\'est plus disponible (durée insuffisante ou déjà réservé). Veuillez en choisir un autre.', 'OK', { duration: 5000 });
          this.stepper.selectedIndex = 2;
          this.fetchSlots();
        }
      });
    }
  }

  fetchSlots() {
    const barber = this.bookingFormGroup.get('barberCtrl')?.value;
    const date = this.bookingFormGroup.get('dateCtrl')?.value;
    const selectedServices = this.bookingFormGroup.get('servicesCtrl')?.value as Service[];

    if (barber && date && selectedServices && selectedServices.length > 0) {
      const dateStr = this.formatDateLocal(date);
      const totalDuration = this.totalDurationForBarber(selectedServices, barber?.name);

      this.apiService.getAvailableSlots(barber.id, dateStr).subscribe(slots => {
        const now = new Date();
        const todayStr = this.formatDateLocal(now);
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        // 1. Définir la plage horaire complète
        const dayOfWeek = (date instanceof Date) ? date.getDay() : new Date(date).getDay();
        const isMonday = dayOfWeek === 1;

        let startHour = 10;
        let startMinute = 30;
        let endHour = 21;

        // Horaires spécifiques barbiers
        const name = barber.name.toLowerCase();
        if (isMonday) {
          startHour = 12;
          startMinute = 0;
          endHour = 18;
        } else if (name.includes("hamouda")) {
          startHour = 12;
          startMinute = 0;
        }

        const [y, mMonth, day] = dateStr.split('-').map(Number);
        const isMarch2026 = y === 2026 && mMonth === 3;
        const isRamadan = (dateStr >= '2026-02-19' && dateStr <= '2026-03-20');

        const forceOpenFrom10 = isMarch2026 && day >= 17 && day <= 20;
        const forceOpenFrom12 = isMarch2026 && day >= 11 && day <= 16;
        const forceLateEvening = isMarch2026 && day >= 17 && day <= 19; // Modifié pour s'arrêter le 19
        const nightTo3 = isMarch2026 && (day === 18 || day === 19);
        const nightTo6 = isMarch2026 && (day === 20 || day === 21); // Le 19 au soir vers le 20 matin, et le 20 au soir vers le 21 matin
        const march11To15EarlyClose = isMarch2026 && day >= 11 && day <= 15;

        // NOUVELLES RÈGLE SPÉCIALES MARS 2026
        const isClosedForClient = isMarch2026 && (day === 23); // Retiré le 21 car matin ouvert et après-midi normal
        const isMarch20ClientWindow = isMarch2026 && day === 20;
        const isMarch21ClientMorning = isMarch2026 && day === 21;
        const isMarch22 = isMarch2026 && day === 22;
        const isMarch16 = isMarch2026 && day === 16;
        
        const slotsSet = new Set<number>();

        if (isClosedForClient && !this.isAdmin) {
          this.allSlotsUI = [];
          this.availableSlots = [];
          return;
        }

        if (isMarch20ClientWindow && !this.isAdmin) {
           // Le 20 mars pour le client : UNIQUEMENT 00h00 à 06h00
           for (let min = 0; min <= 360; min += 15) {
             slotsSet.add(min);
           }
        } else {
           // Comportement pour Admin ou pour Client (hors fenêtre spéciale 20 mars)
           if (!isMonday && forceOpenFrom10) {
             startHour = 10;
           } else if (!isMonday && forceOpenFrom12) {
             startHour = 12;
           }

           if (!isMonday && (forceLateEvening || isMarch16)) {
             endHour = 24;
           } else if (!isMonday && isRamadan && !isMarch22 && !isClosedForClient) {
             endHour = 22;
           }

           if (this.isAdmin && isMarch2026 && day <= 19) {
              // Admin 24h/24 jusqu'au 19 mars inclus
              for (let min = 0; min < 1440; min += 15) {
                slotsSet.add(min);
              }
           } else {
              // Créneaux de nuit standards ou Ramadan
              if (nightTo3) {
                for (let min = 0; min <= 180; min += 15) {
                  slotsSet.add(min);
                }
              }

              if (nightTo6 && (day === 20 || day === 21)) {
                for (let min = 0; min <= 360; min += 15) {
                  slotsSet.add(min);
                }
              }

              // Plage horaire standard
              for (let h = startHour; h < endHour; h++) {
                if (!nightTo3 && !nightTo6 && h >= 1 && h < 10) continue;
                if ((nightTo3 || nightTo6) && h >= (nightTo6 ? 7 : 4) && h < 10) continue;

                for (let m = 0; m < 60; m += 15) {
                  if (h === startHour && m < startMinute) continue;
                  const totalMin = h * 60 + m;
                  if (march11To15EarlyClose && totalMin > 1290 && totalMin < 1440) continue;
                  slotsSet.add(totalMin);
                }
              }
           }
        }

        const fullDaySlots = Array.from(slotsSet).sort((a, b) => a - b);

        // Convertir les slots reçus du backend (libres) en minutes
        const freeSlotsInMinutes = slots.map(s => {
          if (Array.isArray(s)) return s[0] * 60 + s[1];
          const cleanTime = s.split(':');
          return parseInt(cleanTime[0], 10) * 60 + parseInt(cleanTime[1], 10);
        });

        // Calculer combien de créneaux de 15 min sont nécessaires
        const slotsNeeded = Math.ceil(totalDuration / 15) || 1; // Au moins 1 slot
              const newSlotsUI: SlotUI[] = [];

        fullDaySlots.forEach((totalMin, index) => {
          const isPast = (dateStr === todayStr && totalMin <= (currentHour * 60 + currentMinute + 5));
          
          if (isPast) return; // Masquer les créneaux passés

          let canFit = true;
          
          // Un créneau doit être dans la liste des créneaux libres du backend
          if (!freeSlotsInMinutes.includes(totalMin)) {
            canFit = false;
          } else {
            // Vérifier si toute la durée du service rentre
            // Si duration = 45 min, on vérifie totalMin, totalMin+15, totalMin+30
            const needed = Math.ceil(totalDuration / 15) || 1;
            if (needed > 1) {
              for (let j = 1; j < needed; j++) {
                const targetMinutes = totalMin + (j * 15);
                if (!freeSlotsInMinutes.includes(targetMinutes)) {
                  canFit = false;
                  break;
                }
              }
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
        // On garde availableSlots pour la compatibilité avec le reste du code
        this.availableSlots = newSlotsUI.filter(s => s.isAvailable).map(s => s.time);
      });
    } else {
      this.allSlotsUI = [];
      this.availableSlots = [];
    }
  }

  selectSlot(slot: string) {
      this.bookingFormGroup.patchValue({ timeCtrl: slot });
  }

  book() {
    if (this.bookingFormGroup.invalid) {
      this.bookingFormGroup.markAllAsTouched();
      this.snackBar.open('Veuillez remplir tous les champs obligatoires.', 'Fermer', { duration: 3000 });
      return;
    }

    const formValue = this.bookingFormGroup.value;
    
    // Determine time
    let time = formValue.timeCtrl;
    const timeStr = time.length === 5 ? time + ':00' : time;

    const request: AppointmentRequest = {
      serviceIds: formValue.servicesCtrl.map((s: Service) => s.id),
      barberId: formValue.barberCtrl.id,
      date: this.formatDateLocal(formValue.dateCtrl),
      startTime: timeStr,
      userName: formValue.userCtrl.name,
      userFirstName: formValue.userCtrl.firstName,
      userPhone: formValue.userCtrl.phone,
      useReward: formValue.useRewardCtrl
    };

    this.isLoading = true;
    this.apiService.bookAppointment(request).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.apiService.notifyAppointmentBooked(res);
        try {
          localStorage.setItem('lastUserPhone', request.userPhone || '');
        } catch {}
        this.snackBar.open('Rendez-vous confirmé !', 'OK', { duration: 3000 });
        
        // Update user rewards in session storage if used
        if (request.useReward && this.user) {
          this.user.availableRewards = (this.user.availableRewards || 0) - 1;
          this.user.usedRewards = (this.user.usedRewards || 0) + 1;
          sessionStorage.setItem('user', JSON.stringify(this.user));
        }

        this.isBookingSuccess = true;
        this.cdr.detectChanges();
        setTimeout(() => {
          // Refresh the page completely to allow the next customer to start fresh
          window.location.href = '/'; 
        }, 3000);
      },
      error: (err) => {
        this.isLoading = false;
        this.snackBar.open(err.error?.message || 'Erreur lors de la réservation', 'Fermer', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
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

  private serviceDurationForBarber(service: Service, barberName?: string): number {
    const name = (barberName || '').toLowerCase();
    if (name === 'islem') {
      const serviceName = (service?.name || '').toLowerCase();
      if (serviceName === 'coupe') return 75;
      if (serviceName === 'coupe + barbe dégradé + fixation') return 90;
    }
    return service?.duration || 0;
  }

  private totalDurationForBarber(services: Service[], barberName?: string): number {
    return (services || []).reduce((acc, s) => acc + this.serviceDurationForBarber(s, barberName), 0);
  }

  isServiceDisabledForSelectedBarber(service: Service): boolean {
    const barber = this.bookingFormGroup.get('barberCtrl')?.value as Barber;
    const barberName = (barber?.name || '').toLowerCase();
    const serviceName = (service?.name || '').toLowerCase();
    const isRestrictedService = serviceName === 'coupe + barbe + brushing';
    const isRestrictedBarber = barberName === 'aladin' || barberName === 'islem';
    return isRestrictedService && isRestrictedBarber;
  }
}
