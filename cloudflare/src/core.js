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
  // Images des questions (photos, figures) : hors des propriétés (limitées à ~500 Ko), contenu en base64, servies par /media/<id>
  sql.exec('CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, type TEXT NOT NULL, data TEXT NOT NULL, size INTEGER NOT NULL, created INTEGER NOT NULL)');
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
      const value = v === undefined ? null : JSON.parse(JSON.stringify(v));
      // l'export complet emporte aussi les images (stockées hors des propriétés)
      if (fn === 'backupData' && value && typeof value === 'object') value.medias = allMedia();
      return { ok: true, value };
    } catch (e) {
      return { error: String(e && e.message ? e.message : e) };
    }
  }

  // ---- images des questions ----
  // Envoi : POST /media/upload { cred, type, data } (parents et administrateur). data = base64 (photo) ou texte (figure SVG).
  // Lecture : GET /media/<id> (identifiant aléatoire de 128 bits, comme un lien privé). La question ne garde que { src, alt }.
  const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  const MEDIA_MAX = 1200000;           // octets par image (après réduction dans le navigateur, une photo fait ~200 à 500 Ko)
  // octets pour toutes les images (MEDIA_QUOTA_BYTES : réglage facultatif du Worker, utilisé par les tests avec un petit quota)
  const MEDIA_TOTAL_MAX = Number(env.MEDIA_QUOTA_BYTES) > 0 ? Number(env.MEDIA_QUOTA_BYTES) : 400000000;
  const MEDIA_CLEAN_AT = 0.9, MEDIA_CLEAN_TO = 0.8;   // nettoyage automatique : dès 90 % de l'espace, on redescend à 80 %
  const SVG_MAX = 100000;
  const b64 = { enc: bytes => Buffer.from(bytes).toString('base64'), dec: text => new Uint8Array(Buffer.from(String(text), 'base64')) };
  function sniff(bytes) {
    const at = (i, ...v) => v.every((x, j) => bytes[i + j] === x);
    if (at(0, 0xFF, 0xD8, 0xFF)) return 'image/jpeg';
    if (at(0, 0x89, 0x50, 0x4E, 0x47)) return 'image/png';
    if (at(0, 0x47, 0x49, 0x46, 0x38)) return 'image/gif';
    if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp';
    return null;
  }
  // Figure SVG (souvent écrite par une IA) : dessin seul, sans script, sans lien ni ressource extérieure
  function checkSvg(text) {
    const t = String(text || '').replace(/^\uFEFF/, '').trim();
    if (!t || t.length > SVG_MAX) throw new Error('Figure trop grande ou vide.');
    if (!/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(t) || !/<\/svg>\s*$/i.test(t)) throw new Error("Ce n'est pas une figure SVG.");
    if (/<!DOCTYPE|<!ENTITY|<script|<foreignObject|<iframe|<embed|<object|<image|<use|<a[\s>]|\son[a-z]+\s*=|javascript:|@import|url\(\s*['"]?\s*(?!#)/i.test(t))
      throw new Error('Cette figure contient des éléments non autorisés (script, lien ou image extérieure).');
    if (/\b(xlink:)?href\s*=\s*['"]\s*(?!#)/i.test(t)) throw new Error('Cette figure contient un lien non autorisé.');
    return t;
  }
  const mediaTotal = () => Number((sql.exec('SELECT COALESCE(SUM(size), 0) AS n FROM media').toArray()[0] || {}).n || 0);
  function cleanMedia(type, data) {
    if (!MEDIA_TYPES.includes(type)) throw new Error("Format d'image non pris en charge (JPEG, PNG, WebP, GIF ou SVG).");
    if (type === 'image/svg+xml') { const t = checkSvg(data); return { data: b64.enc(Buffer.from(t, 'utf8')), size: Buffer.byteLength(t, 'utf8') }; }
    if (typeof data !== 'string' || !/^[A-Za-z0-9+/=\s]+$/.test(data)) throw new Error('Image illisible.');
    const bytes = b64.dec(data);
    if (!bytes.length) throw new Error('Image vide.');
    if (bytes.length > MEDIA_MAX) throw new Error('Image trop lourde (1,2 Mo au plus).');
    if (sniff(bytes) !== type) throw new Error("Ce fichier n'est pas une image valide.");
    return { data: b64.enc(bytes), size: bytes.length };
  }
  // Images citées par les données (leçons, leçons fournies modifiées, copies des invitations…). Une valeur trop longue est
  // découpée en morceaux clé~0, clé~1… : on les recolle dans l'ordre avant de chercher, pour ne pas couper une adresse en deux.
  function usedMediaIds() {
    const groups = new Map();
    for (const [k, v] of mem) {
      const m = /^(.*)~(\d+)$/.exec(k), base = m ? m[1] : k, i = m ? Number(m[2]) : -1;
      if (!groups.has(base)) groups.set(base, []);
      groups.get(base).push([i, v]);
    }
    const used = new Set();
    for (const parts of groups.values()) {
      const text = parts.sort((a, b) => a[0] - b[0]).map(p => p[1]).join('');
      for (const x of text.matchAll(/\/media\/([0-9a-f]{32})/g)) used.add(x[1]);
    }
    return used;
  }
  // Nettoyage automatique (choix de l'utilisateur, 25/11/2026) : quand un envoi ferait atteindre 90 % de l'espace, on efface
  // d'abord les images qui ne servent plus dans aucune leçon, des plus anciennes aux plus récentes, puis, si ça ne suffit pas,
  // les plus anciennes encore utilisées (la question garde son texte, l'image disparaît), jusqu'à redescendre à 80 % en
  // comptant la nouvelle image. Rien n'est effacé tant qu'on reste sous 90 %. Les images envoyées depuis moins de 24 h et pas
  // encore enregistrées dans une leçon passent en tout dernier.
  function makeRoom(incoming) {
    let total = mediaTotal();
    if (total + incoming < MEDIA_TOTAL_MAX * MEDIA_CLEAN_AT) return { unused: 0, used: 0 };
    const target = MEDIA_TOTAL_MAX * MEDIA_CLEAN_TO - incoming;
    const used = usedMediaIds();
    const rows = sql.exec('SELECT id, size, created FROM media ORDER BY created, id').toArray();
    // une image envoyée il y a moins de 24 h et pas encore dans une leçon est sans doute en cours d'utilisation (éditeur ouvert) : en dernier
    const recent = r => Number(r.created) > DateImpl.now() - 86400000;
    const order = rows.filter(r => !used.has(r.id) && !recent(r)).concat(rows.filter(r => used.has(r.id)), rows.filter(r => !used.has(r.id) && recent(r)));
    const out = { unused: 0, used: 0 };
    for (const r of order) {
      if (total <= target) break;
      sql.exec('DELETE FROM media WHERE id = ?', r.id);
      total -= Number(r.size);
      if (used.has(r.id)) out.used++; else out.unused++;
    }
    return out;
  }
  function uploadMedia({ cred, type, data } = {}) {
    app.checkAdmin_(cred);
    const m = cleanMedia(String(type || ''), data);
    const effacees = makeRoom(m.size);
    if (mediaTotal() + m.size > MEDIA_TOTAL_MAX) throw new Error("L'espace réservé aux images est plein.");
    const id = crypto.randomUUID().replace(/-/g, '');
    sql.exec('INSERT INTO media (id, type, data, size, created) VALUES (?, ?, ?, ?, ?)', id, type, m.data, m.size, DateImpl.now());
    return { src: '/media/' + id, type, size: m.size, effacees };
  }
  function serveMedia(id) {
    const r = /^[0-9a-f]{32}$/.test(id) ? sql.exec('SELECT type, data FROM media WHERE id = ?', id).toArray()[0] : null;
    if (!r) return new Response('Image introuvable', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
    return new Response(b64.dec(r.data), { headers: {
      'content-type': r.type, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff',
      // une figure ouverte seule dans le navigateur ne peut rien exécuter ni charger
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox" } });
  }
  const allMedia = () => Object.fromEntries(sql.exec('SELECT id, type, data FROM media').toArray().map(r => [r.id, { type: r.type, data: r.data }]));
  // Fichier d'export : « medias » { id: { type, data base64 } } (absent des exports plus anciens)
  function readMedias(medias) {
    if (medias == null) return null;
    if (typeof medias !== 'object' || Array.isArray(medias)) throw new Error('Fichier abîmé : images invalides.');
    const out = [];
    for (const [id, m] of Object.entries(medias)) {
      if (!/^[0-9a-f]{32}$/.test(id) || !m || typeof m !== 'object') throw new Error('Fichier abîmé : image « ' + id + ' » invalide.');
      const data = m.type === 'image/svg+xml' ? Buffer.from(String(m.data || ''), 'base64').toString('utf8') : m.data;
      out.push({ id, type: m.type, ...cleanMedia(String(m.type || ''), data) });
    }
    return out;
  }
  function replaceMedias(list) {
    if (!list) return;   // ancien export sans images : celles déjà présentes restent
    sql.exec('DELETE FROM media');
    for (const m of list) sql.exec('INSERT INTO media (id, type, data, size, created) VALUES (?, ?, ?, ?, ?)', m.id, m.type, m.data, m.size, DateImpl.now());
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
      progressions: n('srs_'), images: Number((sql.exec('SELECT COUNT(*) AS n FROM media').toArray()[0] || {}).n || 0), cles: mem.size, octets: app.storageBytes_(Object.fromEntries(mem)), adminPseudo: mem.get('ADMIN_PSEUDO') || '' };
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
    const medias = data ? readMedias(data.medias) : null;
    const p = String(pseudo == null ? '' : pseudo).trim().slice(0, 30) || props.ADMIN_PSEUDO || '';
    if (!p) throw new Error('Choisis ton pseudo.');
    if (parentPseudos(props).includes(app.norm_(p))) throw new Error('Ce pseudo est déjà celui d\'une famille invitée.');
    app.checkNewPassword_(password);
    const salt = Utilities.getUuid();
    replaceAll(props, { ADMIN_PSEUDO: p, ADMIN_PASS_HASH: salt + ':' + app.hashPin_(salt, password) });
    replaceMedias(medias);
    if (!mem.has('schema_version')) store.setProperty('schema_version', '3');
    return counts();
  }
  // Nouvel import une fois installé (l'administrateur principal) : remplace les données, garde son pseudo et son mot de passe
  function importData({ cred, data } = {}) {
    app.ownerOnly_(cred);
    if (data == null) throw new Error('Choisis le fichier exporté.');
    const props = readExport(data);
    const medias = readMedias(data.medias);
    const keep = { ADMIN_PSEUDO: store.getProperty('ADMIN_PSEUDO'), ADMIN_PASS_HASH: mem.get('ADMIN_PASS_HASH') || null, ADMIN_PASSWORD: mem.get('ADMIN_PASSWORD') || null };
    if (keep.ADMIN_PSEUDO && parentPseudos(props).includes(app.norm_(keep.ADMIN_PSEUDO))) throw new Error('Ton pseudo est celui d\'une famille invitée du fichier.');
    replaceAll(props, keep);
    replaceMedias(medias);
    return counts();
  }
  const guard = fn => { try { return { ok: true, value: fn() }; } catch (e) { return { error: String(e && e.message ? e.message : e) }; } };

  // ---- HTTP : POST /api/<fonction> (corps = [arguments]) → { ok, value } | { error } ; /setup/… pour l'installation ----
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  async function body(request) { try { return await request.json(); } catch (e) { return undefined; } }
  async function handle(request) {
    const path = new URL(request.url).pathname;
    if (path === '/setup/status') return json(status());
    if (request.method === 'GET' && path.startsWith('/media/')) return serveMedia(path.slice(7));
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
    if (path === '/media/upload') {
      const b = await body(request);
      if (!b || typeof b !== 'object') return json({ error: 'Requête invalide.' }, 400);
      return json(guard(() => uploadMedia(b)));
    }
    return json({ error: 'Introuvable.' }, 404);
  }
  return { app, store, cache, call, status, install, importData, counts, handle, guard, json, body, PUBLIC, uploadMedia, serveMedia };
}
