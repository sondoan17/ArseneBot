const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { errorEmbed, queueEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Hiển thị hàng đợi nhạc'),

  async execute(interaction) {
    const player = interaction.client.musicManager.get(interaction.guildId);

    if (!player || (!player.current && player.queue.length === 0)) {
      return interaction.reply({
        embeds: [errorEmbed('Hàng đợi trống.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({
      embeds: [queueEmbed(player.queue, player.current, player.loopMode)],
    });
  },
};
