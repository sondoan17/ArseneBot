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
