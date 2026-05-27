const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');
const { requireSameVoiceChannel } = require('./voiceAccess');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Bật hoặc tắt tự phát bài liên quan khi hết queue.')
    .addStringOption((option) => option
      .setName('mode')
      .setDescription('Trạng thái autoplay')
      .setRequired(true)
      .addChoices(
        { name: 'on', value: 'on' },
        { name: 'off', value: 'off' },
      )),
  async execute(interaction, { musicManager }) {
    await musicManager.withGuildLock(interaction.guildId, async () => {
      const player = musicManager.get(interaction.guildId);
      requireSameVoiceChannel(interaction, player);
      if (!player) return interaction.reply({ embeds: [errorEmbed('Bot chưa phát nhạc trong server này.')], ephemeral: true });

      const mode = interaction.options.getString('mode', true);
      player.setAutoplayEnabled(mode === 'on');
      return interaction.reply({ embeds: [successEmbed(`Đã ${mode === 'on' ? 'bật' : 'tắt'} autoplay.`)] });
    });
  },
};
