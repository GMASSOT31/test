// Lance toutes les suites (node tests/run-all.cjs [apps-script|cloudflare|tout]) et affiche le bilan.
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
const arg = process.argv[2] || 'tout';
const targets = arg === 'tout' ? ['apps-script', 'cloudflare'] : [arg];
const files = fs.readdirSync(__dirname).filter(f => /^\d+-.*\.js$/.test(f)).sort();
let bad = 0;
for (const t of targets) {
  let total = 0;
  for (const f of files) {
    // une suite marquée « cible: cloudflare » ne concerne que la version Cloudflare : elle tourne une seule fois
    if (/^\/\/ cible: cloudflare/m.test(fs.readFileSync(path.join(__dirname, f), 'utf8').slice(0, 200)) && t !== 'cloudflare') continue;
    let out = '', code = 0;
    try { out = execFileSync(process.execPath, [path.join(__dirname, f)], { env: { ...process.env, QUIZY_TARGET: t }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 600000 }); }
    catch (e) { out = (e.stdout || '') + (e.stderr || ''); code = e.status || 1; }
    const n = (out.match(/^(OK|ECHEC)/gm) || []).length, ko = (out.match(/^ECHEC/gm) || []).length;
    total += n;
    if (code || ko) { bad++; console.log(`✗ [${t}] ${f} : ${ko} échec(s), code ${code}\n` + out.split('\n').filter(l => /^ECHEC/.test(l)).join('\n')); }
    else console.log(`✓ [${t}] ${f} : ${n} contrôles`);
  }
  console.log(`== ${t} : ${files.length} suites, ${total} contrôles ==`);
}
process.exit(bad ? 1 : 0);
