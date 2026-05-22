# ArseneBot Discord Music Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ArseneBot, a Discord slash-command YouTube music bot with queue, loop, shuffle, seek, volume, remove, leave, and auto-leave behavior.

**Architecture:** Create a CommonJS Node.js app where slash command files parse Discord interactions and delegate playback state to `MusicManager`/`GuildPlayer`. Keep YouTube behavior isolated in `src/music/youtube.js`, consistent response formatting in `src/ui/embeds.js`, and lifecycle/error handling inside the music layer so commands stay thin.

**Tech Stack:** Node.js 20+, discord.js v14, @discordjs/voice, play-dl, dotenv, node:test, Docker.

---

## File Structure

- Create `package.json` — scripts and runtime dependencies.
- Create `.gitignore` — ignore local secrets, dependencies, logs.
- Create `.env.example` — document required Discord env vars and optional YouTube cookie.
- Create `Dockerfile` — production container using Node 20 Alpine with ffmpeg and python3.
- Create `src/config.js` — load `.env`, validate required values, expose normalized config.
- Create `src/utils/format.js` — pure formatting helpers.
- Create `src/utils/logger.js` — spec-compliant `[ArseneBot]` console logging.
- Create `src/music/errors.js` — user-facing music error classes and classifiers.
- Create `src/music/Track.js` — normalize track objects returned from YouTube resolution.
- Create `src/music/youtube.js` — wrap `play-dl` query resolution, retry once after 500ms, stream creation, and cookie setup.
- Create `src/music/GuildPlayer.js` — per-guild playback state, queue operations, loop behavior, volume, seek, audio errors, and idle timer.
- Create `src/music/MusicManager.js` — `Map<guildId, GuildPlayer>` lifecycle wrapper and voice connection cleanup.
- Create `src/ui/embeds.js` — consistent Discord embeds for success, error, queue, now playing.
- Create `src/bot/client.js`, `src/bot/commandLoader.js`, `src/bot/eventLoader.js` — Discord client and module loaders.
- Create `src/events/ready.js`, `src/events/interactionCreate.js`, `src/events/voiceStateUpdate.js` — event handlers.
- Create command files under `src/commands/*.js` — one slash command per spec.
- Create `src/index.js` — app entry point, config, YouTube token init, client login.
- Create `scripts/deploy-commands.js` — register guild/global slash commands.
- Create tests under `test/**` for pure helpers, YouTube dispatch/retry/errors, GuildPlayer state/lifecycle, MusicManager connection cleanup, and voice auto-leave.
- Modify `README.md` — setup, commands, deploy, and manual test checklist.

---

### Task 1: Project Metadata and Runtime Scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `Dockerfile`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "arsenebot",
  "version": "1.0.0",
  "description": "Discord YouTube music bot with slash commands.",
  "main": "src/index.js",
  "type": "commonjs",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "deploy": "node scripts/deploy-commands.js",
    "test": "node --test"
  },
  "engines": {
    "node": ">=20"
  },
  "dependencies": {
    "@discordjs/opus": "^0.10.0",
    "@discordjs/voice": "^0.17.0",
    "discord.js": "^14.15.3",
    "dotenv": "^16.4.5",
    "ffmpeg-static": "^5.2.0",
    "play-dl": "^1.9.7"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```gitignore
.env
node_modules
*.log
```

- [ ] **Step 3: Create `.env.example`**

```dotenv
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
# Optional for dev: guild commands register instantly when set.
DISCORD_GUILD_ID=
# Optional: browser cookie string used when YouTube asks for sign-in confirmation.
YOUTUBE_COOKIE=
# info | warn | error
LOG_LEVEL=info
```

- [ ] **Step 4: Create `Dockerfile`**

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache ffmpeg python3
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["node", "src/index.js"]
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and install exits successfully.

- [ ] **Step 6: Run test script before tests exist**

Run: `npm test`

Expected: command exits successfully with zero tests or no matching tests.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example Dockerfile
git commit -m "chore: scaffold Node music bot project"
```

---

### Task 2: Configuration, Logger, and Formatting Helpers

**Files:**
- Create: `src/config.js`
- Create: `src/utils/format.js`
- Create: `src/utils/logger.js`
- Create: `test/utils/format.test.js`

- [ ] **Step 1: Write failing formatting tests**

Create `test/utils/format.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const { formatDuration, truncate } = require('../../src/utils/format');

test('formatDuration formats unknown durations', () => {
  assert.equal(formatDuration(null), 'Live/Unknown');
  assert.equal(formatDuration(undefined), 'Live/Unknown');
  assert.equal(formatDuration(Number.NaN), 'Live/Unknown');
});

test('formatDuration formats seconds as mm:ss or h:mm:ss', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(65), '1:05');
  assert.equal(formatDuration(3661), '1:01:01');
});

