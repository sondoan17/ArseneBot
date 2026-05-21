# ArseneBot — Discord YouTube Music Bot Design

**Date:** 2026-05-21
**Status:** Approved (sections 1–5)
**Stack:** Node.js 20+, discord.js v14, @discordjs/voice, play-dl

## Mục tiêu

Bot Discord phát nhạc YouTube với bộ tính năng đầy đủ (play / queue / loop / shuffle / seek / volume / auto-leave). Triển khai dạng slash commands. Local dev có Dockerfile + `.env` để dễ deploy về sau. State in-memory, không persist qua restart.

## Phạm vi tính năng (v1)

Slash commands:

- `/play query:<string>` — phát bằng URL video, URL playlist, hoặc keyword search.
- `/skip` — bỏ bài hiện tại.
- `/stop` — dừng phát, xóa queue.
- `/pause`, `/resume` — tạm dừng / tiếp tục.
- `/queue` — hiển thị hàng đợi.
- `/nowplaying` — hiển thị bài đang phát.
- `/volume <0–200>` — chỉnh âm lượng.
- `/loop <off|track|queue>` — chế độ lặp.
- `/shuffle` — xáo trộn queue.
- `/seek <seconds>` — tua bài đang phát đến vị trí tuyệt đối tính bằng giây (0 = từ đầu).
- `/remove <index>` — xóa bài khỏi queue, `index` đánh số 1-based (1 = bài đầu queue, không tính bài đang phát).
- `/leave` — rời voice channel.

Auto-leave sau 5 phút khi:
- Không còn user nào trong voice channel cùng bot, hoặc
- Queue rỗng và không có bài đang phát.

## Ngoài phạm vi (v1)

- Nguồn nhạc khác YouTube (SoundCloud, Spotify).
- Prefix commands.
- Persistent queue qua restart.
- Đa voice channel song song trong cùng server.
- Lyrics, equalizer, filter audio.

## Kiến trúc

### Cấu trúc thư mục

```
ArseneBot/
├── src/
│   ├── index.js                  # Entry point: load env, khởi tạo client, login
│   ├── config.js                 # Đọc & validate biến môi trường
│   ├── bot/
│   │   ├── client.js             # Tạo Discord Client với intents cần thiết
│   │   ├── commandLoader.js      # Quét src/commands/, đăng ký vào client
│   │   └── eventLoader.js        # Quét src/events/, attach vào client
│   ├── commands/                 # Mỗi file = 1 slash command (data + execute)
│   │   ├── play.js
│   │   ├── skip.js
│   │   ├── stop.js
│   │   ├── pause.js
│   │   ├── resume.js
│   │   ├── queue.js
│   │   ├── nowplaying.js
│   │   ├── volume.js
│   │   ├── loop.js
│   │   ├── shuffle.js
│   │   ├── seek.js
│   │   ├── remove.js
│   │   └── leave.js
│   ├── events/
│   │   ├── ready.js
│   │   ├── interactionCreate.js  # Dispatch slash command
│   │   └── voiceStateUpdate.js   # Auto-leave khi không còn ai
│   ├── music/
│   │   ├── MusicManager.js       # Map<guildId, GuildPlayer>, factory + lookup
│   │   ├── GuildPlayer.js        # Per-guild: queue, audio player, voice connection, loop/volume state
│   │   ├── Track.js              # { title, url, duration, requestedBy, thumbnail }
│   │   └── youtube.js            # Wrapper play-dl: resolve URL/keyword/playlist → Track[]
│   ├── ui/
│   │   └── embeds.js             # Tạo embed nhất quán: nowplaying, queue, error
│   └── utils/
│       └── format.js             # formatDuration, truncate, v.v.
├── scripts/
│   └── deploy-commands.js        # Đăng ký slash commands lên Discord (chạy thủ công)
├── .env.example
├── .gitignore
├── Dockerfile
├── package.json
└── README.md
```

### Nguyên tắc tách lớp

- `commands/` chỉ parse interaction options và gọi `MusicManager` — không chứa logic âm nhạc.
- `MusicManager` quản lý vòng đời `GuildPlayer` theo từng guild.
- `GuildPlayer` đóng gói toàn bộ trạng thái phát của một guild.
- `music/youtube.js` là lớp duy nhất biết đến `play-dl` — đổi library sau này chỉ sửa 1 file.
- `ui/embeds.js` tách formatting ra khỏi logic — response nhất quán.

## State model: `GuildPlayer`

```
GuildPlayer {
  guildId:         string
  voiceChannelId:  string | null
  textChannelId:   string
  connection:      VoiceConnection
  audioPlayer:     AudioPlayer

  queue:           Track[]           // KHÔNG chứa bài đang phát
  current:         Track | null
  history:         Track[]

  loopMode:        'off' | 'track' | 'queue'
  volume:          number            // 0..200, default 100
  paused:          boolean

  idleTimer:       Timeout | null
}
```

