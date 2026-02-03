FROM node:22-slim

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.21.0 --activate

WORKDIR /app

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/schema/package.json ./packages/schema/
COPY packages/utils/package.json ./packages/utils/
COPY tooling/typescript/package.json ./tooling/typescript/

# Install dependencies
RUN pnpm install --frozen-lockfile --prod=false

# Copy source code
COPY apps/server ./apps/server
COPY packages/schema ./packages/schema
COPY packages/utils ./packages/utils
COPY tooling/typescript ./tooling/typescript

# Environment
ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

# Run migrations then start the server
CMD ["sh", "-c", "pnpm --filter @floyd-run/engine migrate && pnpm --filter @floyd-run/engine start"]
