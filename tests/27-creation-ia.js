// Créer une leçon : choix « Avec une IA » / « À la main » ; assistant IA en 3 étapes (demande, réponse collée, vérification)
const { chromium } = require('playwright');
const { makeWorld, install, ok, summary, SRC } = require('./harness');
const DAY = 86400000;

const REPONSE_IA = `Voici le quiz demandé :

\`\`\`json
{
  "titre": "Histoire 5ᵉ : l'Empire byzantin",
  "matiere": "Histoire",
  "emoji": "🏛️",
  "description": "Constantinople, Justinien et l'Église d'Orient",
  "questions": [
    { "question": "Quelle est la capitale de l'Empire byzantin ?", "options": ["Rome", "Constantinople", "Athènes", "Ravenne"],
      "bonne_reponse": "Constantinople", "rappel": ["Constantinople"], "explication": "Constantinople est la « nouvelle Rome »." },
    { "question": "Quel empereur fait construire Sainte-Sophie ?", "options": ["Charlemagne", "Constantin", "Justinien", "Clovis"],
      "bonne_reponse": "C", "rappel": "Justinien | l'empereur Justinien", "explication": "Justinien fait bâtir Sainte-Sophie au VIᵉ siècle." },
    { "question": "En quelle année l'Empire byzantin prend-il fin ?", "options": ["1453", "1492", "1204", "1066"],
      "bonne_reponse": "1453", "rappel": ["1453"], "explication": "Les Ottomans prennent Constantinople en 1453.", },
    { "question": "Question sans bonne réponse reconnaissable", "options": ["a", "b", "c", "d"], "bonne_reponse": "z", "rappel": [] }
  ]
}
\`\`\`

N'hésite pas si tu veux plus de questions !`;

