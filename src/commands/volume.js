const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');
const { requireSameVoiceChannel } = require('./voiceAccess');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Chỉnh âm lượng.')
    .addIntegerOption((option) => option.setName('value').setDescription('Âm lượng từ 0 đến 200').setRequired(true).setMinValue(0).setMaxValue(200)),
  async execute(interaction, { musicManager }) {
    await musicManager.withGuildLock(interaction.guildId, async () => {
      const player = musicManager.get(interaction.guildId);
      requireSameVoiceChannel(interaction, player);
      if (!player) return interaction.reply({ embeds: [errorEmbed('Bot chưa phát nhạc trong server này.')], ephemeral: true });
      const volume = interaction.options.getInteger('value', true);
      player.setVolume(volume);
      return interaction.reply({ embeds: [successEmbed(`Âm lượng đã đặt thành **${volume}%**.`)] });
    });
  },
};
