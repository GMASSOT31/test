// Faux environnement Apps Script autour du VRAI Code.gs + Contenu.gs
const vm = require('vm'), fs = require('fs'), crypto = require('crypto');
const SRC = require('path').join(__dirname, '..', 'apps-script') + '/';

function makeWorld(initial = { ADMIN_PASSWORD: 'secret' }) {
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

async function install(context, world, { auto = false } = {}) {
  await context.exposeFunction('__srv', world.call); await context.addInitScript(bridge);
  // les tests existants cliquent eux-mêmes sur « Question suivante » : on coupe le passage automatique, sauf demande explicite
  if (!auto) await context.addInitScript('window.revisionAutoNext = false;');
}
let n = 0, fails = 0;
const ok = (c, m) => { n++; if (!c) fails++; console.log((c ? 'OK   ' : 'ECHEC') + ' ' + m); };
const summary = () => { console.log(`\n${n} contrôles, ${fails} échec(s)`); return fails; };
module.exports = { makeWorld, install, bridge, ok, summary, SRC };

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
Object.assign(module.exports, { seed, login, LEO, EMMA, PW });
