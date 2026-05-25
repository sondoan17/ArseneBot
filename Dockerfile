FROM node:22-alpine
RUN apk add --no-cache chromium ffmpeg python3 xvfb-run
RUN wget -q https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev && npm install playwright-core@^1.52.0 --no-save
COPY . .

RUN chmod +x /app/docker-entrypoint.sh /app/scripts/refresh-yt-auth.js \
    && addgroup -g 1001 bot \
    && adduser -u 1001 -G bot -s /bin/sh -D bot \
    && mkdir -p /home/bot/.config/chromium \
    && chown -R bot:bot /app /home/bot
USER bot
CMD ["/app/docker-entrypoint.sh"]
