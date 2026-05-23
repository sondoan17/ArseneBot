const GuildPlayer = require('./GuildPlayer');

/**
 * Manages GuildPlayer instances per guild
 */
class MusicManager {
  constructor() {
    /** @type {Map<string, GuildPlayer>} */
    this.players = new Map();
  }

  /**
   * Get existing player for a guild
   * @param {string} guildId
   * @returns {GuildPlayer|undefined}
   */
  get(guildId) {
    return this.players.get(guildId);
  }

  /**
   * Get or create a GuildPlayer for the guild
   * @param {string} guildId
   * @param {string} voiceChannelId
   * @param {string} textChannelId
   * @param {import('discord.js').Guild} guild
   * @returns {GuildPlayer}
   */
  getOrCreate(guildId, voiceChannelId, textChannelId, guild) {
    let player = this.players.get(guildId);

    if (!player) {
      player = new GuildPlayer({
        guildId,
        voiceChannelId,
        textChannelId,
        guild,
        onDestroy: () => this.players.delete(guildId),
      });
      this.players.set(guildId, player);
    }

    return player;
  }

  /**
   * Destroy player for a guild
   * @param {string} guildId
   */
  destroy(guildId) {
    const player = this.players.get(guildId);
    if (player) {
      player.destroy();
      this.players.delete(guildId);
    }
  }
}

module.exports = { MusicManager };
