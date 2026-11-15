// ==== Apex Client launcher settings — change these to rebrand ====
module.exports = {
  NAME: 'Apex Client',
  VERSION: '1.1.0',
  MC_VERSION: '1.21.1',

  // Folder in %APPDATA% where the game is installed (like .lunarclient)
  GAME_FOLDER: '.apexclient',

  // Your Discord Application ID (discord.com/developers/applications).
  // The launcher also writes it into the in-game mod config, so you only set it here.
  DISCORD_CLIENT_ID: '000000000000000000',
  DISCORD_INVITE: '', // e.g. https://discord.gg/yourinvite  (shows a button on your Discord profile)

  // Where the launcher downloads the newest in-game mod jar when none is bundled
  // (GitHub Actions publishes it here automatically — see README).
  MOD_URL: 'https://github.com/jakov543/ApexClient/releases/latest/download/ApexClient.jar',

  // Optional: URL of a news.json to show live news in the launcher (see README). Empty = built-in news.
  NEWS_URL: ''
};
