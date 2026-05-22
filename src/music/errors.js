class UserFacingMusicError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'UserFacingMusicError';
    this.cause = cause;
  }
}

function classifyYoutubeError(error) {
  const message = String(error?.message || error || '');
  const lower = message.toLowerCase();

  if (lower.includes('sign in') || lower.includes('confirm your age') || lower.includes('cookie')) {
    return new UserFacingMusicError('YouTube yêu cầu xác thực. Admin cần cập nhật YOUTUBE_COOKIE rồi restart bot.', error);
  }

  if (lower.includes('private') || lower.includes('unavailable') || lower.includes('deleted') || lower.includes('geo')) {
    return new UserFacingMusicError('Track không khả dụng hoặc bị giới hạn khu vực/riêng tư.', error);
  }

  return new UserFacingMusicError('Không thể tải dữ liệu từ YouTube. Vui lòng thử lại sau.', error);
}

module.exports = { UserFacingMusicError, classifyYoutubeError };
