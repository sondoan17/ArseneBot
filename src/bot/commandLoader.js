const fs = require('node:fs');
const path = require('node:path');

async function loadCommands(client) {
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if (!command.data || !command.execute) {
      console.warn(`[ArseneBot] [WARN] Command file ${file} missing "data" or "execute". Skipping.`);
      continue;
    }

    client.commands.set(command.data.name, command);
  }

  console.log(`[ArseneBot] [INFO] Loaded ${client.commands.size} commands.`);
}

module.exports = { loadCommands };
