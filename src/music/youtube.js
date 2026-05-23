const play = require('play-dl');
const { spawn } = require('node:child_process');
const { createTrack } = require('./Track');
const { classifyYoutubeError } = require('./errors');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createYoutubeService(playClient = play, { retryDelayMs = 500 } = {}) {
  let ytCookieStr = null;

  async function withRetry(operation) {
    try {
      return await operation();
    } catch (firstError) {
      await delay(retryDelayMs);
      try {
        return await operation();
      } catch (secondError) {
        throw classifyYoutubeError(secondError);
      }
    }
  }

  async function resolveOnce(query, requestedBy) {
    const validation = await playClient.validate(query);

    if (validation === 'video') {
      const info = await playClient.video_basic_info(query);
      return [createTrack(info.video_details, requestedBy)];
    }

    if (validation === 'playlist') {
      const playlist = await playClient.playlist_info(query, { incomplete: true });
      const videos = await playlist.all_videos();
      return videos.map((video) => createTrack(video, requestedBy));
    }

    const results = await playClient.search(query, { limit: 1, source: { youtube: 'video' } });
    return results.map((video) => createTrack(video, requestedBy));
  }

  async function resolveQuery(query, requestedBy) {
    return withRetry(() => resolveOnce(query, requestedBy));
  }

  async function createStream(track) {
    try {
      // Use yt-dlp for reliable streaming with cookie support
      const args = ['-f', 'bestaudio', '-o', '-', '--no-playlist'];
      if (ytCookieStr) {
        args.unshift('--cookies-from-browser', 'none');
        // Pass cookies via a temp file approach or env var
        // yt-dlp supports --cookies with netscape format, but we pass via header for simplicity
        args.unshift('--add-header', `Cookie:${ytCookieStr}`);
      }
      args.push(track.url);

      const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      proc.stderr.on('data', () => {}); // swallow stderr

      return { stream: proc.stdout, type: 'arbitrary' };
    } catch (error) {
      throw classifyYoutubeError(error);
    }
  }

  function setYoutubeCookie(cookie) {
    if (!cookie) return;
    // Store cookie for yt-dlp
    ytCookieStr = cookie;
    // Also set for play-dl (search still uses it)
    try {
      playClient.setToken({ youtube: { cookie } });
    } catch {
      // ignore
    }
  }

  return { resolveQuery, createStream, setYoutubeCookie };
}

module.exports = { createYoutubeService };
