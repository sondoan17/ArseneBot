const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('skip').setDescription('Bỏ bài hiện tại.'),
  async execute(interaction, { musicManager }) {
    const player = musicManager.get(interaction.guildId);
    if (!player?.current) return interaction.reply({ embeds: [errorEmbed('Không có bài nào đang phát.')], ephemeral: true });
    player.skip();
    return interaction.reply({ embeds: [successEmbed('Đã bỏ bài hiện tại.')] });
  },
};
