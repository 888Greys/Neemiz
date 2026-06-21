# Neemiz withdrawal signer. Minimal image; runs TypeScript directly via tsx.
FROM node:22-alpine

WORKDIR /app

# Install deps first for layer caching
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src

# State (daily caps + idempotency) persists here — mount a volume at /data
ENV SIGNER_STATE_DIR=/data
VOLUME ["/data"]

EXPOSE 8787

# No shell form — exec form so signals reach node
CMD ["npx", "tsx", "src/index.ts"]
