# AGENTS.md

Guidance for AI agents working in NEXORA POS. Keep updated when conventions change.

## Project

Offline-first POS PWA (Next.js 15 App Router, React 19, strict TypeScript, Tailwind v4). All business data lives in the browser via Dexie IndexedDB (`nexora_pos_db`); there is no server database. Single-page terminal app: `app/page.tsx` (`NexoraPOSApp`) hosts every view as a tab (checkout / shifts / inventory / orders / dashboard / settings). Only other route is `app/verify` (public receipt verification).

## Commands

```bash
pnpm install      # install (pnpm-lock.yaml is the only lockfile)
pnpm dev          # dev server on :3000
pnpm lint         # ESLint 9, flat config (eslint.config.mjs)
npx tsc --noEmit  # standalone typecheck
pnpm build        # production build; FAILS on TS errors; does NOT run lint
```

CI order (`.github/workflows/ci.yml`): `lint` → `tsc --noEmit` → `build`. No tests exist in this repo; build + typecheck are the verification gates. Node 20 required (CI and Dockerfile use node:20).

## Structure

- `lib/db.ts` — Dexie schema; authoritative table list (20+ tables). Bump `version(n)` for schema changes.
- `lib/types.ts` — all domain types, single source.
- `lib/services/*` — domain logic: `posService` (completeSale), `inventoryService`, `shiftService`, `printService`, `syncService` (syncEngine/outbox), `backupService`.
- `lib/mockData.ts` — seeds demo catalog/users/registers on first load. Reset app data by deleting IndexedDB `nexora_pos_db` in devtools; it re-seeds on reload.
- `components/*` — feature folders: pos, inventory, orders, shifts, dashboard, settings, command, offline.
- `app/api/products/generate-image/route.ts` — only API route; Gemini image generation, optional.
- Path alias `@/*` maps to repo root (see `tsconfig.json`).
- Deeper docs: `ARCHITECTURE.md`, `DEPLOYMENT.md`, `CONTRIBUTING.md`.

## Conventions

- Icons only from `lucide-react`. Tailwind utility classes, no inline styles. Tailwind v4 is CSS-first config (no `tailwind.config.js`).
- Data mutations go through Dexie `.transaction()` blocks for ACID — follow `lib/services`.
- Strict TS; `any` only with explicit justification.

## Gotchas

- **Lockfile mismatch**: only `pnpm-lock.yaml` exists; `bun.lock` was deleted and no `package-lock.json` exists. `npm ci` in CI and Dockerfile will fail. Commit a `package-lock.json` (`npm install --package-lock-only`) before working on CI/Docker, or migrate CI/Docker to pnpm.
- **ESLint 9 flat config only**: `eslint.config.mjs` is authoritative; legacy `.eslintrc.json` is ignored by ESLint 9 — do not edit it.
- `next.config.ts`: `eslint.ignoreDuringBuilds: true` (build never lints), `typescript.ignoreBuildErrors: false` (build enforces types), `output: 'standalone'`, plus a webpack `DISABLE_HMR` block for AI Studio — do not modify that block.
- Env (`pnpm dev` works without any): only `GEMINI_API_KEY` and `APP_URL` (`app/verify` self-links) per `.env.example`. Core POS runs fully without them; only image generation needs the Gemini key (route falls back to curated/vector placeholders).
- `public/sw.js` service worker caches the shell aggressively; unregister the SW or hard-refresh after asset changes.
- README's component/service tree is stale in places — trust `lib/db.ts` and real file layout over README.
- No test framework configured; do not add test scripts without asking.