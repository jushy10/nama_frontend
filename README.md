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
├── vite.config.ts          # Vite config (React, Tailwind, alias, Vitest)
├── Dockerfile              # Multi-stage build → nginx static server
├── nginx.conf              # SPA routing fallback + gzip + /health
└── .dockerignore
```

## Path alias

Import from `src/` using the `@/` prefix instead of long relative paths:

```ts
import Home from '@/pages/Home'
```

The alias is configured in both `vite.config.ts` (`resolve.alias`) and
`tsconfig.app.json` (`compilerOptions.paths`).

## Docker

The app is packaged as a static site served by nginx via a multi-stage build
(Node builds the bundle, nginx serves `dist/`). The final image is small and
has no Node runtime.

```bash
# Build the image (pass the API URL — Vite bakes it in at build time)
docker build --build-arg VITE_API_URL=https://api.namainsights.com -t nama-frontend .

# Run locally (maps container port 80 → host 8080)
docker run --rm -p 8080:80 nama-frontend
# → http://localhost:8080   ( / and /health both return 200 )
```

`nginx.conf` falls back to `index.html` for unmatched routes (`try_files $uri
$uri/ /index.html`), so React Router deep links resolve on refresh and the ALB
health check on `/` returns `200`.

**Container contract** (what ECS / the ALB target group expect):

- **Port:** `80` (HTTP; TLS terminates at the ALB)
- **Health check:** `GET /` → `200` (or the lightweight `GET /health` → `200 ok`)

> **Build-time config:** Vite inlines `import.meta.env.VITE_*` at **build time**,
> not at container start. `VITE_API_URL` is passed as a `--build-arg` and baked
> into the image (see the Dockerfile build stage and the CI workflow). Reference
> it in code as `import.meta.env.VITE_API_URL`.

## CI/CD — build, push & deploy

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) ("Build & Deploy
Frontend"):

- **On pull requests** — builds the image only (validation; no push).
- **On push to `main`** (and manual **Run workflow**) — builds, pushes to ECR
  (`:latest` and `:<commit-sha>`), then rolls the ECS service onto the new image
  with `aws ecs update-service --force-new-deployment`. If the service isn't
  `ACTIVE` yet it's skipped gracefully (the service pulls `:latest` on first
  launch).

`VITE_API_URL` is passed as a build arg, so the API base URL is baked into the
bundle at build time.

### Division of responsibility

The **ECR repository, ECS service, cluster, and ALB are created by the backend
repo's Terraform** (`module "frontend" { name = "nama-frontend-dev" }`). This
workflow waits for the ECR repo to exist, pushes the image, and forces a
redeploy — it does not manage infrastructure. The Terraform task definition
references the moving `:latest` tag this pushes, so a forced deployment re-pulls
the new image with no task-definition churn.

### What to set in this repo

Under _Settings → Secrets and variables → Actions_:

| Kind     | Name                    | Value                                                                           |
| -------- | ----------------------- | ------------------------------------------------------------------------------- |
| Secret   | `AWS_ACCESS_KEY_ID`     | the `nama-ci` user's key (its `nama-*` policy already covers `nama-frontend-*`) |
| Secret   | `AWS_SECRET_ACCESS_KEY` | the `nama-ci` user's secret                                                     |
| Variable | `AWS_REGION`            | optional; defaults to `us-east-1`                                               |

The `env:` block in `deploy.yml` pins `ECR_REPOSITORY` / `ECS_CLUSTER` /
`ECS_SERVICE` to `nama-frontend-dev` and `VITE_API_URL` to the backend API —
adjust if the infra names differ.

> **Backend CORS:** once the frontend is live, the FastAPI backend must include
> `https://namainsights.com` and `https://www.namainsights.com` in its
> `CORSMiddleware` `allow_origins`, or the browser will block API calls.
