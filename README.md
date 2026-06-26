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
> `VITE_API_URL` is set in `deploy.yml`'s `env:` and baked into the bundle;
> reference it in code as `import.meta.env.VITE_API_URL`.

### What to set in this repo

Under _Settings → Secrets and variables → Actions_:

| Kind     | Name                    | Value                                                             |
| -------- | ----------------------- | ----------------------------------------------------------------- |
| Secret   | `AWS_ACCESS_KEY_ID`     | the `nama-ci` user's key (PowerUserAccess covers S3 + CloudFront) |
| Secret   | `AWS_SECRET_ACCESS_KEY` | the `nama-ci` user's secret                                       |
| Variable | `AWS_REGION`            | optional; defaults to `us-east-1`                                 |

> **Backend CORS:** once the frontend is live, the FastAPI backend must include
> `https://namainsights.com` and `https://www.namainsights.com` in its
> `CORSMiddleware` `allow_origins`, or the browser will block API calls.
