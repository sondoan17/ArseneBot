# ArseneBot Discord Music Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ArseneBot, a Discord slash-command YouTube music bot with queue, loop, shuffle, seek, volume, remove, leave, and auto-leave behavior.

**Architecture:** Create a small CommonJS Node.js app where slash command files parse Discord interactions and delegate all playback state to `MusicManager`/`GuildPlayer`. Keep YouTube-specific behavior isolated in `src/music/youtube.js`, UI formatting in `src/ui/embeds.js`, and pure formatting helpers in `src/utils/format.js`.

**Tech Stack:** Node.js 20+, discord.js v14, @discordjs/voice, play-dl, dotenv, node:test, Docker.

---

## File Structure

- Create `package.json` — scripts and runtime dependencies.
- Create `.gitignore` — ignore local secrets, dependencies, logs.
- Create `.env.example` — document required Discord env vars and optional YouTube cookie.
- Create `Dockerfile` — production container using Node 20 Alpine with ffmpeg and python3.
- Create `src/config.js` — load `.env`, validate required values, expose normalized config.
- Create `src/utils/format.js` — `formatDuration(seconds)` and `truncate(text, maxLength)` pure helpers.
- Create `test/utils/format.test.js` — unit tests for formatting helpers.
- Create `src/music/Track.js` — normalize track objects returned from YouTube resolution.
- Create `src/music/youtube.js` — wrap `play-dl` URL/search/playlist resolution and streaming.
- Create `test/music/youtube.test.js` — unit tests with a fake `play-dl` module injected via factory.
- Create `src/music/GuildPlayer.js` — per-guild playback state, queue operations, loop behavior, audio resources, auto-leave timer.
- Create `test/music/GuildPlayer.test.js` — unit tests with fake audio player/voice connection.
- Create `src/music/MusicManager.js` — `Map<guildId, GuildPlayer>` lifecycle wrapper.
- Create `src/ui/embeds.js` — consistent Discord embeds for success, error, queue, now playing.
- Create `src/bot/client.js` — Discord client factory with required intents.
- Create `src/bot/commandLoader.js` — load command modules from `src/commands`.
- Create `src/bot/eventLoader.js` — load event modules from `src/events`.
- Create `src/events/ready.js` — log ready state.
- Create `src/events/interactionCreate.js` — slash command dispatcher and catch-all interaction error handling.
- Create `src/events/voiceStateUpdate.js` — trigger/clear empty-channel auto-leave checks.
- Create command files under `src/commands/*.js` — one slash command per spec.
- Create `src/index.js` — app entry point, config, YouTube token init, client login.
- Create `scripts/deploy-commands.js` — register guild/global slash commands.
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
DISCORD_GUILD_ID=
YOUTUBE_COOKIE=
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

### Task 2: Configuration and Formatting Helpers

**Files:**
- Create: `src/config.js`
- Create: `src/utils/format.js`
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

- [ ] **Step 5: Run tests**

Run: `npm test -- test/utils/format.test.js`

Expected: PASS, 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/config.js src/utils/format.js test/utils/format.test.js
git commit -m "feat: add config and formatting helpers"
```

---

### Task 3: Track Model and YouTube Resolver

**Files:**
- Create: `src/music/Track.js`
- Create: `src/music/youtube.js`
- Create: `test/music/youtube.test.js`

- [ ] **Step 1: Write failing YouTube resolver tests**

Create `test/music/youtube.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const { createYoutubeService } = require('../../src/music/youtube');

test('resolveQuery resolves video URLs into one track', async () => {
  const calls = [];
  const play = {
    validate: async () => 'video',
    video_basic_info: async (url) => {
      calls.push(['video_basic_info', url]);
      return { video_details: { title: 'Song', url, durationInSec: 90, thumbnails: [{ url: 'thumb' }] } };
    },
  };
  const service = createYoutubeService(play);

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
  const service = createYoutubeService(play);

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
  const service = createYoutubeService(play);

  const tracks = await service.resolveQuery('lofi beats', { id: 'u1' });

  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].title, 'Lofi');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/music/youtube.test.js`

Expected: FAIL with `Cannot find module '../../src/music/youtube'`.

- [ ] **Step 3: Implement `Track` factory**

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

- [ ] **Step 4: Implement YouTube service**

Create `src/music/youtube.js`:

```js
const play = require('play-dl');
const { createTrack } = require('./Track');

