const { Client, GatewayIntentBits, Collection } = require('discord.js');

function createClient() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
    ],
  });

  // Collection to store slash commands
  client.commands = new Collection();

  return client;
}

module.exports = { createClient };
