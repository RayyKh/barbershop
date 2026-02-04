import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { ScrollRevealDirective } from '../../directives/scroll-reveal.directive';
import { ApiService, Barber, Service } from '../../services/api.service';
import { BookingComponent } from '../booking/booking.component';

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
    ScrollRevealDirective
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  services: Service[] = [];
  barbers: Barber[] = [];
  videos: { title: string; url: string }[] = [
    { title: 'Salon de coiffure', url: 'assets/shop.mp4' },
    { title: 'Taille de barbe', url: 'assets/short4.mp4' },
    { title: 'Fade moderne', url: 'assets/short3.mp4' },
    { title: 'Coupe classique', url: 'assets/short1.mp4' },
    { title: 'Taille de barbe', url: 'assets/short5.mp4' },
    { title: 'Fade moderne', url: 'assets/short6.mp4' }
  ];

  galleryImages: string[] = [
    'assets/pic1.png',
    'assets/pic2.png',
    'assets/pic3.png',
    'assets/pic4.png',
    'assets/pic5.png',
    'assets/pic6.png',
    'assets/pic7.png',
    'assets/pic2.png'
  ];

  galleryChunks: string[][] = [];
  currentGalleryIndex = 0;

  feedbacks: { name: string; text: string; rating: number }[] = [
    { name: 'Ahmed Khadhraoui', text: 'Service impeccable, fade parfait et ambiance au top.', rating: 5 },
    { name: 'Amir Bachtobji', text: 'Très pro, rapide et soigné. Je recommande vivement.', rating: 5 },
    { name: 'Rayen Aissaoui', text: 'Super expérience, équipe accueillante et talentueuse.', rating: 5 },
    { name: 'Amen Benzarti', text: 'Coupe nickel, respect des horaires et des goûts.', rating: 4 },
    { name: 'Mohammed Omri', text: 'Barbiers qualifiés, résultats au-delà des attentes.', rating: 5 },
    { name: 'Fares Ben Salem', text: 'Salon élégant, produits premium, top qualité.', rating: 4 },
    { name: 'Rami Zoghlami', text: 'Meilleur barbier du quartier, je recommande sans hésiter.', rating: 5 },
    { name: 'Bayrem Oueslati', text: 'Très satisfait du service et de la précision du travail.', rating: 5 }
  ];

  constructor(private apiService: ApiService) {}

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
    document.getElementById('booking-section')?.scrollIntoView({ behavior: 'smooth' });
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
