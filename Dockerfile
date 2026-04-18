FROM node:20-slim

# System dependencies for PDF → image conversion and native module compilation.
#
# graphicsmagick  — image processing binary required by pdf2pic
# ghostscript     — PDF renderer; GraphicsMagick delegates PDF work to it
# python3/make/g++ — build tools for native Node addons (better-sqlite3, sharp)
#                   used as fallback if prebuilt binaries aren't available for
#                   this platform
RUN apt-get update && apt-get install -y --no-install-recommends \
    graphicsmagick \
    ghostscript \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Server dependencies ──────────────────────────────────────────
# Copy lockfiles before source so this layer is cached until deps change
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# ── Client build ─────────────────────────────────────────────────
# Separate cache layer: client deps only reinstall when client/package-lock.json changes
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm install

# Copy client source then build — layer only invalidates on frontend changes
COPY client/ ./client/
RUN cd client && npm run build

# ── Application source ───────────────────────────────────────────
COPY src/ ./src/
COPY samples/ ./samples/

# Pre-create runtime write directories so the app doesn't need to mkdir on
# first request (initProjectStore and db.js will also create them, but this
# ensures correct ownership when the container starts as a non-root user)
RUN mkdir -p uploads data

EXPOSE 10000

CMD ["node", "src/index.js"]
