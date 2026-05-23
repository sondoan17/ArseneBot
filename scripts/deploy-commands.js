/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
const config = require('../src/config');

async function main() {
  const commands = [];
  const commandsPath = path.join(__dirname, '..', 'src', 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (command.data) {
      commands.push(command.data.toJSON());
    }
  }

  const rest = new REST({ version: '10' }).setToken(config.token);

  console.log(`[ArseneBot] Deploying ${commands.length} commands...`);

  try {
    let data;
    if (config.guildId) {
      // Guild-scoped (instant)
      data = await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands }
      );
      console.log(`[ArseneBot] Successfully registered ${data.length} guild commands for guild ${config.guildId}.`);
    } else {
      // Global (1h cache)
      data = await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands }
      );
      console.log(`[ArseneBot] Successfully registered ${data.length} global commands. (May take up to 1 hour to propagate)`);
    }
  } catch (err) {
    console.error('[ArseneBot] Failed to register commands:', err);
    process.exit(1);
  }
}

main();
