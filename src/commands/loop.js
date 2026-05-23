const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { errorEmbed, successEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Đặt chế độ lặp')
    .addStringOption((opt) =>
      opt
        .setName('mode')
        .setDescription('Chế độ lặp')
        .setRequired(true)
        .addChoices(
          { name: 'Off (tắt)', value: 'off' },
          { name: 'Track (lặp 1 bài)', value: 'track' },
          { name: 'Queue (lặp queue)', value: 'queue' }
        )
    ),

  async execute(interaction) {
    const player = interaction.client.musicManager.get(interaction.guildId);

    if (!player) {
      return interaction.reply({
        embeds: [errorEmbed('Bot chưa kết nối voice channel.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const mode = interaction.options.getString('mode', true);
    player.setLoopMode(mode);

    const labels = { off: 'Tắt', track: 'Lặp 1 bài', queue: 'Lặp toàn bộ queue' };
    return interaction.reply({
      embeds: [successEmbed(`🔁 Chế độ lặp: **${labels[mode]}**`)],
    });
  },
};
