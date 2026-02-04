import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
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
  private sub?: Subscription;

  constructor(private api: ApiService, private router: Router) {}

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
    const isHome = this.router.url === '/' || this.router.url.startsWith('/#');
    
    if (isHome) {
      // Already on home, just scroll
      const element = document.getElementById(fragment);
      if (element) {
        // Smooth scroll to the element
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Update URL without triggering navigation
        window.history.replaceState({}, '', `/#${fragment}`);
      }
    } else {
      // Navigate to home with fragment
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
