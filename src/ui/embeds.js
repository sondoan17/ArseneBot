const { EmbedBuilder } = require('discord.js');
const { formatDuration, truncate, progressBar } = require('../utils/format');

/**
 * Now Playing embed
 * @param {import('../music/Track')} track
 * @param {number} currentSeconds - current playback position
 * @param {boolean} paused
 * @param {string} loopMode
 * @param {number} volume
 * @returns {EmbedBuilder}
 */
function nowPlayingEmbed(track, currentSeconds = 0, paused = false, loopMode = 'off', volume = 100) {
  const status = paused ? '⏸️ Tạm dừng' : '▶️ Đang phát';
  const bar = progressBar(currentSeconds, track.duration);
  const timeStr = `${formatDuration(currentSeconds)} / ${formatDuration(track.duration)}`;

  const embed = new EmbedBuilder()
    .setColor(0x7289da)
    .setTitle(`${status}`)
    .setDescription(`**[${truncate(track.title, 80)}](${track.url})**`)
    .addFields(
      { name: '⏱️ Thời gian', value: `${bar}\n${timeStr}`, inline: false },
      { name: '🔊 Âm lượng', value: `${volume}%`, inline: true },
      { name: '🔁 Lặp', value: loopMode, inline: true },
    )
    .setFooter({ text: `Yêu cầu bởi ${track.requestedBy}` });

  if (track.thumbnail) {
    embed.setThumbnail(track.thumbnail);
  }

  return embed;
}

/**
 * Queue embed (paginated display)
 * @param {import('../music/Track')[]} queue
 * @param {import('../music/Track')|null} current
 * @param {string} loopMode
 * @returns {EmbedBuilder}
 */
function queueEmbed(queue, current, loopMode = 'off') {
  const embed = new EmbedBuilder()
    .setColor(0x7289da)
    .setTitle('📜 Hàng đợi nhạc');

  let description = '';

  if (current) {
    description += `**Đang phát:**\n🎶 [${truncate(current.title, 60)}](${current.url}) — \`${formatDuration(current.duration)}\`\n\n`;
  }

  if (queue.length === 0) {
    description += '*Hàng đợi trống.*';
  } else {
    description += '**Tiếp theo:**\n';
    const maxDisplay = 10;
    const displayed = queue.slice(0, maxDisplay);

    displayed.forEach((track, i) => {
      description += `\`${i + 1}.\` [${truncate(track.title, 50)}](${track.url}) — \`${formatDuration(track.duration)}\`\n`;
    });

    if (queue.length > maxDisplay) {
      description += `\n... và **${queue.length - maxDisplay}** bài khác.`;
    }
  }

  embed.setDescription(description);

  const totalDuration = queue.reduce((acc, t) => acc + (t.duration || 0), 0) + (current?.duration || 0);
  embed.setFooter({ text: `${queue.length} bài trong hàng đợi • Tổng: ${formatDuration(totalDuration)} • Lặp: ${loopMode}` });

  return embed;
}

/**
 * Error embed
 * @param {string} message
 * @returns {EmbedBuilder}
 */
function errorEmbed(message) {
  return new EmbedBuilder()
    .setColor(0xff0000)
    .setDescription(`❌ ${message}`);
}

/**
 * Success embed
 * @param {string} message
 * @returns {EmbedBuilder}
 */
function successEmbed(message) {
  return new EmbedBuilder()
    .setColor(0x00ff00)
    .setDescription(`✅ ${message}`);
}

/**
 * Info embed
 * @param {string} message
 * @returns {EmbedBuilder}
 */
function infoEmbed(message) {
  return new EmbedBuilder()
    .setColor(0x7289da)
    .setDescription(message);
}

module.exports = { nowPlayingEmbed, queueEmbed, errorEmbed, successEmbed, infoEmbed };
