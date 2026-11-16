// Cœur de QUIZy sur Cloudflare : le VRAI code Apps Script (app.gen.js) + les services Google réimplémentés.
// Utilisé tel quel par le Durable Object (stockage SQLite de Cloudflare) et par les tests (node:sqlite).
//
//   PropertiesService → table props(key, value)          mêmes clés, mêmes valeurs (copie en mémoire, écriture immédiate)
//   CacheService      → table cache(key, value, exp)     compteurs anti-essais
//   LockService       → rien : le Durable Object traite une requête à la fois
//   Utilities         → SHA-256 (node:crypto), UUID, fuseau Europe/Paris (Intl)
import { createHash } from 'node:crypto';
import { createApp, NAMES } from './app.gen.js';

const RealDate = Date;

// Décalage (en minutes) du fuseau tz à l'instant ms, ex. Europe/Paris : +60 l'hiver, +120 l'été
const fmts = new Map();
export function tzOffsetMinutes(ms, tz) {
  let f = fmts.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    fmts.set(tz, f);
  }
  const p = {};
  for (const x of f.formatToParts(new RealDate(ms))) p[x.type] = x.value;
  const asUtc = RealDate.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}
// Utilities.formatDate(date, tz, 'Z') → '+0100' / '+0200' (seul format utilisé par Code.gs)
function formatDate(date, tz, format) {
  if (format !== 'Z') throw new Error('Utilities.formatDate : format non pris en charge : ' + format);
  const off = tzOffsetMinutes(date.getTime(), tz), a = Math.abs(off);
  return (off < 0 ? '-' : '+') + String(Math.floor(a / 60)).padStart(2, '0') + String(a % 60).padStart(2, '0');
}

export const sha256Hex = text => createHash('sha256').update(String(text), 'utf8').digest('hex');
const isChunk = k => /~\d+$/.test(k);

