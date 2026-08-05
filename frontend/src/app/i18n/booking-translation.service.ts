import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { BookingLang, bookingTranslations } from './booking-translations';

@Injectable({ providedIn: 'root' })
export class BookingTranslationService {
  private readonly STORAGE_KEY = 'lang';
  private readonly defaultLang: BookingLang = 'fr';
  private readonly langSubject = new BehaviorSubject<BookingLang>(this.getInitialLang());

  readonly lang$ = this.langSubject.asObservable();

  get currentLang(): BookingLang {
    return this.langSubject.value;
  }

  setLanguage(lang: BookingLang): void {
    this.langSubject.next(lang);
    try {
      localStorage.setItem(this.STORAGE_KEY, lang);
    } catch {}
  }

  t(key: string): string {
    const lang = this.currentLang;
    return bookingTranslations[lang]?.[key] ?? bookingTranslations[this.defaultLang]?.[key] ?? key;
  }

  private getInitialLang(): BookingLang {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved === 'fr' || saved === 'en') return saved;
    } catch {}
    return this.defaultLang;
  }
}
