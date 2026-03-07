# Lumen Protocol

Initial full-stack scaffold for a tabletop RPG campaign portal.

## Stack

- **Backend:** FastAPI, PostgreSQL, Redis, WebSockets
- **Frontend:** Next.js (App Router), React, TailwindCSS, Leaflet
- **Infrastructure:** Docker + Docker Compose

## Project structure

```text
backend/
  app/
frontend/
docker-compose.yml
```

## Quick start

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Backend health: http://localhost:8000/health

## Development

Backend service config is loaded from `backend/.env.example` by default in Docker Compose.
