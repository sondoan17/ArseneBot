const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { successEmbed, errorEmbed } = require('../ui/embeds');
const { requireSameVoiceChannel } = require('./voiceAccess');

async function safeRespond(interaction, payload) {
  if (interaction.deferred || interaction.replied) return interaction.editReply(payload);
  return interaction.reply(payload);
}

module.exports = {
  data: new SlashCommandBuilder().setName('leave').setDescription('Rời voice channel.'),
  async execute(interaction, { musicManager }) {
    await musicManager.withGuildLock(interaction.guildId, async () => {
      const player = musicManager.get(interaction.guildId);
      requireSameVoiceChannel(interaction, player);

      const destroyed = musicManager.destroy(interaction.guildId);
      if (!destroyed) {
        await safeRespond(interaction, {
          embeds: [errorEmbed('Bot không ở trong voice channel nào.')],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await safeRespond(interaction, { embeds: [successEmbed('Đã rời voice channel.')] });
    });
  },
};