### Quyết định thiết kế

1. **`current` tách khỏi `queue`** để tránh nhầm lẫn "bài đầu queue có phải bài đang phát không". Khi bài kết thúc: pop từ `queue` → set vào `current`.

2. **Loop semantics:**
   - `off`: phát xong → bỏ `current`, lấy bài tiếp theo.
   - `track`: phát xong → phát lại chính `current` đó.
   - `queue`: phát xong → push `current` vào cuối `queue`, rồi lấy bài tiếp theo.

3. **Volume** áp dụng qua `inlineVolume: true` của `createAudioResource`. Range 0–200, default 100.

4. **Không persist queue.** Restart = mất hết. Đơn giản, không cần serialize/deserialize.

5. **Auto-leave** trong 2 trường hợp (5 phút timer):
   - Không còn user nào trong voice channel (qua event `voiceStateUpdate`).
   - Queue rỗng + không có `current`.
   - Activity mới (user join lại, bài mới được add) → clear timer.

6. **Vòng đời `GuildPlayer`:**
   - Tạo lazy: lệnh `play` đầu tiên trong guild → `MusicManager.getOrCreate(guildId)`.
   - Hủy: khi rời voice → destroy connection + audioPlayer, xóa khỏi `Map`.
   - 1 guild = tối đa 1 `GuildPlayer` cùng lúc.

## Data flow: lệnh `/play`

```
1. defer interaction (resolve có thể lâu, qua 3s timeout)
   └─ ephemeral: false

2. Validate user đang ở voice channel
   └─ Không → reply "Bạn cần vào voice channel trước"

3. Validate bot có quyền join + speak ở channel đó
   └─ Không → reply lỗi cụ thể

4. Resolve query qua music/youtube.js:
   ├─ play-dl validate(query) → 'video' | 'playlist' | 'search' | false
   ├─ video URL  → play.video_basic_info(url) → 1 Track
   ├─ playlist   → play.playlist_info(url, { incomplete: true }) → N Tracks
   └─ search     → play.search(query, { limit: 1, source: { youtube: 'video' } }) → 1 Track

   Nếu 0 kết quả → reply "Không tìm thấy"
   Nếu lỗi network/cookie → reply lỗi rõ ràng

5. MusicManager.getOrCreate(guildId, voiceChannelId, textChannelId)
   └─ Nếu chưa có connection: joinVoiceChannel() + createAudioPlayer()
   └─ Nếu đã có nhưng ở voice channel khác:
      reply "Bot đang phát ở channel khác" (KHÔNG tự move)

6. guildPlayer.enqueue(tracks)
   ├─ Nếu current === null && queue rỗng:
   │   → set current, gọi playCurrent() (tạo audio resource từ stream play-dl)
   │   → reply "Đang phát: <title>"
   └─ Else:
       → push vào queue
       → reply "Đã thêm <N> bài vào hàng đợi"

7. clear idleTimer
```

### Xử lý kết thúc bài (`AudioPlayerStatus.Idle`)

```
onIdle():
  switch (loopMode):
    'track': playCurrent()
    'queue': queue.push(current); current = queue.shift() ?? null
    'off':   history.push(current); current = queue.shift() ?? null

  if (current) playCurrent()
  else startIdleTimer()
```

### Race conditions

1. **User skip giữa lúc đang load stream của bài tiếp** — dùng cờ `isLoading` trong `playCurrent()`. Nếu skip lúc đang load → set `pendingSkip`, sau khi resource tạo xong thì stop ngay để trigger Idle.
2. **Nhiều `/play` cùng lúc** — `enqueue()` push sync vào array, Node single-threaded nên check-and-set tuần tự đủ an toàn.
3. **Bot bị kick khỏi voice giữa chừng** — listen `connection.on('stateChange')` cho state `Disconnected` → cleanup `GuildPlayer`.

## Error handling

| Loại lỗi | Nguồn | Hành vi |
|---|---|---|
| User error (thiếu voice, sai URL, query rỗng) | Validation | Reply ephemeral + message tiếng Việt rõ ràng |
| Track không khả dụng (private, age-gated, geo-blocked, deleted) | `play-dl` throw | Reply trong text channel + skip sang bài tiếp |
| YouTube đòi xác thực | `play-dl` throw cụ thể | Reply hướng dẫn admin: cập nhật cookie |
| Network/timeout khi resolve | fetch lỗi | Retry 1 lần với backoff 500ms, fail thì báo |
| Stream chết giữa bài | `audioPlayer.on('error')` | Log + skip + báo trong text channel |
| Voice connection lỗi | `connection.on('error')` | Cleanup `GuildPlayer`, báo user |
| Lỗi không xác định | catch-all | Log full stack, reply chung "Có lỗi xảy ra, đã ghi log" |

