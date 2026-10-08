FROM node:20-slim

# Install build tools needed for native modules like tree-sitter
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# MIT SKIA Semgrep rules (never Semgrep Registry / --config=auto).
# Explicit COPY keeps path /app/config/semgrep/skia-rules.yaml stable in the image
# even if future .dockerignore changes; the prior `COPY . .` already includes them.
COPY config/semgrep/ /app/config/semgrep/

# Semgrep CE on Debian (glibc) — used by run_semgrep agent tool.
RUN pip3 install --no-cache-dir --break-system-packages semgrep==1.137.0 pydantic==2.13.5 \
    && semgrep --version \
    && test -f /app/config/semgrep/skia-rules.yaml

# Build Forge server + web IDE renderer so /forge/app is available in production.
RUN npm run build \
    && cd skia-ide \
    && npm install \
    && npm run build

EXPOSE 4173

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s CMD node -e "require('http').get('http://localhost:4173/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["npm", "start"]