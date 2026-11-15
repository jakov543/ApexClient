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

const JAVA_ITEMS = ['game_minecraft', 'product_minecraft', 'product_game_pass_pc', 'product_game_pass_ultimate'];

/** What the account owns, e.g. ["product_minecraft","game_minecraft"] */
async function entitlements(token) {
  try {
    const r = await fetch('https://api.minecraftservices.com/entitlements/mcstore', {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
    });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.items || []).map(i => i.name);
  } catch (_) { return []; }
}

/**
 * Fills session with the Java profile, or explains why there is none:
 *  - status 'ok'          → owns Java and has a username
 *  - status 'needsName'   → owns Java (or Game Pass) but never picked a Java username → can create one
 *  - status 'bedrockOnly' → only Bedrock on this account
 *  - status 'none'        → no Minecraft on this Microsoft account → Demo
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
  const ownsJava = items.some(n => JAVA_ITEMS.includes(n));
  const bedrock = items.some(n => /bedrock|pocket|win10/i.test(n));
  session.status = ownsJava ? 'needsName' : (bedrock ? 'bedrockOnly' : 'none');
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
    if (r.status === 403) throw new Error('Mojang did not allow creating this name. Open the official Minecraft Launcher once to finish setting up your account.');
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
