// Faux environnement Apps Script autour du VRAI Code.gs + Contenu.gs
const vm = require('vm'), fs = require('fs'), crypto = require('crypto');
const SRC = require('path').join(__dirname, '..', 'apps-script') + '/';
// Version testée : Apps Script (par défaut) ou Cloudflare (QUIZY_TARGET=cloudflare) — mêmes suites, même juge de paix
const TARGET = process.env.QUIZY_TARGET === 'cloudflare' ? 'cloudflare' : 'apps-script';
const CF = require('path').join(__dirname, '..', 'cloudflare') + '/';

function makeWorld(initial = { ADMIN_PASSWORD: 'secret' }) {
  return TARGET === 'cloudflare' ? makeWorldCf(initial) : makeWorldAs(initial);
}
// Version Apps Script : le vrai Code.gs dans vm, services Google simulés
function makeWorldAs(initial = { ADMIN_PASSWORD: 'secret' }) {
  const props = { ...initial };
  const cache = new Map();
  let now = Date.now();
  const world = { props, advance: ms => { now += ms; }, now: () => now };
  const ctx = {
    PropertiesService: { getScriptProperties: () => ({ getProperties: () => ({ ...props }), getProperty: k => props[k] ?? null,
      setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => ({
      get: k => { const e = cache.get(k); return e && e.exp > now ? e.v : null; },
      put: (k, v, s) => { cache.set(k, { v, exp: now + s * 1000 }); },
      remove: k => { cache.delete(k); } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { sleep() {}, getUuid: () => crypto.randomUUID(),
      computeDigest: (a, s) => [...crypto.createHash('sha256').update(s).digest()].map(b => (b > 127 ? b - 256 : b)),
      DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' } },
    HtmlService: {}, Date: class extends Date { static now() { return now; } }, JSON, Object, Array, Number, String, unescape, encodeURIComponent, Error, Math,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(SRC + 'Contenu.gs', 'utf8') + '\n' + fs.readFileSync(SRC + 'Code.gs', 'utf8'), ctx);
  // comme google.script.run : seules les fonctions publiques (sans _ final) sont appelables depuis une page
  world.call = async (fn, args) => {
    if (typeof ctx[fn] !== 'function' || fn.endsWith('_') || fn === 'doGet') return { err: 'Fonction indisponible : ' + fn };
    try { return { ok: JSON.parse(JSON.stringify(ctx[fn](...args) ?? null)) }; } catch (e) { return { err: e.message }; }
  };
  world.ctx = ctx;
  world.run = (fn, ...args) => ctx[fn](...args);                  // appel direct (côté serveur)
  world.try = (fn, ...args) => { try { return { ok: ctx[fn](...args) }; } catch (e) { return { err: e.message }; } };
  return world;
}

const bridge = `(() => { const make = (ok, ko) => new Proxy({}, { get: (_, n) => {
  if (n === 'withSuccessHandler') return f => make(f, ko);
  if (n === 'withFailureHandler') return f => make(ok, f);
  return (...a) => window.__srv(n, a).then(r => r.err ? ko && ko({ message: 'Error: ' + r.err }) : ok && ok(r.ok)); }});
  window.google = { script: { run: make() } }; })();`;

async function install(context, world, { auto = false, profils = false, installation = false } = {}) {
  // écran « Qui es-tu ? » (profils mémorisés) : coupé pour les suites qui ne le testent pas, sauf demande explicite
  if (!profils) await context.addInitScript('window.QUIZY_PROFILS = false;');
  // invitation « Installer QUIZy » coupée par défaut (testée à part dans 36-installation.js)
  if (!installation) await context.addInitScript('window.QUIZY_INSTALLATION = false;');
  // Apps Script : faux google.script.run ; Cloudflare : la page a son vrai pont (run.js → /api/…)
  if (TARGET !== 'cloudflare') { await context.exposeFunction('__srv', world.call); await context.addInitScript(bridge); }
  // les tests existants cliquent eux-mêmes sur « Question suivante » : on coupe le passage automatique, sauf demande explicite
  if (!auto) await context.addInitScript('window.revisionAutoNext = false;');
}
let n = 0, fails = 0;
const ok = (c, m) => { n++; if (!c) fails++; console.log((c ? 'OK   ' : 'ECHEC') + ' ' + m); };
const summary = () => { console.log(`\n${n} contrôles, ${fails} échec(s)`); return fails; };

// ---- version Cloudflare : le vrai cœur du Worker (src/core.js + src/router.js) sur node:sqlite, pages servies en HTTP ----
let cfMods = null, current = null, PORT = 0;
function cfLoad() {
  if (cfMods) return cfMods;
  require('child_process').execFileSync(process.execPath, [CF + 'build.cjs'], { stdio: 'ignore' });
  const emit = process.emitWarning; process.emitWarning = (w, ...a) => (/SQLite|require\(\) of ES|CommonJS/.test(String(w)) ? undefined : emit.call(process, w, ...a));
  const { DatabaseSync } = require('node:sqlite');
  cfMods = { DatabaseSync, core: require(CF + 'src/core.js'), router: require(CF + 'src/router.js'), assets: require(CF + 'src/assets.js'), files: require(CF + 'src/files.gen.js') };
  return cfMods;
}
function sqlOf(db) {
  return { exec(q, ...b) { const st = db.prepare(q); const rows = /^\s*select/i.test(q) ? st.all(...b) : (st.run(...b), []); return { toArray: () => rows }; } };
}
// comme le Worker : fichiers de public/ intégrés (src/files.gen.js) servis par src/assets.js
const assetCf = request => cfMods.assets.serveAsset(request, cfMods.files.FILES);
function startServer() {
  if (PORT) return;
  PORT = 30000 + (process.pid % 25000);
  const srv = require('http').createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request('http://' + req.headers.host + req.url, { method: req.method, headers: req.headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body });
    let r;
    try { r = await cfMods.router.route(request, { store: rq => current.serve(rq), assets: assetCf }); }
    catch (e) { r = new Response(String(e.stack || e), { status: 500 }); }
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
  });
  srv.listen(PORT, '127.0.0.1'); srv.unref();
}
function makeWorldCf(initial = { ADMIN_PASSWORD: 'secret' }, { timeZone, env = {}, now: start } = {}) {
  const { DatabaseSync, core } = cfLoad();
  startServer();
  // Les parcours de séance sont ouverts à midi. Les tests d’horaires fournissent leur propre instant.
  let now = start ?? new Date().setUTCHours(12, 0, 0, 0);
  class FakeDate extends Date { static now() { return now; } }
  const db = new DatabaseSync(':memory:');
  // fuseau : comme le harnais Apps Script (fuseau du processus), sauf demande explicite (ex. 'Europe/Paris' pour la vraie appli)
  const sql = sqlOf(db), tz = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const c = core.createCore({ sql, DateImpl: FakeDate, env, testTimeZone: tz });
  for (const [k, v] of Object.entries(initial || {})) c.store.setProperty(k, v);
  const st = c.store;
  const props = new Proxy({}, {
    get: (_, k) => (typeof k === 'string' ? st.getProperty(k) ?? undefined : undefined),
    set: (_, k, v) => { st.setProperty(k, v); return true; },
    deleteProperty: (_, k) => { st.deleteProperty(k); return true; },
    has: (_, k) => st.getProperty(k) != null,
    ownKeys: () => st.getKeys(),
    getOwnPropertyDescriptor: (_, k) => (st.getProperty(k) != null ? { value: st.getProperty(k), enumerable: true, configurable: true, writable: true } : undefined),
  });
  const world = { props, advance: ms => { now += ms; }, now: () => now, core: c, ctx: c.app, target: 'cloudflare', sql,
    // un autre « démarrage » du Durable Object sur la même base (ex. avec d'autres variables d'environnement)
    reopen: (env2 = env) => core.createCore({ sql, DateImpl: FakeDate, env: env2, testTimeZone: tz }) };
  world.call = async (fn, args) => { const r = c.call(fn, args); return r.error !== undefined ? { err: r.error } : { ok: r.value }; };
  world.handler = null;   // un test peut remplacer le serveur (pannes simulées) : (fn, args) → { ok } | { err }
  world.serve = async rq => {
    const path = new URL(rq.url).pathname;
    if (world.handler && path.startsWith('/api/')) {
      const r = await world.handler(decodeURIComponent(path.slice(5)), await rq.json());
      return c.json(r.err !== undefined ? { error: r.err } : { ok: true, value: r.ok });
    }
    return c.handle(rq);
  };
  world.run = (fn, ...args) => c.app[fn](...args);
  world.try = (fn, ...args) => { try { return { ok: c.app[fn](...args) }; } catch (e) { return { err: e.message }; } };
  current = world;
  return world;
}
// Adresse d'une page ('Index.html' = page élève, 'admin.html' = espace parents) et fichier servi
function page(name, target = TARGET) {
  if (target !== 'cloudflare') return 'file://' + SRC + name;
  cfLoad(); startServer();
  return 'http://127.0.0.1:' + PORT + (name === 'admin.html' ? '/parents' : name === 'Index.html' ? '/' : '/' + name);
}
function pageFile(name) {
  if (TARGET !== 'cloudflare') return SRC + name;
  cfLoad();
  return CF + 'public/' + (name === 'admin.html' ? 'parents.html' : name === 'Index.html' ? 'index.html' : name);
}
// liens entre les deux pages
const LINKS = TARGET === 'cloudflare' ? { admin: '/parents', student: '/' } : { admin: '/exec?p=admin', student: '/exec' };

module.exports = { makeWorld, makeWorldAs, makeWorldCf, install, bridge, ok, summary, SRC, TARGET, CF, page, pageFile, LINKS };

// ---- aides pour les tests de pages ----
const PW = 'secret';
// Monde de test : Léo (5B, 1234) et Emma (5B, 4321). Léo : byzance-30 + zootopia + un paquet. Emma : byzance + un quiz « Maths ».
function seed(world, { allToLeo = false } = {}) {
  world.run('saveStudent', PW, { classe: '5B', pseudo: 'Léo', pin: '1234' });
  world.run('saveStudent', PW, { classe: '5B', pseudo: 'Emma', pin: '4321' });
  if (allToLeo) { for (const id of ['byzance', 'byzance-30', 'zootopia']) world.run('setBuiltinAssign', PW, id, ['leo']); return; }
  world.run('setBuiltinAssign', PW, 'byzance-30', ['leo']);
  world.run('setBuiltinAssign', PW, 'zootopia', ['leo']);
  world.run('setBuiltinAssign', PW, 'byzance', ['emma']);
  world.run('saveQuiz', PW, { titre: 'Maths', matiere: 'Maths', emoji: '➗', questions: [{ question: 'Combien font 2 + 2 ?', options: ['3', '4', '5'], correct: 1, explication: '2 + 2 = 4' }], pour: ['emma'] });
  world.run('saveDeck', PW, { titre: 'Mots anglais', cartes: [{ recto: 'dog', verso: 'chien' }, { recto: 'cat', verso: 'chat' }], pour: ['leo'] });
}
async function login(p, c = { classe: '5B', pseudo: 'Léo', pin: '1234' }) {
  await p.fill('#login-classe', c.classe); await p.fill('#login-pseudo', c.pseudo); await p.fill('#login-pin', c.pin);
  await p.click('#login-btn');
  await p.waitForSelector('#app:not([hidden])', { timeout: 8000 });
}
const LEO = { classe: '5B', pseudo: 'Léo', pin: '1234' }, EMMA = { classe: '5B', pseudo: 'Emma', pin: '4321' };
// identifiants parent (pseudo + mot de passe), comme les envoie la page d'administration
const ADM = { pseudo: 'Papa', password: 'secret' };
// ---- aides pour les séances (parcours v3) ----
const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Ouvre une leçon et lance une séance ; à la première ouverture, répond à « Quand est ton contrôle ? » et « déjà travaillée ? »
async function startLesson(p, title, { exam = 'Pas de contrôle prévu', tf = true } = {}) {
  await p.locator('.card.lecon', { hasText: title }).first().click();
  if (await p.locator('.setup').count()) {
    await p.locator('.choice', { hasText: exam }).first().click();
    await p.locator('.choice.wide', { hasText: tf ? 'Oui' : 'Non' }).click();
    await p.click('.setup .actions .btn');
  } else await p.locator('.lesson-screen .big-btn').click();
  await p.waitForSelector('.session-head');
}
// Répond à l'écran en cours d'une séance (carte : « J'ai lu »), juste ou faux, puis passe à la suite
async function answerCurrent(p, good = true, { next = true } = {}) {
  if (await p.locator('.flashcard.learn').count()) { await p.click('.panel.session .actions .btn'); return 'carte'; }
  const info = await p.evaluate(() => {
    const t = document.querySelector('.panel.session .question').textContent;
    for (const z of QUIZZES) { const q = z.questions.find(x => x.question === t); if (q) return { right: q.champs ? q.champs.map(c => c.reponses[0]) : q.reponses ? q.reponses[0] : q.options[q.correct], rappel: q.rappel ? q.rappel[0] : null, champs: !!q.champs }; }
    return null;
  });
  if (await p.locator('.masked-btns').count()) await p.locator('.masked-btns .btn').first().click();
  if (await p.locator('.option').count()) {
    if (good) await p.locator('.option').filter({ hasText: new RegExp('^' + esc(info.right) + '$') }).first().click();
    else await p.locator('.option').filter({ hasNotText: info.right }).first().click();
  } else if (info.champs) {
    const ins = p.locator('.saisie.champ');
    for (let k = 0; k < info.right.length; k++) await ins.nth(k).fill(good ? info.right[k] : 'zzz');
    await p.locator('.panel .btn', { hasText: 'Valider' }).click();
  } else { await p.fill('.panel.session .saisie', good ? (info.rappel || info.right) : 'zzz'); await p.keyboard.press('Enter'); }
  if (next) await p.click('.next-btn');
  return 'question';
}
// Termine la séance en cours (tout juste, ou avec good(n) pour choisir)
async function finishSession(p, good = () => true) {
  let n = 0;
  while (await p.locator('.session-head').count() && n < 200) { const kind = await answerCurrent(p, good(n)); if (kind === 'question') n++; }
  await p.waitForSelector('.result .actions');
  return n;
}
Object.assign(module.exports, { seed, login, LEO, EMMA, PW, ADM, startLesson, answerCurrent, finishSession, esc });
