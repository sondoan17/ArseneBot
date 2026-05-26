const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');
const { requireSameVoiceChannel } = require('./voiceAccess');

module.exports = {
  data: new SlashCommandBuilder().setName('pause').setDescription('Tạm dừng bài hiện tại.'),
  async execute(interaction, { musicManager }) {
    await musicManager.withGuildLock(interaction.guildId, async () => {
      const player = musicManager.get(interaction.guildId);
      requireSameVoiceChannel(interaction, player);
      if (!player?.current) return interaction.reply({ embeds: [errorEmbed('Không có bài nào đang phát.')], ephemeral: true });
      player.pause();
      return interaction.reply({ embeds: [successEmbed('Đã tạm dừng.')] });
    });
  },
};
