import { Directive, ElementRef, Input, OnInit, Renderer2, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appScrollReveal]',
  standalone: true
})
export class ScrollRevealDirective implements OnInit, OnDestroy {
  @Input() delay: number = 0;
  @Input() duration: number = 800;
  @Input() threshold: number = 0.15;
  
  private observer: IntersectionObserver | null = null;

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  ngOnInit() {
    this.setupInitialStyles();
    this.createObserver();
  }

  private setupInitialStyles() {
    this.renderer.setStyle(this.el.nativeElement, 'opacity', '0');
    this.renderer.setStyle(this.el.nativeElement, 'transform', 'translateY(30px)');
    this.renderer.setStyle(this.el.nativeElement, 'transition', `all ${this.duration}ms ease-out`);
    this.renderer.setStyle(this.el.nativeElement, 'visibility', 'visible');
  }

  private createObserver() {
    const options = {
      root: null,
      threshold: this.threshold
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.reveal();
          if (this.observer) {
            this.observer.unobserve(this.el.nativeElement);
          }
        }
      });
    }, options);

    this.observer.observe(this.el.nativeElement);
  }

  private reveal() {
    setTimeout(() => {
      this.renderer.setStyle(this.el.nativeElement, 'opacity', '1');
      this.renderer.setStyle(this.el.nativeElement, 'transform', 'translateY(0)');
    }, this.delay);
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}
