# Odoo Next — Code Review Style Guide

This repository is a headless **Next.js 16 (App Router) + React 19 + Odoo 18** application using a Backend-for-Frontend (BFF) pattern over Odoo's native JSON-RPC API.

## Security & BFF Architecture
- **No direct browser-to-Odoo calls**: Client components must only call same-origin Next.js Route Handlers (`/api/odoo/*`) or receive data from Server Components. Never expose `ODOO_BASE_URL` or call Odoo directly from client code.
- **Session handling**: Keep `odoo_session_id` strictly inside `HttpOnly`, `SameSite=Lax` cookies managed by `src/lib/odoo/session.ts`. Never store session tokens in `localStorage`/`sessionStorage` or log raw cookies/credentials.
- **Auth guards**: Protected pages under `src/app/(dashboard)/` must remain guarded by `requireSession()`, and authenticated Route Handlers must validate the session before calling Odoo.
- **Allowlists**: Keep model/field allowlists strict in `/api/odoo/image` and any generic RPC endpoints.

## API Routes & Error Handling
- Validate all request bodies and query parameters in Route Handlers using `zod`.
- Use the structured error types in `src/lib/odoo/errors.ts` and map them to appropriate HTTP status codes without leaking internal stack traces or sensitive backend details.

## Odoo Domain Services (`src/lib/odoo/services/`)
- Always pass explicit `fields`, `limit`, and `offset` parameters to `search_read` calls to avoid unbounded queries.
- Define reusable Odoo model interfaces in `src/lib/odoo/types.ts`.

## TypeScript & Next.js Conventions
- Follow strict TypeScript (`strict: true`); avoid `any` and unnecessary type assertions.
- Use the `@/*` path alias for imports within `src/`.
- Prefer React Server Components by default; add `"use client"` only when state, effects, or browser APIs are needed.

## Testing & Quality
- Add or update Vitest unit tests in `src/__tests__/` when modifying `src/lib/odoo/` client logic, services, or helpers.
- Flag changes that would break `npm test`, `npm run typecheck`, `npm run lint`, or `npm run build`.
