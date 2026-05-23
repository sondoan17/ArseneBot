FROM node:20-alpine
RUN apk add --no-cache ffmpeg python3
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["node", "src/index.js"]
