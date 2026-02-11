import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';

export interface User {
  id?: number;
  name: string;
  firstName?: string;
  email?: string;
  phone: string;
  totalAppointments?: number;
  availableRewards?: number;
  usedRewards?: number;
  roles?: string[];
  role?: 'ADMIN' | 'CLIENT';
}

export interface Service {
  id: number;
  name: string;
  description: string;
  price: number;
  duration: number;
}

export interface Barber {
  id: number;
  name: string;
  speciality: string;
  photo: string;
  description?: string;
}

export interface Appointment {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: 'BOOKED' | 'CANCELLED' | 'DONE' | 'BLOCKED' | 'MODIFIED';
  user?: User;
  barber: Barber;
  services: Service[];
  totalPrice: number;
  adminViewed?: boolean;
  rewardApplied?: boolean;
}

export interface AppointmentRequest {
  barberId: number;
  serviceIds: number[];
  date: string;
  startTime: string;
  userName?: string;
  userFirstName?: string;
  userPhone?: string;
  userEmail?: string;
  useReward?: boolean;
}

export interface RevenueDetail {
  appointmentId: number;
  clientName: string;
  services: string;
  price: number;
  date: string;
}

export interface DailyRevenue {
  date: string;
  details: RevenueDetail[];
  totalRevenue: number;
}

export interface WeeklyRevenue {
  weekNumber: number;
  year: number;
  weekRange: string;
  details: RevenueDetail[];
  totalRevenue: number;
}

export interface RevenueReport {
  barberId: number;
  barberName: string;
  dailyRevenues: DailyRevenue[];
  weeklyRevenues: WeeklyRevenue[];
}

export interface BlockedSlot {
  id?: number;
  date: string;
  startTime?: string;
  endTime?: string;
  barber?: Barber;
  reason?: string;
}

export interface Product {
  id?: number;
  name: string;
  description: string;
  price: number;
  photo: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = `http://${window.location.hostname}:8081/api`;
  private appointmentBookedSubject = new Subject<Appointment>();
  appointmentBooked$ = this.appointmentBookedSubject.asObservable();
  
  private appointmentsChangedSubject = new Subject<void>();
  appointmentsChanged$ = this.appointmentsChangedSubject.asObservable();

  private blockedSlotsChangedSubject = new Subject<void>();
  blockedSlotsChanged$ = this.blockedSlotsChangedSubject.asObservable();

  private evtSource?: EventSource;

  constructor(private http: HttpClient) {
    this.startSseListener();
  }

  public startSseListener() {
    if (this.evtSource) {
      this.evtSource.close();
    }

    const token = sessionStorage.getItem('token');
    // The stream is restricted to ADMINs in backend
    if (!token) return;

    const url = `${this.baseUrl}/appointments/stream?token=${encodeURIComponent(token)}`;
    this.evtSource = new EventSource(url);
    
    this.evtSource.addEventListener('appointment', (event) => {
      this.appointmentsChangedSubject.next();
    });

    this.evtSource.onerror = (err) => {
      console.error('SSE Error:', err);
      this.evtSource?.close();
      // Try to reconnect after 5s if we still have a token
      if (sessionStorage.getItem('token')) {
        setTimeout(() => this.startSseListener(), 5000);
      }
    };
  }

  public stopSseListener() {
    if (this.evtSource) {
      this.evtSource.close();
      this.evtSource = undefined;
    }
  }

