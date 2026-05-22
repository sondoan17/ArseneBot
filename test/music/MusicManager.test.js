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
