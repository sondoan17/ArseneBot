const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { errorEmbed, successEmbed } = require('../ui/embeds');
const { truncate } = require('../utils/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Xóa 1 bài khỏi hàng đợi (1-based, 1 = bài đầu queue)')
    .addIntegerOption((opt) =>
      opt
        .setName('index')
        .setDescription('Vị trí bài trong queue (1-based)')
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction) {
    const player = interaction.client.musicManager.get(interaction.guildId);

    if (!player || player.queue.length === 0) {
      return interaction.reply({
        embeds: [errorEmbed('Hàng đợi trống.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const index = interaction.options.getInteger('index', true);
    const removed = player.remove(index);

    if (!removed) {
      return interaction.reply({
        embeds: [
          errorEmbed(`Vị trí không hợp lệ. Hàng đợi chỉ có **${player.queue.length}** bài.`),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({
      embeds: [successEmbed(`🗑️ Đã xóa: **${truncate(removed.title, 80)}**`)],
    });
  },
};
