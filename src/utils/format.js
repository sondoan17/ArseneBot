/**
 * Format duration in seconds to mm:ss or hh:mm:ss
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0:00';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Truncate a string to maxLength, appending "..." if truncated
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
function truncate(str, maxLength = 60) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Create a progress bar for now playing
 * @param {number} current - current position in seconds
 * @param {number} total - total duration in seconds
 * @param {number} length - bar character length
 * @returns {string}
 */
function progressBar(current, total, length = 20) {
  if (!total || total <= 0) return '▬'.repeat(length);

  const progress = Math.min(current / total, 1);
  const filledLength = Math.round(progress * length);

  const filled = '▬'.repeat(Math.max(0, filledLength - 1));
  const marker = '🔘';
  const empty = '▬'.repeat(Math.max(0, length - filledLength));

  return filled + marker + empty;
}

/**
 * Log with prefix, timestamp, and optional guildId
 * @param {'INFO'|'WARN'|'ERROR'} level
 * @param {string} message
 * @param {string|null} guildId
 */
function log(level, message, guildId = null) {
  const timestamp = new Date().toISOString();
  const guildTag = guildId ? ` [guild:${guildId}]` : '';
  const line = `[${timestamp}] [${level}]${guildTag} ${message}`;

  switch (level) {
    case 'ERROR':
      console.error(line);
      break;
    case 'WARN':
      console.warn(line);
      break;
    default:
      console.log(line);
  }
}

module.exports = { formatDuration, truncate, progressBar, log };
