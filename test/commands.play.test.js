const test = require('node:test');
const assert = require('node:assert/strict');

const playCommand = require('../src/commands/play');
const { messages } = require('../src/config/messages');
const { MUSIC_CONTROL_IDS } = require('../src/ui/musicControls');
const { UserFacingMusicError } = require('../src/music/errors');

function createInteraction() {
  const replies = [];
  return {
    guildId: 'g1',
    channelId: 't1',
    user: { id: 'u1', username: 'user1' },
    options: { getString: () => 'billie jean' },
    member: {
      voice: {
        channel: {
          id: 'v1',
          permissionsFor: () => ({ has: () => true }),
        },
      },
    },
    guild: { id: 'g1', members: { me: {} } },
    editReply: async (payload) => { replies.push(payload); },
    _replies: replies,
  };
}

test('play retries once on transient youtube error and then succeeds', async () => {
  const interaction = createInteraction();
  let calls = 0;

  const context = {
    youtube: {
      resolveQuery: async () => {
        calls += 1;
        if (calls === 1) throw new UserFacingMusicError(messages.youtube.transientError);
        return [{ title: 'Billie Jean', url: 'https://youtube.com/watch?v=1' }];
      },
    },
    musicManager: {
      withGuildLock: async (_guildId, task) => task(),
      getOrCreate: () => ({ enqueue: async () => ({ started: true }) }),
    },
    log: { info() {}, warn() {}, error() {} },
  };

  await playCommand.execute(interaction, context);

  assert.equal(calls, 2);
  assert.ok(interaction._replies.length >= 3);
  assert.equal(interaction._replies[0].embeds[0].data.description, messages.play.searching);
  assert.equal(interaction._replies[interaction._replies.length - 1].embeds[0].data.title, messages.embeds.nowPlayingTitle);
  assert.equal(interaction._replies[interaction._replies.length - 1].components[0].components[1].data.custom_id, MUSIC_CONTROL_IDS.pause);
});
