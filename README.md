# MiniLy - Microservices Shorten URL System 🚀

MiniLy is a full-stack, scalable microservices-based URL shortener with built-in Single Sign-On (SSO) authentication, fast caching strategies, and a responsive web dashboard.

## 🏗 System Architecture

The project adopts a Microservices approach combining different technologies optimized for their specific tasks:

### 1. SSO Service (Backend Authentication)

- **Tech Stack**: Java (Spring Boot)
- **Database**: PostgreSQL 15 + Redis (for token caching / session management)
- **Functionality**: Handles User Registration, Authentication (JWT), and Profile contexts. Exposes `/api/auth/*` endpoints.

### 2. Shorten URL Service (Core API)

- **Tech Stack**: Go (Gin Framework)
- **Database**: MySQL 8.0 + Redis 7
- **Functionality**:
  - Validates user requests via internal HTTP API calls to the SSO service.
  - CRUD operations for shortened URLs.
  - Implements a fast "Read-Through" caching strategy using Redis for millisecond-level URL redirections.
  - Asynchronous background updates (Goroutines) for access counting without blocking the end-user redirection.

### 3. Web Dashboard (Frontend)

- **Tech Stack**: Angular + NGINX
- **Functionality**: Beautiful glass-morphism dashboard providing UI for users to login, create aliases, and view stats of their shortened links. NGINX acts as an API gateway proxy to handle cross-origin routing.

---

## 🛠 Prerequisites

Make sure you have the following installed to run this project:

- **Docker** and **Docker Compose**
- **Git**

---

## 🚀 Quick Start (Deployment)

This project has been fully containerized and uses independent `.env` files for security and easy deployment.

### 1. Clone the repository

```bash
git clone https://github.com/CBGQuocDai/ShortenUrl.git
cd ShortenUrl
```

### 2. Environment Configuration

The project is set up to automatically load hidden `.env` configurations. We use separate env files for independent scalability:

- `.env.sso.db`: PostgreSQL configuration.
- `.env.sso.service`: SSO configurations + JWT secrets.
- `.env.shorten.db`: MySQL configuration.
- `.env.shorten.service`: Go API database DSN and internal network hosts.

_(Note: Ensure your environment variables are configured correctly for production. The provided `.env` files in this architecture are git-ignored for safety)._

### 3. Start the entire system

Run Docker Compose to build and start the infrastructure, databases, and microservices in isolated networks.

```bash
docker-compose up --build -d
```

### 4. Access the App

Once up and running:

- **Web Interface (Angular Dashboard)**: [http://localhost](http://localhost)
- **SSO Root API**: `http://localhost:8080/api/auth`
- **Shorten Root API**: `http://localhost:8081/api/v1/shorten`

---

## 🛡 Features

- **Custom Aliases**: Users can define specific words instead of random characters.
- **Security First**: Middleware implemented in Go communicates locally with SSO Service to guarantee request validity.
- **Redis Caching Pipeline**: Guarantees ultra-fast URL resolutions, protecting the core Database from a barrage of heavy redirect traffic.
- **Separation of Concerns**: Isolated databases per service to strictly follow Microservice Database-per-service patterns.

---

## 📝 License

This project is for educational and portfolio purposes by Quoc Dai.
