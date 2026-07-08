# WTK Socket.io game server (apps/server).
# It runs the shared engine (packages/game) as raw TypeScript via `tsx` — there is no
# compile step — so the install MUST include devDependencies (tsx). Do NOT use --omit=dev.
FROM node:22-slim
WORKDIR /app

# Whole monorepo: the server loads packages/game + data/generated/*.json at runtime.
COPY . .
RUN npm ci

ENV NODE_ENV=production
# Run as the non-root `node` user (built into node:22-slim). Files stay root-owned
# read-only to the app — the process cannot rewrite its own code if compromised.
USER node
# Koyeb injects PORT (default 8000); the server binds to process.env.PORT.
EXPOSE 8000
CMD ["npm", "run", "start", "-w", "@wtk/server"]
