const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('../web/node_modules/typescript');
const compiled = ts.transpileModule(fs.readFileSync('web/src/shared/panel-requests.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const calls = [];
const context = { exports: {}, Headers, fetch: (url, init) => new Promise((resolve, reject) => calls.push({ url, init, resolve, reject })) };
vm.runInNewContext(compiled, context);
const { fetchPanelRead } = context.exports;
const headers = token => ({ Authorization: 'Bearer ' + token });

(async () => {
  const a = fetchPanelRead('/settings/business', { headers: headers('owner'), cache: 'no-cache' });
  const b = fetchPanelRead('/settings/business', { headers: new Headers(headers('owner')), cache: 'no-store' });
  const c = fetchPanelRead('/settings/business', { cache: 'no-cache', method: 'get', headers: headers('owner') });
  assert.equal(calls.length, 1, 'concurrent reads share the network request');
  assert.equal(calls[0].init.cache, 'no-store');
  calls[0].resolve(Response.json({ plan: 'premium' }));
  const [ra, rb, rc] = await Promise.all([a, b, c]);
  assert.notEqual(ra, rb); assert.deepEqual(await ra.json(), await rb.json(), 'every caller can consume its own body');
  assert.equal((await rc.json()).plan, 'premium', 'option order and GET casing do not duplicate requests');

  const fresh = fetchPanelRead('/settings/business', { headers: headers('owner') });
  assert.equal(calls.length, 2, 'completed responses are never reused');
  calls[1].resolve(Response.json({ plan: 'basico' }));
  assert.equal((await (await fresh).json()).plan, 'basico', 'plan changes stay fresh');

  const owner = fetchPanelRead('/settings/business', { headers: headers('owner') });
  const employee = fetchPanelRead('/settings/business', { headers: headers('branch-admin') });
  const other = fetchPanelRead('/settings/another-business', { headers: headers('owner') });
  const scoped = fetchPanelRead('/settings/business?sucursal_id=branch-2', { headers: headers('owner') });
  assert.equal(calls.length, 6, 'accounts, roles, URLs and branch filters are isolated');
  calls.slice(2, 6).forEach((c, i) => c.resolve(Response.json({ id: i })));
  assert.deepEqual(await Promise.all([owner, employee, other, scoped].map(async p => (await (await p).json()).id)), [0, 1, 2, 3]);

  const fail1 = fetchPanelRead('/settings/failure'), fail2 = fetchPanelRead('/settings/failure');
  assert.equal(calls.length, 7); calls[6].reject(new Error('network'));
  assert.equal((await Promise.allSettled([fail1, fail2])).filter(r => r.status === 'rejected').length, 2);
  const retry = fetchPanelRead('/settings/failure'); assert.equal(calls.length, 8);
  calls[7].resolve(Response.json({ error: 'expired' }, { status: 401 }));
  assert.equal((await retry).status, 401, 'HTTP errors preserved');

  const controller = new AbortController();
  const cancellable = fetchPanelRead('/settings/business', { signal: controller.signal });
  const independent = fetchPanelRead('/settings/business');
  assert.equal(calls.length, 10, 'one caller cannot abort another caller');
  assert.equal(calls[8].init.signal, controller.signal);
  calls[8].resolve(Response.json({})); calls[9].resolve(Response.json({}));
  await Promise.all([cancellable, independent]);
  const write1 = fetchPanelRead('/settings/business', { method: 'POST', body: '{}' });
  const write2 = fetchPanelRead('/settings/business', { method: 'POST', body: '{}' });
  assert.equal(calls.length, 12, 'writes are never deduplicated');
  calls[10].resolve(Response.json({})); calls[11].resolve(Response.json({})); await Promise.all([write1, write2]);
  console.log('PASS panel reads: concurrent GET deduplication, independent bodies, fresh plans, token/account/branch isolation, network/HTTP errors, abort isolation and unchanged writes. No external requests.');
})().catch(e => { console.error(e); process.exitCode = 1; });
