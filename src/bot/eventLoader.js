const fs = require('node:fs');
const path = require('node:path');

function loadEvents(client, context, eventsPath = path.join(__dirname, '..', 'events')) {
  const files = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'));

  for (const file of files) {
    const event = require(path.join(eventsPath, file));
    const handler = (...args) => event.execute(...args, context);
    if (event.once) client.once(event.name, handler);
    else client.on(event.name, handler);
  }
}

module.exports = { loadEvents };
