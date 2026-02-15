import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, ViewChild, inject } from '@angular/core';
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
export class BookingComponent implements OnInit {
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
  }

  get canApplyReward(): boolean {
    if (!this.user || (this.user.availableRewards || 0) <= 0) return false;
    
    const selected = this.bookingFormGroup.get('servicesCtrl')?.value as Service[];
    if (!selected || !selected.length) return false;
    
    const hasCoupe = selected.some(s => s.name.toLowerCase().includes('coupe'));
    const hasBarbe = selected.some(s => s.name.toLowerCase().includes('barbe'));
    
    return hasCoupe && hasBarbe;
  }

  get totalSelectedPrice(): number {
    const selected = this.bookingFormGroup.get('servicesCtrl')?.value as Service[];
    if (!selected || !selected.length) return 0;
    
    let total = selected.reduce((acc, s) => acc + s.price, 0);
    
    if (this.bookingFormGroup.get('useRewardCtrl')?.value && this.canApplyReward) {
      // Find the services to discount. Priority: "Coupe + Barbe" pack, or individual "Coupe" and "Barbe"
      const pack = selected.find(s => s.name.toLowerCase().includes('coupe') && s.name.toLowerCase().includes('barbe'));
      
      if (pack) {
        total -= pack.price;
      } else {
        const coupe = selected.find(s => s.name.toLowerCase().includes('coupe'));
        const barbe = selected.find(s => s.name.toLowerCase().includes('barbe'));
        if (coupe && barbe) {
          total -= (coupe.price + barbe.price);
        }
      }
    }
    
    return total;
  }

  onDateChange() {
    this.fetchSlots();
  }
  
  onBarberChange() {
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
      const totalDuration = selectedServices.reduce((acc, s) => acc + s.duration, 0);
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
      const totalDuration = selectedServices.reduce((acc, s) => acc + s.duration, 0);

      this.apiService.getAvailableSlots(barber.id, dateStr).subscribe(slots => {
        const now = new Date();
        const todayStr = this.formatDateLocal(now);
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        // 1. Définir la plage horaire complète (ex: 10h - 21h par tranches de 15min)
        // Note: Le backend renvoie déjà la liste de tous les créneaux théoriques possibles pour ce jour
        // (y compris ceux déjà réservés, car on en a besoin pour savoir s'ils sont rouges)
        // Mais attendez, le backend actuel ne renvoie QUE les libres.
        // On va générer tous les créneaux de la journée basés sur les horaires du salon.
        
        const dayOfWeek = date.getDay(); // 0=Dim, 1=Lun, ...
        let startHour = 10;
        let endHour = 21;

        // Horaires spécifiques barbiers
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
                // Exception pour le dernier créneau : dépassement autorisé de 5-10 min
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
    if (this.bookingFormGroup.valid) {
      const formValue = this.bookingFormGroup.value;
      const request: AppointmentRequest = {
        serviceIds: formValue.servicesCtrl.map((s: Service) => s.id),
        barberId: formValue.barberCtrl.id,
        date: this.formatDateLocal(formValue.dateCtrl),
        startTime: formValue.timeCtrl,
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
          setTimeout(() => {
            // Refresh the page completely to allow the next customer to start fresh
            window.location.href = '/'; 
          }, 3000);
        },
        error: (err) => {
          this.isLoading = false;
          this.snackBar.open('Erreur lors de la réservation: ' + err.message, 'OK', { duration: 3500 });
        }
      });
    }
  }

  private formatDateLocal(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
