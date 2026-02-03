import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { ApiService, Service } from '../../services/api.service';

@Component({
  selector: 'app-service-list',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  template: `
    <div class="list-container">
      <h2>Nos Services</h2>
      <div class="cards">
        <mat-card *ngFor="let service of services" class="card">
          <mat-card-header>
            <mat-card-title>{{service.name}}</mat-card-title>
            <mat-card-subtitle>{{service.duration}} min</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <p>{{service.description}}</p>
            <h3>{{service.price}} €</h3>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .cards { display: flex; flex-wrap: wrap; gap: 20px; }
    .card { width: 300px; }
  `]
})
export class ServiceListComponent implements OnInit {
  services: Service[] = [];
  constructor(private apiService: ApiService) {}
  ngOnInit() {
    this.apiService.getServices().subscribe(data => this.services = data);
  }
}
