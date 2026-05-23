const { Events } = require('discord.js');
const { errorEmbed } = require('../ui/embeds');
const { UserFacingMusicError } = require('../music/errors');

// Commands that need early deferReply (slow operations: search, stream)
const DEFER_COMMANDS = new Set(['play', 'seek']);

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, context) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    // Defer early for slow commands to avoid 3-second timeout
    if (DEFER_COMMANDS.has(interaction.commandName)) {
      try {
        await interaction.deferReply();
      } catch {
        return; // Interaction expired
      }
    }

    try {
      await command.execute(interaction, context);
    } catch (error) {
      context.log.error(interaction.guildId, 'Interaction error', error);
      const message = error instanceof UserFacingMusicError ? error.message : 'Có lỗi xảy ra, đã ghi log.';
      const payload = { embeds: [errorEmbed(message)] };
      if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
      else await interaction.reply(payload);
    }
  },
};
