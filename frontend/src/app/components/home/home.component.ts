import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { ScrollRevealDirective } from '../../directives/scroll-reveal.directive';
import { ApiService, Barber, Service } from '../../services/api.service';
import { BookingComponent } from '../booking/booking.component';
import { ProductListComponent } from '../product-list/product-list.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule, 
    MatButtonModule, 
    MatCardModule, 
    MatIconModule, 
    RouterModule, 
    BookingComponent,
    ScrollRevealDirective,
    ProductListComponent
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  services: Service[] = [];
  barbers: Barber[] = [];
  parallaxOffset = 0;
  videos: { title: string; url: string }[] = [
    { title: 'Salon de coiffure', url: 'assets/vd.mp4' },
    { title: 'Taille de barbe', url: 'assets/vd (1).mp4' },
    { title: 'Fade moderne', url: 'assets/vd (2).mp4' },
    { title: 'Coupe classique', url: 'assets/vd (3).mp4' },
    { title: 'Taille de barbe', url: 'assets/vd (4).mp4' },
    { title: 'Fade moderne', url: 'assets/vd (5).mp4' },
    { title: 'Soin du visage', url: 'assets/vd (6).mp4' },
    { title: 'Style Signature', url: 'assets/vd (7).mp4' },
    { title: 'Finition Précise', url: 'assets/vd (8).mp4' }
  ];

  galleryImages: string[] = [
    
    'assets/img1.jpeg',
    'assets/img2.jpeg',
    'assets/img3.jpeg',
    'assets/img4.jpeg',
    'assets/img5.jpeg',
    'assets/img6.jpeg',
    'assets/img7.jpeg',
    'assets/img8.jpeg',
    'assets/img9.jpeg',
    'assets/img10.jpeg',
    'assets/img11.jpeg',
    'assets/img12.jpeg'
  ];

  galleryChunks: string[][] = [];
  currentGalleryIndex = 0;

  feedbacks: { name: string; text: string; rating: number }[] = [
    { name: 'Ahmed Khadhraoui', text: 'Service impeccable, fade parfait et ambiance au top.', rating: 5 },
    { name: 'Amir Bachtobji', text: 'Très pro, rapide et soigné. Je recommande vivement.', rating: 5 },
    { name: 'Rayen Aissaoui', text: 'Super expérience, équipe accueillante et talentueuse.', rating: 5 },
    { name: 'Mohammed Omri', text: 'Barbiers qualifiés, résultats au-delà des attentes.', rating: 5 },
    { name: 'Fares Ben Salem', text: 'Salon élégant, produits premium, top qualité.', rating: 4 },
    { name: 'Bayrem Oueslati', text: 'Très satisfait du service et de la précision du travail.', rating: 5 }
  ];

  constructor(private apiService: ApiService) {}

  @HostListener('window:scroll', [])
  onWindowScroll() {
    const scrollOffset = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    // On n'applique le parallaxe que si on est dans le haut de la page (Hero section visible)
    if (scrollOffset < window.innerHeight) {
      this.parallaxOffset = scrollOffset * 0.4; // Ajuster le 0.4 pour plus ou moins de décalage
    }
  }

  ngOnInit() {
    this.apiService.getServices().subscribe(data => {
      this.services = data;
    });
    this.apiService.getBarbers().subscribe(data => {
      this.barbers = data;
    });
    this.galleryChunks = this.chunkImages(this.galleryImages, 4);
  }

  scrollToBooking() {
    const element = document.getElementById('booking');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        window.scrollBy(0, -100);
      }, 600);
    }
  }

  isMp4(url: string): boolean {
    return url.toLowerCase().endsWith('.mp4');
  }

  toEmbed(url: string): string {
    // Support YouTube watch and shorts
    const shorts = /https?:\/\/(?:www\.)?youtube\.com\/shorts\/([^\?]+)/i.exec(url);
    if (shorts && shorts[1]) {
      return `https://www.youtube.com/embed/${shorts[1]}?rel=0`;
    }
    const watch = /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([^&]+)/i.exec(url);
    if (watch && watch[1]) {
      return `https://www.youtube.com/embed/${watch[1]}?rel=0`;
    }
    return url;
  }

  private chunkImages(images: string[], size: number): string[][] {
    const chunks: string[][] = [];
    for (let i = 0; i < images.length; i += size) {
      chunks.push(images.slice(i, i + size));
    }
    return chunks;
  }

  nextGallery() {
    this.currentGalleryIndex = (this.currentGalleryIndex + 1) % this.galleryChunks.length;
  }

  prevGallery() {
    this.currentGalleryIndex = (this.currentGalleryIndex - 1 + this.galleryChunks.length) % this.galleryChunks.length;
  }

  goToGallery(i: number) {
    this.currentGalleryIndex = i;
  }
}