### YouTube cookie

- `play-dl` hỗ trợ `setToken({ youtube: { cookie: "..." } })`.
- Cookie để trong `.env` dạng `YOUTUBE_COOKIE` (string `name=value; name2=value2`). Optional.
- `config.js` đọc và pass vào `youtube.js` lúc init.
- `.env.example` ghi rõ cách lấy cookie từ DevTools, warning không share file.
- README ghi: thấy lỗi "Sign in to confirm" → refresh cookie.

### Logging

- `console.log/warn/error` với prefix `[ArseneBot]` + timestamp + guildId.
- Format: `[2026-05-21T10:15:00Z] [INFO] [guild:123] User X requested play: <query>`
- Lỗi: full stack qua `console.error`.
- Không thêm logger library ở v1.

### Rate limiting

- Discord interaction rate limit do `discord.js` tự handle.
- YouTube rate limit từ `play-dl` — nếu user spam `/play`, bot sẽ chậm dần. Đặt giới hạn mềm: 1 user không có 2 `/play` đang resolve cùng lúc trong 1 guild (track qua `Set<userId>` 3s). Nice-to-have.

### Crash recovery

- `process.on('unhandledRejection')` và `'uncaughtException'` → log + KHÔNG kill process.
- `client` disconnect khỏi Discord → `discord.js` tự reconnect.
- State in-memory mất khi restart, theo thiết kế.

## Testing

| Lớp | Cách test | Tool |
|---|---|---|
| `utils/format.js` | Unit test thuần (pure functions) | `node:test` (built-in Node 20+) |
| `music/youtube.js` | Unit test với mock `play-dl` — verify dispatch URL/playlist/search đúng | `node:test` + manual mock |
| `music/GuildPlayer.js` | Unit test logic queue/loop/skip với fake `audioPlayer` (EventEmitter) | `node:test` |
| `commands/*.js` | KHÔNG unit test — manual test trên Discord | — |
| End-to-end | Manual checklist trên test server riêng | README |

### Manual test checklist (README)

- [ ] `/play <video URL>` — phát đúng bài
- [ ] `/play <playlist URL>` — add toàn bộ playlist
- [ ] `/play <keyword>` — search ra kết quả đầu
- [ ] `/skip`, `/pause`, `/resume`, `/stop`
- [ ] `/queue`, `/nowplaying`
- [ ] `/loop track`, `/loop queue`, `/loop off`
- [ ] `/shuffle`, `/remove <index>`, `/seek <seconds>`
- [ ] `/volume 50`, `/volume 150`
- [ ] Auto-leave sau 5 phút khi không ai trong voice
- [ ] Bot bị kick → cleanup không crash

## Deployment

### `.env.example`

```
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=          # optional, dev: deploy commands chỉ cho 1 guild (instant)
YOUTUBE_COOKIE=            # optional
LOG_LEVEL=info             # info | warn | error
```

### `scripts/deploy-commands.js`

- Chạy thủ công: `node scripts/deploy-commands.js`.
- Có `DISCORD_GUILD_ID`: register guild commands (instant).
- Không có: register global commands (1h Discord cache).
- In ra số lệnh đã đăng ký.

### `Dockerfile`

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache ffmpeg python3
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["node", "src/index.js"]
```

- `ffmpeg` cần thiết cho `@discordjs/voice`.
- `python3` cho một số extract trong `play-dl`.
- Không có bước build (pure JS).

### `package.json` scripts

```json
{
  "start":  "node src/index.js",
  "dev":    "node --watch src/index.js",
  "deploy": "node scripts/deploy-commands.js",
  "test":   "node --test"
}
```

### `.gitignore`

`.env`, `node_modules`, `*.log`.

### Dependencies

- `discord.js@^14`
- `@discordjs/voice@^0.17`
- `@discordjs/opus` (native opus encoder, nhanh hơn `opusscript`)
- `play-dl@^1.9`
- `dotenv@^16`
- `ffmpeg-static` (binary ffmpeg cho local Windows)

## Tóm tắt quyết định chốt

| Hạng mục | Quyết định |
|---|---|
| Phạm vi | Full-featured (loop / shuffle / seek / remove / auto-leave) |
| Loại lệnh | Slash commands |
| Nguồn nhạc | YouTube only |
| Stack | discord.js v14 + @discordjs/voice + play-dl |
| Triển khai | Local dev + sẵn sàng deploy (.env + Dockerfile) |
| Persistent state | Không (in-memory) |
