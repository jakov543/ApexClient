// Minecraft sign-in on top of msmc's Microsoft/Xbox steps.
// msmc crashes with an unreadable error when an account has no Minecraft profile,
// so the Minecraft part is done here: owners get their profile, everyone else gets the official Demo.
const crypto = require('crypto');
const { lexicon } = require('msmc');

const UA = { 'Content-Type': 'application/json', Accept: 'application/json' };

/** Turns anything msmc/fetch throws into an Error with a readable message. */
function niceError(e) {
  if (e instanceof Error) return e;
  if (typeof e === 'string') {
    if (e === 'error.gui.closed') return new Error('Sign in cancelled.');
    if (e === 'error.auth.xsts.userNotFound')
      return new Error('This Microsoft account has no Xbox profile yet. Sign in once at xbox.com to create it, then try again.');
    return new Error(lexicon.getCode(e));
  }
  if (e && e.ts) {
    const status = e.response && e.response.status ? ` (code ${e.response.status})` : '';
    return new Error(lexicon.getCode(e.ts) + status);
  }
  try { return new Error(JSON.stringify(e)); } catch (_) { return new Error(String(e)); }
}

/** @param xbox msmc Xbox object (from auth.launch / auth.refresh) */
async function minecraftLogin(xbox) {
  let identityToken;
  try {
    identityToken = await xbox.xAuth('rp://api.minecraftservices.com/');
  } catch (e) { throw niceError(e); }

  const login = await fetch('https://api.minecraftservices.com/authentication/login_with_xbox', {
    method: 'POST', headers: UA, body: JSON.stringify({ identityToken })
  });
  if (!login.ok) {
    if (login.status === 429) throw new Error('Too many sign-in attempts. Wait a minute and try again.');
    throw new Error(`Mojang refused the sign-in (code ${login.status}). Try again in a minute.`);
  }
  const mc = await login.json();

  const session = {
    accessToken: mc.access_token,
    exp: Date.now() + Math.max(60, (mc.expires_in || 86400) - 120) * 1000
  };
  await loadProfile(session);
  return session;
}

/** Everything the account owns, from both Mojang lists (the official launcher uses /license). */
async function entitlements(token) {
  const names = new Set();
  const urls = [
    'https://api.minecraftservices.com/entitlements/mcstore',
    `https://api.minecraftservices.com/entitlements/license?requestId=${crypto.randomUUID()}`
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
      if (!r.ok) continue;
      const j = await r.json();
      for (const i of (j.items || [])) if (i && i.name) names.add(i.name);
    } catch (_) { /* try the other list */ }
  }
  return [...names];
}

const OTHER_GAMES = /bedrock|pocket|win10|dungeons|legends|education|realms/i;

/**
 * Fills session with the Java profile, or explains why there is none:
 *  - status 'ok'          → has a Java username
 *  - status 'needsName'   → owns Java / Game Pass (or a bundle we can't tell apart) → pick a username;
 *                            Mojang checks the licence itself when the name is created
 *  - status 'bedrockOnly' → Mojang refused to create a name (no Java licence) — set by createProfile
 *  - status 'none'        → no Minecraft at all on this Microsoft account → Demo
 */
async function loadProfile(session) {
  const pr = await fetch('https://api.minecraftservices.com/minecraft/profile', {
    headers: { Accept: 'application/json', Authorization: `Bearer ${session.accessToken}` }
  });
  if (pr.ok) {
    const profile = await pr.json();
    if (profile && profile.id) {
      Object.assign(session, { demo: false, status: 'ok', id: profile.id, name: profile.name });
      return session;
    }
  } else if (pr.status !== 404) {
    throw new Error(`Could not load your Minecraft profile (code ${pr.status}).`);
  }

  const items = await entitlements(session.accessToken);
  session.entitlements = items;
  const anyMinecraft = items.some(n => /minecraft|game_pass/i.test(n));
  const clearlyJava = items.some(n => /game_pass/i.test(n) || (/minecraft/i.test(n) && !OTHER_GAMES.test(n)));
  session.likelyJava = clearlyJava;
  session.status = anyMinecraft ? 'needsName' : 'none';
  session.demo = true;
  session.id = crypto.randomUUID().replace(/-/g, '');
  session.name = 'Player';
  return session;
}

/** Checks a Java username: AVAILABLE | DUPLICATE | NOT_ALLOWED | INVALID */
async function nameStatus(session, name) {
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) return 'INVALID';
  const r = await fetch(`https://api.minecraftservices.com/minecraft/profile/name/${encodeURIComponent(name)}/available`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${session.accessToken}` }
  });
  if (!r.ok) return r.status === 429 ? 'RATE_LIMITED' : 'ERROR';
  return (await r.json()).status || 'ERROR';
}

/** Creates the Java profile (username) for an account that owns Minecraft, exactly like the official launcher. */
async function createProfile(session, name) {
  const st = await nameStatus(session, name);
  if (st === 'INVALID') throw new Error('Usernames are 3–16 characters: letters, numbers and _ only.');
  if (st === 'DUPLICATE') throw new Error(`"${name}" is already taken. Try another name.`);
  if (st === 'NOT_ALLOWED') throw new Error(`"${name}" is not allowed. Try another name.`);
  if (st === 'RATE_LIMITED') throw new Error('Too many tries. Wait a minute and try again.');
  const r = await fetch('https://api.minecraftservices.com/minecraft/profile', {
    method: 'POST',
    headers: { ...UA, Authorization: `Bearer ${session.accessToken}` },
    body: JSON.stringify({ profileName: name })
  });
  if (!r.ok) {
    if (r.status === 403 || r.status === 401) {
      session.status = 'bedrockOnly';
      throw new Error('Mojang says this Microsoft account does not own Minecraft: Java Edition (only Bedrock / other games). Sign in with the account that bought Java, or open the official Minecraft Launcher once to finish setting up your purchase.');
    }
    if (r.status === 400) throw new Error(`"${name}" can't be used. Try another name.`);
    throw new Error(`Could not create the username (code ${r.status}).`);
  }
  return loadProfile(session);
}

const isValid = s => s && s.exp > Date.now();

/** MCLC authorization object */
function toMclc(s) {
  return {
    access_token: s.accessToken,
    client_token: crypto.randomUUID(),
    uuid: s.id,
    name: s.name,
    meta: { type: 'msa', demo: s.demo },
    user_properties: {}
  };
}

module.exports = { minecraftLogin, loadProfile, createProfile, nameStatus, niceError, isValid, toMclc };
