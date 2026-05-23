const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { errorEmbed, nowPlayingEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Hiển thị bài đang phát'),

  async execute(interaction) {
    const player = interaction.client.musicManager.get(interaction.guildId);

    if (!player || !player.current) {
      return interaction.reply({
        embeds: [errorEmbed('Hiện không có bài nào đang phát.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const position = player.getPlaybackPosition();

    return interaction.reply({
      embeds: [nowPlayingEmbed(player.current, position, player.paused, player.loopMode, player.volume)],
    });
  },
};
