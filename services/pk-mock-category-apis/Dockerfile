# GCP Cloud Run / Artifact Registry container (GCP project aegis-496207, region us-central1 typical)
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY src ./src
RUN npm ci && npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/server.js"]
