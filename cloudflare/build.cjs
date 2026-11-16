// Construit la version Cloudflare de QUIZy à partir des sources Apps Script, SANS les modifier :
//   src/app.gen.js   = Contenu.gs + Code.gs emballés dans createApp(services) (les services Google sont fournis par l'adaptateur)
//   public/          = pages (Index.html → index.html, admin.html → parents.html) adaptées + fichiers de static/
// Une seule source pour les deux versions : toute évolution de apps-script/ se retrouve ici à la prochaine construction.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = __dirname, AS = path.join(ROOT, '..', 'apps-script');
const read = f => fs.readFileSync(path.join(AS, f), 'utf8');

// ---------- serveur ----------
const contenu = read('Contenu.gs'), code = read('Code.gs');
const names = new Set();
for (const src of [contenu, code]) {
  for (const m of src.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^var\s+([^\n]+)/gm)) {
    const line = m[1];
    const parts = /;\s*(\/\/.*)?$/.test(line) ? line.replace(/;\s*(\/\/.*)?$/, '').split(',') : [line];
    for (const p of parts) { const n = /^\s*([A-Za-z_$][\w$]*)\s*=/.exec(p); if (n) names.add(n[1]); }
  }
}
for (const must of ['BUILTIN_QUIZZES', 'getStudentData', 'answer', 'backupData', 'hashPin_', 'qhash_', 'DAY_MS', 'MIN_MS'])
  if (!names.has(must)) throw new Error('build : « ' + must + ' » introuvable dans les sources');
const app = `// FICHIER GÉNÉRÉ par build.js à partir de apps-script/Contenu.gs et apps-script/Code.gs : ne pas modifier à la main.
/* eslint-disable */
export function createApp(services) {
  const { PropertiesService, CacheService, LockService, Utilities, HtmlService, Date } = services;
// ======================= Contenu.gs =======================
${contenu}
// ======================= Code.gs =======================
${code}
// ======================= fin des sources =======================
  return { ${[...names].join(', ')} };
}
export const NAMES = ${JSON.stringify([...names])};
`;
fs.mkdirSync(path.join(ROOT, 'src'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'src', 'app.gen.js'), app);

// ---------- pages ----------
const OUT = path.join(ROOT, 'public');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, 'static'))) fs.copyFileSync(path.join(ROOT, 'static', f), path.join(OUT, f));

function replaceOnce(text, from, to, what) {
  const n = text.split(from).length - 1;
  if (n !== 1) throw new Error(`build : « ${what} » trouvé ${n} fois (attendu : 1)`);
  return text.replace(from, () => to);
}
const EXEC = /https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec/g;
function head(manifest, title) {
  return `<title>${title}</title>
    <!-- QUIZy sur Cloudflare : appli installable + pont google.script.run → /api -->
    <link rel="manifest" href="/${manifest}">
    <meta name="theme-color" content="#414E98">
    <link rel="icon" href="/icon.svg" type="image/svg+xml">
    <link rel="icon" href="/favicon.ico" sizes="48x48">
    <link rel="apple-touch-icon" href="/icon-180.png">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="QUIZy">
    <script src="/run.js"></script>`;
}
let eleve = read('Index.html');
eleve = replaceOnce(eleve, '<title>QUIZy</title>', head('manifest.webmanifest', 'QUIZy'), 'titre de la page élève');
eleve = eleve.replace(EXEC, m => '/exec').replace('href="/exec?p=admin"', 'href="/parents"');

let parents = read('admin.html');
parents = replaceOnce(parents, '<title>QUIZy · Parents</title>', head('manifest-parents.webmanifest', 'QUIZy · Parents'), 'titre de l\'espace parents');
parents = parents.replace(EXEC, '/exec').replace('href="/exec"', 'href="/"');
parents = replaceOnce(parents, '$("to-student").getAttribute("href") + "?p=admin"', 'location.origin + "/parents"', 'adresse de l\'espace parents à donner');

for (const [n, t] of [['index.html', eleve], ['parents.html', parents]]) {
  if (/\/exec|script\.google\.com/.test(t)) throw new Error('build : une adresse Apps Script reste dans ' + n);
  fs.writeFileSync(path.join(OUT, n), t);
}
console.log('QUIZy construit : src/app.gen.js (' + names.size + ' noms), public/ (' + fs.readdirSync(OUT).length + ' fichiers)');

// ---------- fichiers servis, intégrés au Worker (pas de « Workers Assets » : un seul envoi au déploiement) ----------
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', webmanifest: 'application/manifest+json; charset=utf-8', svg: 'image/svg+xml', png: 'image/png', ico: 'image/x-icon' };
const files = {};
for (const f of fs.readdirSync(OUT).sort()) {
  const ext = f.split('.').pop(), buf = fs.readFileSync(path.join(OUT, f)), text = ext !== 'png' && ext !== 'ico';
  files['/' + f] = { type: MIME[ext] || 'application/octet-stream', text, body: text ? buf.toString('utf8') : buf.toString('base64') };
}
fs.writeFileSync(path.join(ROOT, 'src', 'files.gen.js'), '// FICHIER GÉNÉRÉ par build.cjs (contenu de public/) : ne pas modifier à la main.\nexport const FILES = ' + JSON.stringify(files) + ';\n');
