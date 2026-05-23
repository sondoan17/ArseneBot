const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const { createStream } = require('./youtube');
const { log } = require('../utils/format');

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Per-guild music player state
 */
class GuildPlayer {
  /**
   * @param {object} opts
   * @param {string} opts.guildId
   * @param {string} opts.voiceChannelId
   * @param {string} opts.textChannelId
   * @param {import('discord.js').Guild} opts.guild
   * @param {Function} opts.onDestroy - callback when player is destroyed
   */
  constructor({ guildId, voiceChannelId, textChannelId, guild, onDestroy }) {
    this.guildId = guildId;
    this.voiceChannelId = voiceChannelId;
    this.textChannelId = textChannelId;
    this.guild = guild;
    this.onDestroy = onDestroy;

    /** @type {import('./Track')[]} */
    this.queue = [];
    /** @type {import('./Track')|null} */
    this.current = null;
    /** @type {import('./Track')[]} */
    this.history = [];

    this.loopMode = 'off'; // 'off' | 'track' | 'queue'
    this.volume = 100;
    this.paused = false;
    this.isLoading = false;
    this.pendingSkip = false;

    /** @type {NodeJS.Timeout|null} */
    this.idleTimer = null;

    // Create audio player
    this.audioPlayer = createAudioPlayer();
    this.connection = null;
    this.resource = null;

    this._setupAudioPlayerListeners();
  }

  /**
   * Connect to voice channel
   * @param {string} channelId
   * @param {object} adapterCreator
   */
  connect(channelId, adapterCreator) {
    this.voiceChannelId = channelId;
    this.connection = joinVoiceChannel({
      channelId,
      guildId: this.guildId,
      adapterCreator,
      selfDeaf: true,
    });

    this.connection.subscribe(this.audioPlayer);
    this._setupConnectionListeners();
  }

  /**
   * Enqueue tracks
   * @param {import('./Track')[]} tracks
   * @returns {{ startedPlaying: boolean, count: number }}
   */
  enqueue(tracks) {
    this.clearIdleTimer();

    if (!this.current && this.queue.length === 0) {
      // Nothing playing, start immediately
      this.current = tracks[0];
      this.queue.push(...tracks.slice(1));
      this.playCurrent();
      return { startedPlaying: true, count: tracks.length };
    }

    this.queue.push(...tracks);
    return { startedPlaying: false, count: tracks.length };
  }

  /**
   * Play the current track
   */
  async playCurrent() {
    if (!this.current) {
      this.startIdleTimer();
      return;
    }

    this.isLoading = true;
    this.paused = false;

    try {
      const stream = await createStream(this.current.url);
      this.resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true,
      });
      this.resource.volume?.setVolume(this.volume / 100);

      // Check if skip was requested during loading
      if (this.pendingSkip) {
        this.pendingSkip = false;
        this.isLoading = false;
        this._onIdle();
        return;
      }

