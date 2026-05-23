const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { errorEmbed, successEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Tiếp tục phát bài đang tạm dừng'),

  async execute(interaction) {
    const player = interaction.client.musicManager.get(interaction.guildId);

    if (!player || !player.current) {
      return interaction.reply({
        embeds: [errorEmbed('Hiện không có bài nào đang phát.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!player.paused) {
      return interaction.reply({
        embeds: [errorEmbed('Bài đang phát bình thường, không cần resume.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const ok = player.resume();
    if (!ok) {
      return interaction.reply({
        embeds: [errorEmbed('Không thể tiếp tục phát lúc này.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({
      embeds: [successEmbed('▶️ Đã tiếp tục phát nhạc.')],
    });
  },
};
