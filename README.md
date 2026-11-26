# LactiFlow Clientes

## Sprint 1 de Software Seguro

La sección **Pedidos** permite escribir el nombre del cliente, elegir productos de prueba y cantidades y registrar un pedido. **Historial** muestra los pedidos guardados, más recientes primero, y permite abrir sus detalles después de recargar la página. Es el historial compartido de la demo; el historial personal se integrará con el inicio de sesión. Usa el backend independiente de `backend/` y el proyecto Supabase **Lactiflow Clientes**. La sección **Totales** conserva el panel anterior y sigue consultando al Lactiflow principal.

Desde esta carpeta, iniciar `npm run backend:dev` en una terminal y `npm run dev` en otra; abrir la dirección que muestra Vite. `npm run test:backend` ejecuta las pruebas de la API. Consultar [la configuración del backend y la demostración](backend/README.md).

La conexión a Supabase y el registro y consulta de un pedido desde la interfaz se verificaron con datos de prueba. La autenticación de usuarios, el SSO, MFA, federación, integración con Lactiflow principal y KMS siguen pendientes. Esta es una demo local, no una API lista para exposición pública.

En desarrollo, `VITE_ORDERS_API_URL` usa `/pedidos-api` y Vite redirige al backend local del puerto 3001. Si cambia ese puerto, ajustar el proxy de `vite.config.js`. El proxy no forma parte del sitio compilado: un despliegue futuro debe definir `VITE_ORDERS_API_URL` con la URL de su backend o configurar un proxy en el alojamiento, junto con los controles de acceso pendientes. No se incluyen claves secretas en las variables `VITE_`.

El panel original de totales muestra las cantidades sugeridas por fecha. La documentación que sigue describe esa sección y su conexión al backend principal; el formulario de Pedidos tiene su backend y configuración propios.

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
