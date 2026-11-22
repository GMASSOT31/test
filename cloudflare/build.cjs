// Construit QUIZy (Cloudflare) à partir de cloudflare/source/ (pages + Code.gs repris tels quels) :
//   src/app.gen.js   = Contenu.gs + Code.gs emballés dans createApp(services) (les services Google sont fournis par l'adaptateur)
//   public/          = pages (Index.html → index.html, admin.html → parents.html) adaptées + fichiers de static/
// Le dossier apps-script/ (ancienne version, figée) n'est plus lu ni modifié.
'use strict';
const fs = require('fs'), path = require('path');
// Sources de QUIZy (Cloudflare) : cloudflare/source/. Le dossier apps-script/ est l'ancienne version, figée (16/11/2026).
const ROOT = __dirname, AS = path.join(ROOT, 'source');
const read = f => fs.readFileSync(path.join(AS, f), 'utf8');
const { applyTheme } = require('./theme/theme.cjs');   // identité visuelle QUIZy, propre à la version Cloudflare

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
for (const f of fs.readdirSync(path.join(ROOT, 'static')).filter(f => !fs.statSync(path.join(ROOT, 'static', f)).isDirectory())) fs.copyFileSync(path.join(ROOT, 'static', f), path.join(OUT, f));

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
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <script src="/run.js"></script>
    <script src="/profils.js"></script>
    <script src="/installation.js"></script>`;
}
let eleve = applyTheme(read('Index.html'), 'eleve');
eleve = replaceOnce(eleve, '<title>QUIZy</title>', head('manifest.webmanifest', 'QUIZy'), 'titre de la page élève');
eleve = eleve.replace(EXEC, m => '/exec').replace('href="/exec?p=admin"', 'href="/parents"');

function sharePreview({ title, description, image, alt }) {
  return `<!-- apercu-partage -->
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="QUIZy">
    <meta property="og:locale" content="fr_FR">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="https://quizy.gabriel-massot31.workers.dev/${image}">
    <meta property="og:image:type" content="image/png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${alt}">
    <meta name="twitter:card" content="summary_large_image">
    <!-- fin-apercu-partage -->`;
}
eleve = replaceOnce(eleve, '<!-- apercu-partage -->', sharePreview({
  title: 'QUIZy · Révise en jouant !',
  description: 'Des quiz et des cartes de révision pour apprendre à ton rythme.',
  image: 'quizy-apercu-site.png',
  alt: 'QUIZy. Révise en jouant ! Un quiz et une carte de révision illustrés.',
}), 'aperçu de partage du site');

let parents = applyTheme(read('admin.html'), 'parents');
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
files['/index.html'].invitationPreview = sharePreview({
  title: 'QUIZy · À toi de jouer !',
  description: 'Ouvre ton lien pour commencer ton quiz sur QUIZy.',
  image: 'quizy-apercu-invitation.png',
  alt: 'QUIZy. À toi de jouer ! Deux cartes illustrées, avec un point d’interrogation et une coche.',
});
fs.writeFileSync(path.join(ROOT, 'src', 'files.gen.js'), '// FICHIER GÉNÉRÉ par build.cjs (contenu de public/) : ne pas modifier à la main.\nexport const FILES = ' + JSON.stringify(files) + ';\n');