function createYoutubeService(playClient = play) {
  async function resolveQuery(query, requestedBy) {
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

  async function createStream(track, seekSeconds = 0) {
    return playClient.stream(track.url, { seek: seekSeconds });
  }

  function setYoutubeCookie(cookie) {
    if (cookie) playClient.setToken({ youtube: { cookie } });
  }

  return { resolveQuery, createStream, setYoutubeCookie };
}

module.exports = { createYoutubeService };
```

- [ ] **Step 5: Run tests**

Run: `npm test -- test/music/youtube.test.js`

Expected: PASS, 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/music/Track.js src/music/youtube.js test/music/youtube.test.js
git commit -m "feat: add YouTube track resolver"
```

---

### Task 4: GuildPlayer Queue, Loop, and Playback State

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

function track(title) {
  return { title, url: `https://example.test/${title}`, duration: 60, requestedBy: { id: 'u1' }, thumbnail: null };
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
    createAudioResource: (stream, options) => ({ stream, options }),
    setTimeoutFn: () => 'timer',
    clearTimeoutFn: () => {},
    onDestroy: () => {},
    ...overrides,
  });
  return { player, audioPlayer, voiceConnection };
}

test('enqueue starts first track and queues the rest', async () => {
  const { player, audioPlayer } = createPlayer();

  const result = await player.enqueue([track('one'), track('two')]);

  assert.equal(result.started, true);
  assert.equal(player.current.title, 'one');
  assert.deepEqual(player.queue.map((item) => item.title), ['two']);
  assert.equal(audioPlayer.played.length, 1);
});

test('idle with loop off moves current to history and plays next', async () => {
  const { player } = createPlayer();
  await player.enqueue([track('one'), track('two')]);

  await player.handleIdle();

  assert.deepEqual(player.history.map((item) => item.title), ['one']);
  assert.equal(player.current.title, 'two');
  assert.deepEqual(player.queue, []);
});

test('idle with loop queue rotates current to queue tail', async () => {
  const { player } = createPlayer();
  await player.enqueue([track('one'), track('two')]);
  player.setLoopMode('queue');

  await player.handleIdle();

  assert.equal(player.current.title, 'two');
  assert.deepEqual(player.queue.map((item) => item.title), ['one']);
});

test('skip stops the audio player', async () => {
  const { player, audioPlayer } = createPlayer();
  await player.enqueue([track('one')]);

  player.skip();

  assert.equal(audioPlayer.stopped, 1);
});

test('remove uses one-based queue index', async () => {
  const { player } = createPlayer();
  await player.enqueue([track('one'), track('two'), track('three')]);

  const removed = player.remove(2);

  assert.equal(removed.title, 'three');
  assert.deepEqual(player.queue.map((item) => item.title), ['two']);
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
    this.onDestroy = onDestroy;
    this.queue = [];
    this.current = null;
    this.history = [];
    this.loopMode = 'off';
    this.volume = 100;
    this.paused = false;
    this.idleTimer = null;
    this.isLoading = false;
    this.pendingSkip = false;

    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      this.handleIdle().catch((error) => this.emit('error', error));
    });
    this.audioPlayer.on('idle', () => {
      this.handleIdle().catch((error) => this.emit('error', error));
    });
    this.audioPlayer.on('error', (error) => this.emit('trackError', error));
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
    const stream = await this.youtube.createStream(this.current, seekSeconds);
    const resource = this.createAudioResource(stream.stream, {
      inputType: stream.type || StreamType.Arbitrary,
      inlineVolume: true,
    });
    resource.volume?.setVolume(this.volume / 100);
    this.isLoading = false;
    this.audioPlayer.play(resource);

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
    this.voiceConnection.destroy();
    this.onDestroy?.(this.guildId);
  }
}

