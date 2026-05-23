require('dotenv').config();

const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID'];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`[ArseneBot] [FATAL] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.DISCORD_GUILD_ID || null,
  youtubeCookie: process.env.YOUTUBE_COOKIE || null,
  logLevel: process.env.LOG_LEVEL || 'info',
};
