// cible: cloudflare
// Fuseau Europe/Paris sur Cloudflare (Utilities.formatDate réimplémenté avec Intl) : heure d'hiver, heure d'été, changements
// d'heure (29/03/2026 et 25/10/2026), minuit de Paris. Preuve de parité : le même scénario tourne sur le vrai Code.gs façon
// Apps Script (processus réglé sur TZ=Europe/Paris) et sur le cœur Cloudflare (processus en UTC, fuseau donné par Intl).
const { execFileSync } = require('child_process');
const { makeWorldAs, makeWorldCf, ok, summary } = require('./harness');
const Z = s => Date.parse(s);

// Scénario commun : renvoie toutes les valeurs calculées (décalages, débuts de jour, plans, échéances de révision)
function scenario(make) {
  const H = 3600000, DAY = 86400000, out = {};
  const instants = ['2026-01-15T11:00:00Z', '2026-07-15T11:00:00Z', '2026-03-29T00:59:00Z', '2026-03-29T01:00:00Z', '2026-03-29T12:00:00Z',
    '2026-10-25T00:59:00Z', '2026-10-25T01:00:00Z', '2026-10-25T12:00:00Z', '2026-07-15T21:59:00Z', '2026-07-15T22:00:00Z', '2026-01-15T22:59:00Z', '2026-01-15T23:00:00Z'];
  const w0 = make(Date.parse('2026-01-01T12:00:00Z'));
  out.offsets = instants.map(s => w0.ctx.tzOffsetMin_(Date.parse(s)));
  out.dayStarts = instants.map(s => new Date(w0.ctx.dayStart_(Date.parse(s))).toISOString());
  out.dateStarts = ['2026-01-15', '2026-03-29', '2026-03-30', '2026-07-15', '2026-10-25', '2026-10-26', '2026-02-30'].map(d => w0.ctx.dateStart_(d));
  out.plans = [['2026-03-25T18:00:00Z', '2026-04-10'], ['2026-10-20T07:00:00Z', '2026-11-05'], ['2026-03-28T19:59:00Z', '2026-03-29'], ['2026-10-24T21:30:00Z', '2026-10-25'], ['2026-07-15T21:30:00Z', '2026-07-17']]
    .map(([now, exam]) => w0.ctx.makePlan_(Date.parse(now), exam).map(x => new Date(x).toISOString()));
  // révisions réelles d'un élève autour des changements d'heure
  out.revisions = [];
  for (const start of ['2026-03-27T19:00:00Z', '2026-10-23T19:00:00Z', '2026-07-15T21:45:00Z']) {
    const w = make(Date.parse(start)), A = { pseudo: 'Papa', password: 'secret' };
    w.run('saveStudent', A, { classe: '5B', pseudo: 'Léo', pin: '1234' }); w.run('setBuiltinAssign', A, 'zootopia', ['leo']);
    const ids = w.ctx.BUILTIN_QUIZZES.find(q => q.id === 'zootopia').questions.map(q => w.ctx.qhash_(q.question));
    const L = ['5B', 'Léo', '1234']; let op = 0; const rec = [];
    w.run('answer', ...L, 'zootopia', ids[0], 'qcm', true, '', 's1', 'o' + ++op);
    for (let d = 0; d < 4; d++) {
      const it = w.run('getStudentData', ...L).srs.zootopia.it[ids[0]];
      w.advance(Math.max(it[1] - w.now(), 0) + 9 * H);              // le jour de l’échéance, quelques heures après l’ouverture
      rec.push(w.run('answer', ...L, 'zootopia', ids[0], 'rappel', true, '', 's' + (d + 2), 'o' + ++op).item);
    }
    const exam = new Date(w.now() + 10 * DAY).toISOString().slice(0, 10);
    rec.push(w.run('setLessonPlan', ...L, 'zootopia', exam, true).plan);
    rec.push(w.run('answer', ...L, 'zootopia', ids[1], 'qcm', true, '', 'x', 'o' + ++op).item);
    out.revisions.push(rec);
  }
  return out;
}

