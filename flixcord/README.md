# Flixcord

Flixcord is a Discord-style chat app made for the Apex crew.

**Open Flixcord:** https://claude.ai/artifact/JmfsXjNXdnXfMiNrJP5a3t  (the owner invites friends by email as *Editor* so they can chat)

## Features
- Servers with your own picture or emoji icon, colours, text channels and **voice channels**
- **Voice & video calls**: call a whole channel (📞 button), call one person (click them → Call) or hop into a voice channel. You get mic, deafen, camera, **screen share** and a "who's talking" glow
- Incoming-call popup with a ringtone, plus "X started a call" cards with a Join button
- **Co-owners**: the server owner can make friends co-owners (they can manage channels, emoji and messages)
- Your own profile picture and banner, custom status and an "about me"
- **Custom server emoji** (upload your own, use them with `:name:`) and 1,300+ emoji with search and recents
- Replies, edit, delete, pins, reactions, polls (`/poll Q | A | B`), spoilers, code, mentions, images and search
- Themes: Flix, Midnight, Grass and Light, plus a compact mode

## Files
| File | What it is |
|---|---|
| `index.html` | The Flixcord app (runs on claude.ai, which stores the messages) |
| `call.html` | The call page, served by GitHub Pages: https://jakov543.github.io/ApexClient/flixcord/call.html |
| `logo.svg` | Logo |

Calls are peer-to-peer (WebRTC through PeerJS). Audio and video go straight between the people in the call, and nothing is recorded. A few very strict networks (some school or work Wi-Fi) can block peer-to-peer calls.
