const { SlashCommandBuilder } = require('discord.js');
const { queueEmbed, errorEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('queue').setDescription('Hiển thị hàng đợi.'),
  async execute(interaction, { musicManager }) {
    const player = musicManager.get(interaction.guildId);
    if (!player) return interaction.reply({ embeds: [errorEmbed('Bot chưa phát nhạc trong server này.')], ephemeral: true });
    return interaction.reply({ embeds: [queueEmbed(player)] });
  },
};
