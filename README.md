# nama_frontend

A frontend built with **Vite + React + TypeScript**, including:

- **ESLint + Prettier** — linting and formatting
- **Tailwind CSS v4** — utility-first styling (via `@tailwindcss/vite`)
- **React Router v7** — client-side routing
- **Vitest + Testing Library** — unit/component tests (jsdom)
- **`@/` path alias** — `@/` resolves to `src/`

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (20 LTS recommended) and npm

## Getting started

```bash
npm install      # install dependencies
npm run dev      # start the dev server (http://localhost:5173)
```

## Scripts

| Command                | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `npm run dev`          | Start the Vite dev server with hot reload        |
| `npm run build`        | Type-check and build for production into `dist/` |
| `npm run preview`      | Preview the production build locally             |
| `npm run lint`         | Lint the project with ESLint                     |
| `npm run test`         | Run tests in watch mode (Vitest)                 |
| `npm run test:run`     | Run tests once (CI mode)                         |
| `npm run format`       | Format all files with Prettier                   |
| `npm run format:check` | Check formatting without writing changes         |

## Project structure

```
.
├── index.html              # App entry HTML
├── public/                 # Static assets served as-is (favicon, etc.)
├── src/
│   ├── assets/             # Imported assets (logos, images)
│   ├── pages/              # Route components
│   │   ├── Home.tsx
│   │   ├── Home.test.tsx
│   │   └── About.tsx
│   ├── test/
│   │   └── setup.ts        # Vitest setup (jest-dom matchers, cleanup)
│   ├── App.tsx             # Layout + route definitions
│   ├── App.test.tsx        # Routing tests
│   ├── main.tsx            # App bootstrap (BrowserRouter + render root)
│   ├── index.css           # Global styles + Tailwind import
│   └── App.css             # Component styles
├── eslint.config.js        # ESLint (flat config) + Prettier integration
├── .prettierrc.json        # Prettier options
├── tsconfig*.json          # TypeScript config (incl. @/ path alias)
└── vite.config.ts          # Vite config (React, Tailwind, alias, Vitest)
```

## Path alias

Import from `src/` using the `@/` prefix instead of long relative paths:

```ts
import Home from '@/pages/Home'
```

The alias is configured in both `vite.config.ts` (`resolve.alias`) and
`tsconfig.app.json` (`compilerOptions.paths`).

## Deployment

The app is a static Vite bundle served from a private **S3 bucket behind
CloudFront** (HTTPS at `namainsights.com` + `www`). The bucket and distribution
are created by the backend repo's Terraform (`module "frontend"` →
`static-site-cloudfront`); this repo only builds and uploads.

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) ("Build & Deploy
Frontend"):

- **On pull requests** — builds the bundle only (validation; no upload).
- **On push to `main`** (and manual **Run workflow**) — builds, then resolves the
  bucket (name prefix `nama-frontend-dev-`) and distribution (apex alias) and:
  - `aws s3 sync dist … --delete` — fingerprinted assets get a one-year immutable
    cache; `index.html` is uploaded `no-cache` so a new build shows immediately.
  - `aws cloudfront create-invalidation --paths "/*"`.

Resolving the targets at deploy time (rather than hardcoding the bucket suffix /
distribution id) means a destroy+recreate of the infra doesn't break deploys.

> **Build-time config:** Vite inlines `import.meta.env.VITE_*` at **build time**.
> `VITE_API_URL` and the `VITE_PUBLIC_POSTHOG_*` analytics vars are set in
> `deploy.yml`'s `env:` and baked into the bundle; reference them in code as
> `import.meta.env.VITE_*`.

### What to set in this repo

Under _Settings → Secrets and variables → Actions_:

| Kind     | Name                       | Value                                                             |
| -------- | -------------------------- | ----------------------------------------------------------------- |
| Secret   | `AWS_ACCESS_KEY_ID`        | the `nama-ci` user's key (PowerUserAccess covers S3 + CloudFront) |
| Secret   | `AWS_SECRET_ACCESS_KEY`    | the `nama-ci` user's secret                                       |
| Variable | `AWS_REGION`               | optional; defaults to `us-east-1`                                 |
| Variable | `VITE_PUBLIC_POSTHOG_KEY`  | optional; PostHog project API key — set it to turn analytics on   |
| Variable | `VITE_PUBLIC_POSTHOG_HOST` | optional; PostHog host, defaults to `https://us.i.posthog.com`    |

> **Backend CORS:** once the frontend is live, the FastAPI backend must include
> `https://namainsights.com` and `https://www.namainsights.com` in its
> `CORSMiddleware` `allow_origins`, or the browser will block API calls.

## Analytics

Product analytics run on [PostHog](https://posthog.com) — how many unique
visitors, which pages they open, and what they do. Everyone is **anonymous**
(no login, no accounts); "unique users" are counted by an anonymous per-browser
id, and PostHog's dashboards break out new vs. returning and retention out of
the box.

The wiring lives in [`src/lib/analytics.tsx`](src/lib/analytics.tsx):

- **Pageviews** — captured on every client-side route change (this is a Vite/React
  SPA, so PostHog's automatic pageview would miss in-app navigation).
- **Autocapture** — clicks and other generic interactions, no code needed.
- **Custom events** — call `trackEvent(name, props)` for the actions worth naming
  (the search page already fires `ticker_viewed` with the ticker + asset type).

Analytics are **off unless `VITE_PUBLIC_POSTHOG_KEY` is set**, so `npm run dev`,
the test run, and PR preview builds send nothing. To turn it on:

1. Create a free project at [posthog.com](https://posthog.com) and copy its
   **Project API key** (starts with `phc_`). It's a publishable client-side key —
   safe to ship in the browser bundle.
2. Add it as the `VITE_PUBLIC_POSTHOG_KEY` Actions **variable** (above). The next
   deploy bakes it in and analytics starts flowing.
3. If your project is on PostHog's EU cloud, also set `VITE_PUBLIC_POSTHOG_HOST`
   to `https://eu.i.posthog.com`.
