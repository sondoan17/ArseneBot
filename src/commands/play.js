const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Phát nhạc từ YouTube URL, playlist, hoặc từ khóa.')
    .addStringOption((option) => option.setName('query').setDescription('URL hoặc từ khóa YouTube').setRequired(true)),
  async execute(interaction, { youtube, musicManager, log }) {
    await interaction.deferReply();
    const query = interaction.options.getString('query', true);
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
      await interaction.editReply({ embeds: [errorEmbed('Bạn cần vào voice channel trước.')] });
      return;
    }

    const permissions = voiceChannel.permissionsFor(interaction.guild.members.me);
    if (!permissions.has(PermissionsBitField.Flags.Connect) || !permissions.has(PermissionsBitField.Flags.Speak)) {
      await interaction.editReply({ embeds: [errorEmbed('Bot cần quyền Join và Speak trong voice channel này.')] });
      return;
    }

    log.info(interaction.guildId, `User ${interaction.user.id} requested play: ${query}`);
    const tracks = await youtube.resolveQuery(query, {
      id: interaction.user.id,
      username: interaction.user.username,
    });
    if (tracks.length === 0) {
      await interaction.editReply({ embeds: [errorEmbed('Không tìm thấy kết quả phù hợp.')] });
      return;
    }

    let player;
    try {
      player = musicManager.getOrCreate({ guild: interaction.guild, voiceChannel, textChannelId: interaction.channelId });
    } catch (error) {
      if (error.code === 'PLAYER_IN_DIFFERENT_CHANNEL') {
        await interaction.editReply({ embeds: [errorEmbed('Bot đang phát ở channel khác.')] });
        return;
      }
      throw error;
    }

    const result = await player.enqueue(tracks);
    const message = result.started
      ? `Đang phát: **${tracks[0].title}**`
      : `Đã thêm **${tracks.length}** bài vào hàng đợi.`;
    await interaction.editReply({ embeds: [successEmbed(message)] });
  },
};
