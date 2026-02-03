import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { ApiService, Barber } from '../../services/api.service';

@Component({
  selector: 'app-barber-list',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  template: `
    <div class="list-container">
      <h2>Nos Barbiers</h2>
      <div class="cards">
        <mat-card *ngFor="let barber of barbers" class="card">
          <img mat-card-image [src]="barber.photo" alt="Photo of {{barber.name}}">
          <mat-card-header>
            <mat-card-title>{{barber.name}}</mat-card-title>
            <mat-card-subtitle>{{barber.speciality}}</mat-card-subtitle>
          </mat-card-header>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .cards { display: flex; flex-wrap: wrap; gap: 20px; }
    .card { width: 300px; }
  `]
})
export class BarberListComponent implements OnInit {
  barbers: Barber[] = [];
  constructor(private apiService: ApiService) {}
  ngOnInit() {
    this.apiService.getBarbers().subscribe(data => this.barbers = data);
  }
}
