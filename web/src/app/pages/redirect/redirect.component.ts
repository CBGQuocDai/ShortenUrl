import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-redirect',
  standalone: true,
  template: `
    <div
      style="display: flex; justify-content: center; align-items: center; min-height: 100vh; flex-direction: column;"
    >
      <div class="glass-panel" style="padding: 3rem; text-align: center;">
        @if (error) {
          <h2 style="color: #fca5a5; margin-bottom: 1rem">Link not found or invalid!</h2>
          <p style="color: var(--text-secondary); margin-bottom: 2rem">
            The shortened URL might have been deleted.
          </p>
          <button class="btn btn-primary" (click)="goHome()">Back to Home</button>
        } @else {
          <h2 style="margin-bottom: 1rem">Redirecting...</h2>
          <p style="color: var(--text-secondary)">
            Please wait while we take you to the destination.
          </p>
        }
      </div>
    </div>
  `,
})
export class RedirectComponent implements OnInit {
  route = inject(ActivatedRoute);
  router = inject(Router);
  api = inject(ApiService);
  error = false;

  ngOnInit() {
    const code = this.route.snapshot.paramMap.get('shortCode');
    if (code) {
      this.api.getOriginalUrl(code).subscribe({
        next: (res: any) => {
          if (res.data) {
            window.location.href = res.data;
          } else {
            this.error = true;
          }
        },
        error: () => {
          this.error = true;
        },
      });
    } else {
      this.error = true;
    }
  }

  goHome() {
    this.router.navigate(['/']);
  }
}