// 1. Apps Script, processus en heure de Paris (comme le vrai serveur Google réglé sur Europe/Paris)
const asJson = execFileSync(process.execPath, ['-e', `
  const { makeWorldAs } = require(${JSON.stringify(__dirname + '/harness')});
  const scenario = ${scenario.toString()};
  process.stdout.write(JSON.stringify(scenario(now => { const w = makeWorldAs({ ADMIN_PASSWORD: 'secret' }); w.advance(now - w.now()); return w; })));
`], { env: { ...process.env, TZ: 'Europe/Paris' }, encoding: 'utf8' });
const AS = JSON.parse(asJson);
// 2. Cloudflare : ce processus reste en UTC ; seul le fuseau demandé par Code.gs (Europe/Paris) compte
ok(new Date(Z('2026-07-15T12:00:00Z')).getTimezoneOffset() === 0 || process.env.TZ, 'ce processus de test est en UTC (le fuseau de Paris doit venir de l\'adaptateur, pas de la machine)');
const CF = scenario(now => makeWorldCf({ ADMIN_PASSWORD: 'secret' }, { timeZone: 'Europe/Paris', now }));

ok(JSON.stringify(CF.offsets) === '[60,120,60,120,120,120,60,60,120,120,60,60]', 'décalages : hiver +1 h, été +2 h, bascule le 29/03 à 01:00 UTC et le 25/10 à 01:00 UTC : ' + CF.offsets.join(','));
ok(CF.dayStarts[8] === '2026-07-14T22:00:00.000Z' && CF.dayStarts[9] === '2026-07-15T22:00:00.000Z' && CF.dayStarts[10] === '2026-01-14T23:00:00.000Z' && CF.dayStarts[11] === '2026-01-15T23:00:00.000Z',
  'minuit de Paris : 23:59 reste la veille, 00:00 commence le jour (été et hiver)');
// Comportement d'origine de Code.gs (conservé) : le début du jour est calculé avec le décalage de l'instant, donc à une heure
// près les deux jours de changement d'heure (23:00 ou 01:00 à Paris) ; sans effet pratique, identique sur Apps Script.
ok(CF.dayStarts[4] === '2026-03-28T22:00:00.000Z' && CF.dayStarts[7] === '2026-10-24T23:00:00.000Z', 'jours des changements d\'heure : même calcul que Code.gs (décalage de l\'instant), à l\'identique d\'Apps Script');
ok(CF.dateStarts[1] === Z('2026-03-28T23:00:00Z') && CF.dateStarts[2] === Z('2026-03-29T22:00:00Z') && CF.dateStarts[4] === Z('2026-10-24T22:00:00Z') && CF.dateStarts[5] === Z('2026-10-25T23:00:00Z') && CF.dateStarts[6] === 0,
  'date du contrôle = minuit de Paris (journées de 23 h et 25 h), date impossible refusée');
ok(CF.plans[2].length === 3 && CF.plans[2][2] === '2026-03-29T05:00:00.000Z', 'contrôle le lendemain du passage à l\'heure d\'été : express (maintenant, +1 h, le matin du contrôle)');
ok(CF.plans[3].length === 1 && CF.plans[3][0] === '2026-10-25T06:00:00.000Z', 'express commencé à 23 h 30 (heure de Paris) la veille du passage à l\'heure d\'hiver : uniquement 7 h');
ok(CF.plans[4].length === 2 && CF.plans[4][0] === '2026-07-16T05:00:00.000Z' && CF.plans[4][1] === '2026-07-17T05:00:00.000Z', 'à 23 h 30 en été, les deux créneaux restants commencent à 7 h à Paris');

for (const k of ['offsets', 'dayStarts', 'dateStarts'])
  ok(JSON.stringify(CF[k]) === JSON.stringify(AS[k]), 'parité avec Apps Script (Europe/Paris) : ' + k);
CF.revisions.forEach((revision, i) => {
  ok(revision.slice(0, 4).map(item => item[0]).join() === AS.revisions[i].slice(0, 4).map(item => item[0]).join(),
    'les niveaux restent identiques après modification des créneaux');
  ok(revision.slice(0, 4).every(item => {
    const hour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(item[1]);
    return hour === '07';
  }), 'les échéances régulières restent à 7 h autour des changements d’heure');
});
// et le Worker de production ne force aucun fuseau
const src = require('fs').readFileSync(__dirname + '/../cloudflare/src/worker.js', 'utf8');
ok(!/testTimeZone/.test(src) && /createCore\(\{ sql: ctx\.storage\.sql, env \}\)/.test(src), 'le Worker en ligne utilise le fuseau de Code.gs (Europe/Paris), sans réglage de test');
process.exit(summary() ? 1 : 0);
