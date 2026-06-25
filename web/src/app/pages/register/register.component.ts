import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-container">
      <div class="glass-panel form-box">
        <h2 style="text-align: center; margin-bottom: 2rem; font-size: 2rem;">Create Account <span style="color:var(--accent-color)">.</span></h2>
        
        @if (errorMsg()) {
          <div class="error-msg">{{ errorMsg() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <label class="form-label">Username</label>
          <input type="text" formControlName="username" class="input-field" placeholder="Pick a username">
          
          <label class="form-label">Password</label>
          <input type="password" formControlName="password" class="input-field" placeholder="Create a password">
          
          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem" [disabled]="form.invalid">Register</button>
        </form>

        <p style="text-align: center; margin-top: 1.5rem; color: var(--text-secondary)">
          Already have an account? <a routerLink="/login" style="color: var(--accent-color); text-decoration: none">Login</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      width: 100%;
    }
    .form-box {
      width: 400px;
      padding: 2.5rem;
    }
    .error-msg {
      background: rgba(239, 68, 68, 0.2);
      color: #fca5a5;
      padding: 10px;
      border-radius: 8px;
      margin-bottom: 1rem;
      text-align: center;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
  `]
})
export class RegisterComponent {
  fb = inject(FormBuilder);
  api = inject(ApiService);
  router = inject(Router);

  form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  errorMsg = signal('');

  onSubmit() {
    if (this.form.valid) {
      this.api.register(this.form.value).subscribe({
        next: () => {
          this.router.navigate(['/login']);
        },
        error: (err) => {
          this.errorMsg.set('Registration failed or username exists.');
        }
      });
    }
  }
}
