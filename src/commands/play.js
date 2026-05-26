const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');
const { UserFacingMusicError, isYoutubeAuthError } = require('../music/errors');
const { requireSameVoiceChannel } = require('./voiceAccess');

const execFileAsync = promisify(execFile);

const TRANSIENT_YOUTUBE_ERROR_MESSAGE = 'Không thể tải dữ liệu từ YouTube. Vui lòng thử lại sau.';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(error) {
  return error instanceof UserFacingMusicError && error.message === TRANSIENT_YOUTUBE_ERROR_MESSAGE;
}

function safeForLog(value, max = 160) {
  return String(value ?? '')
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/([?&](?:token|auth|key|sig|signature|cookie|oauth)[^=]*=)[^&\s]+/gi, '$1[redacted]')
    .slice(0, max);
}

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return {};
  const sanitized = {};
  for (const [key, value] of Object.entries(meta)) {
    if (/raw|token|cookie|secret|auth|key/i.test(key)) continue;
    sanitized[key] = typeof value === 'string' ? safeForLog(value, 120) : value;
  }
  return sanitized;
}

async function updateStatus(interaction, message) {
  try {
    await interaction.editReply({ embeds: [successEmbed(message)] });
  } catch {
    // Best effort status update only.
  }
}

async function refreshYoutubeAuth(log, guildId) {
  log.warn(guildId, '[auth] Starting one-shot Playwright refresh for YouTube auth');
  const { stdout, stderr } = await execFileAsync('sh', [
    '-lc',
    'rm -f /home/bot/.config/chromium/chromium/Singleton* 2>/dev/null; timeout 120 xvfb-run -a -s "-screen 0 1280x720x24" node /app/scripts/refresh-yt-auth.js',
  ], { timeout: 130000, maxBuffer: 1024 * 1024 });
  const summary = [stdout, stderr].filter(Boolean).join('\n').trim().slice(-2000);
  log.warn(guildId, `[auth] Playwright refresh finished output=${summary || 'none'}`);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Phát nhạc từ YouTube URL, playlist, hoặc từ khóa.')
    .addStringOption((option) => option.setName('query').setDescription('URL hoặc từ khóa YouTube').setRequired(true)),
  async execute(interaction, { youtube, musicManager, log }) {
    // deferReply already done in interactionCreate handler
    const query = interaction.options.getString('query', true);
    const voiceChannel = requireSameVoiceChannel(interaction);

    const permissions = voiceChannel.permissionsFor(interaction.guild.members.me);
    if (!permissions.has(PermissionsBitField.Flags.Connect) || !permissions.has(PermissionsBitField.Flags.Speak)) {
      await interaction.editReply({ embeds: [errorEmbed('Bot cần quyền Join và Speak trong voice channel này.')] });
      return;
    }

    const commandStartedAt = Date.now();
    await musicManager.withGuildLock(interaction.guildId, async () => {
      log.info(interaction.guildId, `User ${interaction.user.id} requested play: ${safeForLog(query)}`);
      log.info(interaction.guildId, `[timing] /play start query=${safeForLog(query)}`);
      await updateStatus(interaction, 'Ae đợi tí anh Độ đang tìm bài hát');

      let authRefreshed = false;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const resolveStartedAt = Date.now();
          const tracks = await youtube.resolveQuery(query, {
            id: interaction.user.id,
            username: interaction.user.username,
          });
          log.info(interaction.guildId, `[timing] /play resolve duration=${Date.now() - resolveStartedAt}ms tracks=${tracks.length} attempt=${attempt}`);
          if (tracks.length === 0) {
            await interaction.editReply({ embeds: [errorEmbed('Không tìm thấy kết quả phù hợp.')] });
            return;
          }

          await updateStatus(interaction, `Anh Độ tìm thấy rồi: **${tracks[0].title}**`);

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

          await updateStatus(interaction, 'Anh Độ tìm thấy bài rồi, đang vào voice...');
          const enqueueStartedAt = Date.now();
          const result = await player.enqueue(tracks);
          log.info(interaction.guildId, `[timing] /play enqueue duration=${Date.now() - enqueueStartedAt}ms started=${result.started} added=${result.added} attempt=${attempt}`);
          const message = result.started
            ? `Đang phát: **${tracks[0].title}**`
            : tracks.length === 1
              ? `Đã thêm vào hàng đợi: **${tracks[0].title}**`
              : `Đã thêm **${tracks.length}** bài vào hàng đợi. Bài đầu: **${tracks[0].title}**`;
          if (!result.started) {
            log.warn(
              interaction.guildId,
              `[queue] replying queued current=${player.current?.title || 'none'} queue=${player.queue.length} audio=${player.audioPlayer.state?.status || 'unknown'} voice=${player.voiceConnection.state?.status || 'unknown'} userVoice=${voiceChannel.id} botVoice=${interaction.guild.members.me?.voice?.channelId || 'none'} addedTitles=${tracks.map((track) => track.title).join(' | ')}`,
            );
          }
          log.info(interaction.guildId, `[reply] /play editReply-start attempt=${attempt} result=${result.started ? 'started' : 'queued'} deferred=${interaction.deferred} replied=${interaction.replied}`);
          await interaction.editReply({ embeds: [successEmbed(message)] });
          log.info(interaction.guildId, `[reply] /play editReply-ok attempt=${attempt} result=${result.started ? 'started' : 'queued'} deferred=${interaction.deferred} replied=${interaction.replied}`);
          log.info(interaction.guildId, `[timing] /play total duration=${Date.now() - commandStartedAt}ms attempt=${attempt} result=${result.started ? 'started' : 'queued'}`);
          return;
        } catch (error) {
          if (!authRefreshed && isYoutubeAuthError(error)) {
            authRefreshed = true;
            await updateStatus(interaction, 'YouTube đang đòi xác thực, anh Độ đang tự đăng nhập lại...');
            log.warn(interaction.guildId, `YouTube auth error on /play, refreshing auth once... query=${safeForLog(query)} meta=${JSON.stringify(sanitizeMeta(error.meta))} cause=${safeForLog(error.cause?.message || error.message)}`);
            await refreshYoutubeAuth(log, interaction.guildId);
            await delay(1500);
            continue;
          }
          if (attempt === 1 && shouldRetry(error)) {
            log.warn(interaction.guildId, `Transient YouTube error on /play, retrying once... query=${safeForLog(query)} meta=${JSON.stringify(sanitizeMeta(error.meta))} cause=${safeForLog(error.cause?.message || error.message)}`);
            await delay(1200);
            continue;
          }
          if (shouldRetry(error) || isYoutubeAuthError(error)) {
            log.error(interaction.guildId, `Returning YouTube failure to user on /play query=${safeForLog(query)} attempt=${attempt} meta=${JSON.stringify(sanitizeMeta(error.meta))} cause=${safeForLog(error.cause?.message || error.message)}`);
          }
          throw error;
        }
      }
    });
  },
};