module.exports = { GuildPlayer };
```

- [ ] **Step 4: Run tests**

Run: `npm test -- test/music/GuildPlayer.test.js`

Expected: PASS, 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/music/GuildPlayer.js test/music/GuildPlayer.test.js
git commit -m "feat: add guild music player state"
```

---

### Task 5: MusicManager and Embed UI

**Files:**
- Create: `src/music/MusicManager.js`
- Create: `src/ui/embeds.js`

- [ ] **Step 1: Create `MusicManager`**

Create `src/music/MusicManager.js`:

```js
const { createAudioPlayer, joinVoiceChannel } = require('@discordjs/voice');
const { GuildPlayer } = require('./GuildPlayer');

class MusicManager {
  constructor({ youtube }) {
    this.youtube = youtube;
    this.players = new Map();
  }

  get(guildId) {
    return this.players.get(guildId) || null;
  }

  getOrCreate({ guild, voiceChannel, textChannelId }) {
    const existing = this.get(guild.id);
    if (existing) {
      if (existing.voiceChannelId !== voiceChannel.id) {
        throw new Error('Bot đang phát ở channel khác.');
      }
      return existing;
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
    });
    const audioPlayer = createAudioPlayer();
    connection.subscribe(audioPlayer);

    const player = new GuildPlayer({
      guildId: guild.id,
      voiceChannelId: voiceChannel.id,
      textChannelId,
      audioPlayer,
      voiceConnection: connection,
      youtube: this.youtube,
      onDestroy: (guildId) => this.players.delete(guildId),
    });

    this.players.set(guild.id, player);
    return player;
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

- [ ] **Step 2: Create embed helpers**

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

- [ ] **Step 3: Run full tests**

Run: `npm test`

Expected: PASS for all existing tests.

- [ ] **Step 4: Commit**

```bash
git add src/music/MusicManager.js src/ui/embeds.js
git commit -m "feat: add music manager and embeds"
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

- [ ] **Step 1: Create Discord client factory**

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

- [ ] **Step 2: Create command loader**

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

- [ ] **Step 3: Create event loader**

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

- [ ] **Step 4: Create ready event**

Create `src/events/ready.js`:

```js
const { Events } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`[${new Date().toISOString()}] [INFO] [guild:-] Ready as ${client.user.tag}`);
  },
};
```

- [ ] **Step 5: Create interaction dispatcher**

Create `src/events/interactionCreate.js`:

```js
const { Events } = require('discord.js');
const { errorEmbed } = require('../ui/embeds');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, context) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, context);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] [ERROR] [guild:${interaction.guildId}]`, error);
      const payload = { embeds: [errorEmbed('Có lỗi xảy ra, đã ghi log.')], ephemeral: true };
      if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
      else await interaction.reply(payload);
    }
  },
};
```

- [ ] **Step 6: Create voice state auto-leave event**

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

- [ ] **Step 7: Create app entry point**

Create `src/index.js`:

```js
const { loadConfig } = require('./config');
const { createClient } = require('./bot/client');
const { loadCommands } = require('./bot/commandLoader');
const { loadEvents } = require('./bot/eventLoader');
const { createYoutubeService } = require('./music/youtube');
const { MusicManager } = require('./music/MusicManager');

process.on('unhandledRejection', (error) => {
  console.error(`[${new Date().toISOString()}] [ERROR] [guild:-] Unhandled rejection`, error);
});

process.on('uncaughtException', (error) => {
  console.error(`[${new Date().toISOString()}] [ERROR] [guild:-] Uncaught exception`, error);
});

const config = loadConfig();
const youtube = createYoutubeService();
youtube.setYoutubeCookie(config.youtubeCookie);

const musicManager = new MusicManager({ youtube });
const client = createClient();

loadCommands(client);
loadEvents(client, { config, youtube, musicManager });

