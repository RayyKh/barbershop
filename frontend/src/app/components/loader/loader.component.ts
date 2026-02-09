import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { AnimationOptions, LottieComponent } from 'ngx-lottie';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule, LottieComponent],
  template: `
    <div class="loader-overlay" *ngIf="visible">
      <div class="loader-content">
        <ng-lottie [options]="options" height="150px" width="150px"></ng-lottie>
        <p *ngIf="message" class="loader-message">{{ message }}</p>
      </div>
    </div>
  `,
  styles: [`
    .loader-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(5px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    }
    .loader-content {
      text-align: center;
    }
    .loader-message {
      color: #d4af37;
      margin-top: 15px;
      font-size: 1.2rem;
      font-family: 'Playfair Display', serif;
      letter-spacing: 1px;
    }
  `]
})
export class LoaderComponent {
  @Input() visible = false;
  @Input() message = 'Chargement...';

  options: AnimationOptions = {
    path: 'assets/lottie/barber.json',
  };
}
