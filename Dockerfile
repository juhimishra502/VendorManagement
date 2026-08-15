# Stage 1: Build the React frontend
FROM node:22-alpine AS frontend-build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci

COPY apps/web/ apps/web/
COPY packages/shared/ packages/shared/
RUN npm run build --workspace packages/shared
RUN npm run build --workspace apps/web

# Stage 2: Build the Express backend
FROM node:22-alpine AS backend-build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci

COPY apps/api/ apps/api/
COPY packages/shared/ packages/shared/
COPY packages/db/ packages/db/
RUN npm run build --workspace packages/shared
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma
# Build the db package (Prisma client wrapper) BEFORE the API — apps/api imports
# `prisma` from @vendor-management/db, whose types live in dist/. Without this the
# API's tsc can't resolve those types and fails with noImplicitAny errors.
RUN npm run build --workspace packages/db
RUN npm run build --workspace apps/api

# Stage 3: Run both applications in one image
FROM node:22-alpine AS production

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci --omit=dev

COPY packages/db/ packages/db/
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

# Workspace package builds are needed at runtime: apps/api imports
# @vendor-management/shared and @vendor-management/db, which resolve to their dist/.
COPY --from=backend-build /app/packages/shared/dist/ packages/shared/dist/
COPY --from=backend-build /app/packages/db/dist/ packages/db/dist/
COPY --from=backend-build /app/apps/api/dist/ apps/api/dist/
COPY --from=frontend-build /app/apps/web/dist/ apps/api/frontend/

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma && node apps/api/dist/index.js"]
