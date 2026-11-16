// QUIZy — profils mémorisés sur l'appareil et écran « Qui es-tu ? » (sélecteur de profil façon Netflix / choix de compte Google).
// Commun à la page élève (/) et à l'espace parents (/parents). Chargé par les deux pages avant leur propre script.
//
// Ce qui est mémorisé (localStorage, clé "profiles", tableau JSON, 8 profils au plus, le plus récent en premier, sans doublon) :
//   { role: 'eleve' | 'parent', id, nom, pseudo, classe (élève seulement), couleur, admin (parent principal), maj }
// JAMAIS de PIN, de mot de passe, de jeton ni de donnée sensible. Rien n'est jamais mis dans l'URL.
// Tous les accès au stockage sont protégés : en navigation privée ou stockage bloqué, l'écran n'apparaît pas et le site marche.
(function () {
    "use strict";
    var CLE = "profiles", MAX = 8, CHOIX = "quizy-profil-choisi";
    // couleurs d'avatar tirées de la palette QUIZy, toutes lisibles avec une initiale blanche (contraste ≥ 4,5:1)
    var COULEURS = ["#414E98", "#6E4BA6", "#102B52", "#1D6585", "#8A4775", "#2C6A4E"];

    function norm(t) {
        return String(t == null ? "" : t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
    }
    function texte(v, max) { return String(v == null ? "" : v).slice(0, max); }

    // ---------- stockage (toujours dans un try/catch) ----------
    function stockageOk() {
        try { var k = "__quizy_test__"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return true; } catch (e) { return false; }
    }
    function valide(p) {
        return !!p && typeof p === "object" && typeof p.nom === "string" && p.nom !== "" &&
            ((p.role === "eleve" && !!p.classe && !!p.pseudo) || (p.role === "parent" && !!p.pseudo));
    }
    function lire() {
        try {
            var a = JSON.parse(localStorage.getItem(CLE) || "[]");
            return Array.isArray(a) ? a.filter(valide).slice(0, MAX) : [];
        } catch (e) { return []; }
    }
    function ecrire(liste) {
        try { localStorage.setItem(CLE, JSON.stringify(liste.slice(0, MAX))); return true; } catch (e) { return false; }
    }
    // Identifiant de connexion normalisé : classe + pseudo pour un élève, pseudo pour un parent
    function cle(p) { return p.role + "|" + (p.role === "eleve" ? norm(p.classe) + "|" : "") + norm(p.pseudo); }
    function couleurDe(graine) {
        var h = 0, s = String(graine);
        for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return COULEURS[h % COULEURS.length];
    }
    // Profil propre : seulement les champs autorisés (jamais de secret, même si l'appelant en passe un par erreur)
    function nettoyer(p) {
        var q = { role: p.role === "parent" ? "parent" : "eleve", id: texte(p.id, 60), nom: texte(p.nom || p.pseudo, 30), pseudo: texte(p.pseudo, 30) };
        if (q.role === "eleve") q.classe = texte(p.classe, 30);
        if (q.role === "parent" && p.admin) q.admin = true;
        q.couleur = COULEURS.indexOf(p.couleur) >= 0 ? p.couleur : couleurDe(q.role + ":" + (q.id || cle(q)));
        q.maj = Date.now();
        return q;
    }
    // Après chaque connexion réussie : le profil passe en tête (même personne = même rôle et même id, ou même identifiant)
    function memoriser(p) {
        if (!actif()) return;
        var q = nettoyer(p);
        if (!valide(q)) return;
        var autres = lire().filter(function (x) { return cle(x) !== cle(q) && !(x.role === q.role && q.id && x.id === q.id); });
        var ancien = lire().filter(function (x) { return x.role === q.role && q.id && x.id === q.id; })[0];
        if (ancien && ancien.couleur) q.couleur = ancien.couleur;   // l'avatar ne change pas de couleur d'une connexion à l'autre
        else if (!p.couleur) {
            // nouveau profil : une couleur pas encore prise sur cet appareil, pour bien distinguer les pastilles
            var prises = autres.map(function (x) { return x.couleur; });
            var libre = COULEURS.filter(function (c) { return prises.indexOf(c) < 0; });
            if (libre.length && prises.indexOf(q.couleur) >= 0) q.couleur = libre[0];
        }
        ecrire([q].concat(autres));
    }
    // Le nom ou l'identifiant d'une personne a changé (ex. le parent renomme un enfant) : on met à jour sans changer l'ordre
    function mettreAJour(role, id, champs) {
        if (!actif() || !id) return;
        var liste = lire(), change = false;
        liste.forEach(function (x, i) {
            if (x.role === role && x.id === String(id)) {
                var q = nettoyer(Object.assign({}, x, champs, { role: role, id: id, couleur: x.couleur }));
                if (valide(q)) { q.maj = x.maj; liste[i] = q; change = true; }
            }
        });
        if (change) {
            // un même identifiant ne doit pas apparaître deux fois
            var vus = {};
            ecrire(liste.filter(function (x) { var k = cle(x); if (vus[k]) return false; vus[k] = 1; return true; }));
        }
    }
    function retirer(k) { ecrire(lire().filter(function (x) { return cle(x) !== k; })); }
    // Désactivable par une page (tests) avec window.QUIZY_PROFILS = false
    function actif() { return window.QUIZY_PROFILS !== false && stockageOk(); }

    // Passage d'une page à l'autre (ex. profil parent touché sur la page élève) : la clé voyage en sessionStorage, pas dans l'URL
    function choisirPour(p) { try { sessionStorage.setItem(CHOIX, cle(p)); } catch (e) { /* stockage bloqué */ } }
    function choixEnAttente() {
        try {
            var k = sessionStorage.getItem(CHOIX);
            sessionStorage.removeItem(CHOIX);
            return k ? lire().filter(function (p) { return cle(p) === k; })[0] || null : null;
        } catch (e) { return null; }
    }

    // ---------- affichage ----------
    function el(tag, attrs, enfants) {
        var e = document.createElement(tag);
        Object.keys(attrs || {}).forEach(function (k) {
            if (k === "class") e.className = attrs[k];
            else if (k === "text") e.textContent = attrs[k];
            else if (k.indexOf("on") === 0) e.addEventListener(k.slice(2), attrs[k]);
            else e.setAttribute(k, attrs[k]);
        });
        (enfants || []).forEach(function (c) { if (c != null) e.append(c); });
        return e;
    }
    function sousTitre(p) { return p.role === "eleve" ? "Élève · " + p.classe : (p.admin ? "Parent · administrateur" : "Parent"); }
    // Pastille : initiale sur la couleur du profil (décorative : le nom est toujours écrit à côté)
    function avatar(p, petit) {
        return el("span", { class: "qp-avatar" + (petit ? " qp-petit" : ""), "aria-hidden": "true", style: "background:" + p.couleur },
            [document.createTextNode((p.nom.trim().charAt(0) || "?").toUpperCase())]);
    }

    // Écran « Qui es-tu ? » dans conteneur. options : { onChoisir(p), onAutre(), onVide() }
    function grille(conteneur, options) {
        var liste = lire();
        var statut = el("p", { class: "qp-statut", role: "status" });
        var ul = el("ul", { class: "qp-grille", role: "list" });
        liste.forEach(function (p) {
            var choisir = el("button", { type: "button", class: "qp-profil", "data-profil": cle(p),
                "aria-label": "Me connecter : " + p.nom + ", " + sousTitre(p).toLowerCase(), onclick: function () { options.onChoisir(p); } },
                [avatar(p), el("span", { class: "qp-nom", text: p.nom }), el("span", { class: "qp-role", text: sousTitre(p) })]);
            var retirerBtn = el("button", { type: "button", class: "qp-retirer", "aria-label": "Retirer le profil " + p.nom + " de cet appareil",
                onclick: function () {
                    retirer(cle(p));
                    if (!lire().length) { (options.onVide || options.onAutre)(); return; }
                    grille(conteneur, options);
                    var s = conteneur.querySelector(".qp-statut"); if (s) s.textContent = "Profil « " + p.nom + " » retiré de cet appareil.";
                    var premier = conteneur.querySelector(".qp-profil"); if (premier) premier.focus();
                } }, [document.createTextNode("Retirer")]);
            ul.append(el("li", { class: "qp-carte" }, [choisir, retirerBtn]));
        });
        conteneur.replaceChildren(
            el("h2", { class: "qp-titre", text: "Qui es-tu ?" }),
            el("p", { class: "qp-aide", text: "Touche ton profil. Ces profils sont mémorisés sur cet appareil seulement, sans aucun mot de passe." }),
            ul, statut,
            el("div", { class: "qp-actions" }, [el("button", { type: "button", class: "btn secondary qp-autre", onclick: function () { options.onAutre(); } },
                [document.createTextNode("➕ Autre profil / Nouvelle connexion")])]));
        conteneur.hidden = false;
    }
    // Bandeau du profil choisi (au-dessus du mot de passe) avec « Autre profil »
    function puce(conteneur, p, onAutre) {
        conteneur.replaceChildren(avatar(p, true),
            el("span", { class: "qp-puce-texte" }, [el("strong", { text: p.nom }), el("span", { text: sousTitre(p) })]),
            el("button", { type: "button", class: "qp-changer", onclick: onAutre, "aria-label": "Autre profil : revenir au choix des profils" }, [document.createTextNode("Autre profil")]));
        conteneur.hidden = false;
    }
    // Échec de connexion avec un profil mémorisé : message clair + « Retirer ce profil »
    function proposerRetrait(conteneur, p, message, onRetire) {
        conteneur.replaceChildren(
            el("p", { class: "qp-erreur", text: message }),
            el("button", { type: "button", class: "btn secondary qp-retirer-profil", onclick: function () { retirer(cle(p)); conteneur.hidden = true; onRetire(); } },
                [document.createTextNode("🗑️ Retirer ce profil de cet appareil")]));
        conteneur.hidden = false;
    }

    // Styles (variables de la page : --navy, --blue, --gold, --muted, --line ; valeurs de secours sinon)
    var css = "" +
        ".qp-zone[hidden],.qp-puce[hidden],.lockbar[hidden]{display:none!important}" +
        ".qp-zone{max-width:720px;margin:20px auto;padding:22px 18px;background:#fff;border-radius:22px;box-shadow:0 5px 0 rgba(16,43,82,.12),0 12px 28px rgba(16,43,82,.10);text-align:center}" +
        ".qp-titre{margin:0 0 4px;font-size:1.7rem;font-weight:900;color:var(--navy,#102B52)}" +
        ".qp-aide{margin:0 0 16px;color:var(--muted,#5F6B8A);font-size:.92rem;font-weight:600}" +
        ".qp-grille{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:14px}" +
        ".qp-carte{display:flex;flex-direction:column;align-items:stretch;gap:4px}" +
        ".qp-profil{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;min-height:150px;padding:14px 8px 12px;border:3px solid transparent;border-radius:18px;background:#F1F4FB;font:inherit;color:var(--navy,#102B52);cursor:pointer;transition:transform .15s,border-color .15s}" +
        ".qp-profil:hover{transform:translateY(-3px);border-color:var(--gold,#FFD078)}" +
        ".qp-profil:focus-visible,.qp-retirer:focus-visible,.qp-changer:focus-visible{outline:3px solid var(--navy,#102B52);outline-offset:3px}" +
        ".qp-avatar{display:inline-flex;align-items:center;justify-content:center;width:76px;height:76px;border-radius:50%;color:#fff;font-size:2.1rem;font-weight:900;box-shadow:0 4px 0 rgba(16,43,82,.25);flex-shrink:0}" +
        ".qp-avatar.qp-petit{width:44px;height:44px;font-size:1.25rem;box-shadow:none}" +
        ".qp-nom{font-weight:900;font-size:1.08rem;line-height:1.15;overflow-wrap:anywhere}" +
        ".qp-role{font-weight:700;font-size:.8rem;color:var(--muted,#5F6B8A)}" +
        ".qp-retirer{min-height:48px;border:0;border-radius:12px;background:transparent;font:inherit;font-weight:800;font-size:.85rem;color:#8a1740;cursor:pointer}" +
        ".qp-retirer:hover{background:#fff0f3}" +
        ".qp-statut{min-height:1.2em;margin:10px 0 0;font-weight:700;color:var(--muted,#5F6B8A)}" +
        ".qp-statut:empty{margin:0}" +
        ".qp-actions{margin-top:14px}" +
        ".qp-autre{min-height:48px}" +
        ".qp-puce{display:flex;align-items:center;gap:10px;margin:4px 0 10px;padding:8px 10px;border-radius:16px;background:#F1F4FB;text-align:left}" +
        ".qp-puce-texte{display:flex;flex-direction:column;flex:1;min-width:0;color:var(--navy,#102B52)}" +
        ".qp-puce-texte strong{font-size:1.05rem;overflow-wrap:anywhere}" +
        ".qp-puce-texte span{font-size:.8rem;font-weight:700;color:var(--muted,#5F6B8A)}" +
        ".qp-changer{min-height:48px;padding:0 12px;border:2px solid var(--line,#E1E6F3);border-radius:12px;background:#fff;font:inherit;font-weight:800;color:var(--blue,#414E98);cursor:pointer}" +
        ".qp-erreur{margin:6px 0 8px;font-weight:700;color:#8a1740}" +
        ".qp-retirer-profil{min-height:48px}" +
        "@media (max-width:700px){.qp-zone{margin:12px;padding:18px 12px}.qp-titre{font-size:1.45rem}.qp-grille{grid-template-columns:repeat(2,1fr);gap:10px}}";
    function styles() {
        if (document.getElementById("qp-styles")) return;
        var s = document.createElement("style"); s.id = "qp-styles"; s.textContent = css;
        (document.head || document.documentElement).append(s);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", styles); else styles();

    window.QuizyProfils = { actif: actif, lire: lire, memoriser: memoriser, mettreAJour: mettreAJour, retirer: retirer, cle: cle, norm: norm,
        choisirPour: choisirPour, choixEnAttente: choixEnAttente, avatar: avatar, grille: grille, puce: puce, proposerRetrait: proposerRetrait, MAX: MAX };
})();
