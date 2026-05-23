const { EventEmitter } = require('node:events');
const { AudioPlayerStatus, createAudioResource, StreamType } = require('@discordjs/voice');
const { UserFacingMusicError } = require('./errors');

class GuildPlayer extends EventEmitter {
  constructor({
    guildId,
    voiceChannelId,
    textChannelId,
    audioPlayer,
    voiceConnection,
    youtube,
    createAudioResource: createResource = createAudioResource,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
    notify = async () => {},
    log = console,
    onDestroy,
  }) {
    super();
    this.guildId = guildId;
    this.voiceChannelId = voiceChannelId;
    this.textChannelId = textChannelId;
    this.audioPlayer = audioPlayer;
    this.voiceConnection = voiceConnection;
    this.youtube = youtube;
    this.createAudioResource = createResource;
    this.setTimeoutFn = setTimeoutFn;
    this.clearTimeoutFn = clearTimeoutFn;
    this.notify = notify;
    this.log = log;
    this.onDestroy = onDestroy;
    this.queue = [];
    this.current = null;
    this.history = [];
    this.loopMode = 'off';
    this.volume = 100;
    this.paused = false;
    this.idleTimer = null;
    this.currentResource = null;
    this.isLoading = false;
    this.pendingSkip = false;

    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      this.log.info(this.guildId, 'AudioPlayer → idle');
      this.handleIdle().catch((error) => this.emit('error', error));
    });
    this.audioPlayer.on('error', (error) => {
      this.log.error(this.guildId, 'AudioPlayer error', error);
      this.handleAudioError(error).catch((handlerError) => this.emit('error', handlerError));
    });
    this.audioPlayer.on(AudioPlayerStatus.Playing, () => {
      this.log.info(this.guildId, 'AudioPlayer → playing');
    });
    this.audioPlayer.on(AudioPlayerStatus.Buffering, () => {
      this.log.info(this.guildId, 'AudioPlayer → buffering');
    });
  }

  async enqueue(tracks) {
    this.clearIdleTimer();
    if (!this.current && this.queue.length === 0) {
      const [first, ...rest] = tracks;
      this.current = first || null;
      this.queue.push(...rest);
      if (this.current) await this.playCurrent();
      return { started: Boolean(this.current), added: rest.length };
    }

    this.queue.push(...tracks);
    return { started: false, added: tracks.length };
  }

  async playCurrent(seekSeconds = 0) {
    if (!this.current) return;
    this.isLoading = true;
    try {
      this.log.info(this.guildId, `Creating stream for: ${this.current.title}`);
      const stream = await this.youtube.createStream(this.current, seekSeconds);
      this.log.info(this.guildId, `Stream created, type=${stream.type}, connection state=${this.voiceConnection.state?.status}`);

      const resource = this.createAudioResource(stream.stream, {
        inputType: stream.type || StreamType.Arbitrary,
        inlineVolume: true,
      });
      this.currentResource = resource;
      resource.volume?.setVolume(this.volume / 100);

      this.log.info(this.guildId, `Playing resource, player state=${this.audioPlayer.state?.status}`);
      this.audioPlayer.play(resource);
      this.log.info(this.guildId, `After play(), player state=${this.audioPlayer.state?.status}`);
    } finally {
      this.isLoading = false;
    }

    if (this.pendingSkip) {
      this.pendingSkip = false;
      this.audioPlayer.stop();
    }
  }

  async handleIdle() {
    this.log.info(this.guildId, `handleIdle called, current=${this.current?.title}, loop=${this.loopMode}, queue=${this.queue.length}`);
    if (!this.current) {
      this.startIdleTimer();
      return;
    }

    if (this.loopMode === 'track') {
      await this.playCurrent();
      return;
    }

    const finished = this.current;
    if (this.loopMode === 'queue') this.queue.push(finished);
    else this.history.push(finished);

    this.current = this.queue.shift() || null;
    if (this.current) await this.playCurrent();
    else startIdleTimerSafe(this);
  }

  async handleAudioError(error) {
    const failedTrack = this.current;
    this.log.error(this.guildId, 'Audio player error', error);
    if (failedTrack) {
      await this.notify(`Không thể phát **${failedTrack.title}**, đang bỏ qua bài này.`);
      this.history.push(failedTrack);
    }
    this.current = this.queue.shift() || null;
    if (this.current) await this.playCurrent();
    else this.startIdleTimer();
  }

  skip() {
    if (this.isLoading) {
      this.pendingSkip = true;
      return;
    }
    this.audioPlayer.stop();
  }

  stop() {
    this.queue = [];
    this.current = null;
    this.currentResource = null;
    this.audioPlayer.stop();
    this.startIdleTimer();
  }

  pause() {
    const paused = this.audioPlayer.pause();
    if (paused) this.paused = true;
    return paused;
  }

  resume() {
    const resumed = this.audioPlayer.unpause();
    if (resumed) this.paused = false;
    return resumed;
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(200, volume));
    this.currentResource?.volume?.setVolume(this.volume / 100);
  }

  setLoopMode(loopMode) {
    this.loopMode = loopMode;
  }

  shuffle() {
    for (let index = this.queue.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [this.queue[index], this.queue[swapIndex]] = [this.queue[swapIndex], this.queue[index]];
    }
  }

  async seek(seconds) {
    if (!this.current) throw new UserFacingMusicError('Không có bài nào đang phát.');
    if (!Number.isFinite(this.current.duration)) throw new UserFacingMusicError('Bài này không hỗ trợ seek vì không có thời lượng xác định.');
    if (seconds > this.current.duration) throw new UserFacingMusicError('Vị trí seek vượt quá thời lượng bài hát.');
    await this.playCurrent(seconds);
  }

  remove(index) {
    const zeroBasedIndex = index - 1;
    if (zeroBasedIndex < 0 || zeroBasedIndex >= this.queue.length) return null;
    return this.queue.splice(zeroBasedIndex, 1)[0];
  }

  startIdleTimer() {
    this.clearIdleTimer();
    this.idleTimer = this.setTimeoutFn(() => this.destroy(), 5 * 60 * 1000);
  }

  clearIdleTimer() {
    if (!this.idleTimer) return;
    this.clearTimeoutFn(this.idleTimer);
    this.idleTimer = null;
  }

  destroy() {
    this.clearIdleTimer();
    this.queue = [];
    this.current = null;
    this.currentResource = null;
    if (this.voiceConnection.state?.status !== 'destroyed') this.voiceConnection.destroy();
    this.onDestroy?.(this.guildId);
  }
}

function startIdleTimerSafe(player) {
  player.startIdleTimer();
}

module.exports = { GuildPlayer };
