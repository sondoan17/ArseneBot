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
