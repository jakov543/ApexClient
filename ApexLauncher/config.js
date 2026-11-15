// ==== Apex Client launcher settings — change these to rebrand ====
module.exports = {
  NAME: 'Apex Client',
  VERSION: '1.5.1',
  MC_VERSION: '1.21.1',

  // Folder in %APPDATA% where the game is installed (like .lunarclient)
  GAME_FOLDER: '.apexclient',

  // Your Discord Application ID (discord.com/developers/applications).
  // The launcher also writes it into the in-game mod config, so you only set it here.
  DISCORD_CLIENT_ID: '1571423751231373405',
  DISCORD_INVITE: '', // e.g. https://discord.gg/yourinvite  (shows a button on your Discord profile)
  // Rich Presence images are loaded from the repo (no need to upload art assets to Discord)
  DISCORD_IMAGES: 'https://raw.githubusercontent.com/jakov543/ApexClient/main/docs/discord/',
  DOWNLOAD_URL: 'https://github.com/jakov543/ApexClient/releases/latest',

  // Where the launcher downloads the newest in-game mod jar when none is bundled
  // (GitHub Actions publishes it here automatically — see README).
  MOD_URL: 'https://github.com/jakov543/ApexClient/releases/latest/download/ApexClient.jar',

  // Optional: URL of a news.json to show live news in the launcher (see README). Empty = built-in news.
  NEWS_URL: ''
};
