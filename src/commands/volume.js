const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { errorEmbed, successEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Chỉnh âm lượng (0-200)')
    .addIntegerOption((opt) =>
      opt
        .setName('level')
        .setDescription('Mức âm lượng (0-200)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(200)
    ),

  async execute(interaction) {
    const player = interaction.client.musicManager.get(interaction.guildId);

    if (!player) {
      return interaction.reply({
        embeds: [errorEmbed('Bot chưa kết nối voice channel.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const level = interaction.options.getInteger('level', true);
    player.setVolume(level);

    return interaction.reply({
      embeds: [successEmbed(`🔊 Đã chỉnh âm lượng thành **${level}%**`)],
    });
  },
};
