import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit, OnDestroy {
  newCount = 0;
  isScrolled = false;
  private sub?: Subscription;

  constructor(
    private api: ApiService, 
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const scrollOffset = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    const newState = scrollOffset > 20;
    
    if (this.isScrolled !== newState) {
      this.isScrolled = newState;
      this.cdr.detectChanges(); // Forcer Angular à mettre à jour la vue
    }
  }

  ngOnInit(): void {
    this.refreshCount();
    
    // Refresh count on any appointment change (local or remote via SSE)
    this.sub = this.api.appointmentsChanged$.subscribe(() => {
      this.refreshCount();
    });

    // Fallback polling every 60 seconds
    setInterval(() => this.refreshCount(), 60000);
  }

  navigateToSection(fragment: string) {
    if (fragment === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.router.navigate(['/']);
      return;
    }

    const isHome = this.router.url === '/' || this.router.url.split('#')[0] === '/';
    
    if (isHome) {
      // Forcer la fermeture du menu mobile avant de scroller
      const element = document.getElementById(fragment);
      if (element) {
        // Utiliser scrollIntoView natif qui est plus fiable quand il y a des conflits
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Ajuster un peu après le scroll pour compenser la navbar
          setTimeout(() => {
            window.scrollBy(0, -100);
          }, 600);
          window.history.replaceState({}, '', `/#${fragment}`);
        }, 100);
      }
    } else {
      this.router.navigate(['/'], { fragment: fragment });
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private refreshCount() {
    const token = sessionStorage.getItem('token');
    if (!token) {
      this.newCount = 0;
      return;
    }

    this.api.getNewAppointmentsCount().subscribe({
      next: (n) => this.newCount = n,
      error: (err) => {
        console.error('Error fetching new appointments count', err);
        this.newCount = 0;
      }
    });
  }
}
