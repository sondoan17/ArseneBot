const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { errorEmbed, successEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Tạm dừng bài đang phát'),

  async execute(interaction) {
    const player = interaction.client.musicManager.get(interaction.guildId);

    if (!player || !player.current) {
      return interaction.reply({
        embeds: [errorEmbed('Hiện không có bài nào đang phát.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (player.paused) {
      return interaction.reply({
        embeds: [errorEmbed('Bài đã đang tạm dừng.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const ok = player.pause();
    if (!ok) {
      return interaction.reply({
        embeds: [errorEmbed('Không thể tạm dừng lúc này.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({
      embeds: [successEmbed('⏸️ Đã tạm dừng phát nhạc.')],
    });
  },
};