test('truncate preserves short text and ellipsizes long text', () => {
  assert.equal(truncate('abc', 5), 'abc');
  assert.equal(truncate('abcdef', 5), 'ab...');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/utils/format.test.js`

Expected: FAIL with `Cannot find module '../../src/utils/format'`.

- [ ] **Step 3: Implement formatting helpers**

Create `src/utils/format.js`:

```js
function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return 'Live/Unknown';

  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function truncate(text, maxLength) {
  const value = String(text ?? '');
  if (value.length <= maxLength) return value;
  if (maxLength <= 3) return '.'.repeat(maxLength);
  return `${value.slice(0, maxLength - 3)}...`;
}

module.exports = { formatDuration, truncate };
```

- [ ] **Step 4: Implement config loader**

Create `src/config.js`:

```js
require('dotenv').config();

const LOG_LEVELS = new Set(['info', 'warn', 'error']);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function loadConfig() {
  const logLevel = process.env.LOG_LEVEL || 'info';
  if (!LOG_LEVELS.has(logLevel)) {
    throw new Error('LOG_LEVEL must be one of: info, warn, error');
  }

  return {
    discordToken: requireEnv('DISCORD_TOKEN'),
    discordClientId: requireEnv('DISCORD_CLIENT_ID'),
    discordGuildId: process.env.DISCORD_GUILD_ID || null,
    youtubeCookie: process.env.YOUTUBE_COOKIE || null,
    logLevel,
  };
}

module.exports = { loadConfig };
```

- [ ] **Step 5: Implement logger**

Create `src/utils/logger.js`:

```js
function formatPrefix(level, guildId = '-') {
  return `[ArseneBot] [${new Date().toISOString()}] [${level}] [guild:${guildId}]`;
}

function info(guildId, message, ...args) {
  console.log(formatPrefix('INFO', guildId), message, ...args);
}

function warn(guildId, message, ...args) {
  console.warn(formatPrefix('WARN', guildId), message, ...args);
}

function error(guildId, message, ...args) {
  console.error(formatPrefix('ERROR', guildId), message, ...args);
}

module.exports = { info, warn, error };
```

- [ ] **Step 6: Run tests**

Run: `npm test -- test/utils/format.test.js`

Expected: PASS, 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/config.js src/utils/format.js src/utils/logger.js test/utils/format.test.js
git commit -m "feat: add config logging and formatting helpers"
```

---

### Task 3: Track Model and YouTube Resolver

**Files:**
- Create: `src/music/errors.js`
- Create: `src/music/Track.js`
- Create: `src/music/youtube.js`
- Create: `test/music/youtube.test.js`

- [ ] **Step 1: Write failing YouTube resolver tests**

Create `test/music/youtube.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const { createYoutubeService } = require('../../src/music/youtube');
const { UserFacingMusicError } = require('../../src/music/errors');

test('resolveQuery resolves video URLs into one track', async () => {
  const calls = [];
  const play = {
    validate: async () => 'video',
    video_basic_info: async (url) => {
      calls.push(['video_basic_info', url]);
      return { video_details: { title: 'Song', url, durationInSec: 90, thumbnails: [{ url: 'thumb' }] } };
    },
  };
  const service = createYoutubeService(play, { retryDelayMs: 0 });

  const tracks = await service.resolveQuery('https://youtube.test/watch?v=1', { id: 'u1', username: 'User' });

  assert.deepEqual(calls, [['video_basic_info', 'https://youtube.test/watch?v=1']]);
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].title, 'Song');
  assert.equal(tracks[0].duration, 90);
  assert.equal(tracks[0].requestedBy.id, 'u1');
});

test('resolveQuery resolves playlists into tracks', async () => {
  const play = {
    validate: async () => 'playlist',
    playlist_info: async () => ({
      all_videos: async () => [
        { title: 'A', url: 'url-a', durationInSec: 1, thumbnails: [] },
        { title: 'B', url: 'url-b', durationInSec: 2, thumbnails: [{ url: 'b.jpg' }] },
      ],
    }),
  };
  const service = createYoutubeService(play, { retryDelayMs: 0 });

  const tracks = await service.resolveQuery('playlist-url', { id: 'u1' });

  assert.equal(tracks.length, 2);
  assert.deepEqual(tracks.map((track) => track.url), ['url-a', 'url-b']);
});

test('resolveQuery searches keyword queries', async () => {
  const play = {
    validate: async () => 'search',
    search: async (query, options) => {
      assert.equal(query, 'lofi beats');
      assert.deepEqual(options, { limit: 1, source: { youtube: 'video' } });
      return [{ title: 'Lofi', url: 'url', durationInSec: 30, thumbnails: [] }];
    },
  };
  const service = createYoutubeService(play, { retryDelayMs: 0 });

  const tracks = await service.resolveQuery('lofi beats', { id: 'u1' });

  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].title, 'Lofi');
});

test('resolveQuery retries one transient failure', async () => {
  let attempts = 0;
  const play = {
    validate: async () => 'video',
    video_basic_info: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('network timeout');
      return { video_details: { title: 'Retry Song', url: 'url', durationInSec: 10, thumbnails: [] } };
    },
  };
  const service = createYoutubeService(play, { retryDelayMs: 0 });

  const tracks = await service.resolveQuery('url', { id: 'u1' });

  assert.equal(attempts, 2);
  assert.equal(tracks[0].title, 'Retry Song');
});

test('resolveQuery maps YouTube sign-in errors to cookie guidance', async () => {
  const play = {
    validate: async () => 'video',
    video_basic_info: async () => {
      throw new Error('Sign in to confirm your age');
    },
  };
  const service = createYoutubeService(play, { retryDelayMs: 0 });

  await assert.rejects(
    () => service.resolveQuery('url', { id: 'u1' }),
    (error) => error instanceof UserFacingMusicError && error.message.includes('YOUTUBE_COOKIE'),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/music/youtube.test.js`

Expected: FAIL with `Cannot find module '../../src/music/youtube'`.

- [ ] **Step 3: Implement music errors**

Create `src/music/errors.js`:

```js
class UserFacingMusicError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'UserFacingMusicError';
    this.cause = cause;
  }
}

function classifyYoutubeError(error) {
  const message = String(error?.message || error || '');
  const lower = message.toLowerCase();

  if (lower.includes('sign in') || lower.includes('confirm your age') || lower.includes('cookie')) {
    return new UserFacingMusicError('YouTube yêu cầu xác thực. Admin cần cập nhật YOUTUBE_COOKIE rồi restart bot.', error);
  }

  if (lower.includes('private') || lower.includes('unavailable') || lower.includes('deleted') || lower.includes('geo')) {
    return new UserFacingMusicError('Track không khả dụng hoặc bị giới hạn khu vực/riêng tư.', error);
  }

  return new UserFacingMusicError('Không thể tải dữ liệu từ YouTube. Vui lòng thử lại sau.', error);
}

module.exports = { UserFacingMusicError, classifyYoutubeError };
```

- [ ] **Step 4: Implement `Track` factory**

Create `src/music/Track.js`:

```js
function createTrack(details, requestedBy) {
  return {
    title: details.title || 'Unknown title',
    url: details.url,
    duration: Number.isFinite(details.durationInSec) ? details.durationInSec : null,
    requestedBy,
    thumbnail: details.thumbnails?.[0]?.url || null,
  };
}

module.exports = { createTrack };
```

- [ ] **Step 5: Implement YouTube service with retry and classification**

Create `src/music/youtube.js`:

```js
const play = require('play-dl');
const { createTrack } = require('./Track');
const { classifyYoutubeError } = require('./errors');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createYoutubeService(playClient = play, { retryDelayMs = 500 } = {}) {
  async function withRetry(operation) {
    try {
      return await operation();
    } catch (firstError) {
      await delay(retryDelayMs);
      try {
        return await operation();
      } catch (secondError) {
        throw classifyYoutubeError(secondError);
      }
    }
  }

  async function resolveOnce(query, requestedBy) {
    const validation = await playClient.validate(query);

    if (validation === 'video') {
      const info = await playClient.video_basic_info(query);
      return [createTrack(info.video_details, requestedBy)];
    }

    if (validation === 'playlist') {
      const playlist = await playClient.playlist_info(query, { incomplete: true });
      const videos = await playlist.all_videos();
      return videos.map((video) => createTrack(video, requestedBy));
    }

    const results = await playClient.search(query, { limit: 1, source: { youtube: 'video' } });
    return results.map((video) => createTrack(video, requestedBy));
  }

  async function resolveQuery(query, requestedBy) {
    return withRetry(() => resolveOnce(query, requestedBy));
  }

  async function createStream(track, seekSeconds = 0) {
    try {
      return await playClient.stream(track.url, { seek: seekSeconds });
    } catch (error) {
      throw classifyYoutubeError(error);
    }
  }

  function setYoutubeCookie(cookie) {
    if (cookie) playClient.setToken({ youtube: { cookie } });
  }

  return { resolveQuery, createStream, setYoutubeCookie };
}

module.exports = { createYoutubeService };
```

- [ ] **Step 6: Run tests**

Run: `npm test -- test/music/youtube.test.js`

Expected: PASS, 5 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/music/errors.js src/music/Track.js src/music/youtube.js test/music/youtube.test.js
git commit -m "feat: add YouTube resolver with retry"
```

---

### Task 4: GuildPlayer Queue, Loop, Volume, Seek, and Audio Error State

**Files:**
- Create: `src/music/GuildPlayer.js`
- Create: `test/music/GuildPlayer.test.js`

- [ ] **Step 1: Write failing GuildPlayer tests**

Create `test/music/GuildPlayer.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const { GuildPlayer } = require('../../src/music/GuildPlayer');

function track(title, duration = 60) {
  return { title, url: `https://example.test/${title}`, duration, requestedBy: { id: 'u1' }, thumbnail: null };
}

function createFakeAudioPlayer() {
  const player = new EventEmitter();
  player.played = [];
  player.stopped = 0;
  player.paused = false;
  player.play = (resource) => player.played.push(resource);
  player.stop = () => { player.stopped += 1; player.emit('idle'); };
  player.pause = () => { player.paused = true; return true; };
  player.unpause = () => { player.paused = false; return true; };
  return player;
}

function createPlayer(overrides = {}) {
  const audioPlayer = createFakeAudioPlayer();
  const resources = [];
  const youtube = {
    createStream: async (current, seekSeconds = 0) => ({ stream: { current, seekSeconds }, type: 'opus' }),
  };
  const voiceConnection = { destroyed: false, destroy() { this.destroyed = true; } };
  const player = new GuildPlayer({
    guildId: 'g1',
    voiceChannelId: 'v1',
    textChannelId: 't1',
    audioPlayer,
    voiceConnection,
    youtube,
    createAudioResource: (stream, options) => {
      const resource = { stream, options, volumeValue: null, volume: { setVolume(value) { resource.volumeValue = value; } } };
      resources.push(resource);
      return resource;
    },
    setTimeoutFn: (fn, ms) => ({ fn, ms }),
    clearTimeoutFn: (timer) => { timer.cleared = true; },
    notify: async () => {},
    log: { info() {}, warn() {}, error() {} },
    onDestroy: () => {},
    ...overrides,
  });
  return { player, audioPlayer, voiceConnection, resources };
}

test('enqueue starts first track and queues the rest', async () => {
  const { player, audioPlayer } = createPlayer();

  const result = await player.enqueue([track('one'), track('two')]);

  assert.equal(result.started, true);
  assert.equal(player.current.title, 'one');
  assert.deepEqual(player.queue.map((item) => item.title), ['two']);
  assert.equal(audioPlayer.played.length, 1);
});

test('idle event advances exactly once', async () => {
  const { player, audioPlayer } = createPlayer();
  await player.enqueue([track('one'), track('two'), track('three')]);

  audioPlayer.emit('idle');
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(player.history.map((item) => item.title), ['one']);
  assert.equal(player.current.title, 'two');
  assert.deepEqual(player.queue.map((item) => item.title), ['three']);
});

test('idle with loop queue rotates current to queue tail', async () => {
  const { player } = createPlayer();
  await player.enqueue([track('one'), track('two')]);
  player.setLoopMode('queue');

  await player.handleIdle();

  assert.equal(player.current.title, 'two');
  assert.deepEqual(player.queue.map((item) => item.title), ['one']);
});

test('setVolume updates current audio resource immediately', async () => {
  const { player, resources } = createPlayer();
  await player.enqueue([track('one')]);

  player.setVolume(150);

  assert.equal(player.volume, 150);
  assert.equal(resources[0].volumeValue, 1.5);
});

test('seek rejects unknown duration and out-of-range positions', async () => {
  const { player } = createPlayer();
  await player.enqueue([track('live', null)]);

  await assert.rejects(() => player.seek(5), /không hỗ trợ seek/);

  player.current = track('short', 10);
  await assert.rejects(() => player.seek(11), /vượt quá thời lượng/);
});

test('remove uses one-based queue index', async () => {
  const { player } = createPlayer();
  await player.enqueue([track('one'), track('two'), track('three')]);

  const removed = player.remove(2);

  assert.equal(removed.title, 'three');
  assert.deepEqual(player.queue.map((item) => item.title), ['two']);
});

test('empty queue starts idle timer and enqueue clears it', async () => {
  let clearCount = 0;
  const { player } = createPlayer({ clearTimeoutFn: () => { clearCount += 1; } });
  await player.enqueue([track('one')]);

  await player.handleIdle();

  assert.equal(player.current, null);
  assert.equal(player.idleTimer.ms, 5 * 60 * 1000);

  await player.enqueue([track('two')]);

  assert.equal(clearCount, 1);
  assert.equal(player.idleTimer, null);
});

test('audio error notifies and advances to next track', async () => {
  const messages = [];
  const { player, audioPlayer } = createPlayer({ notify: async (message) => messages.push(message) });
  await player.enqueue([track('one'), track('two')]);

  audioPlayer.emit('error', new Error('stream died'));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(player.current.title, 'two');
  assert.equal(messages.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/music/GuildPlayer.test.js`

Expected: FAIL with `Cannot find module '../../src/music/GuildPlayer'`.

- [ ] **Step 3: Implement `GuildPlayer`**

Create `src/music/GuildPlayer.js`:

```js
const { EventEmitter } = require('node:events');
const { AudioPlayerStatus, createAudioResource, StreamType } = require('@discordjs/voice');
const { UserFacingMusicError } = require('./errors');

class GuildPlayer extends EventEmitter {
  constructor({
    guildId,
    voiceChannelId,
    textChannelId,
    audioPlayer,
    voiceConnection,
    youtube,
    createAudioResource: createResource = createAudioResource,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
    notify = async () => {},
    log = console,
    onDestroy,
  }) {
    super();
    this.guildId = guildId;
    this.voiceChannelId = voiceChannelId;
    this.textChannelId = textChannelId;
    this.audioPlayer = audioPlayer;
    this.voiceConnection = voiceConnection;
    this.youtube = youtube;
    this.createAudioResource = createResource;
    this.setTimeoutFn = setTimeoutFn;
    this.clearTimeoutFn = clearTimeoutFn;
    this.notify = notify;
    this.log = log;
    this.onDestroy = onDestroy;
    this.queue = [];
    this.current = null;
    this.history = [];
    this.loopMode = 'off';
    this.volume = 100;
    this.paused = false;
    this.idleTimer = null;
    this.currentResource = null;
    this.isLoading = false;
    this.pendingSkip = false;

    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      this.handleIdle().catch((error) => this.emit('error', error));
    });
    this.audioPlayer.on('error', (error) => {
      this.handleAudioError(error).catch((handlerError) => this.emit('error', handlerError));
    });
  }

  async enqueue(tracks) {
    this.clearIdleTimer();
    if (!this.current && this.queue.length === 0) {
      const [first, ...rest] = tracks;
      this.current = first || null;
      this.queue.push(...rest);
      if (this.current) await this.playCurrent();
      return { started: Boolean(this.current), added: rest.length };
    }

    this.queue.push(...tracks);
    return { started: false, added: tracks.length };
  }

  async playCurrent(seekSeconds = 0) {
    if (!this.current) return;
    this.isLoading = true;
    try {
      const stream = await this.youtube.createStream(this.current, seekSeconds);
      const resource = this.createAudioResource(stream.stream, {
        inputType: stream.type || StreamType.Arbitrary,
        inlineVolume: true,
      });
      this.currentResource = resource;
      resource.volume?.setVolume(this.volume / 100);
      this.audioPlayer.play(resource);
    } finally {
      this.isLoading = false;
    }

    if (this.pendingSkip) {
      this.pendingSkip = false;
      this.audioPlayer.stop();
    }
  }

  async handleIdle() {
    if (!this.current) {
      this.startIdleTimer();
      return;
    }

    if (this.loopMode === 'track') {
      await this.playCurrent();
      return;
    }

    const finished = this.current;
    if (this.loopMode === 'queue') this.queue.push(finished);
    else this.history.push(finished);

    this.current = this.queue.shift() || null;
    if (this.current) await this.playCurrent();
    else startIdleTimerSafe(this);
  }

  async handleAudioError(error) {
    const failedTrack = this.current;
    this.log.error(this.guildId, 'Audio player error', error);
    if (failedTrack) {
      await this.notify(`Không thể phát **${failedTrack.title}**, đang bỏ qua bài này.`);
      this.history.push(failedTrack);
    }
    this.current = this.queue.shift() || null;
    if (this.current) await this.playCurrent();
    else this.startIdleTimer();
  }

  skip() {
    if (this.isLoading) {
      this.pendingSkip = true;
      return;
    }
    this.audioPlayer.stop();
  }

  stop() {
    this.queue = [];
    this.current = null;
    this.currentResource = null;
    this.audioPlayer.stop();
    this.startIdleTimer();
  }

  pause() {
    const paused = this.audioPlayer.pause();
    if (paused) this.paused = true;
    return paused;
  }

  resume() {
    const resumed = this.audioPlayer.unpause();
    if (resumed) this.paused = false;
    return resumed;
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(200, volume));
    this.currentResource?.volume?.setVolume(this.volume / 100);
  }

  setLoopMode(loopMode) {
    this.loopMode = loopMode;
  }

  shuffle() {
    for (let index = this.queue.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [this.queue[index], this.queue[swapIndex]] = [this.queue[swapIndex], this.queue[index]];
    }
  }

  async seek(seconds) {
    if (!this.current) throw new UserFacingMusicError('Không có bài nào đang phát.');
    if (!Number.isFinite(this.current.duration)) throw new UserFacingMusicError('Bài này không hỗ trợ seek vì không có thời lượng xác định.');
    if (seconds > this.current.duration) throw new UserFacingMusicError('Vị trí seek vượt quá thời lượng bài hát.');
    await this.playCurrent(seconds);
  }

  remove(index) {
    const zeroBasedIndex = index - 1;
    if (zeroBasedIndex < 0 || zeroBasedIndex >= this.queue.length) return null;
    return this.queue.splice(zeroBasedIndex, 1)[0];
  }

  startIdleTimer() {
    this.clearIdleTimer();
    this.idleTimer = this.setTimeoutFn(() => this.destroy(), 5 * 60 * 1000);
  }

  clearIdleTimer() {
    if (!this.idleTimer) return;
    this.clearTimeoutFn(this.idleTimer);
    this.idleTimer = null;
  }

  destroy() {
    this.clearIdleTimer();
    this.queue = [];
    this.current = null;
    this.currentResource = null;
    if (this.voiceConnection.state?.status !== 'destroyed') this.voiceConnection.destroy();
    this.onDestroy?.(this.guildId);
  }
}

function startIdleTimerSafe(player) {
  player.startIdleTimer();
}

module.exports = { GuildPlayer };
```

- [ ] **Step 4: Run tests**

Run: `npm test -- test/music/GuildPlayer.test.js`

Expected: PASS, 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/music/GuildPlayer.js test/music/GuildPlayer.test.js
git commit -m "feat: add guild music player state"
```

---

### Task 5: MusicManager, Voice Cleanup, and Embed UI

**Files:**
- Create: `src/music/MusicManager.js`
- Create: `src/ui/embeds.js`
- Create: `test/music/MusicManager.test.js`

- [ ] **Step 1: Write failing MusicManager cleanup test**

Create `test/music/MusicManager.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const { MusicManager } = require('../../src/music/MusicManager');

test('voice connection disconnected state removes player', () => {
  const connection = new EventEmitter();
  connection.subscribe = () => {};
  connection.destroy = () => { connection.destroyed = true; };
  connection.state = { status: 'ready' };
  const manager = new MusicManager({
    youtube: {},
    joinVoiceChannel: () => connection,
    createAudioPlayer: () => {
      const audioPlayer = new EventEmitter();
      audioPlayer.on = audioPlayer.on.bind(audioPlayer);
      return audioPlayer;
    },
    notify: async () => {},
    log: { info() {}, warn() {}, error() {} },
  });

  manager.getOrCreate({
    guild: { id: 'g1', voiceAdapterCreator: {} },
    voiceChannel: { id: 'v1' },
    textChannelId: 't1',
  });

  connection.emit('stateChange', { status: 'ready' }, { status: 'disconnected' });

  assert.equal(manager.get('g1'), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/music/MusicManager.test.js`

Expected: FAIL with `Cannot find module '../../src/music/MusicManager'`.

- [ ] **Step 3: Create `MusicManager` with connection cleanup**

Create `src/music/MusicManager.js`:

```js
const voice = require('@discordjs/voice');
const { GuildPlayer } = require('./GuildPlayer');

class MusicManager {
  constructor({ youtube, client = null, joinVoiceChannel = voice.joinVoiceChannel, createAudioPlayer = voice.createAudioPlayer, notify, log = console }) {
    this.youtube = youtube;
    this.client = client;
    this.joinVoiceChannel = joinVoiceChannel;
    this.createAudioPlayer = createAudioPlayer;
    this.notify = notify;
    this.log = log;
    this.players = new Map();
  }

  get(guildId) {
    return this.players.get(guildId) || null;
  }

  getOrCreate({ guild, voiceChannel, textChannelId }) {
    const existing = this.get(guild.id);
    if (existing) {
      if (existing.voiceChannelId !== voiceChannel.id) {
        const error = new Error('Bot đang phát ở channel khác.');
        error.code = 'PLAYER_IN_DIFFERENT_CHANNEL';
        throw error;
      }
      return existing;
    }

    const connection = this.joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
    });
    const audioPlayer = this.createAudioPlayer();
    connection.subscribe(audioPlayer);

    const player = new GuildPlayer({
      guildId: guild.id,
      voiceChannelId: voiceChannel.id,
      textChannelId,
      audioPlayer,
      voiceConnection: connection,
      youtube: this.youtube,
      notify: this.notify || ((message) => this.notifyTextChannel(textChannelId, message)),
      log: this.log,
      onDestroy: (guildId) => this.players.delete(guildId),
    });

    connection.on('stateChange', (oldState, newState) => {
      if (newState.status === 'disconnected' || newState.status === 'destroyed') {
        this.players.delete(guild.id);
        this.log.warn(guild.id, 'Voice connection disconnected; cleaned up player.');
      }
    });
    connection.on('error', (error) => {
      this.log.error(guild.id, 'Voice connection error', error);
      this.destroy(guild.id);
    });

    this.players.set(guild.id, player);
    return player;
  }

  async notifyTextChannel(textChannelId, message) {
    const channel = await this.client?.channels.fetch(textChannelId).catch(() => null);
    if (channel?.isTextBased()) await channel.send(message);
  }

  destroy(guildId) {
    const player = this.get(guildId);
    if (!player) return false;
    player.destroy();
    this.players.delete(guildId);
    return true;
  }
}

module.exports = { MusicManager };
```

- [ ] **Step 4: Create embed helpers**

Create `src/ui/embeds.js`:

```js
const { EmbedBuilder } = require('discord.js');
const { formatDuration, truncate } = require('../utils/format');

function successEmbed(description) {
  return new EmbedBuilder().setColor(0x2ecc71).setDescription(description);
}

function errorEmbed(description) {
  return new EmbedBuilder().setColor(0xe74c3c).setDescription(description);
}

function nowPlayingEmbed(track, player) {
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('Đang phát')
    .setDescription(`[${truncate(track.title, 100)}](${track.url})`)
    .addFields(
      { name: 'Thời lượng', value: formatDuration(track.duration), inline: true },
      { name: 'Âm lượng', value: `${player.volume}%`, inline: true },
      { name: 'Loop', value: player.loopMode, inline: true },
    );
  if (track.thumbnail) embed.setThumbnail(track.thumbnail);
  return embed;
}

function queueEmbed(player) {
  const lines = player.queue.slice(0, 10).map((track, index) => (
    `${index + 1}. [${truncate(track.title, 80)}](${track.url}) — ${formatDuration(track.duration)}`
  ));
  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('Hàng đợi')
    .setDescription(lines.length ? lines.join('\n') : 'Hàng đợi đang trống.');
}

module.exports = { successEmbed, errorEmbed, nowPlayingEmbed, queueEmbed };
```

- [ ] **Step 5: Run tests**

Run: `npm test -- test/music/MusicManager.test.js`

Expected: PASS, 1 test passes.

- [ ] **Step 6: Commit**

```bash
git add src/music/MusicManager.js src/ui/embeds.js test/music/MusicManager.test.js
git commit -m "feat: add music manager lifecycle"
```

---

### Task 6: Bot Client, Loaders, Events, and Entry Point

**Files:**
- Create: `src/bot/client.js`
- Create: `src/bot/commandLoader.js`
- Create: `src/bot/eventLoader.js`
- Create: `src/events/ready.js`
- Create: `src/events/interactionCreate.js`
- Create: `src/events/voiceStateUpdate.js`
- Create: `src/index.js`
- Create: `test/events/voiceStateUpdate.test.js`

- [ ] **Step 1: Write failing voice state auto-leave tests**

Create `test/events/voiceStateUpdate.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const event = require('../../src/events/voiceStateUpdate');

function members(items) {
  return {
    filter(fn) {
      return { size: items.filter(fn).length };
    },
  };
}

test('voiceStateUpdate starts idle timer when no humans remain', () => {
  let started = false;
  const player = { voiceChannelId: 'v1', startIdleTimer: () => { started = true; }, clearIdleTimer: () => {} };
  const guild = { id: 'g1', channels: { cache: new Map([['v1', { members: members([{ user: { bot: true } }]) }]]) } };

  event.execute({ guild }, {}, { musicManager: { get: () => player } });

  assert.equal(started, true);
});

test('voiceStateUpdate clears idle timer when a human is present', () => {
  let cleared = false;
  const player = { voiceChannelId: 'v1', startIdleTimer: () => {}, clearIdleTimer: () => { cleared = true; } };
  const guild = { id: 'g1', channels: { cache: new Map([['v1', { members: members([{ user: { bot: false } }]) }]]) } };

  event.execute({ guild }, {}, { musicManager: { get: () => player } });

  assert.equal(cleared, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/events/voiceStateUpdate.test.js`

Expected: FAIL with `Cannot find module '../../src/events/voiceStateUpdate'`.

- [ ] **Step 3: Create Discord client factory**

Create `src/bot/client.js`:

```js
const { Client, GatewayIntentBits } = require('discord.js');

function createClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });
}

module.exports = { createClient };
```

- [ ] **Step 4: Create command loader**

Create `src/bot/commandLoader.js`:

```js
const fs = require('node:fs');
const path = require('node:path');
const { Collection } = require('discord.js');

function loadCommands(client, commandsPath = path.join(__dirname, '..', 'commands')) {
  client.commands = new Collection();
  const files = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

  for (const file of files) {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.data.name, command);
  }

  return client.commands;
}

module.exports = { loadCommands };
```

- [ ] **Step 5: Create event loader**

Create `src/bot/eventLoader.js`:

```js
const fs = require('node:fs');
const path = require('node:path');

function loadEvents(client, context, eventsPath = path.join(__dirname, '..', 'events')) {
  const files = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'));

  for (const file of files) {
    const event = require(path.join(eventsPath, file));
    const handler = (...args) => event.execute(...args, context);
    if (event.once) client.once(event.name, handler);
    else client.on(event.name, handler);
  }
}

module.exports = { loadEvents };
```

- [ ] **Step 6: Create ready event**

Create `src/events/ready.js`:

```js
const { Events } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client, { log }) {
    log.info('-', `Ready as ${client.user.tag}`);
  },
};
```

- [ ] **Step 7: Create interaction dispatcher**

Create `src/events/interactionCreate.js`:

```js
const { Events } = require('discord.js');
const { errorEmbed } = require('../ui/embeds');
const { UserFacingMusicError } = require('../music/errors');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, context) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, context);
    } catch (error) {
      context.log.error(interaction.guildId, 'Interaction error', error);
      const message = error instanceof UserFacingMusicError ? error.message : 'Có lỗi xảy ra, đã ghi log.';
      const payload = { embeds: [errorEmbed(message)], ephemeral: true };
      if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
      else await interaction.reply(payload);
    }
  },
};
```

- [ ] **Step 8: Create voice state auto-leave event**

Create `src/events/voiceStateUpdate.js`:

```js
const { Events } = require('discord.js');

module.exports = {
  name: Events.VoiceStateUpdate,
  execute(oldState, newState, { musicManager }) {
    const guildId = oldState.guild.id;
    const player = musicManager.get(guildId);
    if (!player) return;

    const channel = oldState.guild.channels.cache.get(player.voiceChannelId);
    if (!channel?.members) return;

    const humanMembers = channel.members.filter((member) => !member.user.bot);
    if (humanMembers.size === 0) player.startIdleTimer();
    else player.clearIdleTimer();
  },
};
```

- [ ] **Step 9: Create app entry point**

Create `src/index.js`:

```js
const { loadConfig } = require('./config');
const { createClient } = require('./bot/client');
const { loadCommands } = require('./bot/commandLoader');
const { loadEvents } = require('./bot/eventLoader');
const { createYoutubeService } = require('./music/youtube');
const { MusicManager } = require('./music/MusicManager');
const log = require('./utils/logger');

process.on('unhandledRejection', (error) => {
  log.error('-', 'Unhandled rejection', error);
});

process.on('uncaughtException', (error) => {
  log.error('-', 'Uncaught exception', error);
});

const config = loadConfig();
const youtube = createYoutubeService();
youtube.setYoutubeCookie(config.youtubeCookie);

const client = createClient();
const musicManager = new MusicManager({ youtube, client, log });

loadCommands(client);
loadEvents(client, { config, youtube, musicManager, log });

client.login(config.discordToken);
```

- [ ] **Step 10: Run tests**

Run: `npm test -- test/events/voiceStateUpdate.test.js`

Expected: PASS, 2 tests pass.

- [ ] **Step 11: Commit**

```bash
git add src/bot src/events src/index.js test/events/voiceStateUpdate.test.js
git commit -m "feat: add Discord client lifecycle"
```

---

### Task 7: Slash Commands

**Files:**
- Create: `src/commands/play.js`
- Create: `src/commands/skip.js`
- Create: `src/commands/stop.js`
- Create: `src/commands/pause.js`
- Create: `src/commands/resume.js`
- Create: `src/commands/queue.js`
- Create: `src/commands/nowplaying.js`
- Create: `src/commands/volume.js`
- Create: `src/commands/loop.js`
- Create: `src/commands/shuffle.js`
- Create: `src/commands/seek.js`
- Create: `src/commands/remove.js`
- Create: `src/commands/leave.js`

- [ ] **Step 1: Create `/play`**

Create `src/commands/play.js`:

```js
const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Phát nhạc từ YouTube URL, playlist, hoặc từ khóa.')
    .addStringOption((option) => option.setName('query').setDescription('URL hoặc từ khóa YouTube').setRequired(true)),
  async execute(interaction, { youtube, musicManager, log }) {
    await interaction.deferReply();
    const query = interaction.options.getString('query', true);
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      await interaction.editReply({ embeds: [errorEmbed('Bạn cần vào voice channel trước.')] });
      return;
    }

    const permissions = voiceChannel.permissionsFor(interaction.guild.members.me);
    if (!permissions.has(PermissionsBitField.Flags.Connect) || !permissions.has(PermissionsBitField.Flags.Speak)) {
      await interaction.editReply({ embeds: [errorEmbed('Bot cần quyền Join và Speak trong voice channel này.')] });
      return;
    }

    log.info(interaction.guildId, `User ${interaction.user.id} requested play: ${query}`);
    const tracks = await youtube.resolveQuery(query, {
      id: interaction.user.id,
      username: interaction.user.username,
    });
    if (tracks.length === 0) {
      await interaction.editReply({ embeds: [errorEmbed('Không tìm thấy kết quả phù hợp.')] });
      return;
    }

    let player;
    try {
      player = musicManager.getOrCreate({ guild: interaction.guild, voiceChannel, textChannelId: interaction.channelId });
    } catch (error) {
      if (error.code === 'PLAYER_IN_DIFFERENT_CHANNEL') {
        await interaction.editReply({ embeds: [errorEmbed('Bot đang phát ở channel khác.')] });
        return;
      }
      throw error;
    }

    const result = await player.enqueue(tracks);
    const message = result.started
      ? `Đang phát: **${tracks[0].title}**`
      : `Đã thêm **${tracks.length}** bài vào hàng đợi.`;
    await interaction.editReply({ embeds: [successEmbed(message)] });
  },
};
```

- [ ] **Step 2: Create playback control commands**

Create `src/commands/skip.js`, `stop.js`, `pause.js`, and `resume.js` exactly as below:

```js
// src/commands/skip.js
const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('skip').setDescription('Bỏ bài hiện tại.'),
  async execute(interaction, { musicManager }) {
    const player = musicManager.get(interaction.guildId);
    if (!player?.current) return interaction.reply({ embeds: [errorEmbed('Không có bài nào đang phát.')], ephemeral: true });
    player.skip();
    return interaction.reply({ embeds: [successEmbed('Đã bỏ bài hiện tại.')] });
  },
};
```

```js
// src/commands/stop.js
const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('stop').setDescription('Dừng phát và xóa hàng đợi.'),
  async execute(interaction, { musicManager }) {
    const player = musicManager.get(interaction.guildId);
    if (!player) return interaction.reply({ embeds: [errorEmbed('Bot chưa phát nhạc trong server này.')], ephemeral: true });
    player.stop();
    return interaction.reply({ embeds: [successEmbed('Đã dừng phát và xóa hàng đợi.')] });
  },
};
```

```js
// src/commands/pause.js
const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('pause').setDescription('Tạm dừng bài hiện tại.'),
  async execute(interaction, { musicManager }) {
    const player = musicManager.get(interaction.guildId);
    if (!player?.current) return interaction.reply({ embeds: [errorEmbed('Không có bài nào đang phát.')], ephemeral: true });
    player.pause();
    return interaction.reply({ embeds: [successEmbed('Đã tạm dừng.')] });
  },
};
```

```js
// src/commands/resume.js
const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('resume').setDescription('Tiếp tục phát nhạc.'),
  async execute(interaction, { musicManager }) {
    const player = musicManager.get(interaction.guildId);
    if (!player?.current) return interaction.reply({ embeds: [errorEmbed('Không có bài nào đang phát.')], ephemeral: true });
    player.resume();
    return interaction.reply({ embeds: [successEmbed('Đã tiếp tục phát.')] });
  },
};
```

- [ ] **Step 3: Create display commands**

Create `src/commands/queue.js` and `src/commands/nowplaying.js`:

```js
// src/commands/queue.js
const { SlashCommandBuilder } = require('discord.js');
const { queueEmbed, errorEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('queue').setDescription('Hiển thị hàng đợi.'),
  async execute(interaction, { musicManager }) {
    const player = musicManager.get(interaction.guildId);
    if (!player) return interaction.reply({ embeds: [errorEmbed('Bot chưa phát nhạc trong server này.')], ephemeral: true });
    return interaction.reply({ embeds: [queueEmbed(player)] });
  },
};
```

```js
// src/commands/nowplaying.js
const { SlashCommandBuilder } = require('discord.js');
const { nowPlayingEmbed, errorEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('nowplaying').setDescription('Hiển thị bài đang phát.'),
  async execute(interaction, { musicManager }) {
    const player = musicManager.get(interaction.guildId);
    if (!player?.current) return interaction.reply({ embeds: [errorEmbed('Không có bài nào đang phát.')], ephemeral: true });
    return interaction.reply({ embeds: [nowPlayingEmbed(player.current, player)] });
  },
};
```

- [ ] **Step 4: Create queue mutation commands**

Create `src/commands/volume.js`, `loop.js`, `shuffle.js`, `seek.js`, and `remove.js`:

```js
// src/commands/volume.js
const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Chỉnh âm lượng.')
    .addIntegerOption((option) => option.setName('value').setDescription('Âm lượng từ 0 đến 200').setRequired(true).setMinValue(0).setMaxValue(200)),
  async execute(interaction, { musicManager }) {
    const player = musicManager.get(interaction.guildId);
    if (!player) return interaction.reply({ embeds: [errorEmbed('Bot chưa phát nhạc trong server này.')], ephemeral: true });
    const volume = interaction.options.getInteger('value', true);
    player.setVolume(volume);
    return interaction.reply({ embeds: [successEmbed(`Âm lượng đã đặt thành **${volume}%**.`)] });
  },
};
```

```js
// src/commands/loop.js
const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Đặt chế độ lặp.')
    .addStringOption((option) => option.setName('mode').setDescription('Chế độ lặp').setRequired(true).addChoices(
      { name: 'off', value: 'off' },
      { name: 'track', value: 'track' },
      { name: 'queue', value: 'queue' },
    )),
  async execute(interaction, { musicManager }) {
    const player = musicManager.get(interaction.guildId);
    if (!player) return interaction.reply({ embeds: [errorEmbed('Bot chưa phát nhạc trong server này.')], ephemeral: true });
    const mode = interaction.options.getString('mode', true);
    player.setLoopMode(mode);
    return interaction.reply({ embeds: [successEmbed(`Loop đã đặt thành **${mode}**.`)] });
  },
};
```

```js
// src/commands/shuffle.js
const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('shuffle').setDescription('Xáo trộn hàng đợi.'),
  async execute(interaction, { musicManager }) {
    const player = musicManager.get(interaction.guildId);
    if (!player || player.queue.length < 2) return interaction.reply({ embeds: [errorEmbed('Cần ít nhất 2 bài trong hàng đợi để shuffle.')], ephemeral: true });
    player.shuffle();
    return interaction.reply({ embeds: [successEmbed('Đã xáo trộn hàng đợi.')] });
  },
};
```

```js
// src/commands/seek.js
const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');
const { UserFacingMusicError } = require('../music/errors');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Tua bài hiện tại đến số giây tuyệt đối.')
    .addIntegerOption((option) => option.setName('seconds').setDescription('Vị trí tính bằng giây').setRequired(true).setMinValue(0)),
  async execute(interaction, { musicManager }) {
    await interaction.deferReply();
    const player = musicManager.get(interaction.guildId);
    if (!player?.current) throw new UserFacingMusicError('Không có bài nào đang phát.');
    const seconds = interaction.options.getInteger('seconds', true);
    await player.seek(seconds);
    return interaction.editReply({ embeds: [successEmbed(`Đã tua đến **${seconds}s**.`)] });
  },
};
```

```js
// src/commands/remove.js
const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Xóa bài khỏi hàng đợi.')
    .addIntegerOption((option) => option.setName('index').setDescription('Vị trí 1-based trong queue').setRequired(true).setMinValue(1)),
  async execute(interaction, { musicManager }) {
    const player = musicManager.get(interaction.guildId);
    if (!player) return interaction.reply({ embeds: [errorEmbed('Bot chưa phát nhạc trong server này.')], ephemeral: true });
    const index = interaction.options.getInteger('index', true);
    const removed = player.remove(index);
    if (!removed) return interaction.reply({ embeds: [errorEmbed('Index không hợp lệ.')], ephemeral: true });
    return interaction.reply({ embeds: [successEmbed(`Đã xóa **${removed.title}** khỏi hàng đợi.`)] });
  },
};
```

- [ ] **Step 5: Create `/leave`**

Create `src/commands/leave.js`:

```js
const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('leave').setDescription('Rời voice channel.'),
  async execute(interaction, { musicManager }) {
    const destroyed = musicManager.destroy(interaction.guildId);
    if (!destroyed) return interaction.reply({ embeds: [errorEmbed('Bot không ở trong voice channel nào.')], ephemeral: true });
    return interaction.reply({ embeds: [successEmbed('Đã rời voice channel.')] });
  },
};
```

- [ ] **Step 6: Run tests**

Run: `npm test`

Expected: PASS for all existing tests.

- [ ] **Step 7: Commit**

```bash
git add src/commands
git commit -m "feat: add music slash commands"
```

---

### Task 8: Slash Command Deployment Script

**Files:**
- Create: `scripts/deploy-commands.js`

- [ ] **Step 1: Create deploy script**

Create `scripts/deploy-commands.js`:

```js
const { REST, Routes } = require('discord.js');
const { loadConfig } = require('../src/config');
const { createClient } = require('../src/bot/client');
const { loadCommands } = require('../src/bot/commandLoader');

async function main() {
  const config = loadConfig();
  const client = createClient();
  const commands = Array.from(loadCommands(client).values()).map((command) => command.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(config.discordToken);

  const route = config.discordGuildId
    ? Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId)
    : Routes.applicationCommands(config.discordClientId);

  await rest.put(route, { body: commands });
  console.log(`Registered ${commands.length} slash commands.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Verify command modules load**

Run: `node -e "const { createClient } = require('./src/bot/client'); const { loadCommands } = require('./src/bot/commandLoader'); const c = createClient(); console.log(loadCommands(c).size)"`

Expected: prints `13`.

- [ ] **Step 3: Run tests**

Run: `npm test`

Expected: PASS for all existing tests.

- [ ] **Step 4: Commit**

```bash
git add scripts/deploy-commands.js
git commit -m "feat: add slash command deployment"
```

---

### Task 9: README Setup and Manual Verification Checklist

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace README content**

Replace `README.md` with:

```markdown
# ArseneBot

ArseneBot is a Discord YouTube music bot using slash commands, discord.js v14, @discordjs/voice, and play-dl.

## Setup

1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Fill in `DISCORD_TOKEN` and `DISCORD_CLIENT_ID`.
4. Optionally set `DISCORD_GUILD_ID` for instant guild command deployment during development.
5. Optionally set `YOUTUBE_COOKIE` if YouTube asks for sign-in confirmation.
6. Run `npm install`.
7. Run `npm run deploy`.
8. Run `npm start`.

## Commands

- `/play query:<string>` — play a YouTube video URL, playlist URL, or keyword search.
- `/skip` — skip the current track.
- `/stop` — stop playback and clear the queue.
- `/pause` and `/resume` — pause or resume playback.
- `/queue` — show the queued tracks.
- `/nowplaying` — show the current track.
- `/volume value:<0-200>` — set playback volume.
- `/loop mode:<off|track|queue>` — set loop mode.
- `/shuffle` — shuffle the queue.
- `/seek seconds:<number>` — seek the current track to an absolute position.
- `/remove index:<number>` — remove a queued track by 1-based index.
- `/leave` — leave the voice channel.

## YouTube Cookie

If YouTube returns errors such as `Sign in to confirm`, refresh the `YOUTUBE_COOKIE` value from your browser DevTools and restart the bot. Do not commit `.env` or share the cookie.

## Docker

```bash
docker build -t arsenebot .
docker run --env-file .env arsenebot
```

## Manual Test Checklist

Use a private Discord test server.

- [ ] `/play <video URL>` plays the right track.
- [ ] `/play <playlist URL>` adds the playlist.
- [ ] `/play <keyword>` plays the first search result.
- [ ] `/play` while bot is active in another voice channel returns `Bot đang phát ở channel khác.`
- [ ] YouTube sign-in/cookie errors show the `YOUTUBE_COOKIE` guidance.
- [ ] `/skip`, `/pause`, `/resume`, and `/stop` work.
- [ ] `/queue` and `/nowplaying` display correct state.
- [ ] `/loop track`, `/loop queue`, and `/loop off` work.
- [ ] `/shuffle`, `/remove <index>`, and `/seek <seconds>` work.
- [ ] `/seek` rejects live/unknown-duration tracks and out-of-range seconds.
- [ ] `/volume 50` and `/volume 150` change volume on the current track.
- [ ] Bot auto-leaves after 5 minutes when no humans remain in voice.
- [ ] Bot auto-leaves after 5 minutes when queue is empty and nothing is playing.
- [ ] Kicking the bot from voice cleans up without crashing.
```

- [ ] **Step 2: Run tests**

Run: `npm test`

Expected: PASS for all existing tests.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add setup and manual test checklist"
```

---

### Task 10: Final Verification

**Files:**
- Verify all project files.

- [ ] **Step 1: Run full unit test suite**

Run: `npm test`

Expected: PASS for all tests.

- [ ] **Step 2: Verify all commands load**

Run: `node -e "const { createClient } = require('./src/bot/client'); const { loadCommands } = require('./src/bot/commandLoader'); const c = createClient(); console.log([...loadCommands(c).keys()].sort().join(','))"`

Expected: prints `leave,loop,nowplaying,pause,play,queue,remove,resume,seek,shuffle,skip,stop,volume`.

- [ ] **Step 3: Verify Docker build**

Run: `docker build -t arsenebot .`

Expected: image builds successfully.

- [ ] **Step 4: Manual Discord verification**

Run: `npm run deploy`, then `npm start`, then complete the README manual checklist on a private Discord test server.

Expected: every checklist item passes, or failing items are fixed before completion.

- [ ] **Step 5: Commit any verification fixes**

```bash
git status --short
git add <changed-files>
git commit -m "fix: address music bot verification issues"
```

Skip this commit only if `git status --short` is empty.

---

## Self-Review

**Spec coverage:** This revised plan covers scaffold, env/config, Docker, command deployment, all 13 slash commands, in-memory state, queue/current separation, loop modes, immediate volume changes, seek validation, remove/shuffle, auto-leave timers, voice disconnect cleanup, audio stream error skip/notify behavior, YouTube cookie guidance, one retry with 500ms backoff, `[ArseneBot]` logging, crash handlers, unit tests, and README manual verification.

**Review feedback incorporated:** Removed duplicate idle listener, added voice connection `stateChange`/`error` cleanup, added audio error recovery, made `/play` return the channel-conflict message, added YouTube retry/error classification, made volume update the active resource, added seek validation, added auto-leave tests, switched to `PermissionsBitField.Flags`, fixed the Task 7 commit typo, and added `.env.example` comments.

**Known implementation notes:** The soft rate limit for concurrent `/play` resolves remains out of scope for this plan because the approved spec marks it nice-to-have. Manual Discord testing is required before claiming the bot is complete.

**Placeholder scan:** No `TBD`, `TODO`, `implement later`, or unspecified test steps remain.

**Type consistency:** `Track` uses `{ title, url, duration, requestedBy, thumbnail }`; `GuildPlayer` consistently uses `current`, `queue`, `history`, `loopMode`, `volume`, `currentResource`, and command files call the same public methods defined in Task 4.
