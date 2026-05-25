const test = require('node:test');
const assert = require('node:assert/strict');

const playCommand = require('../src/commands/play');
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
        if (calls === 1) throw new UserFacingMusicError('Không thể tải dữ liệu từ YouTube. Vui lòng thử lại sau.');
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
  assert.equal(interaction._replies.length, 1);
  assert.match(interaction._replies[0].embeds[0].data.description, /Đang phát/);
});
