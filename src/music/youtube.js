const play = require('play-dl');
const Track = require('./Track');
const config = require('../config');
const { log } = require('../utils/format');

let initialized = false;

/**
 * Initialize play-dl with YouTube cookie if available
 */
async function init() {
  if (initialized) return;

  if (config.youtubeCookie) {
    await play.setToken({
      youtube: { cookie: config.youtubeCookie },
    });
    log('INFO', 'YouTube cookie set.');
  }

  initialized = true;
}

/**
 * Resolve a query (URL, playlist URL, or search keyword) into Track(s)
 * @param {string} query - video URL, playlist URL, or search keyword
 * @param {string} requestedBy - username who requested
 * @returns {Promise<Track[]>}
 */
async function resolve(query, requestedBy) {
  await init();

  const validated = play.validate(query);

  if (validated === 'yt_video') {
    return await resolveVideo(query, requestedBy);
  }

  if (validated === 'yt_playlist') {
    return await resolvePlaylist(query, requestedBy);
  }

  // Search
  return await resolveSearch(query, requestedBy);
}

/**
 * Resolve a single YouTube video URL
 */
async function resolveVideo(url, requestedBy) {
  const info = await retryOnce(() => play.video_basic_info(url));
  const details = info.video_details;

  if (!details) return [];

  return [
    new Track({
      title: details.title || 'Unknown',
      url: details.url,
      duration: details.durationInSec || 0,
      requestedBy,
      thumbnail: details.thumbnails?.[0]?.url || null,
    }),
  ];
}

/**
 * Resolve a YouTube playlist URL
 */
async function resolvePlaylist(url, requestedBy) {
  const playlist = await retryOnce(() => play.playlist_info(url, { incomplete: true }));

  if (!playlist) return [];

  const videos = await playlist.all_videos();
  const tracks = videos.map(
    (v) =>
      new Track({
        title: v.title || 'Unknown',
        url: v.url,
        duration: v.durationInSec || 0,
        requestedBy,
        thumbnail: v.thumbnails?.[0]?.url || null,
      })
  );

  return tracks;
}

/**
 * Resolve a search keyword to a single track
 */
async function resolveSearch(query, requestedBy) {
  const results = await retryOnce(() =>
    play.search(query, { limit: 1, source: { youtube: 'video' } })
  );

  if (!results || results.length === 0) return [];

  const v = results[0];
  return [
    new Track({
      title: v.title || 'Unknown',
      url: v.url,
      duration: v.durationInSec || 0,
      requestedBy,
      thumbnail: v.thumbnails?.[0]?.url || null,
    }),
  ];
}

/**
 * Create audio stream for a track
 * @param {string} url - YouTube video URL
 * @returns {Promise<import('play-dl').YouTubeStream>}
 */
async function createStream(url) {
  await init();
  return await play.stream(url);
}

/**
 * Retry a function once with 500ms delay on failure
 */
async function retryOnce(fn) {
  try {
    return await fn();
  } catch (err) {
    log('WARN', `Retry after error: ${err.message}`);
    await new Promise((r) => setTimeout(r, 500));
    return await fn();
  }
}

module.exports = { resolve, createStream };
