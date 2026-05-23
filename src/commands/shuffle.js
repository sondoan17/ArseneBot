const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { errorEmbed, successEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Xáo trộn hàng đợi'),

  async execute(interaction) {
    const player = interaction.client.musicManager.get(interaction.guildId);

    if (!player || player.queue.length < 2) {
      return interaction.reply({
        embeds: [errorEmbed('Cần ít nhất 2 bài trong hàng đợi để shuffle.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    player.shuffle();

    return interaction.reply({
      embeds: [successEmbed(`🔀 Đã xáo trộn **${player.queue.length}** bài.`)],
    });
  },
};
