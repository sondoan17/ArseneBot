FROM node:20-alpine
RUN apk add --no-cache ffmpeg python3
RUN wget -q https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN addgroup -g 1001 bot && adduser -u 1001 -G bot -s /bin/sh -D bot && chown -R bot:bot /app
USER bot
CMD ["node", "src/index.js"]
