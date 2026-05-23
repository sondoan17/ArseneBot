const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');
const { UserFacingMusicError } = require('../music/errors');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Tua bài hiện tại đến số giây tuyệt đối.')
    .addIntegerOption((option) => option.setName('seconds').setDescription('Vị trí tính bằng giây').setRequired(true).setMinValue(0)),
  async execute(interaction, { musicManager }) {
    await interaction.deferReply();
    const player = musicManager.get(interaction.guildId);
    if (!player?.current) throw new UserFacingMusicError('Không có bài nào đang phát.');
    const seconds = interaction.options.getInteger('seconds', true);
    await player.seek(seconds);
    return interaction.editReply({ embeds: [successEmbed(`Đã tua đến **${seconds}s**.`)] });
  },
};
