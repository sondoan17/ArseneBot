const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');
const { requireSameVoiceChannel } = require('./voiceAccess');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Xóa bài khỏi hàng đợi.')
    .addIntegerOption((option) => option.setName('index').setDescription('Vị trí 1-based trong queue').setRequired(true).setMinValue(1)),
  async execute(interaction, { musicManager }) {
    await musicManager.withGuildLock(interaction.guildId, async () => {
      const player = musicManager.get(interaction.guildId);
      requireSameVoiceChannel(interaction, player);
      if (!player) return interaction.reply({ embeds: [errorEmbed('Bot chưa phát nhạc trong server này.')], ephemeral: true });
      const index = interaction.options.getInteger('index', true);
      const removed = player.remove(index);
      if (!removed) return interaction.reply({ embeds: [errorEmbed('Index không hợp lệ.')], ephemeral: true });
      return interaction.reply({ embeds: [successEmbed(`Đã xóa **${removed.title}** khỏi hàng đợi.`)] });
    });
  },
};
