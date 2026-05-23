FROM node:20-alpine
RUN apk add --no-cache ffmpeg python3
RUN wget -q https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# Entrypoint: write YouTube cookies from env var to Netscape file
RUN echo '#!/bin/sh' > /entrypoint.sh && \
    echo 'if [ -n "$YOUTUBE_COOKIE" ]; then' >> /entrypoint.sh && \
    echo '  python3 -c "import json,os,sys; cookies=json.loads(os.environ[\"YOUTUBE_COOKIE\"]); [sys.stdout.write(f\"{c[\"domain\"]}\t{\"TRUE\" if c[\"domain\"].startswith(\".\") else \"FALSE\"}\t{c.get(\"path\",\"/\")}\t{\"TRUE\" if c.get(\"secure\") else \"FALSE\"}\t{int(c.get(\"expirationDate\",0))}\t{c[\"name\"]}\t{c[\"value\"]}\n\") for c in cookies]" > /app/cookies.txt' >> /entrypoint.sh && \
    echo 'fi' >> /entrypoint.sh && \
    echo 'exec node src/index.js' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

RUN addgroup -g 1001 bot && adduser -u 1001 -G bot -s /bin/sh -D bot && chown -R bot:bot /app
USER bot
CMD ["/entrypoint.sh"]
