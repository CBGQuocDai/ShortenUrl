import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-container">
      <div class="glass-panel form-box">
        <h2 style="text-align: center; margin-bottom: 2rem; font-size: 2rem;">
          Welcome Back <span style="color:var(--accent-color)">.</span>
        </h2>

        @if (errorMsg()) {
          <div class="error-msg">{{ errorMsg() }}</div>
        }

        <div
          style="background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3); border-radius: 8px; padding: 10px; margin-bottom: 1.5rem; text-align: center; color: var(--text-secondary); font-size: 0.9rem"
        >
          <b>Trial Account:</b> demo_account / Demo&#64;123456
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <label class="form-label">Username</label>
          <input
            type="text"
            formControlName="username"
            class="input-field"
            placeholder="Enter your username"
          />

          <label class="form-label">Password</label>
          <input
            type="password"
            formControlName="password"
            class="input-field"
            placeholder="Enter your password"
          />

          <button
            type="submit"
            class="btn btn-primary"
            style="width: 100%; margin-top: 1rem"
            [disabled]="form.invalid"
          >
            Login
          </button>
        </form>

        <p style="text-align: center; margin-top: 1.5rem; color: var(--text-secondary)">
          Don't have an account?
          <a routerLink="/register" style="color: var(--accent-color); text-decoration: none"
            >Register</a
          >
        </p>
      </div>
    </div>
  `,
  styles: [
    `
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
    `,
  ],
})
export class LoginComponent {
  fb = inject(FormBuilder);
  api = inject(ApiService);
  router = inject(Router);

  form = this.fb.group({
    username: ['demo_account', Validators.required],
    password: ['Demo@123456', Validators.required],
  });

  errorMsg = signal('');

  onSubmit() {
    if (this.form.valid) {
      this.api.login(this.form.value).subscribe({
        next: (res: any) => {
          localStorage.setItem('token', res.data.token);
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.errorMsg.set('Invalid credentials or server error.');
        },
      });
    }
  }
}
