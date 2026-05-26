const { Events } = require('discord.js');
const { errorEmbed } = require('../ui/embeds');
const { UserFacingMusicError } = require('../music/errors');

// Commands that need early deferReply (slow operations: search, stream, voice join)
const DEFER_COMMANDS = new Set(['alo', 'mixi', 'play', 'seek']);

function commandOptionsSummary(interaction) {
  const options = interaction.options?.data || [];
  if (!options.length) return 'none';
  return options.map((option) => {
    const name = option.name || 'unknown';
    const sensitive = /(token|secret|password|pass|cookie|key)/i.test(name);
    const value = sensitive ? '[REDACTED]' : String(option.value ?? '[complex]').slice(0, 120);
    return `${name}=${value}`;
  }).join(' ');
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, context) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    const startedAt = Date.now();
    const userTag = interaction.user?.tag || interaction.user?.id || 'unknown';
    context.log.info(interaction.guildId, `[command] start /${interaction.commandName} user=${userTag}(${interaction.user?.id || 'unknown'}) channel=${interaction.channelId || 'unknown'} options=${commandOptionsSummary(interaction)}`);

    // Defer early for slow commands to avoid 3-second timeout
    if (DEFER_COMMANDS.has(interaction.commandName)) {
      context.log.info(interaction.guildId, `[command] defer-start /${interaction.commandName} duration=${Date.now() - startedAt}ms deferred=${interaction.deferred} replied=${interaction.replied}`);
      try {
        await interaction.deferReply();
        context.log.info(interaction.guildId, `[command] defer-ok /${interaction.commandName} duration=${Date.now() - startedAt}ms deferred=${interaction.deferred} replied=${interaction.replied}`);
      } catch (error) {
        context.log.warn(interaction.guildId, `[command] expired-before-defer /${interaction.commandName} duration=${Date.now() - startedAt}ms error=${error.code || error.message}`);
        return;
      }
    }

    try {
      await command.execute(interaction, context);
      context.log.info(interaction.guildId, `[command] end /${interaction.commandName} duration=${Date.now() - startedAt}ms deferred=${interaction.deferred} replied=${interaction.replied}`);
    } catch (error) {
      context.log.error(interaction.guildId, `[command] error /${interaction.commandName} duration=${Date.now() - startedAt}ms`, error);
      const message = error instanceof UserFacingMusicError ? error.message : 'Có lỗi xảy ra, đã ghi log.';
      const payload = { embeds: [errorEmbed(message)] };
      try {
        if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
        else await interaction.reply(payload);
      } catch (replyError) {
        context.log.warn(interaction.guildId, `Failed to send interaction error response: ${replyError.code || replyError.message}`);
      }
    }
  },
};
