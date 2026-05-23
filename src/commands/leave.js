const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { errorEmbed, successEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Bot rời khỏi voice channel'),

  async execute(interaction) {
    const player = interaction.client.musicManager.get(interaction.guildId);

    if (!player) {
      return interaction.reply({
        embeds: [errorEmbed('Bot chưa kết nối voice channel.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    interaction.client.musicManager.destroy(interaction.guildId);

    return interaction.reply({
      embeds: [successEmbed('👋 Đã rời voice channel.')],
    });
  },
};
