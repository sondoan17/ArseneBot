const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { errorEmbed, successEmbed } = require('../ui/embeds');
const { formatDuration } = require('../utils/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Tua bài đang phát đến vị trí (tính bằng giây)')
    .addIntegerOption((opt) =>
      opt
        .setName('seconds')
        .setDescription('Vị trí tuyệt đối tính bằng giây (0 = từ đầu)')
        .setRequired(true)
        .setMinValue(0)
    ),

  async execute(interaction) {
    const player = interaction.client.musicManager.get(interaction.guildId);

    if (!player || !player.current) {
      return interaction.reply({
        embeds: [errorEmbed('Hiện không có bài nào đang phát.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const seconds = interaction.options.getInteger('seconds', true);

    if (seconds >= player.current.duration) {
      return interaction.reply({
        embeds: [
          errorEmbed(`Vị trí tua vượt quá độ dài bài (**${formatDuration(player.current.duration)}**).`),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    const ok = await player.seek(seconds);
    if (!ok) {
      return interaction.editReply({ embeds: [errorEmbed('Tua thất bại, vui lòng thử lại.')] });
    }

    return interaction.editReply({
      embeds: [successEmbed(`⏩ Đã tua đến **${formatDuration(seconds)}**`)],
    });
  },
};
