import { ChangeDetectorRef, OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { Subscription } from 'rxjs';
import { BookingTranslationService } from './booking-translation.service';

@Pipe({
  name: 'bt',
  standalone: true,
  pure: false
})
export class BookingTranslatePipe implements PipeTransform, OnDestroy {
  private sub: Subscription;

  constructor(private i18n: BookingTranslationService, private cdr: ChangeDetectorRef) {
    this.sub = this.i18n.lang$.subscribe(() => this.cdr.markForCheck());
  }

  transform(key: string): string {
    return this.i18n.t(key);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
