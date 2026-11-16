/* QUIZy — installation de l'appli sur l'écran d'accueil (PWA).
 *
 * Ce que fait ce fichier (chargé dans la page élève et dans l'espace parents) :
 *  - enregistre le petit service worker (/sw.js) qui rend l'appli installable et affiche
 *    une page « hors ligne » propre si le réseau manque ;
 *  - garde de côté l'événement « beforeinstallprompt » (Chrome, Edge, Android…) pour
 *    proposer l'installation en UN clic, au moment choisi par l'appli ;
 *  - sur iPhone / iPad (pas d'installation automatique), affiche un mini tutoriel :
 *    Partager → « Sur l'écran d'accueil » → « Ajouter » ;
 *  - ne propose RIEN si l'appli est déjà installée (ouverte en fenêtre indépendante,
 *    ou installée depuis cette page) ni sur un navigateur qui ne sait pas installer ;
 *  - « Plus tard » : on ne redemande pas avant 7 jours ; « Non merci » : pas avant 90 jours.
 *    Ce choix est mémorisé sur l'appareil (localStorage « quizy-installation »), sans aucune
 *    donnée personnelle. Si le stockage est bloqué, rien ne casse : on propose seulement
 *    une fois par visite au maximum.
 *
 * L'invitation n'apparaît qu'APRÈS une connexion réussie (appel QuizyInstallation.proposer()),
 * jamais sur l'écran de connexion : discrète, en bas de l'écran, sans bloquer l'appli.
 * window.QUIZY_INSTALLATION = false désactive tout (utilisé par les tests automatiques). */