      this.audioPlayer.play(this.resource);
      this.isLoading = false;
    } catch (err) {
      log('ERROR', `Failed to play "${this.current?.title}": ${err.message}`, this.guildId);
      this.isLoading = false;

      // Skip to next track on error
      this._sendErrorToTextChannel(`Không thể phát **${this.current?.title}**: ${err.message}`);
      this.current = this.queue.shift() || null;
      if (this.current) {
        await this.playCurrent();
      } else {
        this.startIdleTimer();
      }
    }
  }

  /**
   * Skip current track
   */
  skip() {
    if (this.isLoading) {
      this.pendingSkip = true;
      return;
    }
    this.audioPlayer.stop();
  }

  /**
   * Stop playback and clear queue
   */
  stop() {
    this.queue = [];
    this.current = null;
    this.loopMode = 'off';
    this.audioPlayer.stop();
    this.startIdleTimer();
  }

  /**
   * Pause playback
   */
  pause() {
    if (this.audioPlayer.state.status === AudioPlayerStatus.Playing) {
      this.audioPlayer.pause();
      this.paused = true;
      return true;
    }
    return false;
  }

  /**
   * Resume playback
   */
  resume() {
    if (this.audioPlayer.state.status === AudioPlayerStatus.Paused) {
      this.audioPlayer.unpause();
      this.paused = false;
      return true;
    }
    return false;
  }

  /**
   * Set volume (0-200)
   * @param {number} vol
   */
  setVolume(vol) {
    this.volume = Math.max(0, Math.min(200, vol));
    if (this.resource?.volume) {
      this.resource.volume.setVolume(this.volume / 100);
    }
  }

  /**
   * Set loop mode
   * @param {'off'|'track'|'queue'} mode
   */
  setLoopMode(mode) {
    this.loopMode = mode;
  }

  /**
   * Shuffle the queue
   */
  shuffle() {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
  }

  /**
   * Remove a track from queue by 1-based index
   * @param {number} index - 1-based
   * @returns {import('./Track')|null}
   */
  remove(index) {
    const i = index - 1;
    if (i < 0 || i >= this.queue.length) return null;
    const [removed] = this.queue.splice(i, 1);
    return removed;
  }

  /**
   * Seek to a position in seconds
   * @param {number} seconds
   */
  async seek(seconds) {
    if (!this.current) return false;

    try {
      const play = require('play-dl');
      const seekStream = await play.stream(this.current.url, { seek: seconds });
      this.resource = createAudioResource(seekStream.stream, {
        inputType: seekStream.type,
        inlineVolume: true,
      });
      this.resource.volume?.setVolume(this.volume / 100);
      this.audioPlayer.play(this.resource);
      this.paused = false;
      return true;
    } catch (err) {
      log('ERROR', `Seek failed: ${err.message}`, this.guildId);
      return false;
    }
  }

  /**
   * Get current playback position in seconds
   * @returns {number}
   */
  getPlaybackPosition() {
    if (this.audioPlayer.state.status === AudioPlayerStatus.Playing ||
        this.audioPlayer.state.status === AudioPlayerStatus.Paused) {
      return Math.floor((this.audioPlayer.state.resource?.playbackDuration || 0) / 1000);
    }
    return 0;
  }

  /**
   * Leave voice channel and clean up
   */
  destroy() {
    this.clearIdleTimer();
    this.audioPlayer.stop(true);

    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }

    this.queue = [];
    this.current = null;
    this.history = [];

    log('INFO', `GuildPlayer destroyed.`, this.guildId);
  }

  /**
   * Start idle timer (auto-leave after 5 min)
   */
  startIdleTimer() {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      log('INFO', `Idle timeout reached, leaving voice.`, this.guildId);
      this.destroy();
      if (this.onDestroy) this.onDestroy();
    }, IDLE_TIMEOUT_MS);
  }

  /**
   * Clear idle timer
   */
  clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  // --- Private ---

  _setupAudioPlayerListeners() {
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      this._onIdle();
    });

    this.audioPlayer.on('error', (err) => {
      log('ERROR', `AudioPlayer error: ${err.message}`, this.guildId);
      this._sendErrorToTextChannel(`Lỗi phát nhạc: ${err.message}. Chuyển bài tiếp theo...`);
      this._onIdle();
    });
  }

  _setupConnectionListeners() {
    if (!this.connection) return;

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        // Try to reconnect
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        // Cannot reconnect, destroy
        log('WARN', `Voice connection lost, destroying player.`, this.guildId);
        this.destroy();
        if (this.onDestroy) this.onDestroy();
      }
    });

    this.connection.on('error', (err) => {
      log('ERROR', `Voice connection error: ${err.message}`, this.guildId);
      this.destroy();
      if (this.onDestroy) this.onDestroy();
    });
  }

  _onIdle() {
    switch (this.loopMode) {
      case 'track':
        this.playCurrent();
        break;

      case 'queue':
        if (this.current) {
          this.queue.push(this.current);
        }
        this.current = this.queue.shift() || null;
        if (this.current) {
          this.playCurrent();
        } else {
          this.startIdleTimer();
        }
        break;

      case 'off':
      default:
        if (this.current) {
          this.history.push(this.current);
        }
        this.current = this.queue.shift() || null;
        if (this.current) {
          this.playCurrent();
        } else {
          this.startIdleTimer();
        }
        break;
    }
  }

  async _sendErrorToTextChannel(message) {
    try {
      const channel = await this.guild.channels.fetch(this.textChannelId);
      if (channel) {
        const { errorEmbed } = require('../ui/embeds');
        await channel.send({ embeds: [errorEmbed(message)] });
      }
    } catch {
      // Silently fail
    }
  }
}

module.exports = GuildPlayer;
