import { CommonModule, ViewportScroller } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterOutlet, Scroll } from '@angular/router';
import { filter } from 'rxjs/operators';
import { NavbarComponent } from './components/navbar/navbar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent],
  template: `
    <app-navbar></app-navbar>
    <router-outlet></router-outlet>
  `,
  styles: [`
    
  `]
})
export class AppComponent implements OnInit {
  title = 'frontend';

  constructor(private router: Router, private viewportScroller: ViewportScroller) {}

  ngOnInit() {
    this.router.events.pipe(
      filter((e: any): e is Scroll => e instanceof Scroll)
    ).subscribe(e => {
      if (e.anchor) {
        // More robust manual scroll
        setTimeout(() => {
          const element = document.getElementById(e.anchor!);
          if (element) {
            // Using scrollIntoView which is more reliable than scrollToAnchor in some cases
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            // Fallback to native viewport scroller
            this.viewportScroller.scrollToAnchor(e.anchor!);
          }
        }, 200);
      } else if (e.position) {
        this.viewportScroller.scrollToPosition(e.position);
      } else {
        this.viewportScroller.scrollToPosition([0, 0]);
      }
    });
  }
}
