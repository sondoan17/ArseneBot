const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('pause').setDescription('Tạm dừng bài hiện tại.'),
  async execute(interaction, { musicManager }) {
    const player = musicManager.get(interaction.guildId);
    if (!player?.current) return interaction.reply({ embeds: [errorEmbed('Không có bài nào đang phát.')], ephemeral: true });
    player.pause();
    return interaction.reply({ embeds: [successEmbed('Đã tạm dừng.')] });
  },
};
