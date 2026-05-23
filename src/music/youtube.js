const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { StreamType } = require('@discordjs/voice');
const { createTrack } = require('./Track');
const { classifyYoutubeError } = require('./errors');

const YTDLP_PATH = 'yt-dlp';
const COOKIES_FILE = '/app/cookies.txt';
const JS_RUNTIME = 'node';

// Public Invidious instances for search (yt-dlp blocked on VPS IPs)
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.fdn.fr',
  'https://yewtu.be',
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isUrl(query) {
  return /youtube\.com|youtu\.be/.test(query);
}

function isPlaylistUrl(query) {
  return /[?&]list=/.test(query);
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function searchInvidious(query, requestedBy) {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const data = await fetchJson(`${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
      const results = (data || []).filter((r) => r.type === 'video').slice(0, 5);
      if (results.length > 0) {
        return results.map((video) =>
          createTrack(
            {
              title: video.title || 'Unknown title',
              url: `https://www.youtube.com/watch?v=${video.videoId}`,
              durationInSec: video.lengthSeconds || null,
              thumbnails: video.videoThumbnails?.length ? [{ url: video.videoThumbnails[0].url }] : [],
            },
            requestedBy,
          ),
        );
      }
    } catch {
      // Try next instance
    }
  }
  return [];
}

async function resolveInvidious(url, requestedBy) {
  const videoId = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
  if (!videoId) return null;

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const data = await fetchJson(`${instance}/api/v1/videos/${videoId}`);
      return [
        createTrack(
          {
            title: data.title || 'Unknown title',
            url: `https://www.youtube.com/watch?v=${videoId}`,
            durationInSec: data.lengthSeconds || null,
            thumbnails: data.videoThumbnails?.length ? [{ url: data.videoThumbnails[0].url }] : [],
          },
          requestedBy,
        ),
      ];
    } catch {
      // Try next instance
    }
  }
  return null;
}

function spawnYtDlp(args, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error('yt-dlp timed out'));
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 || stdout.length > 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || 'yt-dlp failed with no output'));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function parseTracks(output, requestedBy) {
  const lines = output.split('\n').filter((l) => l.trim());
  return lines
    .map((line) => {
      try {
        const data = JSON.parse(line);
        return createTrack(
          {
            title: data.title || 'Unknown title',
            url: data.webpage_url || data.url,
            durationInSec: data.duration || null,
            thumbnails: data.thumbnail ? [{ url: data.thumbnail }] : [],
          },
          requestedBy,
        );
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function buildBaseArgs() {
  const args = ['--js-runtime', JS_RUNTIME];
  if (existsSync(COOKIES_FILE)) {
    args.push('--cookies', COOKIES_FILE);
  }
  return args;
}

function buildYtDlpArgs(query) {
  return [...buildBaseArgs(), '--dump-json', query];
}

function createYoutubeService({ retryDelayMs = 500 } = {}) {
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

  async function resolveQuery(query, requestedBy) {
    return withRetry(async () => {
      // Try Invidious first (avoids YouTube bot detection on VPS)
      if (isUrl(query)) {
        const result = await resolveInvidious(query, requestedBy);
        if (result && result.length > 0) return result;
      } else {
        const results = await searchInvidious(query, requestedBy);
        if (results.length > 0) return [results[0]];
      }

      // Fallback to yt-dlp
      let ytQuery = query;
      if (!isUrl(query)) ytQuery = `ytsearch1:${query}`;
      const args = buildYtDlpArgs(ytQuery);
      const output = await spawnYtDlp(args);
      return parseTracks(output, requestedBy);
    });
  }

  async function createStream(track) {
    try {
      const args = [...buildBaseArgs(), '-f', 'bestaudio', '-o', '-', '--no-playlist', track.url];
      const proc = spawn(YTDLP_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      proc.stderr.on('data', () => {});

      return { stream: proc.stdout, type: StreamType.Arbitrary };
    } catch (error) {
      throw classifyYoutubeError(error);
    }
  }

  function setYoutubeCookie(_cookie) {
    // Cookies are now handled by entrypoint script writing /app/cookies.txt
  }

  return { resolveQuery, createStream, setYoutubeCookie };
}

module.exports = { createYoutubeService };
