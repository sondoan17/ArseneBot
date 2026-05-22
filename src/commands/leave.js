const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('leave').setDescription('Rời voice channel.'),
  async execute(interaction, { musicManager }) {
    const destroyed = musicManager.destroy(interaction.guildId);
    if (!destroyed) return interaction.reply({ embeds: [errorEmbed('Bot không ở trong voice channel nào.')], ephemeral: true });
    return interaction.reply({ embeds: [successEmbed('Đã rời voice channel.')] });
  },
};
