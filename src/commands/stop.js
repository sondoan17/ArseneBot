const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { errorEmbed, successEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Dừng phát và xóa hàng đợi'),

  async execute(interaction) {
    const player = interaction.client.musicManager.get(interaction.guildId);

    if (!player || (!player.current && player.queue.length === 0)) {
      return interaction.reply({
        embeds: [errorEmbed('Hiện không có gì để dừng.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    player.stop();

    return interaction.reply({
      embeds: [successEmbed('Đã dừng phát và xóa hàng đợi.')],
    });
  },
};
