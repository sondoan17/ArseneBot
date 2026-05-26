const { EmbedBuilder } = require('discord.js');
const { formatDuration, truncate } = require('../utils/format');

function successEmbed(description) {
  return new EmbedBuilder().setColor(0x2ecc71).setDescription(description);
}

function errorEmbed(description) {
  return new EmbedBuilder().setColor(0xe74c3c).setDescription(description);
}

function nowPlayingEmbed(track, player) {
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('Đang phát')
    .setDescription(`[${truncate(track.title, 100)}](${track.url})`)
    .addFields(
      { name: 'Thời lượng', value: formatDuration(track.duration), inline: true },
      { name: 'Âm lượng', value: `${player.volume}%`, inline: true },
      { name: 'Loop', value: player.loopMode, inline: true },
    );
  if (track.thumbnail) embed.setThumbnail(track.thumbnail);
  return embed;
}

function queueEmbed(player) {
  const nowPlaying = player.current
    ? `Đang phát: [${truncate(player.current.title, 90)}](${player.current.url}) — ${formatDuration(player.current.duration)}`
    : 'Đang phát: không có bài nào.';
  const total = player.queue.length;
  const lines = player.queue.slice(0, 10).map((track, index) => (
    `${index + 1}. [${truncate(track.title, 80)}](${track.url}) — ${formatDuration(track.duration)}`
  ));
  let queueText = lines.length ? lines.join('\n') : 'Hàng đợi đang trống.';
  if (total > lines.length) {
    queueText += `\n\n...và ${total - lines.length} mục nữa`;
  }
  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle(`Hàng đợi (${total})`)
    .setDescription(`${nowPlaying}\n\n${queueText}`);
}

module.exports = { successEmbed, errorEmbed, nowPlayingEmbed, queueEmbed };
