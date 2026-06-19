# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

# Copy packages
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate prisma client
RUN npx prisma generate

# Copy source code and build
COPY . .
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Stage 2: Production slim runner
FROM node:20-alpine AS runner

WORKDIR /app

# Copy production files
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

# Ensure uploads directories exist
RUN mkdir -p uploads/tasks uploads/avatars

EXPOSE 3001

ENV NODE_ENV=production

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
