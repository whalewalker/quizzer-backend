# ===== Base Image =====
FROM node:20-alpine AS base
WORKDIR /app

# ===== Dependencies =====
FROM base AS deps

# Install OS deps for Prisma
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install all deps (production only)
RUN npm ci --omit=dev

# ===== Build =====
FROM base AS build

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .

# Generate Prisma client + Build app
RUN npx prisma generate && npm run build

# ===== Production =====
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache dumb-init openssl

# Create non-root user
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

WORKDIR /app

# Copy production deps
COPY --from=deps /app/node_modules ./node_modules

# Copy prisma client + build output
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY package.json package-lock.json ./ 

USER nestjs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
