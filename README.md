# LactiFlow — Totales

## Sprint 1 de Software Seguro

Se añadió la base independiente de **Lactiflow Pedidos** en `backend/`, con configuración para un proyecto Supabase propio, catálogo ficticio y registro de pedidos. La interfaz de totales existente permanece disponible. Consultar [la configuración y demostración del backend](backend/README.md).

Desde esta carpeta: `npm run backend:dev` para la API y `npm run test:backend` para sus pruebas. Primero hay que crear el proyecto Supabase de Pedidos y completar la configuración descrita en esa guía. La conexión a una base real no se considera verificada hasta ejecutar la demostración.

A lightweight read-only dashboard that displays daily production totals predicted by the LactiFlow suggestion engine.

Built with **Vue 3 + Bootstrap 5**. Consumes the **public API** from the LactiFlow backend — no login or authentication required.

## Requirements

- Node.js 18+
- LactiFlow backend running on `http://localhost:3000`

## Setup

```sh
npm install
```

## Configuration

Copy the example environment file and adjust if needed:

```sh
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3000` | Base URL of the LactiFlow backend API |

## Usage

```sh
npm run dev
```

Opens the dev server (default: `http://localhost:5173`). The dashboard fetches aggregated suggestion totals from `GET /api/public/suggestions/summary?date=YYYY-MM-DD`.

## Build for production

```sh
npm run build
```

Output goes to `dist/`.

## What it shows

- A week calendar to navigate between dates
- Total number of distinct products and estimated quantity for the selected date
- A table with product name, quantity, and unit

## Project structure

```
.env              — Local environment variables (git-ignored)
.env.example      — Example environment config
index.html        — HTML entry point
vite.config.js    — Vite configuration
src/
  main.js         — App bootstrap
  App.vue         — Single-file component (calendar, stats, table)
```
