const config = require('./config');
const { createClient } = require('./bot/client');
const { loadCommands } = require('./bot/commandLoader');
const { loadEvents } = require('./bot/eventLoader');
const { MusicManager } = require('./music/MusicManager');

// Crash recovery: log but don't kill
process.on('unhandledRejection', (err) => {
  console.error(`[ArseneBot] [ERROR] Unhandled rejection:`, err);
});
process.on('uncaughtException', (err) => {
  console.error(`[ArseneBot] [ERROR] Uncaught exception:`, err);
});

async function main() {
  const client = createClient();

  // Attach music manager to client for global access
  client.musicManager = new MusicManager();

  // Load commands and events
  await loadCommands(client);
  await loadEvents(client);

  // Login
  await client.login(config.token);
}

main().catch((err) => {
  console.error(`[ArseneBot] [FATAL] Failed to start:`, err);
  process.exit(1);
});
