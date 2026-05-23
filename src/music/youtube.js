const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { StreamType } = require('@discordjs/voice');
const { createTrack } = require('./Track');
const { classifyYoutubeError } = require('./errors');

const YTDLP_PATH = 'yt-dlp';
const COOKIES_FILE = '/app/cookies.txt';
const JS_RUNTIME = 'node';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isUrl(query) {
  return /youtube\.com|youtu\.be/.test(query);
}

function isPlaylistUrl(query) {
  return /[?&]list=/.test(query);
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

function buildArgs(query) {
  const args = buildBaseArgs();
  if (isUrl(query)) {
    if (isPlaylistUrl(query)) {
      args.push('--flat-playlist', '--dump-json', query);
    } else {
      args.push('--dump-json', query);
    }
  } else {
    args.push('--dump-json', `ytsearch1:${query}`);
  }
  return args;
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

  async function resolveOnce(query, requestedBy) {
    const args = buildArgs(query);
    const output = await spawnYtDlp(args);
    return parseTracks(output, requestedBy);
  }

  async function resolveQuery(query, requestedBy) {
    return withRetry(() => resolveOnce(query, requestedBy));
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
    // This method kept for backward compatibility
  }

  return { resolveQuery, createStream, setYoutubeCookie };
}

module.exports = { createYoutubeService };
