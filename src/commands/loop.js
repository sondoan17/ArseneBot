const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Đặt chế độ lặp.')
    .addStringOption((option) => option.setName('mode').setDescription('Chế độ lặp').setRequired(true).addChoices(
      { name: 'off', value: 'off' },
      { name: 'track', value: 'track' },
      { name: 'queue', value: 'queue' },
    )),
  async execute(interaction, { musicManager }) {
    const player = musicManager.get(interaction.guildId);
    if (!player) return interaction.reply({ embeds: [errorEmbed('Bot chưa phát nhạc trong server này.')], ephemeral: true });
    const mode = interaction.options.getString('mode', true);
    player.setLoopMode(mode);
    return interaction.reply({ embeds: [successEmbed(`Loop đã đặt thành **${mode}**.`)] });
  },
};
