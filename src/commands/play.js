const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { resolve } = require('../music/youtube');
const { errorEmbed, successEmbed, infoEmbed } = require('../ui/embeds');
const { truncate, log } = require('../utils/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Phát nhạc từ YouTube (URL video, playlist, hoặc keyword)')
    .addStringOption((opt) =>
      opt.setName('query').setDescription('URL hoặc keyword tìm kiếm').setRequired(true)
    ),

  async execute(interaction) {
    const query = interaction.options.getString('query', true);
    const member = interaction.member;
    const voiceChannel = member.voice?.channel;

    if (!voiceChannel) {
      return interaction.reply({
        embeds: [errorEmbed('Bạn cần vào voice channel trước.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    // Check bot permissions
    const permissions = voiceChannel.permissionsFor(interaction.guild.members.me);
    if (!permissions.has('Connect') || !permissions.has('Speak')) {
      return interaction.reply({
        embeds: [errorEmbed('Bot không có quyền `Connect` hoặc `Speak` ở voice channel này.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    log('INFO', `User ${member.user.username} requested play: ${query}`, interaction.guildId);

    let tracks;
    try {
      tracks = await resolve(query, member.user.username);
    } catch (err) {
      log('ERROR', `Resolve failed: ${err.message}`, interaction.guildId);
      let userMessage = `Không thể tải bài nhạc: ${err.message}`;
      if (/sign in|confirm/i.test(err.message)) {
        userMessage = 'YouTube yêu cầu xác thực. Admin cần cập nhật `YOUTUBE_COOKIE`.';
      }
      return interaction.editReply({ embeds: [errorEmbed(userMessage)] });
    }

    if (!tracks || tracks.length === 0) {
      return interaction.editReply({ embeds: [errorEmbed('Không tìm thấy kết quả.')] });
    }

    const manager = interaction.client.musicManager;
    const existing = manager.get(interaction.guildId);

    // Bot is already playing in another channel
    if (existing && existing.voiceChannelId && existing.voiceChannelId !== voiceChannel.id) {
      return interaction.editReply({
        embeds: [errorEmbed('Bot đang phát ở voice channel khác.')],
      });
    }

    const player = manager.getOrCreate(
      interaction.guildId,
      voiceChannel.id,
      interaction.channelId,
      interaction.guild
    );

    // Connect if not connected
    if (!player.connection) {
      player.textChannelId = interaction.channelId;
      player.connect(voiceChannel.id, interaction.guild.voiceAdapterCreator);
    }

    const result = player.enqueue(tracks);

    if (result.startedPlaying) {
      const t = tracks[0];
      const extra = tracks.length > 1 ? ` và ${tracks.length - 1} bài tiếp theo` : '';
      return interaction.editReply({
        embeds: [successEmbed(`Đang phát: **[${truncate(t.title, 80)}](${t.url})**${extra}`)],
      });
    }

    return interaction.editReply({
      embeds: [
        infoEmbed(
          `Đã thêm **${result.count}** bài vào hàng đợi. Vị trí tiếp theo: **#${player.queue.length - result.count + 1}**`
        ),
      ],
    });
  },
};
