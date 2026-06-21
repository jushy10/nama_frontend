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
# Build the image
docker build -t nama-frontend .

# Run locally (maps container port 80 → host 8080)
docker run --rm -p 8080:80 nama-frontend
# → http://localhost:8080   (health check: http://localhost:8080/health)
```

`nginx.conf` falls back to `index.html` for unmatched routes so React Router
client-side routes resolve on direct navigation / refresh.

### Deploying to ECS

1. **Build & push** to ECR:

   ```bash
   AWS_REGION=us-east-1
   ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
   REPO=$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/nama-frontend

   aws ecr create-repository --repository-name nama-frontend --region $AWS_REGION
   aws ecr get-login-password --region $AWS_REGION \
     | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
   docker build -t $REPO:latest .
   docker push $REPO:latest
   ```

   > On Apple Silicon / ARM, build for the Fargate platform with
   > `docker build --platform linux/amd64 ...` (or set the task's CPU
   > architecture to `ARM64`).

2. **Task definition** — container port `80`. Point the ALB target group's
   health check at `/health`.

3. **Service** — run behind an Application Load Balancer; the target group
   forwards to container port `80`.

> **Note:** Vite inlines `import.meta.env.VITE_*` values at **build time**, not
> at container start. Per-environment config must be passed as build args and
> baked into the image (e.g. one image per environment), not via ECS runtime
> environment variables.

## CI/CD — build, push & deploy

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs on every push
to `main` (and via manual **Run workflow**) and:

1. Builds the Docker image and **pushes it to Amazon ECR** — `linux/amd64`,
   tagged `:latest` (moving) and `:<commit-sha>` (immutable).
2. **Triggers a rolling deployment** of the existing ECS service
   (`aws ecs update-service --force-new-deployment`) and waits for it to
   stabilize.

It authenticates with **GitHub OIDC** — no long-lived AWS keys are stored.

### Division of responsibility

The **task definition, ECS service, cluster, IAM roles, and ALB are managed by
Terraform** (in the backend repo). This workflow does **not** create or modify
them — it only pushes a new image and forces the service to redeploy.

For the redeploy to pick up the new image, the Terraform task definition must
reference the **moving tag** this workflow pushes:

```
<account>.dkr.ecr.<region>.amazonaws.com/nama-frontend:latest
```

Because the tag string never changes, Terraform sees no diff and a
`--force-new-deployment` re-pulls `:latest` — no new task definition revision is
registered, so there's **no Terraform drift**.

> **Rollback:** pin the task definition's image to a specific `:<sha>` in
> Terraform and apply.

### What the Terraform (backend) repo must provide

- The task definition's container image set to the ECR repo with the `:latest`
  tag (above).
- A **GitHub OIDC provider** and an **IAM role** the workflow assumes, whose
  trust policy allows this repo
  (`repo:jushy10/nama_frontend:*` on `token.actions.githubusercontent.com`), with
  permissions for **ECR push** (e.g. `AmazonEC2ContainerRegistryPowerUser`) plus:

  ```json
  {
    "Effect": "Allow",
    "Action": ["ecs:UpdateService", "ecs:DescribeServices"],
    "Resource": "*"
  }
  ```

  (No `iam:PassRole` / `RegisterTaskDefinition` needed — this workflow never
  registers a task definition.)

### What to set in this repo

1. Add the IAM role ARN as a repository secret named `AWS_ROLE_ARN`
   (_Settings → Secrets and variables → Actions_).
2. Adjust the `env:` block in `deploy.yml` (`AWS_REGION`, `ECR_REPOSITORY`,
   `ECS_CLUSTER`, `ECS_SERVICE`) to match the names Terraform created.
