# ArseneBot

Discord YouTube music bot — full-featured slash commands (play, queue, loop, shuffle, seek, volume, auto-leave).

**Stack:** Node.js 20+, discord.js v14, @discordjs/voice, play-dl

## Tính năng

| Lệnh | Mô tả |
|---|---|
| `/play <query>` | Phát URL video, URL playlist, hoặc keyword search |
| `/skip` | Bỏ bài hiện tại |
| `/stop` | Dừng phát, xóa queue |
| `/pause` / `/resume` | Tạm dừng / tiếp tục |
| `/queue` | Hiển thị hàng đợi |
| `/nowplaying` | Bài đang phát |
| `/volume <0-200>` | Chỉnh âm lượng |
| `/loop <off\|track\|queue>` | Chế độ lặp |
| `/shuffle` | Xáo trộn queue |
| `/seek <seconds>` | Tua bài đang phát |
| `/remove <index>` | Xóa bài khỏi queue (1-based) |
| `/leave` | Rời voice channel |

Auto-leave sau 5 phút khi voice channel trống hoặc queue rỗng.

## Setup local

### 1. Yêu cầu

- Node.js 20+
- `ffmpeg` (cài qua hệ thống hoặc dùng `ffmpeg-static` đã có trong dependencies)
- Python 3 (cho `play-dl` extract)

### 2. Cài đặt

```bash
git clone <repo>
cd ArseneBot
npm install
```

### 3. Tạo Discord bot

1. Vào https://discord.com/developers/applications → New Application.
2. Tab **Bot** → tạo bot, copy **Token**.
3. Tab **Bot** → bật `SERVER MEMBERS INTENT` (không bắt buộc) và `MESSAGE CONTENT INTENT` (không bắt buộc cho slash commands, nhưng có thể bật để mở rộng sau).
4. Tab **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Connect`, `Speak`, `Send Messages`, `Use Slash Commands`, `Embed Links`
   - Mở URL kết quả → invite bot vào server test.

### 4. Cấu hình `.env`

```bash
cp .env.example .env
```

Điền:

```
DISCORD_TOKEN=<bot token>
DISCORD_CLIENT_ID=<application id>
DISCORD_GUILD_ID=<server id để dev cho nhanh>
YOUTUBE_COOKIE=             # optional, xem mục Troubleshooting
LOG_LEVEL=info
```

### 5. Đăng ký slash commands

```bash
npm run deploy
```

- Có `DISCORD_GUILD_ID` → đăng ký guild commands (hiện ngay).
- Không có → đăng ký global (cache Discord 1 giờ).

### 6. Chạy bot

```bash
npm start
# hoặc dev mode (auto-reload)
npm run dev
```

## Deploy với Docker

```bash
docker build -t arsenebot .
docker run --env-file .env arsenebot
```

## Troubleshooting

### "Sign in to confirm you're not a bot"

YouTube đôi khi đòi xác thực với IP server. Cách fix:

1. Mở YouTube trên Chrome (đã đăng nhập).
2. DevTools (F12) → tab **Application** → **Cookies** → `https://www.youtube.com`.
3. Copy tất cả cookies dạng `name1=value1; name2=value2; ...`.
4. Dán vào `YOUTUBE_COOKIE` trong `.env`.
5. Restart bot.

**Cảnh báo:** Cookie có quyền truy cập tài khoản YouTube — KHÔNG share file `.env`.

### Bot không phát nhạc

- Verify `ffmpeg` đã cài (`ffmpeg -version`).
- Verify bot có quyền `Connect` + `Speak` ở voice channel.
- Verify bot không bị mute server-wide.

### Bot crash với lỗi opus

```bash
npm rebuild @discordjs/opus
```

## Manual test checklist

- [ ] `/play <video URL>` — phát đúng bài
- [ ] `/play <playlist URL>` — add toàn bộ playlist
- [ ] `/play <keyword>` — search và phát kết quả đầu
- [ ] `/skip`, `/pause`, `/resume`, `/stop`
- [ ] `/queue`, `/nowplaying`
- [ ] `/loop track`, `/loop queue`, `/loop off`
- [ ] `/shuffle`, `/remove <index>`, `/seek <seconds>`
- [ ] `/volume 50`, `/volume 150`
- [ ] Auto-leave sau 5 phút khi không ai trong voice
- [ ] Bot bị kick khỏi voice → cleanup không crash

## Cấu trúc dự án

Xem [docs/superpowers/specs/2026-05-21-arsenebot-discord-music-design.md](docs/superpowers/specs/2026-05-21-arsenebot-discord-music-design.md) để biết thiết kế chi tiết.
