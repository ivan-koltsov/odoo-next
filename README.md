# Odoo Next

A modular, extensible headless **Next.js 16 (App Router) + Odoo 18** base application built on Odoo's native **JSON-RPC** API and **session-based authentication**, adapted from [Webkul's Odoo + ReactJS integration guide](https://webkul.com/blog/integrate-odoo-with-reactjs-frontend/) with Next.js BFF security and production best practices.

## Architecture

```
Browser (Next.js App Router + React 19 + Tailwind CSS v4)
   │  HttpOnly cookie (odoo_session_id) · same-origin requests (zero CORS)
   ▼
Next.js BFF Layer (Server Components + /api/odoo/* Route Handlers)
   │  Server-side JSON-RPC client (src/lib/odoo/client.ts)
   ▼
Odoo 18 Backend (port 8069 — private / never exposed directly to browser)
   ├── /web/session/authenticate
   ├── /web/session/get_session_info
   ├── /web/session/destroy
   ├── /web/dataset/call_kw/<model>/<method>
   ├── /web/image?model=...&id=...&field=image_256
   └── /web/webclient/version_info
```

### Key Improvements Over a Plain Vite/SPA Setup
- **No CORS in dev or production**: All browser requests talk to same-origin Next.js Route Handlers (`/api/odoo/*`), which proxy to Odoo server-side.
- **Secure `HttpOnly` session cookies**: Odoo's `session_id` is stored in an `HttpOnly`, `SameSite=Lax` cookie rather than `localStorage`, while session metadata hydrates cleanly from Server Components.
- **Typed Domain Services**: Reusable service modules in `src/lib/odoo/services/` (`products.ts`, `partners.ts`) keep model fields, domains, and pagination consistent.
- **Authenticated Image Proxy**: `/api/odoo/image` forwards the user's session cookie to Odoo's `/web/image` endpoint using an explicit model/field allowlist (`image_128`, `image_256`, `image_512`, `image_1024`, `avatar_128`).
- **Interactive RPC Explorer**: Built-in `/explorer` page for testing `odooCall(model, method, args, kwargs)` while developing new Odoo features.

## Quick Start

### 1. Configure Environment Variables

```bash
cp .env.example .env.local
```

Update `.env.local` with your Odoo instance URL and database name:

```env
ODOO_BASE_URL=http://localhost:8069
ODOO_DB=odoo
```

### 2. Start Odoo 18 Locally (Optional)

If you don't already have an Odoo instance running, start Odoo 18 + PostgreSQL 16 via Docker Compose:

```bash
docker compose up -d
```

Then open [http://localhost:8069](http://localhost:8069) once to initialize your database (e.g., `odoo`) and optionally install the **Sales** or **Inventory** app for `product.product` demo records.

### 3. Install & Run Next.js

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) and sign in with your Odoo credentials.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js dev server with Turbopack |
| `npm run build` | Production build (`output: "standalone"`) |
| `npm run start` | Start production server |
| `npm run typecheck` | Run strict TypeScript checking |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest unit tests |

## Project Structure

```
src/
├── lib/
│   ├── odoo/
│   │   ├── config.ts             # Server-side Odoo environment configuration
│   │   ├── errors.ts             # Structured OdooRpcError / Auth / Connection errors
│   │   ├── types.ts              # Shared JSON-RPC & Odoo domain types
│   │   ├── client.ts             # Core JSON-RPC transport (odooRpc, odooCall, auth)
│   │   ├── session.ts            # HttpOnly cookie & Server Component auth guards
│   │   ├── images.ts             # Image URL builder & proxy allowlist
│   │   └── services/
│   │       ├── products.ts       # product.product & product.category queries
│   │       └── partners.ts       # res.partner list, create, update
│   └── api/
│       └── client.ts             # Browser-side odooCall() & apiFetch() helpers
├── components/
│   ├── layout/app-shell.tsx      # Dashboard shell with Odoo plum (#714B67) branding
│   ├── providers/auth-provider.tsx
│   └── ui/                       # Reusable Badge, Card, OdooImage components
└── app/
    ├── login/                    # Odoo login screen + live backend status check
    ├── (dashboard)/
    │   ├── page.tsx              # Overview & live Odoo KPIs
    │   ├── products/             # Paginated product catalog & [id] detail page
    │   ├── partners/             # Contacts search & creation (CRUD example)
    │   └── explorer/             # Interactive JSON-RPC playground
    └── api/
        ├── health/route.ts       # Next.js + Odoo version health check
        └── odoo/
            ├── auth/{login,logout,session}/route.ts
            ├── call/route.ts     # Generic authenticated /web/dataset/call_kw bridge
            ├── image/route.ts    # Authenticated resized image proxy
            ├── products/         # Typed product endpoints
            └── partners/         # Typed partner GET + POST endpoints
```

## How to Extend with New Odoo Models

1. **Add Types**: Define your Odoo model interface in `src/lib/odoo/types.ts` (e.g., `OdooSaleOrder`).
2. **Create a Service**: Add `src/lib/odoo/services/orders.ts` using `odooCall("sale.order", "search_read", ...)` with explicit `fields`, `limit`, and `offset`.
3. **Expose Route Handlers (if client-driven)**: Add `src/app/api/odoo/orders/route.ts` validated with `zod`.
4. **Build the UI**: Add a page under `src/app/(dashboard)/orders/page.tsx` (automatically protected by `requireSession()` in `(dashboard)/layout.tsx`) and register the link in `src/components/layout/app-shell.tsx`.
