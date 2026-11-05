# INTENTIONALLY VULNERABLE - LAB ONLY
# Stage 1: Build & dependency resolution with staging seed keys
FROM node:20-alpine AS builder
WORKDIR /build
COPY package.json .
RUN npm install --no-audit --no-fund
# Flaw: Staging configuration generated during build stage with hardcoded seed keys
RUN echo "STAGING_DEALER_PARTNER_KEY=LAB{docker_multistage_staging_seed_leak}" > /build/.env.staging.local

# Stage 2: Production runtime image
FROM node:20-alpine AS runner
LABEL maintainer="catalog-team@automarket.internal"
LABEL org.automarket.catalog.build="2026.10-release"
LABEL org.automarket.catalog.internal_repo="git@github.internal:automarket/catalog-service.git"

WORKDIR /code
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/package.json .
# Flaw: Accidental build artifact spillage from builder stage
COPY --from=builder /build/.env.staging.local /code/.env.staging.local
COPY server.js .
COPY images/ ./images/
RUN mkdir -p /tmp/uploads uploads && echo "LAB{traversal_secret_flag}" > secret.txt && echo "LAB{etc_passwd_sim}" > /tmp/flag.txt && cp secret.txt images/secret.txt
EXPOSE 3000
CMD ["node", "server.js"]