client.login(config.discordToken);
```

- [ ] **Step 8: Run tests**

Run: `npm test`

Expected: PASS for all existing tests.

- [ ] **Step 9: Commit**

```bash
git add src/bot src/events src/index.js
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
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Phát nhạc từ YouTube URL, playlist, hoặc từ khóa.')
    .addStringOption((option) => option.setName('query').setDescription('URL hoặc từ khóa YouTube').setRequired(true)),
  async execute(interaction, { youtube, musicManager }) {
    await interaction.deferReply();
    const query = interaction.options.getString('query', true);
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      await interaction.editReply({ embeds: [errorEmbed('Bạn cần vào voice channel trước.')] });
      return;
    }

    const permissions = voiceChannel.permissionsFor(interaction.guild.members.me);
    if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
      await interaction.editReply({ embeds: [errorEmbed('Bot cần quyền Join và Speak trong voice channel này.')] });
      return;
    }

    const tracks = await youtube.resolveQuery(query, {
      id: interaction.user.id,
      username: interaction.user.username,
    });
    if (tracks.length === 0) {
      await interaction.editReply({ embeds: [errorEmbed('Không tìm thấy kết quả phù hợp.')] });
      return;
    }

    const player = musicManager.getOrCreate({ guild: interaction.guild, voiceChannel, textChannelId: interaction.channelId });
    const result = await player.enqueue(tracks);
    const message = result.started
      ? `Đang phát: **${tracks[0].title}**`
      : `Đã thêm **${tracks.length}** bài vào hàng đợi.`;
    await interaction.editReply({ embeds: [successEmbed(message)] });
  },
};
```

- [ ] **Step 2: Create playback control commands**

Create `src/commands/skip.js`:

```js
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

Create `src/commands/stop.js`:

```js
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

Create `src/commands/pause.js`:

```js
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

Create `src/commands/resume.js`:

```js
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

Create `src/commands/queue.js`:

```js
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

Create `src/commands/nowplaying.js`:

```js
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

Create `src/commands/volume.js`:

```js
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

Create `src/commands/loop.js`:

```js
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

Create `src/commands/shuffle.js`:

```js
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

Create `src/commands/seek.js`:

```js
const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Tua bài hiện tại đến số giây tuyệt đối.')
    .addIntegerOption((option) => option.setName('seconds').setDescription('Vị trí tính bằng giây').setRequired(true).setMinValue(0)),
  async execute(interaction, { musicManager }) {
    await interaction.deferReply();
    const player = musicManager.get(interaction.guildId);
    if (!player?.current) return interaction.editReply({ embeds: [errorEmbed('Không có bài nào đang phát.')] });
    const seconds = interaction.options.getInteger('seconds', true);
    await player.seek(seconds);
    return interaction.editReply({ embeds: [successEmbed(`Đã tua đến **${seconds}s**.`)] });
  },
};
```

Create `src/commands/remove.js`:

```js
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
- [ ] `/skip`, `/pause`, `/resume`, and `/stop` work.
- [ ] `/queue` and `/nowplaying` display correct state.
- [ ] `/loop track`, `/loop queue`, and `/loop off` work.
- [ ] `/shuffle`, `/remove <index>`, and `/seek <seconds>` work.
- [ ] `/volume 50` and `/volume 150` change playback volume.
- [ ] Bot auto-leaves after 5 minutes when no humans remain in voice.
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

**Spec coverage:** This plan covers project scaffold, env/config, Docker, command deployment, all 13 slash commands, in-memory guild player state, queue/current separation, loop modes, volume, seek, remove, shuffle, auto-leave timer hooks, YouTube cookie initialization, logging via console, crash handlers, unit tests for pure logic/YouTube dispatch/player state, and README manual checklist.

**Known implementation notes:** The first implementation should keep rate limiting as a later nice-to-have because the spec marks it nice-to-have. Manual Discord testing is required before claiming the bot is complete.

**Placeholder scan:** No `TBD`, `TODO`, `implement later`, or unspecified test steps remain.

**Type consistency:** `Track` uses `{ title, url, duration, requestedBy, thumbnail }`; `GuildPlayer` consistently uses `current`, `queue`, `history`, `loopMode`, `volume`, and command files call the same public methods defined in Task 4.
