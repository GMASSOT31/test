// Routage du Worker « quizy », partagé avec les tests (qui fournissent leurs propres store et assets).
//   /api/<fonction>, /setup/…, /media/… (images des questions)  → Durable Object (store)      autres adresses → fichiers de public/ (assets)
const PAGES = new Set(['/', '/parents']);
const json = (o, status) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export async function route(request, { store, assets }) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/setup/') || url.pathname.startsWith('/media/')) {
    // les pages envoient du JSON : une autre origine ne peut pas le faire sans autorisation (CORS), donc pas d'appel forgé
    if (request.method === 'POST' && !/^application\/json\b/i.test(request.headers.get('content-type') || ''))
      return json({ error: 'Requête invalide.' }, 415);
    return store(request);
  }
  // Base vide : les pages mènent à l'écran « Installer »
  if (request.method === 'GET' && PAGES.has(url.pathname)) {
    const st = await (await store(new Request(url.origin + '/setup/status'))).json();
    if (!st.installed) return Response.redirect(url.origin + '/installer', 302);
  }
  return assets(request);
}
