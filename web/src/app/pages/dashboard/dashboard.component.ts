import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="dashboard-layout">
      <header
        class="glass-panel"
        style="padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; border-radius: 0; border-left: none; border-right: none; border-top: none;"
      >
        <h1 style="font-size: 1.5rem; letter-spacing: 1px">
          Mini<span style="color:var(--accent-color)">Ly</span>
        </h1>
        <div style="display: flex; align-items: center; gap: 1rem;">
          <span style="color: var(--text-secondary)">{{ api.currentUser()?.username }}</span>
          <button class="btn btn-danger" style="padding: 0.5rem 1rem" (click)="api.logout()">
            Logout
          </button>
        </div>
      </header>

      <main class="container">
        <!-- Create Section -->
        <div class="glass-panel" style="padding: 2rem; margin-bottom: 2rem">
          <h3 style="margin-bottom: 1rem">Create new Short URL</h3>
          <form
            [formGroup]="form"
            (ngSubmit)="onCreate()"
            style="display: flex; gap: 1rem; align-items: flex-start"
          >
            <div style="flex: 2">
              <input
                type="url"
                formControlName="url"
                class="input-field"
                placeholder="https://very-long-url.com/example"
                style="margin-bottom: 0"
              />
            </div>
            <div style="flex: 1">
              <input
                type="text"
                formControlName="shortCode"
                class="input-field"
                placeholder="custom-alias"
                style="margin-bottom: 0"
              />
            </div>
            <button
              type="submit"
              class="btn btn-primary"
              style="height: 48px; min-width: 100px;"
              [disabled]="form.invalid"
            >
              Create
            </button>
          </form>
          @if (errorMsg()) {
            <div style="color: #fca5a5; margin-top: 1rem; font-size: 0.9rem">{{ errorMsg() }}</div>
          }
        </div>

        <!-- List Section -->
        <div class="glass-panel" style="padding: 2rem">
          <h3 style="margin-bottom: 1.5rem">Your URLs</h3>
          <div class="table-container">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="border-bottom: 1px solid var(--glass-border)">
                  <th style="padding: 1rem; color: var(--text-secondary)">Short URL</th>
                  <th style="padding: 1rem; color: var(--text-secondary)">Original URL</th>
                  <th style="padding: 1rem; color: var(--text-secondary)">Clicks</th>
                  <th style="padding: 1rem; color: var(--text-secondary)">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (item of urls(); track item.shortCode) {
                  <tr
                    style="border-bottom: 1px solid var(--glass-border); transition: background-color 0.2s"
                    class="row-hover"
                  >
                    <td style="padding: 1rem; color: var(--accent-color)">
                      <a
                        [href]="'http://localhost:3000/s/' + item.shortCode"
                        target="_blank"
                        style="color: inherit; text-decoration: none; font-weight: 500"
                      >
                        localhost:3000/s/{{ item.shortCode }}
                      </a>
                    </td>
                    <td
                      style="padding: 1rem; max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
                      [title]="item.url"
                    >
                      {{ item.url }}
                    </td>
                    <td style="padding: 1rem">
                      <span
                        style="background: rgba(59,130,246,0.1); padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 600"
                        >{{ item.accessCount }}</span
                      >
                    </td>
                    <td style="padding: 1rem">
                      <button
                        class="btn btn-danger"
                        style="padding: 0.4rem 0.8rem; font-size: 0.85rem"
                        (click)="deleteUrl(item)"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                }
                @if (urls().length === 0) {
                  <tr>
                    <td
                      colspan="4"
                      style="padding: 2rem; text-align: center; color: var(--text-secondary)"
                    >
                      No shorten URLs found.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [
    `
      .dashboard-layout {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
      .container {
        max-width: 1000px;
        margin: 2rem auto;
        width: 100%;
        padding: 0 1rem;
      }
      .row-hover:hover {
        background-color: rgba(255, 255, 255, 0.02);
      }
      .table-container {
        overflow-x: auto;
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  api = inject(ApiService);
  fb = inject(FormBuilder);

  urls = signal<any[]>([]);
  errorMsg = signal('');

  form = this.fb.group({
    url: ['', [Validators.required, Validators.pattern('https?://.+')]],
    shortCode: ['', Validators.required],
  });

  ngOnInit() {
    this.api.getMe();
    this.loadData();
  }

  loadData() {
    this.api.getStat(1, 100).subscribe({
      // Go API pagination usually starts at 1, maybe page=1
      next: (res: any) => {
        // Handle both Spring Page response (res.data.content) and Go array response (res.data)
        const rawItems = res.data?.content || res.data || [];
        const items = rawItems.map((i: any) => ({
          ...i,
          shortCode: i.shortCode || i.short_code,
          accessCount: i.accessCount || i.access_count,
        }));
        this.urls.set(items);
      },
    });
  }

  onCreate() {
    if (this.form.valid) {
      this.api
        .createShorten({
          url: this.form.value.url,
          shorten_code: this.form.value.shortCode, // Ensure it matches backend snake_case if required
        })
        .subscribe({
          next: () => {
            this.form.reset();
            this.errorMsg.set('');
            this.loadData();
          },
          error: (err) => {
            this.errorMsg.set(err.error?.message || 'Error creating short URL');
          },
        });
    }
  }

  deleteUrl(item: any) {
    // Backend DeleteShortenUrl receives shortenCode
    this.api.deleteShorten(item.shortCode || item.short_code).subscribe({
      next: () => this.loadData(),
    });
  }
}
