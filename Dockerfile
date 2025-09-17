# Multi-stage build: build frontend, then serve with Node backend
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY backend ./backend
COPY --from=build /app/dist ./dist
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && \
    cd backend && npm ci --omit=dev --no-audit --no-fund || true
EXPOSE 3001
CMD ["node", "backend/server.js"]

