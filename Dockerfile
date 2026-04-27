FROM node:20-slim

# Install build tools needed for native modules like tree-sitter
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# Build Forge server + web IDE renderer so /forge/app is available in production.
RUN npm run build \
    && cd skia-ide \
    && npm install \
    && npm run build

EXPOSE 4173

CMD ["npm", "run", "dev"]