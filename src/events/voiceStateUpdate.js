const { Events } = require('discord.js');
const { log } = require('../utils/format');

module.exports = {
  name: Events.VoiceStateUpdate,
  execute(oldState, newState) {
    const client = (oldState.client || newState.client);
    const guildId = (oldState.guild || newState.guild).id;
    const player = client.musicManager.get(guildId);

    if (!player || !player.voiceChannelId) return;

    // Check if the voice channel the bot is in is now empty (excluding the bot itself)
    const guild = oldState.guild || newState.guild;
    const botVoiceChannel = guild.channels.cache.get(player.voiceChannelId);

    if (!botVoiceChannel) return;

    const humanMembers = botVoiceChannel.members.filter((m) => !m.user.bot);

    if (humanMembers.size === 0) {
      log('INFO', `Voice channel empty, starting auto-leave timer.`, guildId);
      player.startIdleTimer();
    } else {
      // Someone is in the channel, clear the idle timer (if it was started for empty channel)
      // Only clear if there's something playing or queued; otherwise keep the queue-empty timer
      if (player.current || player.queue.length > 0) {
        player.clearIdleTimer();
      }
    }
  },
};