// sql : { exec(requête, ...valeurs) → { toArray() } } (ctx.storage.sql de Cloudflare, ou l'équivalent node:sqlite des tests)
// env : variables du Worker (INSTALL_CODE, ADMIN_PASSWORD de secours) ; DateImpl : horloge (faussée dans les tests)
// testTimeZone : TESTS SEULEMENT. Les suites historiques supposent un serveur réglé sur le fuseau du processus (le harnais Apps
// Script n'a pas formatDate) ; en production, rien n'est passé et le fuseau demandé par Code.gs (Europe/Paris) s'applique.
export function createCore({ sql, env = {}, DateImpl = RealDate, testTimeZone = null }) {
  sql.exec('CREATE TABLE IF NOT EXISTS props (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, exp INTEGER NOT NULL)');
  const mem = new Map();
  for (const r of sql.exec('SELECT key, value FROM props').toArray()) mem.set(r.key, r.value);

  // ---- PropertiesService ----
  // Secours « mot de passe oublié » : le secret ADMIN_PASSWORD du Worker joue le rôle de la propriété ADMIN_PASSWORD d'Apps Script.
  const rescue = () => (typeof env.ADMIN_PASSWORD === 'string' && env.ADMIN_PASSWORD ? env.ADMIN_PASSWORD : null);
  const store = {
    getProperties() { const o = Object.fromEntries(mem); if (rescue()) o.ADMIN_PASSWORD = rescue(); return o; },
    getProperty(k) { if (k === 'ADMIN_PASSWORD' && rescue()) return rescue(); return mem.has(k) ? mem.get(k) : null; },
    getKeys() { return [...mem.keys()]; },
    setProperty(k, v) {
      k = String(k); v = String(v);
      mem.set(k, v);
      sql.exec('INSERT INTO props (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', k, v);
      return store;
    },
    deleteProperty(k) { k = String(k); mem.delete(k); sql.exec('DELETE FROM props WHERE key = ?', k); return store; },
  };
  // ---- CacheService ----
  const cache = {
    get(k) { const r = sql.exec('SELECT value FROM cache WHERE key = ? AND exp > ?', String(k), DateImpl.now()).toArray()[0]; return r ? r.value : null; },
    put(k, v, seconds) {
      const now = DateImpl.now();
      sql.exec('DELETE FROM cache WHERE exp <= ?', now);
      sql.exec('INSERT INTO cache (key, value, exp) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, exp = excluded.exp',
        String(k), String(v), now + (seconds || 600) * 1000);
    },
    remove(k) { sql.exec('DELETE FROM cache WHERE key = ?', String(k)); },
  };
  const lock = { waitLock() {}, tryLock() { return true; }, releaseLock() {}, hasLock() { return true; } };
  const Utilities = {
    sleep() {},
    getUuid: () => crypto.randomUUID(),
    computeDigest: (alg, text) => [...createHash('sha256').update(String(text), 'utf8').digest()].map(b => (b > 127 ? b - 256 : b)),
    formatDate: (date, tz, format) => formatDate(date, testTimeZone || tz, format),
    DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
  };
  const app = createApp({
    PropertiesService: { getScriptProperties: () => store },
    CacheService: { getScriptCache: () => cache },
    LockService: { getScriptLock: () => lock },
    Utilities, HtmlService: {}, Date: DateImpl,
  });

  // ---- les fonctions appelables depuis les pages : comme google.script.run (pas de _ final, pas doGet) ----
  const PUBLIC = new Set(NAMES.filter(n => typeof app[n] === 'function' && !n.endsWith('_') && n !== 'doGet'));
  function call(fn, args) {
    if (!PUBLIC.has(fn)) return { error: 'Fonction indisponible : ' + fn };
    if (!Array.isArray(args)) return { error: 'Requête invalide.' };
    try {
      const v = app[fn](...args);
      return { ok: true, value: v === undefined ? null : JSON.parse(JSON.stringify(v)) };
    } catch (e) {
      return { error: String(e && e.message ? e.message : e) };
    }
  }

  // ---- installation et import (transfert depuis l'appli Apps Script) ----
  const installed = () => !!(store.getProperty('ADMIN_PASSWORD') || store.getProperty('ADMIN_PASS_HASH'));
  function status() { return { installed: installed(), codeConfigured: !!env.INSTALL_CODE }; }
  // Fichier d'export : { date, schema: 3, proprietes: { clé: valeur texte } } (= backupData de l'appli Apps Script)
  function readExport(data) {
    if (data == null) return {};
    if (typeof data !== 'object' || !data.proprietes || typeof data.proprietes !== 'object' || Array.isArray(data.proprietes))
      throw new Error("Ce fichier n'est pas un export de QUIZy.");
    if (data.schema !== 3) throw new Error('Version de fichier inconnue (schéma ' + data.schema + ').');
    const out = {};
    for (const [k, v] of Object.entries(data.proprietes)) {
      if (typeof v !== 'string') throw new Error('Fichier abîmé : valeur invalide pour « ' + k + ' ».');
      if (k === 'ADMIN_PASSWORD' || k === 'ADMIN_PASS_HASH') continue;   // jamais repris d'un fichier
      out[k] = v;
    }
    return out;
  }
  function counts() {
    const keys = [...mem.keys()].filter(k => !isChunk(k)), n = p => keys.filter(k => k.startsWith(p)).length;
    return { enfants: n('student_'), familles: n('parent_'), lecons: n('quiz_'), paquets: n('deck_'), leconsFourniesModifiees: n('override_'),
      progressions: n('srs_'), cles: mem.size, octets: app.storageBytes_(Object.fromEntries(mem)), adminPseudo: mem.get('ADMIN_PSEUDO') || '' };
  }
  // Remplace toutes les données par celles du fichier (les morceaux ~0, ~1… sont gardés tels quels : Code.gs les recolle à la lecture)
  function replaceAll(props, keep) {
    sql.exec('DELETE FROM props'); mem.clear();
    sql.exec('DELETE FROM cache');
    for (const [k, v] of Object.entries({ ...props, ...keep })) if (v != null) store.setProperty(k, v);
  }
  function parentPseudos(props) {
    return Object.keys(props).filter(k => k.startsWith('parent_') && !isChunk(k))
      .map(k => { try { return app.norm_(JSON.parse(props[k]).pseudo); } catch (e) { return ''; } });
  }
  // 1re installation : code d'installation (secret du Worker) + fichier d'export (facultatif) + pseudo et mot de passe administrateur
  function install({ code, data, pseudo, password } = {}) {
    if (installed()) throw new Error('QUIZy est déjà installé. Pour remplacer les données, utilise « Importer » avec ton pseudo et ton mot de passe.');
    if (!env.INSTALL_CODE) throw new Error("Aucun code d'installation n'est configuré sur le serveur.");
    const failKey = 'install-echecs';
    if (Number(cache.get(failKey) || 0) >= 10) throw new Error("Trop d'essais. Réessaie dans quelques minutes.");
    if (String(code || '').trim().toUpperCase() !== String(env.INSTALL_CODE).trim().toUpperCase()) {
      cache.put(failKey, String(Number(cache.get(failKey) || 0) + 1), 300);
      throw new Error("Code d'installation incorrect.");
    }
    const props = readExport(data);
    const p = String(pseudo == null ? '' : pseudo).trim().slice(0, 30) || props.ADMIN_PSEUDO || '';
    if (!p) throw new Error('Choisis ton pseudo.');
    if (parentPseudos(props).includes(app.norm_(p))) throw new Error('Ce pseudo est déjà celui d\'une famille invitée.');
    app.checkNewPassword_(password);
    const salt = Utilities.getUuid();
    replaceAll(props, { ADMIN_PSEUDO: p, ADMIN_PASS_HASH: salt + ':' + app.hashPin_(salt, password) });
    if (!mem.has('schema_version')) store.setProperty('schema_version', '3');
    return counts();
  }
  // Nouvel import une fois installé (l'administrateur principal) : remplace les données, garde son pseudo et son mot de passe
  function importData({ cred, data } = {}) {
    app.ownerOnly_(cred);
    if (data == null) throw new Error('Choisis le fichier exporté.');
    const props = readExport(data);
    const keep = { ADMIN_PSEUDO: store.getProperty('ADMIN_PSEUDO'), ADMIN_PASS_HASH: mem.get('ADMIN_PASS_HASH') || null, ADMIN_PASSWORD: mem.get('ADMIN_PASSWORD') || null };
    if (keep.ADMIN_PSEUDO && parentPseudos(props).includes(app.norm_(keep.ADMIN_PSEUDO))) throw new Error('Ton pseudo est celui d\'une famille invitée du fichier.');
    replaceAll(props, keep);
    return counts();
  }
  const guard = fn => { try { return { ok: true, value: fn() }; } catch (e) { return { error: String(e && e.message ? e.message : e) }; } };

  // ---- HTTP : POST /api/<fonction> (corps = [arguments]) → { ok, value } | { error } ; /setup/… pour l'installation ----
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  async function body(request) { try { return await request.json(); } catch (e) { return undefined; } }
  async function handle(request) {
    const path = new URL(request.url).pathname;
    if (path === '/setup/status') return json(status());
    if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
    if (path.startsWith('/api/')) {
      const args = await body(request);
      if (args === undefined) return json({ error: 'Requête invalide.' }, 400);
      return json(call(decodeURIComponent(path.slice(5)), args));
    }
    if (path === '/setup/install' || path === '/setup/import') {
      const b = await body(request);
      if (!b || typeof b !== 'object') return json({ error: 'Requête invalide.' }, 400);
      return json(guard(() => (path === '/setup/install' ? install(b) : importData(b))));
    }
    return json({ error: 'Introuvable.' }, 404);
  }
  return { app, store, cache, call, status, install, importData, counts, handle, guard, json, body, PUBLIC };
}
