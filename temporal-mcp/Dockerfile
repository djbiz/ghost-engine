FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
ENV MCP_TRANSPORT=sse
ENV PORT=3100
EXPOSE 3100
CMD ["node", "dist/index.js"]
