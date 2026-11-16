// Worker « quizy » : sert les pages (public/, intégrées au Worker) et transmet les appels /api/… et /setup/… au Durable Object « Store ».
import { DurableObject } from 'cloudflare:workers';
import { createCore } from './core.js';
import { route } from './router.js';
import { serveAsset } from './assets.js';
import { FILES } from './files.gen.js';

// Une seule instance (« quizy-eu ») : elle exécute la logique de Code.gs, une requête à la fois (= LockService d'Apps Script).
export class Store extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.core = createCore({ sql: ctx.storage.sql, env });
  }
  fetch(request) { return this.core.handle(request); }
}

export default {
  fetch(request, env) {
    // instance unique, créée en Europe de l'Ouest (au plus près des utilisateurs, en France)
    const stub = env.STORE.get(env.STORE.idFromName('quizy-eu'), { locationHint: 'weur' });
    return route(request, { store: r => stub.fetch(r), assets: r => serveAsset(r, FILES) });
  },
};
