// Sert les fichiers de public/ intégrés au Worker (src/files.gen.js) : / → index.html, /parents → parents.html, /installer…
const bin = new Map();
export function serveAsset(request, FILES) {
  const url = new URL(request.url);
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Méthode non autorisée', { status: 405 });
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  else if (p.endsWith('/') && p.length > 1) return Response.redirect(url.origin + p.slice(0, -1), 301);
  else if (p.endsWith('.html')) return Response.redirect(url.origin + (p === '/index.html' ? '/' : p.slice(0, -5)), 301);
  else if (!/\.[a-z0-9]+$/i.test(p)) p += '.html';
  const f = Object.prototype.hasOwnProperty.call(FILES, p) ? FILES[p] : null;
  if (!f) return new Response('Page introuvable', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  let body = f.body;
  if (!f.text) { if (!bin.has(p)) bin.set(p, Uint8Array.from(atob(f.body), c => c.charCodeAt(0))); body = bin.get(p); }
  const headers = { 'content-type': f.type, 'cache-control': f.type.startsWith('image/') ? 'public, max-age=86400' : 'no-cache', 'x-content-type-options': 'nosniff' };
  return new Response(request.method === 'HEAD' ? null : body, { headers });
}
