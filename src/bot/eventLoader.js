const fs = require('node:fs');
const path = require('node:path');

async function loadEvents(client) {
  const eventsPath = path.join(__dirname, '..', 'events');
  const eventFiles = fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);

    if (!event.name || !event.execute) {
      console.warn(`[ArseneBot] [WARN] Event file ${file} missing "name" or "execute". Skipping.`);
      continue;
    }

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }

  console.log(`[ArseneBot] [INFO] Loaded ${eventFiles.length} events.`);
}

module.exports = { loadEvents };
