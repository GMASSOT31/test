// Worker « quizy » : sert les pages (public/) et transmet les appels /api/… et /setup/… au Durable Object « Store ».
import { DurableObject } from 'cloudflare:workers';
import { createCore } from './core.js';
import { route } from './router.js';

// Une seule instance (« main ») : elle exécute la logique de Code.gs, une requête à la fois (= LockService d'Apps Script).
export class Store extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.core = createCore({ sql: ctx.storage.sql, env });
  }
  fetch(request) { return this.core.handle(request); }
}

export default {
  fetch(request, env) {
    const stub = env.STORE.get(env.STORE.idFromName('main'));
    return route(request, { store: r => stub.fetch(r), assets: r => env.ASSETS.fetch(r) });
  },
};
