<p align="center"><img src="docs/logo.png" alt="Apex Client" width="560"></p>

<p align="center">
  <b>A fast, clean Lunar-style client for Minecraft Java 1.21.1</b><br>
  Own launcher · built-in PvP mods · draggable HUD · Discord Rich Presence · Windows 10 &amp; 11
</p>

<p align="center"><img src="docs/launcher-home.png" alt="Apex Client launcher" width="820"></p>

## Download
Go to **[Releases](../../releases/latest)** and download **`ApexClient-Setup-x.x.x.exe`**.
Run it (if Windows says *"Windows protected your PC"* → **More info → Run anyway**), open **Apex Client**, press **LAUNCH GAME**.

- Sign in with your Microsoft account to play. You can also browse the launcher without signing in.
- Accounts without Minecraft can play the free **Demo**.
- Java, Minecraft, Fabric and Fabric API are downloaded automatically into `%APPDATA%\.apexclient`.

## Features

**Launcher**
- Microsoft login (remembered securely), Demo support, browse without signing in
- One-click install & launch with progress bar, bundled Java 21
- Mods / Cosmetics / Settings pages, RAM slider, game logs, news
- Discord Rich Presence ("In the launcher")
- Auto-updates the in-game mod from the latest GitHub release

**In game** — press **Right Shift**
| HUD | PvP / Visual | Other |
|---|---|---|
| FPS, CPS, Keystrokes | Zoom (hold **C**, scroll) | Apex Cape |
| Coordinates, Ping, Clock | Toggle Sprint | Custom main menu |
| Armor Status, Potion Effects, Server IP | Fullbright | Discord Rich Presence |

Every HUD element can be dragged in **Edit HUD Layout** (snaps to edges and center).

## Project layout
```
ApexClient/     In-game client (Fabric mod, Java 21, Gradle)
ApexLauncher/   Desktop launcher (Electron + minecraft-launcher-core + msmc)
.github/        GitHub Actions: builds the mod + Windows installer and publishes a release on every push
```

## How releases are built
Every push to `main` runs **Actions → Build Apex Client**:
1. builds `ApexClient.jar` (Linux runner)
2. builds `ApexClient-Setup-x.x.x.exe` with the jar inside (Windows runner)
3. publishes both as a new release

The launcher downloads the newest `ApexClient.jar` from the latest release on every launch, so players get mod updates without reinstalling.
For launcher updates, bump `version` in `ApexLauncher/package.json` and players download the new installer.

## Setup (owner)
1. **Discord Rich Presence** — create an app at https://discord.com/developers/applications named *Apex Client*,
   upload `ApexClient/discord-assets/*.png` as Rich Presence art assets (`logo`, `overworld`, `nether`, `end`),
   and put the **Application ID** in `ApexLauncher/config.js` → `DISCORD_CLIENT_ID`. Optional: `DISCORD_INVITE`.
2. **Repo name** — if your repo isn't `jakov543/ApexClient`, change `MOD_URL` in `ApexLauncher/config.js`
   and `publish` / `repository` in `ApexLauncher/package.json`.
3. **News** (optional) — set `NEWS_URL` in `config.js` to a raw `news.json`: `[{"tag":"UPDATE","t":"Title","p":"Text"}]`

## Build locally (optional)
Needs **Java 21 JDK** (https://adoptium.net) and **Node.js 20+** (https://nodejs.org).
Run **`BUILD-ALL.bat`** → installer in `ApexLauncher\dist\`. `TEST-LAUNCHER.bat` runs the launcher without packaging.

## Rebrand
- Names / folder / Discord: `ApexLauncher/config.js`, `productName` in `ApexLauncher/package.json`, `ApexClient.java`, `fabric.mod.json`
- Images: `ApexLauncher/renderer/assets/`, `ApexLauncher/build/icon.ico`, `ApexClient/src/main/resources/assets/apexclient/`
- Logo sources: `ApexClient/discord-assets/*.svg`

## License
MIT — see [LICENSE](LICENSE). Not affiliated with Mojang or Microsoft. Minecraft is a trademark of Mojang AB.