  // Web Push Notifications
  subscribeToPush(subscription: any, barberId?: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/notifications/subscribe`, {
      subscription,
      barberId
    });
  }

  unsubscribeFromPush(endpoint: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/notifications/unsubscribe`, endpoint);
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/auth/me`);
  }

  notifyAppointmentBooked(appt: Appointment): void {
    this.appointmentBookedSubject.next(appt);
    this.appointmentsChangedSubject.next();
  }
  getServices(): Observable<Service[]> {
    return this.http.get<Service[]>(`${this.baseUrl}/services`);
  }

  // Barbers
  getBarbers(): Observable<Barber[]> {
    return this.http.get<Barber[]>(`${this.baseUrl}/barbers`).pipe(
      map((barbers) => {
        const descriptions: { [key: string]: { specialty: string, desc: string } } = {
          'Aladin': {
            specialty: 'Barber – Expert en Détails',
            desc: 'Perfectionniste dans les moindres détails : contours, barbe, finitions et rasage. Chaque coupe est soignée jusqu’à la dernière touche.'
          },
          'Hamouda': {
            specialty: 'Barber – Style & Créativité',
            desc: 'Passionné par les tendances et la créativité. Il propose des looks uniques et modernes, avec une touche artistique qui fait la différence.'
          },
          'Ahmed': {
            specialty: 'Barber – Spécialiste Type Fade',
            desc: 'Spécialisé dans le Type Fade, ce barbier maîtrise les dégradés précis et équilibrés, parfaitement adaptés à la morphologie du visage. Idéal pour un style moderne et net.'
          }
        };

        const desiredNames = ['Aladin', 'Hamouda', 'Ahmed'];
        const transformed = barbers.slice(0);
        
        for (let i = 0; i < Math.min(desiredNames.length, transformed.length); i++) {
          const name = desiredNames[i];
          transformed[i] = {
            ...transformed[i],
            name: name,
            speciality: descriptions[name]?.specialty || transformed[i].speciality || 'Barbier',
            description: descriptions[name]?.desc || transformed[i].description,
            photo: name === 'Aladin' ? 'ala.jpeg' : `${name.toLowerCase()}.jpeg`
          };
        }
        
        if (transformed.length < desiredNames.length) {
          for (let i = transformed.length; i < desiredNames.length; i++) {
            const name = desiredNames[i];
            transformed.push({
              id: 1000 + i,
              name: name,
              speciality: descriptions[name]?.specialty || 'Barbier',
              description: descriptions[name]?.desc,
              photo: `${name.toLowerCase()}.jpeg`
            });
          }
        }
        return transformed;
      })
    );
  }

  // Appointments
  getAvailableSlots(barberId: number, date: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/appointments/available?barberId=${barberId}&date=${date}`);
  }

  bookAppointment(request: AppointmentRequest): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.baseUrl}/appointments/book`, request);
  }

  getMyAppointments(): Observable<Appointment[]> {
      return this.http.get<Appointment[]>(`${this.baseUrl}/appointments/my-appointments`);
  }

  getAppointmentsByContact(email?: string, phone?: string): Observable<Appointment[]> {
    const usp = new URLSearchParams();
    if (email) usp.set('email', email);
    if (phone) usp.set('phone', phone);
    const qs = usp.toString();
    return this.http.get<Appointment[]>(`${this.baseUrl}/appointments/by-contact${qs ? '?' + qs : ''}`);
  }

  getAllAppointments(): Observable<Appointment[]> {
      return this.http.get<Appointment[]>(`${this.baseUrl}/appointments`);
  }

  markAdminViewed(id: number): Observable<Appointment> {
    return this.http.put<Appointment>(`${this.baseUrl}/appointments/${id}/view`, {});
  }

  updateAppointmentStatus(id: number, status: string): Observable<Appointment> {
    return this.http.put<Appointment>(`${this.baseUrl}/appointments/${id}/status?status=${status}`, {});
  }

  lockSlot(barberId: number, date: string, startTime: string, firstName?: string, name?: string, phone?: string, serviceIds?: number[]): Observable<Appointment> {
    const params = new URLSearchParams({ barberId: String(barberId), date, startTime });
    if (firstName) params.set('firstName', firstName);
    if (name) params.set('name', name);
    if (phone) params.set('phone', phone);
    if (serviceIds && serviceIds.length > 0) {
      params.set('serviceIds', serviceIds.join(','));
    }
    return this.http.post<Appointment>(`${this.baseUrl}/appointments/lock?${params.toString()}`, {});
  }

  unlockSlot(barberId: number, date: string, startTime: string): Observable<Appointment> {
    const params = new URLSearchParams({ barberId: String(barberId), date, startTime });
    return this.http.delete<Appointment>(`${this.baseUrl}/appointments/lock?${params.toString()}`);
  }

  cancelAppointment(id: number): Observable<Appointment> {
    return this.http.put<Appointment>(`${this.baseUrl}/appointments/${id}/cancel`, {});
  }

  deleteAppointment(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/appointments/${id}`);
  }

  modifyAppointment(id: number, date: string, startTime: string): Observable<Appointment> {
    const params = new URLSearchParams({ date, startTime });
    return this.http.put<Appointment>(`${this.baseUrl}/appointments/${id}/modify?${params.toString()}`, {});
  }

  getNewAppointmentsCount(): Observable<number> {
    return this.http.get<number>(`${this.baseUrl}/appointments/new-count`);
  }

  getRevenueReport(barberId: number, date?: string): Observable<RevenueReport> {
    const url = date 
      ? `${this.baseUrl}/appointments/revenue-report/${barberId}?date=${date}`
      : `${this.baseUrl}/appointments/revenue-report/${barberId}`;
    return this.http.get<RevenueReport>(url);
  }

  filterAppointments(params: { barberId?: number; date?: string; status?: string; q?: string; sort?: string }): Observable<Appointment[]> {
    const usp = new URLSearchParams();
    if (params.barberId) usp.set('barberId', String(params.barberId));
    if (params.date) usp.set('date', params.date);
    if (params.status) usp.set('status', params.status);
    if (params.q) usp.set('q', params.q);
    if (params.sort) usp.set('sort', params.sort);
    const qs = usp.toString();
    return this.http.get<Appointment[]>(`${this.baseUrl}/appointments/filter${qs ? '?' + qs : ''}`);
  }

  // Blocked Slots (Admin)
  getBlockedSlots(): Observable<BlockedSlot[]> {
    return this.http.get<BlockedSlot[]>(`${this.baseUrl}/appointments/blocked`);
  }

  blockSlot(date: string, startTime?: string, endTime?: string, barberId?: number, reason?: string): Observable<BlockedSlot> {
    const params = new URLSearchParams({ date });
    if (startTime) params.set('startTime', startTime);
    if (endTime) params.set('endTime', endTime);
    if (barberId) params.set('barberId', String(barberId));
    if (reason) params.set('reason', reason);
    return this.http.post<BlockedSlot>(`${this.baseUrl}/appointments/blocked?${params.toString()}`, {}).pipe(
      map(res => {
        this.blockedSlotsChangedSubject.next();
        this.appointmentsChangedSubject.next();
        return res;
      })
    );
  }

  deleteBlockedSlot(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/appointments/blocked/${id}`).pipe(
      map(res => {
        this.blockedSlotsChangedSubject.next();
        this.appointmentsChangedSubject.next();
        return res;
      })
    );
  }

  // Products
  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.baseUrl}/products`);
  }

  getProductById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.baseUrl}/products/${id}`);
  }

  createProduct(product: Product): Observable<Product> {
    return this.http.post<Product>(`${this.baseUrl}/products`, product);
  }

  updateProduct(id: number, product: Product): Observable<Product> {
    return this.http.put<Product>(`${this.baseUrl}/products/${id}`, product);
  }

  deleteProduct(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/products/${id}`);
  }

  // Auth
  login(credentials: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/signin`, credentials).pipe(
      map((res: any) => {
        // Save token and user info
        if (res && res.token) {
          sessionStorage.setItem('token', res.token);
          sessionStorage.setItem('user', JSON.stringify(res));
          // Start SSE listener immediately since token is now in storage
          this.startSseListener();
        }
        return res;
      })
    );
  }
}
