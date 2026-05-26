const { createClipCommand } = require('./clipCommand');

module.exports = createClipCommand({
  name: 'alo',
  description: 'alo - alo vũ à vũ.',
  text: 'Ờ, anh chào Vũ nhé. Em là Vũ hả Vũ? Rồi rồi... Em ơi, chối làm sao được Vũ. Anh nói thật đấy, Vũ mà không nói chuyện nghiêm túc  với anh là anh đăng hết thông tin của Vũ lên mạng đấy.',
  audioPath: '/media/audio/alo-vu-ha-em.mp3',
  clipKey: 'alo',
});
