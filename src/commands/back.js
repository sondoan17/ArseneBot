const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');
const { requireSameVoiceChannel } = require('./voiceAccess');

module.exports = {
  data: new SlashCommandBuilder().setName('back').setDescription('Phát lại bài vừa phát trước đó.'),
  async execute(interaction, { musicManager }) {
    await musicManager.withGuildLock(interaction.guildId, async () => {
      const player = musicManager.get(interaction.guildId);
      requireSameVoiceChannel(interaction, player);
      if (!player) return interaction.reply({ embeds: [errorEmbed('Bot chưa phát nhạc trong server này.')], ephemeral: true });

      const previous = await player.back();
      if (!previous) {
        return interaction.reply({ embeds: [errorEmbed('Không có bài nào trước đó để phát lại.')], ephemeral: true });
      }

      return interaction.reply({ embeds: [successEmbed(`Đang quay lại bài trước: **${previous.title}**`)] });
    });
  },
};
