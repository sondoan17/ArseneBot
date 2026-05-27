const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed } = require('../ui/embeds');
const { nowPlayingMessage } = require('../ui/musicControls');
const { messages } = require('../config/messages');
const { requireSameVoiceChannel } = require('./voiceAccess');

module.exports = {
  data: new SlashCommandBuilder().setName('nowplaying').setDescription(messages.commands.nowplaying.description),
  async execute(interaction, { musicManager }) {
    const player = musicManager.get(interaction.guildId);
    requireSameVoiceChannel(interaction, player);
    if (!player?.current) return interaction.reply({ embeds: [errorEmbed(messages.playback.noCurrentTrack)], ephemeral: true });
    return interaction.reply(nowPlayingMessage(player.current, player));
  },
};
