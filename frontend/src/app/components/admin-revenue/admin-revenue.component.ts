import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { ApiService, Barber, RevenueReport } from '../../services/api.service';

@Component({
  selector: 'app-admin-revenue',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatSelectModule,
    MatFormFieldModule,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    FormsModule,
    RouterLink
  ],
  templateUrl: './admin-revenue.component.html',
  styleUrl: './admin-revenue.component.css'
})
export class AdminRevenueComponent implements OnInit {
  barbers: Barber[] = [];
  selectedBarberId: number | null = null;
  report: RevenueReport | null = null;
  loading = false;
  currentDate: Date = new Date();

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.checkUserRole();
    this.loadBarbers();
  }

  checkUserRole(): void {
    const userStr = sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      // On peut imaginer une logique ici si on veut limiter certains admins
      // Mais pour l'instant tous les admins voient tout
    }
  }

  loadBarbers(): void {
    this.apiService.getBarbers().subscribe(barbers => {
      this.barbers = barbers;
      if (this.barbers.length > 0) {
        this.selectedBarberId = this.barbers[0].id;
        this.loadReport();
      }
    });
  }

  loadReport(): void {
    if (this.selectedBarberId) {
      this.loading = true;
      this.report = null; // Effacer le rapport précédent pour éviter de l'afficher pendant le chargement
      const dateStr = this.formatDate(this.currentDate);
      console.log('Loading revenue report for date:', dateStr);
      this.apiService.getRevenueReport(this.selectedBarberId, dateStr).subscribe({
        next: (report) => {
          console.log('Report received:', report);
          this.report = report;
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading revenue report', err);
          this.loading = false;
        }
      });
    }
  }

  onBarberChange(): void {
    this.loadReport();
  }

  previousWeek(): void {
    const d = new Date(this.currentDate);
    d.setDate(d.getDate() - 7);
    this.currentDate = d;
    this.loadReport();
  }

  nextWeek(): void {
    const d = new Date(this.currentDate);
    d.setDate(d.getDate() + 7);
    this.currentDate = d;
    this.loadReport();
  }

  getWeekRangeDisplay(): string {
    const d = new Date(this.currentDate);
    const day = d.getDay();
    // Ajuster pour obtenir le lundi de la semaine
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    const startOfWeek = new Date(d.setDate(diff));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const startDay = startOfWeek.getDate().toString().padStart(2, '0');
    const endDay = endOfWeek.getDate().toString().padStart(2, '0');
    
    // Mois en français
    const months = ['Janv', 'Févr', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
    const startMonth = months[startOfWeek.getMonth()];
    const endMonth = months[endOfWeek.getMonth()];
    const year = endOfWeek.getFullYear();

    if (startMonth === endMonth) {
      return `${startDay} - ${endDay} ${startMonth} ${year}`;
    } else {
      return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`;
    }
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
