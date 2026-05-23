FROM node:20-alpine
RUN apk add --no-cache ffmpeg python3
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN addgroup -g 1001 bot && adduser -u 1001 -G bot -s /bin/sh -D bot && chown -R bot:bot /app
USER bot
CMD ["node", "src/index.js"]
