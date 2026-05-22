const voice = require('@discordjs/voice');
const { GuildPlayer } = require('./GuildPlayer');

class MusicManager {
  constructor({ youtube, client = null, joinVoiceChannel = voice.joinVoiceChannel, createAudioPlayer = voice.createAudioPlayer, notify, log = console }) {
    this.youtube = youtube;
    this.client = client;
    this.joinVoiceChannel = joinVoiceChannel;
    this.createAudioPlayer = createAudioPlayer;
    this.notify = notify;
    this.log = log;
    this.players = new Map();
  }

  get(guildId) {
    return this.players.get(guildId) || null;
  }

  getOrCreate({ guild, voiceChannel, textChannelId }) {
    const existing = this.get(guild.id);
    if (existing) {
      if (existing.voiceChannelId !== voiceChannel.id) {
        const error = new Error('Bot đang phát ở channel khác.');
        error.code = 'PLAYER_IN_DIFFERENT_CHANNEL';
        throw error;
      }
      return existing;
    }

    const connection = this.joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
    });
    const audioPlayer = this.createAudioPlayer();
    connection.subscribe(audioPlayer);

    const player = new GuildPlayer({
      guildId: guild.id,
      voiceChannelId: voiceChannel.id,
      textChannelId,
      audioPlayer,
      voiceConnection: connection,
      youtube: this.youtube,
      notify: this.notify || ((message) => this.notifyTextChannel(textChannelId, message)),
      log: this.log,
      onDestroy: (guildId) => this.players.delete(guildId),
    });

    connection.on('stateChange', (oldState, newState) => {
      if (newState.status === 'disconnected' || newState.status === 'destroyed') {
        this.players.delete(guild.id);
        this.log.warn(guild.id, 'Voice connection disconnected; cleaned up player.');
      }
    });
    connection.on('error', (error) => {
      this.log.error(guild.id, 'Voice connection error', error);
      this.destroy(guild.id);
    });

    this.players.set(guild.id, player);
    return player;
  }

  async notifyTextChannel(textChannelId, message) {
    const channel = await this.client?.channels.fetch(textChannelId).catch(() => null);
    if (channel?.isTextBased()) await channel.send(message);
  }

  destroy(guildId) {
    const player = this.get(guildId);
    if (!player) return false;
    player.destroy();
    this.players.delete(guildId);
    return true;
  }
}

module.exports = { MusicManager };
