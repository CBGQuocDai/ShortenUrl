import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private router = inject(Router);

  currentUser = signal<any>(null);

  login(data: any) {
    return this.http.post('/api/auth/login', data);
  }

  register(data: any) {
    return this.http.post('/api/auth/register', data);
  }

  getMe() {
    this.http.get('/api/auth/me').subscribe({
      next: (res: any) => this.currentUser.set(res.data),
      error: () => this.logout()
    });
  }

  logout() {
    localStorage.removeItem('token');
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getStat(page: number = 0, size: number = 10) {
    return this.http.get('/api/shorten?page=' + page + '&size=' + size);
  }

  createShorten(data: any) {
    return this.http.post('/api/shorten/create', data);
  }

  deleteShorten(id: number) {
    return this.http.delete('/api/shorten/' + id);
  }
}
