import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';

export interface User {
  id?: number;
  name: string;
  email?: string;
  phone: string;
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
}

export interface Appointment {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: 'BOOKED' | 'CANCELLED' | 'DONE' | 'BLOCKED';
  user: User;
  barber: Barber;
  service: Service;
  adminViewed?: boolean;
}

export interface AppointmentRequest {
  barberId: number;
  serviceId: number;
  date: string;
  startTime: string;
  userName?: string;
  userPhone?: string;
  userEmail?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = 'http://localhost:8081/api';
  private appointmentBookedSubject = new Subject<Appointment>();
  appointmentBooked$ = this.appointmentBookedSubject.asObservable();
  
  private appointmentsChangedSubject = new Subject<void>();
  appointmentsChanged$ = this.appointmentsChangedSubject.asObservable();

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
        const desiredNames = ['Ala', 'Hamouda', 'Ahmed'];
        const transformed = barbers.slice(0);
        for (let i = 0; i < Math.min(desiredNames.length, transformed.length); i++) {
          transformed[i] = {
            ...transformed[i],
            name: desiredNames[i],
            speciality: transformed[i].speciality || 'Barbier',
          };
        }
        if (transformed.length < desiredNames.length) {
          for (let i = transformed.length; i < desiredNames.length; i++) {
            transformed.push({
              id: 1000 + i,
              name: desiredNames[i],
              speciality: 'Barbier',
              photo: ''
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

  lockSlot(barberId: number, date: string, startTime: string): Observable<Appointment> {
    const params = new URLSearchParams({ barberId: String(barberId), date, startTime });
    return this.http.post<Appointment>(`${this.baseUrl}/appointments/lock?${params.toString()}`, {});
  }

  unlockSlot(barberId: number, date: string, startTime: string): Observable<Appointment> {
    const params = new URLSearchParams({ barberId: String(barberId), date, startTime });
    return this.http.delete<Appointment>(`${this.baseUrl}/appointments/lock?${params.toString()}`);
  }

  cancelAppointment(id: number): Observable<Appointment> {
    return this.http.put<Appointment>(`${this.baseUrl}/appointments/${id}/cancel`, {});
  }

  getNewAppointmentsCount(): Observable<number> {
    return this.http.get<number>(`${this.baseUrl}/appointments/new-count`);
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
