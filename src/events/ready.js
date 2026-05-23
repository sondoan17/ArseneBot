const { Events } = require('discord.js');
const { log } = require('../utils/format');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    log('INFO', `Bot logged in as ${client.user.tag} - serving ${client.guilds.cache.size} guilds.`);
    client.user.setActivity('🎵 /play to start');
  },
};
