import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatToolbarModule, MatButtonModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit, OnDestroy {
  newCount = 0;
  private sub?: Subscription;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.refreshCount();
    
    // Refresh count on any appointment change (local or remote via SSE)
    this.sub = this.api.appointmentsChanged$.subscribe(() => {
      this.refreshCount();
    });

    // Fallback polling every 60 seconds
    setInterval(() => this.refreshCount(), 60000);
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
