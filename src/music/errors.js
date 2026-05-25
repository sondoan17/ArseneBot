class UserFacingMusicError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'UserFacingMusicError';
    this.cause = cause;
  }
}

function classifyYoutubeError(error, context = {}) {
  const message = String(error?.message || error || '');
  const lower = message.toLowerCase();
  const meta = { ...context, rawMessage: message, causeName: error?.name || null };

  if (lower.includes('sign in') || lower.includes('confirm your age') || lower.includes('cookie')) {
    const classified = new UserFacingMusicError('YouTube yêu cầu xác thực. Admin cần cập nhật YOUTUBE_COOKIE rồi restart bot.', error);
    classified.meta = meta;
    return classified;
  }

  if (lower.includes('private') || lower.includes('unavailable') || lower.includes('deleted') || lower.includes('geo')) {
    const classified = new UserFacingMusicError('Track không khả dụng hoặc bị giới hạn khu vực/riêng tư.', error);
    classified.meta = meta;
    return classified;
  }

  const classified = new UserFacingMusicError('Không thể tải dữ liệu từ YouTube. Vui lòng thử lại sau.', error);
  classified.meta = meta;
  return classified;
}

function isYoutubeAuthError(error) {
  return error instanceof UserFacingMusicError
    && error.message === 'YouTube yêu cầu xác thực. Admin cần cập nhật YOUTUBE_COOKIE rồi restart bot.';
}

module.exports = { UserFacingMusicError, classifyYoutubeError, isYoutubeAuthError };
