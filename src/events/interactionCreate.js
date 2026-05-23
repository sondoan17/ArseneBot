const { Events, MessageFlags } = require('discord.js');
const { log } = require('../utils/format');
const { errorEmbed } = require('../ui/embeds');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      log('WARN', `Unknown command: ${interaction.commandName}`, interaction.guildId);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (err) {
      log('ERROR', `Command "${interaction.commandName}" failed: ${err.stack || err.message}`, interaction.guildId);

      const reply = {
        embeds: [errorEmbed('Có lỗi xảy ra, đã ghi log.')],
        flags: MessageFlags.Ephemeral,
      };

      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      } catch (replyErr) {
        log('ERROR', `Failed to send error reply: ${replyErr.message}`, interaction.guildId);
      }
    }
  },
};
