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

## CI/CD — build & push to ECR

[`.github/workflows/ecr-push.yml`](.github/workflows/ecr-push.yml) builds the
image and pushes it to Amazon ECR on every push to `main` (and via manual
**Run workflow**). It authenticates with **GitHub OIDC** — no long-lived AWS
keys are stored. Each run pushes two tags: `latest` and the commit SHA.

### One-time setup

1. **Create the ECR repository:**

   ```bash
   aws ecr create-repository --repository-name nama-frontend
   ```

2. **Create the GitHub OIDC provider** in AWS (once per account), if it doesn't
   already exist:

   ```bash
   aws iam create-open-id-connect-provider \
     --url https://token.actions.githubusercontent.com \
     --client-id-list sts.amazonaws.com
   ```

3. **Create an IAM role** the workflow can assume, with this trust policy
   (replace `<ACCOUNT_ID>` and the repo if forked):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
         },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
           "StringEquals": {
             "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
           },
           "StringLike": {
             "token.actions.githubusercontent.com:sub": "repo:jushy10/nama_frontend:*"
           }
         }
       }
     ]
   }
   ```

   Attach a policy allowing ECR push (the managed
   `AmazonEC2ContainerRegistryPowerUser` policy is sufficient).

4. **Add the role ARN** as a repository secret named `AWS_ROLE_ARN`
   (_Settings → Secrets and variables → Actions_).

5. Adjust `AWS_REGION` / `ECR_REPOSITORY` in the workflow's `env:` block if they
   differ from `us-east-1` / `nama-frontend`.

> To also deploy automatically after the push (render a new task definition and
> update the ECS service via `aws-actions/amazon-ecs-deploy-task-definition`),
> add a deploy job — happy to wire that up when the cluster/service exist.
