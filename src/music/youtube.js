const play = require('play-dl');
const { createTrack } = require('./Track');
const { classifyYoutubeError } = require('./errors');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createYoutubeService(playClient = play, { retryDelayMs = 500 } = {}) {
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

  async function createStream(track, seekSeconds = 0) {
    try {
      return await playClient.stream(track.url, { seek: seekSeconds });
    } catch (error) {
      throw classifyYoutubeError(error);
    }
  }

  function setYoutubeCookie(cookie) {
    if (cookie) playClient.setToken({ youtube: { cookie } });
  }

  return { resolveQuery, createStream, setYoutubeCookie };
}

module.exports = { createYoutubeService };
