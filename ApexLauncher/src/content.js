// Mods, resource packs and shaders from Modrinth — search and one-click install per Minecraft version.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const cfg = require('../config');

const API = 'https://api.modrinth.com/v2';
const UA = { 'User-Agent': `jakov543/ApexClient-Launcher/${cfg.VERSION}` };

const TYPES = {
  mod: { folder: 'mods', loaders: ['fabric'], needsFabric: true },
  resourcepack: { folder: 'resourcepacks', loaders: ['minecraft'], needsFabric: false },
  shader: { folder: 'shaderpacks', loaders: ['iris'], needsFabric: true }
};

// shaders need these mods
const SHADER_MODS = ['iris', 'sodium'];

const enc = v => encodeURIComponent(JSON.stringify(v));

async function api(pathAndQuery) {
  const r = await fetch(API + pathAndQuery, { headers: UA });
  if (r.status === 429) throw new Error('Modrinth is busy — wait a few seconds and try again.');
  if (!r.ok) throw new Error(`Modrinth answered ${r.status}`);
  return r.json();
}

function instanceDir(root, mc) { return path.join(root, 'instances', mc); }
function recordFile(root, mc) { return path.join(instanceDir(root, mc), 'apex-content.json'); }

function readRecord(root, mc) {
  try { return JSON.parse(fs.readFileSync(recordFile(root, mc), 'utf8')); } catch (_) { return {}; }
}
async function writeRecord(root, mc, rec) {
  await fsp.mkdir(instanceDir(root, mc), { recursive: true });
  await fsp.writeFile(recordFile(root, mc), JSON.stringify(rec, null, 2));
}

/**
 * @param o { type, query, mc, offset, sort: 'downloads'|'relevance'|'newest'|'follows' }
 * @returns { total, hits: [{ id, slug, title, author, description, downloads, icon }] }
 */
async function search(o) {
  const facets = [[`project_type:${o.type}`], [`versions:${o.mc}`]];
  if (o.type === 'mod') facets.push(['categories:fabric']);
  const index = ['downloads', 'relevance', 'newest', 'follows', 'updated'].includes(o.sort) ? o.sort : (o.query ? 'relevance' : 'downloads');
  const q = `/search?query=${encodeURIComponent(o.query || '')}&facets=${enc(facets)}&index=${index}&limit=24&offset=${o.offset || 0}`;
  const j = await api(q);
  return {
    total: j.total_hits || 0,
    hits: (j.hits || []).map(h => ({
      id: h.project_id, slug: h.slug, title: h.title, author: h.author,
      description: h.description, downloads: h.downloads || 0, icon: h.icon_url || ''
    }))
  };
}

/** Newest version of a project that fits this Minecraft version + loader. */
async function bestVersion(projectId, mc, loaders) {
  const list = await api(`/project/${encodeURIComponent(projectId)}/version?loaders=${enc(loaders)}&game_versions=${enc([mc])}`);
  return list.find(v => v.version_type === 'release') || list[0] || null;
}

/**
 * Installs a project (and its required dependencies) into the version's folder.
 * @param o { root, mc, mode: 'apex'|'fabric'|'vanilla', type, projectId, title, download, progress }
 * @returns titles installed
 */
async function install(o) {
  const t = TYPES[o.type];
  if (!t) throw new Error('Unknown content type');
  if (t.needsFabric && o.mode === 'vanilla') {
    throw new Error(`Minecraft ${o.mc} runs without Fabric here, so ${o.type === 'shader' ? 'shaders' : 'mods'} can't be added. Pick a version tagged APEX or FPS BOOST.`);
  }
  const rec = readRecord(o.root, o.mc);
  const done = [];
  const seen = new Set();

  async function one(projectId, type, titleHint, depth) {
    if (seen.has(projectId) || depth > 6) return;
    seen.add(projectId);
    const tt = TYPES[type];
    if (rec[projectId] && fs.existsSync(path.join(instanceDir(o.root, o.mc), TYPES[rec[projectId].type].folder, rec[projectId].file))) return;

    const v = await bestVersion(projectId, o.mc, tt.loaders);
    if (!v) {
      if (depth === 0) throw new Error(`${titleHint || 'This project'} has no version for Minecraft ${o.mc}.`);
      return; // optional-ish dependency without a build for this version
    }
    const file = (v.files || []).find(f => f.primary) || (v.files || [])[0];
    if (!file) throw new Error(`${titleHint || 'This project'} has no file to download.`);

    const dir = path.join(instanceDir(o.root, o.mc), tt.folder);
    await fsp.mkdir(dir, { recursive: true });
    const label = titleHint || v.name || projectId;
    o.progress && o.progress(`Downloading ${label}`, 0);
    await o.download(file.url, path.join(dir, file.filename),
      p => o.progress && o.progress(`Downloading ${label}`, p),
      file.hashes && file.hashes.sha512 ? { sha512: file.hashes.sha512 } : null);
    rec[projectId] = { type, file: file.filename, title: label, version: v.version_number };
    done.push(label);

    if (type === 'mod') {
      for (const d of (v.dependencies || [])) {
        if (d.dependency_type === 'required' && d.project_id) await one(d.project_id, 'mod', null, depth + 1);
      }
    }
  }

  await one(o.projectId, o.type, o.title, 0);
  if (o.type === 'shader') for (const m of SHADER_MODS) await one(m, 'mod', m === 'iris' ? 'Iris Shaders' : 'Sodium', 1);
  await writeRecord(o.root, o.mc, rec);
  return done;
}

/** Everything in the version's mods / resourcepacks / shaderpacks folders. */
function installed(root, mc) {
  const rec = readRecord(root, mc);
  const byFile = {};
  for (const [id, r] of Object.entries(rec)) byFile[`${r.type}/${r.file}`] = { id, ...r };
  const out = [];
  for (const [type, t] of Object.entries(TYPES)) {
    const dir = path.join(instanceDir(root, mc), t.folder);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith('.') || f.endsWith('.part') || f.endsWith('.new')) continue;
      const known = byFile[`${type}/${f}`];
      const builtin = type === 'mod' && /^(ApexClient|fabric-api)/i.test(f);
      out.push({ type, file: f, id: known ? known.id : null, title: known ? known.title : f.replace(/\.(jar|zip)$/i, ''), version: known ? known.version : '', builtin });
    }
  }
  return out;
}

async function remove(root, mc, type, file) {
  const t = TYPES[type];
  if (!t || !file || file.includes('/') || file.includes('\\') || file.includes('..')) throw new Error('Bad file name');
  if (type === 'mod' && /^(ApexClient|fabric-api)/i.test(file)) throw new Error('This mod is part of Apex Client and can\'t be removed.');
  await fsp.rm(path.join(instanceDir(root, mc), t.folder, file), { force: true });
  const rec = readRecord(root, mc);
  for (const [id, r] of Object.entries(rec)) if (r.type === type && r.file === file) delete rec[id];
  await writeRecord(root, mc, rec);
}

module.exports = { search, install, installed, remove, TYPES };
