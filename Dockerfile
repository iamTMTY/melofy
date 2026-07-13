FROM node:20-alpine

WORKDIR /app

# Copy entire monorepo so workspace links resolve
COPY package.json package-lock.json* ./
COPY client/package.json client/package-lock.json* ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/

# Install all dependencies (workspaces link @melofy/shared)
RUN npm install

# Copy source
COPY shared/src/ ./shared/src/
COPY client/ ./client/

# Build Next.js
WORKDIR /app/client
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
