// Identité visuelle QUIZy (pack d'assets v1) — appliquée UNIQUEMENT à la version Cloudflare, au moment de la construction.
// Les sources apps-script/ restent celles de l'appli Apps Script en ligne (décision de l'utilisateur, 16/11/2026).
// Chaque remplacement doit trouver sa cible : sinon la construction échoue (une évolution de apps-script/ à reporter ici).
'use strict';
const fs = require('fs'), path = require('path');
const DIR = __dirname;
const uri = f => {
  let s = fs.readFileSync(path.join(DIR, f), 'utf8').trim();
  if (!s.includes('url(#')) s = s.replace(/<defs>[\s\S]*?<\/defs>/, '');
  return 'data:image/svg+xml,' + encodeURIComponent(s.replace(/"/g, "'")).replace(/%20/g, ' ').replace(/%2F/g, '/').replace(/%3D/g, '=').replace(/%3A/g, ':').replace(/%2C/g, ',').replace(/%27/g, "'");
};
const LOGO = uri('quizy-logo-white.svg'), AVATAR = uri('avatar.svg');
const PICTO = n => uri(n + '.svg');

const VARS = { '--navy': '#102B52', '--blue': '#414E98', '--gold': '#FFD078', '--pink': '#FFC9DA', '--violet': '#9872C6', '--mint': '#BFF2D6',
  '--ink': '#1A2B4C', '--muted': '#5F6B8A', '--line': '#E1E6F3', '--bg': '#F1F4FB' };
const COLORS = [['#1e3a8a', '#102B52'], ['#3b6fe0', '#414E98'], ['#785aff', '#9872C6'], ['#ffd166', '#FFD078'], ['#ff8fb8', '#C9A8EE'], ['#5dffb0', '#A9C9FF'],
  ['rgba(30,58,138,', 'rgba(16,43,82,'], ['rgba(59,111,224,', 'rgba(65,78,152,'], ['rgba(120,90,255,', 'rgba(152,114,198,'], ['rgba(255,209,102,', 'rgba(255,208,120,'],
  ['rgba(93,255,176,', 'rgba(169,201,255,'], ['rgba(255,95,162,', 'rgba(152,114,198,'], ['rgba(15,23,80,', 'rgba(16,43,82,']];
const FLOATS = [['📚', 'question'], ['⚡', 'bulb'], ['🧠', 'timer'], ['🎯', 'star']];
const FONT = `    <!-- Police de l'interface (arrondie, assortie au logo QUIZy) -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap" rel="stylesheet">
`;
const THEME = `
        /* ===== Identité QUIZy (pack d'assets v1) : palette, police, logo, pictogrammes ===== */
        :root { --quizy-gradient: linear-gradient(135deg, #174780, #414E98 52%, #9872C6); }
        body, button, input, select, textarea { font-family: "Nunito", -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .rv-banner {
          background:
            radial-gradient(circle at 85% 0%, rgba(152,114,198,.55), transparent 45%),
            radial-gradient(circle at 10% 100%, rgba(169,201,255,.22), transparent 40%),
            var(--quizy-gradient);
          border-bottom: 3px solid #FFD078;
        }
        .rv-banner::before { opacity: .12; }
        .rv-title { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 6px 0 4px; line-height: 1; text-shadow: none; }
        .rv-logo { display: block; height: 64px; width: auto; filter: drop-shadow(0 3px 0 rgba(16,43,82,.35)); }
        .rv-tag { font-size: 14px; font-weight: 900; letter-spacing: .3px; background: #FFD078; color: #102B52; padding: 3px 10px; border-radius: 999px; transform: rotate(-3deg); box-shadow: 0 3px 0 rgba(16,43,82,.35); }
        .rv-float img { display: block; width: 34px; height: 34px; }
        .rv-f2 img, .rv-f4 img { width: 28px; height: 28px; }
        .rv-chip { color: #102B52; }
        .rv-ticker { background: #FFD078; color: #102B52; }
        .login-emoji img { display: block; width: 76px; height: 76px; margin: 0 auto; filter: drop-shadow(0 4px 10px rgba(65,78,152,.35)); }
        .btn { letter-spacing: .1px; }
        @media (max-width: 700px) {
          .rv-title { margin: 0; gap: 8px; }
          .rv-logo { height: 30px; filter: none; }
          .rv-tag { font-size: 11px; padding: 2px 8px; box-shadow: none; }
        }
`;
const EXTRA_ELEVE = `        /* pictogrammes du pack : révision du jour, bilan de séance */
        .daily:not(.done) { background: radial-gradient(circle at 92% 10%, rgba(255,208,120,.25), transparent 40%), var(--quizy-gradient); }
        .daily:not(.done) .daily-txt { padding-left: 62px; position: relative; min-height: 52px; justify-content: center; }
        .daily:not(.done) .daily-txt::before { content: ""; position: absolute; left: 0; top: 50%; width: 52px; height: 52px; margin-top: -26px; background: url("${PICTO('calendar-badge')}") center / contain no-repeat; }
        .daily .btn.daily-btn { background: var(--gold); color: var(--navy); }
        /* bilan : le trophée du pack remplace 🎉 (la pause garde ⏸️) */
        .big-emoji.trophy { font-size: 0; width: 88px; height: 88px; margin: 0 auto 4px; background: url("${PICTO('trophy-badge')}") center / contain no-repeat; }
`;
function once(s, from, to, what) {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error('thème : « ' + what + ' » trouvé ' + n + ' fois (attendu : 1)');
  return s.replace(from, () => to);
}
const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function applyTheme(html, page) {
  let s = html;
  for (const [k, v] of Object.entries(VARS)) {
    const re = new RegExp('(\\n\\s*' + esc(k) + ':\\s*)[^;]+;');
    if (!re.test(s)) throw new Error('thème : variable ' + k + ' introuvable (' + page + ')');
    s = s.replace(re, (m, a) => a + v + ';');
  }
  for (const [a, b] of COLORS) s = s.replace(new RegExp(esc(a), 'gi'), b);
  s = s.replace(/var\(--gold\), var\(--pink\)/g, 'var(--gold), var(--violet)');
  FLOATS.forEach(([emoji, name], i) => { s = once(s, `rv-float rv-f${i + 1}">${emoji}</span>`, `rv-float rv-f${i + 1}"><img src="${PICTO(name)}" alt=""></span>`, 'picto ' + (i + 1)); });
  const logo = `<img class="rv-logo" src="${LOGO}" alt="QUIZy" width="154" height="64">`;
  if (page === 'eleve') {
    s = once(s, '<h1 class="rv-title">Prêt·e à <span class="rv-hl">tout déchirer</span> ? 🚀</h1>', '<h1 class="rv-title">' + logo + '</h1>', 'titre élève');
    s = once(s, '<div class="login-emoji" aria-hidden="true">🎒</div>', `<div class="login-emoji" aria-hidden="true"><img src="${AVATAR}" alt=""></div>`, 'icône de connexion');
    s = once(s, 'h("div", { class: "big-emoji" }, stopped ? "⏸️" : "🎉"),', 'h("div", { class: stopped ? "big-emoji" : "big-emoji trophy", "aria-hidden": "true" }, stopped ? "⏸️" : "🎉"),', 'bilan de séance');
    s = once(s, 'h("div", { class: "big-emoji" }, "🎉"),', 'h("div", { class: "big-emoji trophy", "aria-hidden": "true" }, "🎉"),', 'fin des cartes');
  } else {
    s = once(s, '<h1 class="rv-title">Espace <span class="rv-hl">admin</span> ⚙️</h1>', '<h1 class="rv-title">' + logo + '<span class="rv-tag">Parents</span></h1>', 'titre parents');
  }
  s = s.replace('    <style>', () => FONT + '    <style>');
  const i = s.indexOf('    </style>');
  if (i < 0) throw new Error('thème : </style> introuvable');
  return s.slice(0, i) + THEME + (page === 'eleve' ? EXTRA_ELEVE : '') + s.slice(i);
}
module.exports = { applyTheme };
