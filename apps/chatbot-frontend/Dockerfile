# ── Stage 1: Builder ──────────────────────────────────────────────────────────
# The admin-console is a standalone Vite/React app (not in the pnpm/Turbo
# monorepo), so we install + build directly inside its own directory.
FROM node:22-bookworm-slim AS builder

# Enable pnpm via corepack — same version used across the entire monorepo
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

WORKDIR /app

COPY . .
RUN printf 'allowBuilds:\n  esbuild: true\n' > pnpm-workspace.yaml && \
    pnpm install --no-frozen-lockfile && \
    pnpm run build

# ── Stage 2: Runner (Nginx) ───────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Inline nginx config:
#  - SPA fallback (try_files -> /index.html)
#  - Proxy /api/* -> chatbot-backend:8000
#  - Long-lived cache for hashed assets
RUN printf 'server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    resolver 127.0.0.11 valid=30s ipv6=off;\n\
    \n\
    location /api/ {\n\
    set $chatbot_backend http://chatbot-backend:8000;\n\
    proxy_pass $chatbot_backend;\n\
    proxy_set_header Host $host;\n\
    proxy_set_header X-Real-IP $remote_addr;\n\
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n\
    proxy_set_header X-Forwarded-Proto $scheme;\n\
    proxy_read_timeout 120s;\n\
    }\n\
    \n\
    location / {\n\
    try_files $uri $uri/ /index.html;\n\
    }\n\
    \n\
    location /assets/ {\n\
    expires 1y;\n\
    add_header Cache-Control "public, immutable";\n\
    }\n\
    }\n' > /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
