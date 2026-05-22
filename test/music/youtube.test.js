const test = require('node:test');
const assert = require('node:assert/strict');

const { createYoutubeService } = require('../../src/music/youtube');
const { UserFacingMusicError } = require('../../src/music/errors');

test('resolveQuery resolves video URLs into one track', async () => {
  const calls = [];
  const play = {
    validate: async () => 'video',
    video_basic_info: async (url) => {
      calls.push(['video_basic_info', url]);
      return { video_details: { title: 'Song', url, durationInSec: 90, thumbnails: [{ url: 'thumb' }] } };
    },
  };
  const service = createYoutubeService(play, { retryDelayMs: 0 });

  const tracks = await service.resolveQuery('https://youtube.test/watch?v=1', { id: 'u1', username: 'User' });

  assert.deepEqual(calls, [['video_basic_info', 'https://youtube.test/watch?v=1']]);
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].title, 'Song');
  assert.equal(tracks[0].duration, 90);
  assert.equal(tracks[0].requestedBy.id, 'u1');
});

test('resolveQuery resolves playlists into tracks', async () => {
  const play = {
    validate: async () => 'playlist',
    playlist_info: async () => ({
      all_videos: async () => [
        { title: 'A', url: 'url-a', durationInSec: 1, thumbnails: [] },
        { title: 'B', url: 'url-b', durationInSec: 2, thumbnails: [{ url: 'b.jpg' }] },
      ],
    }),
  };
  const service = createYoutubeService(play, { retryDelayMs: 0 });

  const tracks = await service.resolveQuery('playlist-url', { id: 'u1' });

  assert.equal(tracks.length, 2);
  assert.deepEqual(tracks.map((track) => track.url), ['url-a', 'url-b']);
});

test('resolveQuery searches keyword queries', async () => {
  const play = {
    validate: async () => 'search',
    search: async (query, options) => {
      assert.equal(query, 'lofi beats');
      assert.deepEqual(options, { limit: 1, source: { youtube: 'video' } });
      return [{ title: 'Lofi', url: 'url', durationInSec: 30, thumbnails: [] }];
    },
  };
  const service = createYoutubeService(play, { retryDelayMs: 0 });

  const tracks = await service.resolveQuery('lofi beats', { id: 'u1' });

  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].title, 'Lofi');
});

test('resolveQuery retries one transient failure', async () => {
  let attempts = 0;
  const play = {
    validate: async () => 'video',
    video_basic_info: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('network timeout');
      return { video_details: { title: 'Retry Song', url: 'url', durationInSec: 10, thumbnails: [] } };
    },
  };
  const service = createYoutubeService(play, { retryDelayMs: 0 });

  const tracks = await service.resolveQuery('url', { id: 'u1' });

  assert.equal(attempts, 2);
  assert.equal(tracks[0].title, 'Retry Song');
});

test('resolveQuery maps YouTube sign-in errors to cookie guidance', async () => {
  const play = {
    validate: async () => 'video',
    video_basic_info: async () => {
      throw new Error('Sign in to confirm your age');
    },
  };
  const service = createYoutubeService(play, { retryDelayMs: 0 });

  await assert.rejects(
    () => service.resolveQuery('url', { id: 'u1' }),
    (error) => error instanceof UserFacingMusicError && error.message.includes('YOUTUBE_COOKIE'),
  );
});