(async () => {
  const w = makeWorld();
  const ADM = { pseudo: 'Papa', password: 'secret' };
  for (const [p, pin] of [['Jul', '1111'], ['Mael', '1112']]) w.run('saveStudent', ADM, { classe: 'Gaby', pseudo: p, pin });
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 390, height: 844 } }); await install(c, w);
  await c.grantPermissions(['clipboard-read', 'clipboard-write']);
  const a = await c.newPage(); const errs = []; a.on('pageerror', e => errs.push(e.message));
  await a.goto('file://' + SRC + 'admin.html');
  await a.fill('#admin-pseudo', 'Papa'); await a.fill('#password', 'secret'); await a.click('#unlock'); await a.waitForSelector('#admin-area:not([hidden])');
  const pane = async () => (await a.locator('.pane:visible').evaluateAll(l => l.map(e => e.id))).join();

  // ---- 1. deux façons de créer une leçon ----
  await a.click('#tab-quiz-liste'); await a.click('#tab-quiz-ajout');
  const choices = await a.locator('.choice strong').allInnerTexts();
  ok((await pane()) === 'pane-quiz-new' && choices.length === 2 && choices[0].includes('Avec une IA') && choices[0].includes('le plus rapide') && choices[1].includes('À la main'), '« Créer une leçon » : 2 choix clairs, l\'IA en premier : ' + choices.map(x => x.replace(/\s+/g, ' ')).join(' | '));
  await a.click('#mode-manual');
  ok((await pane()) === 'pane-quiz-ajout' && await a.locator('#titre').isVisible() && await a.locator('#lien-url').isHidden() && (await a.locator('#quiz-more summary').innerText()).includes('Plus d\'options'), '« À la main » : le formulaire, les champs facultatifs (description, lien) repliés');
  await a.click('#pane-quiz-ajout .back-link'); await a.click('#tab-quiz-ajout');

  // ---- 2. étape 1 : la demande pour l'IA ----
  await a.click('#mode-ia');
  ok((await pane()) === 'pane-quiz-ia' && await a.locator('#ia-step-1').isVisible() && (await a.locator('.stepper li.on').innerText()).includes('La demande'), 'avec une IA : étape 1 sur 3 « La demande »');
  const checked = async () => a.locator('#ia-count button[aria-checked="true"]').innerText();
  const prompt = async () => a.locator('#ia-prompt').inputValue();
  ok((await a.locator('#ia-count button').allInnerTexts()).join() === '10,20,30,40,50,60' && (await checked()) === '20' && (await a.locator('#ia-classe').inputValue()) === '5ᵉ', 'nombre de questions : 10 à 60 (20 par défaut) ; classe 5ᵉ par défaut');
  let pr = await prompt();
  ok(pr.includes('EXACTEMENT 20 questions') && pr.includes('élève de 5ᵉ') && pr.includes('"bonne_reponse"') && pr.includes('"rappel"') && pr.includes('"explication"') && pr.includes('n\'invente rien') && pr.includes('UNE SEULE juste'), 'la demande : nombre, classe, règles pédagogiques et format attendu');
  await a.click('#ia-count button[data-n="40"]'); await a.selectOption('#ia-classe', '4ᵉ');
  pr = await prompt();
  ok((await checked()) === '40' && pr.includes('EXACTEMENT 40 questions') && pr.includes('élève de 4ᵉ') && !pr.includes('20 questions'), 'choisir 40 questions et la 4ᵉ : la demande se met à jour');
  ok((await a.locator('#ia-copy').getAttribute('class')).includes('big') && !(await a.locator('#ia-copy').getAttribute('class')).includes('secondary') && (await a.locator('#ia-next-1').getAttribute('class')).includes('secondary'), 'une seule action en avant : « 📋 Copier la demande »');
  await a.click('#ia-copy'); await a.waitForSelector('#ia-copy-status.ok');
  ok((await a.evaluate(() => navigator.clipboard.readText())) === pr && (await a.locator('#ia-copy-status').innerText()).includes('copiée'), 'copier : la demande est dans le presse-papiers, « ✅ Demande copiée ! »');
  ok(!(await a.locator('#ia-next-1').getAttribute('class')).includes('secondary') && (await a.locator('#ia-copy').innerText()).includes('Copier à nouveau'), 'après la copie : « J\'ai la réponse de l\'IA → » passe en avant');

  // ---- 3. étape 2 : coller la réponse ----
  await a.click('#ia-next-1');
  ok(await a.locator('#ia-step-2').isVisible() && await a.locator('#ia-next-2').isDisabled() && (await a.locator('.stepper li.done').count()) === 1, 'étape 2 « La réponse » : bouton suivant grisé tant que rien n\'est collé');
  await a.fill('#ia-answer', 'Désolé, je ne peux pas lire les photos.'); await a.waitForSelector('#ia-parse-status.err');
  ok((await a.locator('#ia-parse-status').innerText()).includes('Je ne trouve pas de quiz') && await a.locator('#ia-next-2').isDisabled(), 'réponse sans quiz : message clair, on ne peut pas continuer');
  await a.fill('#ia-answer', REPONSE_IA); await a.waitForSelector('#ia-parse-status.ok');
  ok((await a.locator('#ia-parse-status').innerText()).includes('3 questions trouvées') && (await a.locator('#ia-parse-status').innerText()).includes('1 ignorée') && await a.locator('#ia-next-2').isEnabled(), 'vraie réponse d\'IA (texte autour, ```json, virgule en trop, réponse « C ») : « ✅ 3 questions trouvées (1 ignorée) »');

  // ---- 4. étape 3 : vérifier et donner la leçon ----
  await a.click('#ia-next-2');
  ok(await a.locator('#ia-step-3').isVisible() && (await a.locator('#ia-titre').inputValue()) === 'Histoire 5ᵉ : l\'Empire byzantin' && (await a.locator('#ia-summary').innerText()).includes('3 questions') && (await a.locator('#ia-summary').innerText()).includes('1 question ignorée'), 'étape 3 : titre proposé, résumé, question ignorée signalée');
  ok((await a.locator('#ia-pour .pour-item').count()) === 2 && (await a.locator('#ia-pour input:checked').count()) === 0, '« Pour qui ? » : Jul et Mael (rien coché d\'office quand il y a plusieurs enfants)');
  await a.click('#ia-preview-sum');
  ok((await a.locator('#ia-questions li').count()) === 3 && (await a.locator('#ia-questions li').nth(1).innerText()).includes('✅ Justinien'), 'aperçu des questions avec la bonne réponse (« C » → Justinien)');
  const exam = new Date(w.now() + 3 * DAY).toISOString().slice(0, 10);
  await a.locator('#ia-pour .pour-item', { hasText: 'Mael' }).locator('input').check(); await a.fill('#ia-exam', exam);
  await a.click('#ia-save'); await a.waitForSelector('#prog-status.ok');
  const key = Object.keys(w.props).find(k => k.startsWith('quiz_') && !k.includes('~'));
  const q = JSON.parse(w.props[key]);
  ok(q.titre === 'Histoire 5ᵉ : l\'Empire byzantin' && q.matiere === 'Histoire' && q.emoji === '🏛️' && q.questions.length === 3 && JSON.stringify(q.pour) === '["mael"]', 'leçon créée : titre, matière, emoji, 3 questions, pour Mael');
  ok(q.questions[1].correct === 2 && JSON.stringify(q.questions[1].rappel) === '["Justinien","l\'empereur Justinien"]' && q.questions[0].explication.includes('nouvelle Rome') && q.questions.every(x => x.options.length === 4), 'questions bien lues : bonne réponse, réponses écrites acceptées, explication');
  const srs = JSON.parse(w.props['srs_mael__' + q.id] || '{}');
  ok(srs.exam === exam && srs.plan.length >= 2, 'date du contrôle enregistrée pour Mael : plan de révision prêt (' + srs.plan.length + ' séances)');
  ok((await pane()) === 'pane-programmes' && (await a.locator('#prog-status').innerText()).includes('donnée à Mael') && (await a.locator('#prog-status').innerText()).includes('contrôle') && (await a.locator(`.prog-card[data-student="mael"] .lesson-row[data-quiz="${q.id}"] .lr-name`).innerText()) === 'L\'Empire byzantin', 'retour sur « Enfants » : la fiche de Mael est ouverte, la leçon y est (titre court) avec son contrôle');
  ok(w.run('getStudentData', 'Gaby', 'Mael', '1112').quizzes.some(x => x.id === q.id) && !w.run('getStudentData', 'Gaby', 'Jul', '1111').quizzes.some(x => x.id === q.id), 'Mael la voit sur sa page élève, Jul non');

  // ---- 5. préférences retenues ; « Retoucher à la main » ----
  await a.click('#tab-quiz-liste'); await a.click('#tab-quiz-ajout'); await a.click('#mode-ia');
  ok((await checked()) === '40' && (await a.locator('#ia-classe').inputValue()) === '4ᵉ' && (await a.locator('#ia-answer').inputValue()) === '', 'nouvelle leçon : 40 questions et 4ᵉ retenus, réponse précédente effacée');
  await a.click('#ia-next-1'); await a.fill('#ia-answer', REPONSE_IA); await a.waitForSelector('#ia-parse-status.ok'); await a.click('#ia-next-2');
  await a.fill('#ia-titre', 'Byzance (à retoucher)'); await a.click('#ia-edit');
  ok((await pane()) === 'pane-quiz-ajout' && (await a.locator('#titre').inputValue()) === 'Byzance (à retoucher)' && (await a.locator('#questions .question').count()) === 3 && (await a.locator('#quiz-form-title').innerText()).includes('préparée par l\'IA'), '« ✏️ Retoucher à la main » : le formulaire, prérempli avec les 3 questions');
  ok((await a.locator('#questions .question').nth(1).locator('.q-rappel').inputValue()).includes('Justinien'), 'les réponses écrites acceptées sont reprises');
  await a.click('#save-quiz'); await a.waitForSelector('#quizlist-status.ok');
  ok(Object.keys(w.props).filter(k => k.startsWith('quiz_') && !k.includes('~')).length === 2, 'enregistrée comme une NOUVELLE leçon (la première est intacte)');

  // ---- 6. sans enfant coché : la leçon est créée mais cachée ----
  await a.click('#tab-quiz-ajout'); await a.click('#mode-ia'); await a.click('#ia-next-1'); await a.fill('#ia-answer', REPONSE_IA); await a.waitForSelector('#ia-parse-status.ok'); await a.click('#ia-next-2');
  ok((await a.locator('#ia-pour input:checked').count()) === 0, 'nouvelle leçon : les enfants cochés la fois d\'avant ne le sont plus');
  await a.fill('#ia-titre', 'Sans enfant'); await a.click('#ia-save'); await a.waitForSelector('#quizlist-status.ok');
  ok((await pane()) === 'pane-quiz-liste' && (await a.locator('#quizlist-status').innerText()).includes('cachée'), 'personne de coché : retour aux « Leçons », prévenu qu\'elle est cachée');

  // ---- 7. lecture tolérante des réponses d'IA ----
  const parse = t => a.evaluate(x => { const r = parseAiQuiz(x); return r && { n: r.quiz ? r.quiz.questions.length : 0, titre: r.quiz && r.quiz.titre, ignored: r.ignored, cut: r.cut, opts: r.quiz && r.quiz.questions[0].options, correct: r.quiz && r.quiz.questions[0].correct }; }, t);
  const one = (o) => ({ question: 'Q ?', options: ['a', 'b', 'c', 'd'], bonne_reponse: 'b', ...o });
  let r = await parse(JSON.stringify([one(), one()]));
  ok(r && r.n === 2 && r.titre === 'Nouvelle leçon', 'seulement la liste des questions : acceptée (titre par défaut)');
  r = await parse('{ “titre”: “Guillemets typographiques”, “questions”: [{ “question”: “Q ?”, “options”: [“a”, “b”], “bonne_reponse”: “a” }] }');
  ok(r && r.n === 1 && r.titre === 'Guillemets typographiques', 'guillemets « typographiques » de certaines IA : corrigés');
  r = await parse(JSON.stringify({ titre: 'Trop', questions: Array.from({ length: 70 }, () => one()) }));
  ok(r && r.n === 60 && r.cut === 10, '70 questions : 60 gardées (le maximum), 10 retirées');
  r = await parse(JSON.stringify({ titre: 'Six', questions: [one({ options: ['a', 'b', 'c', 'd', 'e', 'f'], bonne_reponse: 'f' })] }));
  ok(r && r.opts.length === 4 && r.opts[r.correct] === 'f', '6 réponses proposées : 4 gardées, dont toujours la bonne');
  r = await parse(JSON.stringify({ titre: 'Accents', questions: [one({ options: ['Été', 'Hiver'], bonne_reponse: 'ete' })] }));
  ok(r && r.n === 1 && r.correct === 0, 'bonne réponse écrite sans accent ni majuscule : reconnue');
  ok((await parse('rien du tout')) === null, 'aucun JSON : rien');

  // ---- 7 bis. téléphone : « 📤 Envoyer à mon IA » (menu de partage) ----
  ok(await a.locator('#ia-share').isHidden(), 'ordinateur (pas de menu de partage tactile) : pas de bouton « Envoyer à mon IA »');
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); await install(m, w);
  await m.grantPermissions(['clipboard-read', 'clipboard-write']);
  await m.addInitScript(() => {
    window.__shareMode = 'ok';
    Object.defineProperty(navigator, 'share', { configurable: true, value: async d => {
      if (window.__shareMode !== 'ok') { const e = new Error('partage'); e.name = window.__shareMode; throw e; }
      window.__shared = d;
    } });
  });
  const t = await m.newPage(); t.on('pageerror', e => errs.push(e.message));
  await t.goto('file://' + SRC + 'admin.html');
  await t.fill('#admin-pseudo', 'Papa'); await t.fill('#password', 'secret'); await t.click('#unlock'); await t.waitForSelector('#admin-area:not([hidden])');
  await t.click('#tab-quiz-liste'); await t.click('#tab-quiz-ajout'); await t.click('#mode-ia');
  const cls = async id => t.locator(id).getAttribute('class');
  ok(await t.locator('#ia-share').isVisible() && !(await cls('#ia-share')).includes('secondary') && (await cls('#ia-copy')).includes('secondary') && (await cls('#ia-next-1')).includes('secondary'), 'téléphone : « 📤 Envoyer à mon IA » en premier et mis en avant, « Copier » en second');
  await t.evaluate(() => { window.__shareMode = 'AbortError'; });
  await t.click('#ia-share'); await t.waitForTimeout(200);
  ok((await t.locator('#ia-copy-status').innerText()) === '' && (await cls('#ia-next-1')).includes('secondary'), 'menu de partage refermé sans choisir d\'appli : rien ne change');
  await t.evaluate(() => { window.__shareMode = 'ok'; });
  await t.click('#ia-share'); await t.waitForSelector('#ia-copy-status.ok');
  ok((await t.evaluate(() => window.__shared && window.__shared.text)) === await t.locator('#ia-prompt').inputValue() && (await t.locator('#ia-copy-status').innerText()).includes('Demande envoyée'), 'partage : la demande complète part vers l\'appli d\'IA, « ✅ Demande envoyée ! »');
  ok(!(await cls('#ia-next-1')).includes('secondary') && (await cls('#ia-share')).includes('secondary') && (await t.locator('#ia-share').innerText()).includes('Envoyer à nouveau'), 'ensuite « J\'ai la réponse de l\'IA → » passe en avant');
  const nb = await t.evaluate(() => { const r = document.getElementById('ia-next-1').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
  ok(nb, 'et il est à l\'écran, sous le pouce, au retour de l\'appli d\'IA');
  await t.click('#ia-back'); await t.click('#mode-ia');
  await t.evaluate(() => { window.__shareMode = 'NotAllowedError'; });
  await t.click('#ia-share'); await t.waitForSelector('#ia-copy-status.ok');
  ok((await t.locator('#ia-copy-status').innerText()).includes('copiée') && (await t.evaluate(() => navigator.clipboard.readText())).includes('EXACTEMENT'), 'partage refusé par le téléphone : la demande est copiée à la place');
  await m.close();

  // ---- 8. serveur : 60 questions au plus ----
  const big = n => ({ titre: 'Gros', pour: [], questions: Array.from({ length: n }, (x, i) => ({ question: 'Q' + i + ' ?', options: ['a', 'b'], correct: 0 })) });
  ok(!w.try('saveQuiz', ADM, big(60)).err && (w.try('saveQuiz', ADM, big(61)).err || '').includes('Maximum 60'), 'serveur : 60 questions acceptées, 61 refusées');
  ok(errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(errs));
  await b.close(); process.exit(summary() ? 1 : 0);
})().catch(e => { console.log('ECHEC:', e.message.split('\n')[0]); process.exit(1); });
