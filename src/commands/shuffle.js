const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');
const { requireSameVoiceChannel } = require('./voiceAccess');

module.exports = {
  data: new SlashCommandBuilder().setName('shuffle').setDescription('Xáo trộn hàng đợi.'),
  async execute(interaction, { musicManager }) {
    await musicManager.withGuildLock(interaction.guildId, async () => {
      const player = musicManager.get(interaction.guildId);
      requireSameVoiceChannel(interaction, player);
      if (!player || player.queue.length < 2) return interaction.reply({ embeds: [errorEmbed('Cần ít nhất 2 bài trong hàng đợi để shuffle.')], ephemeral: true });
      player.shuffle();
      return interaction.reply({ embeds: [successEmbed('Đã xáo trộn hàng đợi.')] });
    });
  },
};
