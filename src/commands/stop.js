const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('stop').setDescription('Dừng phát và xóa hàng đợi.'),
  async execute(interaction, { musicManager }) {
    const player = musicManager.get(interaction.guildId);
    if (!player) return interaction.reply({ embeds: [errorEmbed('Bot chưa phát nhạc trong server này.')], ephemeral: true });
    player.stop();
    return interaction.reply({ embeds: [successEmbed('Đã dừng phát và xóa hàng đợi.')] });
  },
};
