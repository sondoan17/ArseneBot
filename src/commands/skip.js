const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { errorEmbed, successEmbed } = require('../ui/embeds');
const { truncate } = require('../utils/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Bỏ qua bài đang phát'),

  async execute(interaction) {
    const player = interaction.client.musicManager.get(interaction.guildId);

    if (!player || !player.current) {
      return interaction.reply({
        embeds: [errorEmbed('Hiện không có bài nào đang phát.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const skipped = player.current;
    player.skip();

    return interaction.reply({
      embeds: [successEmbed(`Đã bỏ qua: **${truncate(skipped.title, 80)}**`)],
    });
  },
};
