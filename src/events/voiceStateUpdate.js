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
