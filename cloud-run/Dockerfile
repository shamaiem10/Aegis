# AEGIS API — Cloud Run
FROM node:20-slim

# Chromium for puppeteer-core (scraping). Image must not download its own browser binary.
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# Debian chromium package — adjust if your base image uses a different path.
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build \
  && npm prune --omit=dev

EXPOSE 8080

ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
