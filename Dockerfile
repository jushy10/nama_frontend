# syntax=docker/dockerfile:1

# ---- Build stage ----
# Compiles the Vite app into static assets in /app/dist.
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies first to leverage Docker layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Build the production bundle. Vite inlines VITE_* env vars at build time, so
# the API URL is supplied as a build arg and exported before the build runs.
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- Runtime stage ----
# Serves the static build with nginx. Small, fast, and ECS-friendly.
FROM nginx:1.27-alpine AS runtime

# SPA-aware nginx config (client-side routing fallback + gzip + /health).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy only the built assets from the build stage.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Container-level health check (ECS can also use this via the task definition).
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