(function () {
  'use strict';
  var CLE = 'quizy-installation';
  var JOUR = 24 * 3600 * 1000;
  var PLUS_TARD_J = 7, NON_MERCI_J = 90;

  var differe = null;        // événement beforeinstallprompt gardé de côté
  var voulu = false;         // l'appli a demandé à proposer (connexion réussie)
  var dejaVu = false;        // proposé pendant cette visite (secours si le stockage est bloqué)
  var bandeau = null, feuille = null;

  function actif() { return window.QUIZY_INSTALLATION !== false; }

  // ---------- mémoire de l'appareil (jamais d'erreur si le stockage est bloqué) ----------
  function lire() {
    try { var o = JSON.parse(window.localStorage.getItem(CLE) || 'null'); return o && typeof o === 'object' ? o : {}; }
    catch (e) { return {}; }
  }
  function ecrire(o) {
    try { window.localStorage.setItem(CLE, JSON.stringify(o)); } catch (e) { /* stockage indisponible : tant pis */ }
  }
  function maintenant() { return Date.now(); }

  // ---------- détection ----------
  function modeAppli() {
    try {
      return ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay']
        .some(function (m) { return window.matchMedia('(display-mode: ' + m + ')').matches; });
    } catch (e) { return false; }
  }
  // l'appli tourne-t-elle déjà « installée » (fenêtre indépendante) ou a-t-elle été installée ici ?
  function installee() { return modeAppli() || window.navigator.standalone === true || lire().installee === true; }

  function ua() { return String(window.navigator.userAgent || ''); }
  // iPhone, iPod, iPad — y compris l'iPad récent qui se présente comme un Mac tactile
  function estIOS() {
    var u = ua();
    if (/iPhone|iPad|iPod/i.test(u)) return true;
    return /Macintosh/.test(u) && (window.navigator.maxTouchPoints || 0) > 1;
  }
  function estIPad() { return /iPad/i.test(ua()) || (/Macintosh/.test(ua()) && (window.navigator.maxTouchPoints || 0) > 1); }
  // navigateurs intégrés (Instagram, Facebook, TikTok…) : impossible d'ajouter à l'écran d'accueil
  function navigateurIntegre() { return /FBAN|FBAV|Instagram|Line\/|TikTok|Snapchat|; wv\)/i.test(ua()); }

  // une proposition est-elle possible sur cet appareil, maintenant ?
  function peutInstaller() {
    if (!actif() || installee()) return false;
    if (differe) return true;
    return estIOS() && !navigateurIntegre();
  }
  function enPause() { var o = lire(); return typeof o.pause === 'number' && o.pause > maintenant(); }

  function signaler() {
    try { window.dispatchEvent(new CustomEvent('quizy-installation', { detail: { possible: peutInstaller() } })); } catch (e) { /* vieux navigateur */ }
  }

  // ---------- styles (injectés une seule fois) ----------
  var CSS = [
    '.qi-bandeau{position:fixed;left:12px;right:12px;bottom:calc(12px + var(--qi-bas,0px) + env(safe-area-inset-bottom));z-index:900;',
    'max-width:520px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px;padding:12px 14px;',
    'background:#fff;color:#102B52;border-radius:18px;box-shadow:0 10px 30px rgba(16,43,82,.28);border:2px solid #E4E8FF;',
    'font:inherit;animation:qi-monte .25s ease-out}',
    '.qi-bandeau[hidden],.qi-fond[hidden]{display:none!important}',
    '.qi-icone{width:48px;height:48px;border-radius:12px;flex:0 0 48px;box-shadow:0 2px 6px rgba(16,43,82,.2)}',
    '.qi-texte{flex:1 1 160px;min-width:0;line-height:1.25}',
    '.qi-texte strong{display:block;font-size:1rem}',
    '.qi-texte span{font-size:.85rem;color:#4A5578}',
    '.qi-actions{display:flex;flex-wrap:wrap;gap:8px;flex:1 1 100%;justify-content:flex-end}',
    '.qi-btn{min-height:48px;min-width:48px;padding:0 16px;border-radius:12px;border:0;font:inherit;font-weight:700;cursor:pointer;font-size:.95rem}',
    '.qi-btn.qi-oui{background:#414E98;color:#fff;flex:1 1 auto}',
    '.qi-btn.qi-non{background:#F1F3FB;color:#102B52}',
    '.qi-btn:focus-visible{outline:3px solid #F5B400;outline-offset:2px}',
    '.qi-fond{position:fixed;inset:0;z-index:950;background:rgba(16,43,82,.45);display:flex;align-items:flex-end;justify-content:center}',
    '.qi-feuille{background:#fff;color:#102B52;width:100%;max-width:480px;border-radius:22px 22px 0 0;',
    'padding:20px 20px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -10px 30px rgba(16,43,82,.3);animation:qi-monte .25s ease-out;max-height:90vh;overflow:auto}',
    '.qi-fond.qi-haut{align-items:flex-start}.qi-fond.qi-haut .qi-feuille{border-radius:0 0 22px 22px;padding-top:calc(20px + env(safe-area-inset-top))}',
    '.qi-feuille h2{margin:0 0 4px;font-size:1.2rem;display:flex;align-items:center;gap:10px}',
    '.qi-feuille h2 img{width:40px;height:40px;border-radius:10px}',
    '.qi-feuille p{margin:6px 0 12px;color:#4A5578;font-size:.92rem}',
    '.qi-etapes{list-style:none;margin:0 0 16px;padding:0;display:grid;gap:10px}',
    '.qi-etapes li{display:flex;align-items:center;gap:12px;background:#F6F7FD;border-radius:14px;padding:10px 12px;font-size:.95rem;line-height:1.3}',
    '.qi-num{flex:0 0 30px;height:30px;border-radius:50%;background:#414E98;color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center}',
    '.qi-picto{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;background:#fff;border:1px solid #DDE2F5;color:#1A7CF5}',
    '.qi-feuille .qi-btn.qi-oui{width:100%}',
    '@keyframes qi-monte{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}',
    '@media (prefers-reduced-motion:reduce){.qi-bandeau,.qi-feuille{animation:none}}',
    '@media (prefers-color-scheme:dark){.qi-bandeau,.qi-feuille{background:#16213E;color:#fff;border-color:#2B3866}',
    '.qi-texte span,.qi-feuille p{color:#C8CEE8}.qi-btn.qi-non{background:#25325A;color:#fff}.qi-etapes li{background:#1E2A4E}.qi-picto{background:#fff}}'
  ].join('');
  function styles() {
    if (document.getElementById('qi-styles')) return;
    var s = document.createElement('style'); s.id = 'qi-styles'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  function el(tag, attrs, enfants) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'texte') n.textContent = attrs[k]; else if (k === 'html') n.innerHTML = attrs[k]; else n.setAttribute(k, attrs[k]);
    });
    (enfants || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }

  // la page élève a une barre d'onglets fixée en bas sur téléphone : le bandeau se pose au-dessus
  function ajusterHauteur() {
    if (!bandeau) return;
    var bas = 0;
    try {
      document.querySelectorAll('.sidebar').forEach(function (b) {
        var st = window.getComputedStyle(b);
        if (st.position === 'fixed' && st.display !== 'none' && b.getClientRects().length) { // (offsetParent vaut null pour un élément fixe)
          var r = b.getBoundingClientRect();
          if (r.bottom >= window.innerHeight - 2) bas = Math.max(bas, r.height);
        }
      });
    } catch (e) { /* rien */ }
    bandeau.style.setProperty('--qi-bas', bas + 'px');
  }

  // ---------- bandeau d'invitation ----------
  function fermerBandeau() {
    if (bandeau) { bandeau.remove(); bandeau = null; }
    window.removeEventListener('resize', ajusterHauteur);
  }
  function reporter(jours) {
    var o = lire(); o.pause = maintenant() + jours * JOUR; o.choix = jours === NON_MERCI_J ? 'non' : 'plus-tard'; ecrire(o);
    fermerBandeau(); fermerTutoriel(); signaler();
  }

  function afficherBandeau() {
    if (bandeau || !document.body) return;
    styles();
    var ios = !differe;
    var oui = el('button', { class: 'qi-btn qi-oui', type: 'button', id: 'qi-installer',
      texte: ios ? 'Comment faire ?' : 'Installer' });
    var tard = el('button', { class: 'qi-btn qi-non', type: 'button', id: 'qi-plus-tard', texte: 'Plus tard',
      'aria-label': 'Plus tard : me le reproposer dans une semaine' });
    var non = el('button', { class: 'qi-btn qi-non', type: 'button', id: 'qi-non-merci', texte: 'Non merci',
      'aria-label': 'Non merci : ne plus me le proposer' });
    bandeau = el('div', { class: 'qi-bandeau', id: 'qi-bandeau', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'qi-titre' }, [
      el('img', { class: 'qi-icone', src: '/icon-192.png', alt: '' }),
      el('div', { class: 'qi-texte' }, [
        el('strong', { id: 'qi-titre', texte: 'Installer QUIZy' }),
        el('span', { texte: ios ? 'Ajoute QUIZy à ton écran d’accueil : il s’ouvrira comme une vraie appli.'
                                : 'Ouvre QUIZy en un geste, dans sa propre fenêtre, comme une vraie appli.' })
      ]),
      el('div', { class: 'qi-actions' }, [tard, non, oui])
    ]);
    oui.addEventListener('click', function () { if (differe) lancerInstallation(); else ouvrirTutoriel(); });
    tard.addEventListener('click', function () { reporter(PLUS_TARD_J); });
    non.addEventListener('click', function () { reporter(NON_MERCI_J); });
    document.body.appendChild(bandeau);
    ajusterHauteur();
    window.addEventListener('resize', ajusterHauteur);
    dejaVu = true;
  }

  // ---------- installation en un clic (Chrome, Edge, Android…) ----------
  function lancerInstallation() {
    var ev = differe;
    if (!ev) { ouvrirTutoriel(); return Promise.resolve('tutoriel'); }
    differe = null; // l'événement ne peut servir qu'une fois
    fermerBandeau();
    try {
      ev.prompt();
      return Promise.resolve(ev.userChoice).then(function (choix) {
        var r = choix && choix.outcome;
        if (r === 'accepted') { var o = lire(); o.installee = true; delete o.pause; ecrire(o); }
        else reporter(PLUS_TARD_J); // fenêtre du navigateur refusée : on n'insiste pas avant 7 jours
        signaler();
        return r || 'inconnu';
      }, function () { signaler(); return 'erreur'; });
    } catch (e) { signaler(); return Promise.resolve('erreur'); }
  }

  // ---------- tutoriel iPhone / iPad ----------
  var PICTO_PARTAGER = '<svg width="20" height="22" viewBox="0 0 20 22" aria-hidden="true"><path d="M10 1v13M5.5 5.5 10 1l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 9H3.5a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 3.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 16.5 9h-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var PICTO_AJOUTER = '<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><rect x="2" y="2" width="18" height="18" rx="4" fill="none" stroke="#102B52" stroke-width="2"/><path d="M11 7v8M7 11h8" stroke="#102B52" stroke-width="2" stroke-linecap="round"/></svg>';

  function fermerTutoriel() {
    if (!feuille) return;
    feuille.remove(); feuille = null;
    document.removeEventListener('keydown', echap);
  }
  function echap(e) { if (e.key === 'Escape') fermerTutoriel(); }

  function ouvrirTutoriel() {
    if (feuille) return;
    styles();
    fermerBandeau();
    var ipad = estIPad();
    var ok = el('button', { class: 'qi-btn qi-oui', type: 'button', id: 'qi-compris', texte: 'J’ai compris' });
    var boite = el('div', { class: 'qi-feuille', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'qi-tuto-titre' }, [
      el('h2', { id: 'qi-tuto-titre' }, [el('img', { src: '/icon-192.png', alt: '' }), 'Installer QUIZy']),
      el('p', { texte: 'Trois gestes dans Safari, et QUIZy s’ouvre depuis ton écran d’accueil, en plein écran.' }),
      el('ol', { class: 'qi-etapes' }, [
        el('li', {}, [el('span', { class: 'qi-num', texte: '1' }), el('span', { class: 'qi-picto', html: PICTO_PARTAGER }),
          el('span', { texte: ipad ? 'Touche le bouton Partager, en haut à droite.' : 'Touche le bouton Partager, en bas de l’écran.' })]),
        el('li', {}, [el('span', { class: 'qi-num', texte: '2' }), el('span', { class: 'qi-picto', html: PICTO_AJOUTER }),
          el('span', { texte: 'Fais défiler et choisis « Sur l’écran d’accueil ».' })]),
        el('li', {}, [el('span', { class: 'qi-num', texte: '3' }), el('span', { class: 'qi-picto', html: '<strong style="color:#1A7CF5;font-size:.8rem">OK</strong>' }),
          el('span', { texte: 'Touche « Ajouter » en haut à droite. C’est fini !' })])
      ]),
      ok
    ]);
    feuille = el('div', { class: 'qi-fond' + (ipad ? ' qi-haut' : ''), id: 'qi-tutoriel' }, [boite]);
    feuille.addEventListener('click', function (e) { if (e.target === feuille) fermerTutoriel(); });
    // après le tutoriel, on ne réaffiche pas l'invitation avant une semaine (l'appli installée, elle ne reviendra plus)
    ok.addEventListener('click', function () { reporter(PLUS_TARD_J); });
    document.addEventListener('keydown', echap);
    document.body.appendChild(feuille);
    try { ok.focus(); } catch (e) { /* rien */ }
  }

  // ---------- API publique ----------
  // appelée après une connexion réussie : propose l'installation si c'est utile et pas en pause
  function proposer() {
    if (!actif()) return false;
    voulu = true;
    if (dejaVu || bandeau || enPause() || !peutInstaller()) return false;
    var delai = typeof window.QUIZY_INSTALLATION_DELAI === 'number' ? window.QUIZY_INSTALLATION_DELAI : 1500;
    setTimeout(function () { if (!dejaVu && !enPause() && peutInstaller()) afficherBandeau(); }, delai);
    return true;
  }
  // depuis un menu (« 📲 Installer l'appli ») : ignore la pause, l'utilisateur l'a demandé
  function ouvrir() {
    if (!peutInstaller()) return false;
    if (differe) lancerInstallation(); else ouvrirTutoriel();
    return true;
  }

  // ---------- événements du navigateur ----------
  window.addEventListener('beforeinstallprompt', function (e) {
    if (!actif()) return;
    e.preventDefault();             // pas de mini-barre automatique : c'est QUIZy qui propose, au bon moment
    differe = e;
    var o = lire(); if (o.installee) { delete o.installee; ecrire(o); } // l'appli a été désinstallée depuis
    signaler();
    if (voulu) proposer();
  });
  window.addEventListener('appinstalled', function () {
    var o = lire(); o.installee = true; delete o.pause; ecrire(o);
    differe = null; fermerBandeau(); fermerTutoriel(); signaler();
  });

  // service worker : rend l'appli installable et affiche une page propre hors connexion
  if (actif() && 'serviceWorker' in window.navigator && window.isSecureContext) {
    window.addEventListener('load', function () {
      window.navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () { /* sans service worker, l'appli marche quand même */ });
    });
  }

  window.QuizyInstallation = {
    proposer: proposer, ouvrir: ouvrir, peutInstaller: peutInstaller, installee: installee,
    estIOS: estIOS, _etat: lire
  };
})();
