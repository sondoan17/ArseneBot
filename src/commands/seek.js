const { SlashCommandBuilder } = require('discord.js');
const { successEmbed } = require('../ui/embeds');
const { UserFacingMusicError } = require('../music/errors');
const { requireSameVoiceChannel } = require('./voiceAccess');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Tua bài hiện tại đến số giây tuyệt đối.')
    .addIntegerOption((option) => option.setName('seconds').setDescription('Vị trí tính bằng giây').setRequired(true).setMinValue(0)),
  async execute(interaction, { musicManager }) {
    await musicManager.withGuildLock(interaction.guildId, async () => {
      const player = musicManager.get(interaction.guildId);
      requireSameVoiceChannel(interaction, player);
      if (!player?.current) throw new UserFacingMusicError('Không có bài nào đang phát.');
      const seconds = interaction.options.getInteger('seconds', true);
      await player.seek(seconds);
      return interaction.editReply({ embeds: [successEmbed(`Đã tua đến **${seconds}s**.`)] });
    });
  },
};
