const test = require('node:test');
const assert = require('node:assert/strict');

const interactionCreate = require('../src/events/interactionCreate');
const { MUSIC_CONTROL_IDS } = require('../src/ui/musicControls');

function createButtonInteraction() {
  const calls = [];
  return {
    guildId: 'g1',
    customId: MUSIC_CONTROL_IDS.skip,
    member: { voice: { channel: { id: 'v1' } } },
    guild: { members: { me: { voice: { channelId: 'v1' } } } },
    isButton: () => true,
    isChatInputCommand: () => false,
    deferUpdate: async () => { calls.push('deferUpdate'); },
    update: async () => { calls.push('update'); },
    reply: async () => { calls.push('reply'); },
    followUp: async () => { calls.push('followUp'); },
    deferred: false,
    replied: false,
    _calls: calls,
  };
}

test('skip button defers update and lets player own the message lifecycle', async () => {
  let skipped = 0;
  const interaction = createButtonInteraction();
  const context = {
    log: { info() {}, warn() {}, error() {} },
    musicManager: {
      withGuildLock: async (_guildId, task) => task(),
      get: () => ({
        current: { title: 'one' },
        voiceChannelId: 'v1',
        skip() { skipped += 1; },
      }),
    },
  };

  await interactionCreate.execute(interaction, context);

  assert.equal(skipped, 1);
  assert.deepEqual(interaction._calls, ['deferUpdate']);
});
