const { SlashCommandBuilder } = require('discord.js');
const { nowPlayingEmbed, errorEmbed } = require('../ui/embeds');
const { requireSameVoiceChannel } = require('./voiceAccess');

module.exports = {
  data: new SlashCommandBuilder().setName('nowplaying').setDescription('Hiển thị bài đang phát.'),
  async execute(interaction, { musicManager }) {
    const player = musicManager.get(interaction.guildId);
    requireSameVoiceChannel(interaction, player);
    if (!player?.current) return interaction.reply({ embeds: [errorEmbed('Không có bài nào đang phát.')], ephemeral: true });
    return interaction.reply({ embeds: [nowPlayingEmbed(player.current, player)] });
  },
};
