import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { ApiService, Product } from '../../services/api.service';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss']
})
export class ProductListComponent implements OnInit {
  products: Product[] = [];
  loading = true;
  isHome = false;
  currentIndex = 0;
  visibleItems = 3;

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.isHome = this.router.url === '/' || this.router.url === '/home';
    this.loadProducts();
    this.updateVisibleItems();
    window.addEventListener('resize', () => this.updateVisibleItems());
  }

  updateVisibleItems(): void {
    const width = window.innerWidth;
    if (width < 768) {
      this.visibleItems = 1;
    } else if (width < 1024) {
      this.visibleItems = 2;
    } else {
      this.visibleItems = 3;
    }
  }

  loadProducts(): void {
    this.loading = true;
    this.api.getProducts().subscribe({
      next: (data) => {
        this.products = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des produits', err);
        this.loading = false;
      }
    });
  }

  get maxIndex(): number {
    return Math.max(0, this.products.length - this.visibleItems);
  }

  nextSlide(): void {
    if (this.currentIndex < this.maxIndex) {
      this.currentIndex++;
    } else {
      this.currentIndex = 0; // Loop back
    }
  }

  prevSlide(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
    } else {
      this.currentIndex = this.maxIndex; // Loop to end
    }
  }

  goToSlide(index: number): void {
    this.currentIndex = Math.min(index, this.maxIndex);
  }

  get dots(): number[] {
    const numDots = Math.ceil(this.products.length / this.visibleItems);
    return Array.from({ length: numDots }, (_, i) => i);
  }

  isDotActive(index: number): boolean {
    return Math.floor(this.currentIndex / this.visibleItems) === index;
  }
}
