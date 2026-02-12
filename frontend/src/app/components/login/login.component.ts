import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatCardModule, MatInputModule, MatButtonModule, MatSnackBarModule],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title>Accès Administrateur</mat-card-title>
          <mat-card-subtitle>Section privée du salon</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="loginForm" (ngSubmit)="login()" class="login-form">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Nom d'utilisateur</mat-label>
              <input matInput formControlName="username" >
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Mot de passe</mat-label>
              <input matInput type="password" formControlName="password" >
            </mat-form-field>

            <button mat-raised-button color="primary" type="submit" [disabled]="!loginForm.valid" class="submit-btn">Se connecter</button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    :host { display: block; background: #000; min-height: 100vh; width: 100%; }
    .login-container { display: flex; justify-content: center; padding: 140px 20px 40px; }
    .login-card { width: 420px; padding: 8px; color: #fff; }
    .full-width { width: 100%; margin-bottom: 16px; }
    .login-form { margin-top: 8px; }
    .submit-btn { background: #d4af37; color: #000; }
    .submit-btn:hover { filter: brightness(1.1); }
    mat-card-title { color: #d4af37; }
    mat-card-subtitle { color: #aaaaaa; }
    :host ::ng-deep .mat-mdc-form-field .mdc-notched-outline__leading,
    :host ::ng-deep .mat-mdc-form-field .mdc-notched-outline__notch,
    :host ::ng-deep .mat-mdc-form-field .mdc-notched-outline__trailing { border-color: #d4af37 !important; }
    :host ::ng-deep .mat-mdc-form-field .mdc-text-field--focused .mdc-notched-outline__leading,
    :host ::ng-deep .mat-mdc-form-field .mdc-text-field--focused .mdc-notched-outline__notch,
    :host ::ng-deep .mat-mdc-form-field .mdc-text-field--focused .mdc-notched-outline__trailing { border-color: #d4af37 !important; }
    :host ::ng-deep .mat-mdc-form-field .mdc-floating-label { color: #d4af37 !important; }
    :host ::ng-deep .mat-mdc-form-field .mdc-text-field__input { color: #ffffff; }
  `]
})
export class LoginComponent {
  loginForm: FormGroup;
  error = '';

  constructor(private fb: FormBuilder, private apiService: ApiService, private router: Router, private snackBar: MatSnackBar) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  login() {
    if (this.loginForm.valid) {
      this.apiService.login(this.loginForm.value).subscribe({
        next: (response: any) => {
          this.snackBar.open('Connexion réussie', 'OK', { duration: 2500 });
          this.router.navigate(['/admin']);
        },
        error: (err) => {
          console.error('Login error', err);
          this.snackBar.open('Identifiants invalides ou erreur serveur', 'OK', { duration: 3000 });
        }
      });
    }
  }
}
