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

  const pr = await fetch('https://api.minecraftservices.com/minecraft/profile', {
    headers: { Accept: 'application/json', Authorization: `Bearer ${mc.access_token}` }
  });
  let profile = null;
  if (pr.ok) profile = await pr.json();
  else if (pr.status !== 404) throw new Error(`Could not load your Minecraft profile (code ${pr.status}).`);

  const demo = !profile || !profile.id;
  return {
    accessToken: mc.access_token,
    exp: Date.now() + Math.max(60, (mc.expires_in || 86400) - 120) * 1000,
    demo,
    id: demo ? crypto.randomUUID().replace(/-/g, '') : profile.id,
    name: demo ? 'Player' : profile.name
  };
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

module.exports = { minecraftLogin, niceError, isValid, toMclc };
