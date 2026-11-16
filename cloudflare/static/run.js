// QUIZy sur Cloudflare : remplace google.script.run (Apps Script) par des appels POST /api/<fonction>.
// Même interface : google.script.run.withSuccessHandler(f).withFailureHandler(g).fonction(arg1, arg2…)
// Réponse du serveur : { ok: true, value } ou { error: "message" }. Panne réseau : le gestionnaire d'échec reçoit une erreur
// dont le message ne ressemble à aucune erreur définitive (la page élève réessaie alors, comme avec Google).
(function () {
  function call(name, args, onOk, onKo) {
    fetch('/api/' + encodeURIComponent(name), {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args), credentials: 'same-origin', cache: 'no-store'
    })
      .then(function (r) { return r.json().catch(function () { throw new Error('Réponse illisible du serveur (' + r.status + ').'); }); })
      .then(function (d) {
        if (d && typeof d.error === 'string') { if (onKo) onKo(new Error(d.error)); }
        else if (onOk) onOk(d ? d.value : null);
      }, function (e) {
        if (onKo) onKo(new Error('NetworkError: ' + (e && e.message ? e.message : 'connexion impossible')));
      });
  }
  function runner(onOk, onKo) {
    return new Proxy({}, {
      get: function (_, name) {
        if (name === 'withSuccessHandler') return function (f) { return runner(f, onKo); };
        if (name === 'withFailureHandler') return function (f) { return runner(onOk, f); };
        if (name === 'withUserObject') return function () { return runner(onOk, onKo); };
        if (typeof name !== 'string' || name === 'then') return undefined;
        return function () { call(name, Array.prototype.slice.call(arguments), onOk, onKo); };
      }
    });
  }
  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = runner(null, null);
})();
