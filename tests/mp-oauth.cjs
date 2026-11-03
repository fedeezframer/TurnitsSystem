const fs = require('node:fs'), vm = require('node:vm'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const ts = require('../web/node_modules/typescript');
const source = fs.readFileSync('api/server.js', 'utf8');
const ast = ts.createSourceFile('server.js', source, ts.ScriptTarget.Latest, true);
const names = ['crearMpOAuthState','leerMpOAuthState','mpOAuthReturnUrl','obtenerTokenMpVigente','obtenerTokenMpVigenteEquipo'];
const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(ast)).join('\n');
const callback = ast.statements.find(node => ts.isExpressionStatement(node) && node.getText(ast).startsWith('app.get("/oauth-callback"')).getText(ast);
let handler, updates = [], failSave = false, fetches = 0, online = true, tokenOk = true;
const ctx = {
  crypto, Buffer, URLSearchParams, Date, AbortSignal, Object,
  process: {env:{MP_TURNERO_CLIENT_SECRET:'test-secret',MP_TURNERO_CLIENT_ID:'test-client'}},
  cleanSlug: slug => String(slug).toLowerCase().replace(/[^a-z0-9-]/g,''), UUID_REGEX:/^[0-9a-f-]{36}$/,
  PANEL_URL:'https://turnits.example/panel', API_URL:'https://api.example',
  console:{log(){},warn(){},error(){}}, invalidateCache(){}, crearNotificacion(){},
  encryptMpSecret: value => value ? `enc:${value}` : null,
  decryptMpSecret: value => value ? value.replace(/^enc:(?:v1:)?/,'') : null,
  supabase:{from:table=>({
    select:()=>({eq(){return this},maybeSingle:async()=>({data:{metodo_pago:'sena',puede_recibir_pagos_personales:true}})}),
    update:patch=>({eq(){return this},then(resolve){updates.push({table,patch});return Promise.resolve({error:failSave?new Error('fixture save failed'):null}).then(resolve)}}),
  })},
  fetch:async()=>{ fetches++; if(!online)throw Error('fixture network error'); return {ok:tokenOk,json:async()=>({access_token:'new-access',refresh_token:'new-refresh',expires_in:180*86400})} },
  app:{get:(_path, fn)=>{handler=fn}},
};
vm.createContext(ctx); vm.runInContext(functions+'\n'+callback, ctx);
const response = () => ({statusCode:200,status(n){this.statusCode=n;return this},send(value){this.body=value;return this},redirect(value){this.url=value;return this}});
(async()=>{
  for (const origin of ['pagos','onboarding']) {
    const state = ctx.crearMpOAuthState('demo',null,origin);
    assert.equal(ctx.leerMpOAuthState(state).returnTo,origin);
    const tampered = state.slice(0,-2)+'xx'; assert.equal(ctx.leerMpOAuthState(tampered),null);
    for (const scenario of ['ok','denied','missing','network','save']) {
      online=scenario!=='network'; failSave=scenario==='save'; updates=[];
      const res=response();
      await handler({query:{state,...(scenario==='denied'?{error:'access_denied'}:scenario==='missing'?{}:{code:'fixture-code'})}},res);
      const url=new URL(res.url);
      assert.equal(url.origin,'https://turnits.example');
      assert.equal(url.searchParams.get(origin==='onboarding'?'onboarding':'seccion'),origin==='onboarding'?'mp':'pagos');
      assert.equal(url.searchParams.get('status'),scenario==='ok'?'mp_success':'mp_error');
      if(scenario==='ok') {assert.equal(updates[0].patch.mp_access_token,'enc:new-access');assert.equal(updates[0].patch.metodo_pago,undefined,'preserves the chosen deposit method')}
      if(scenario==='denied'||scenario==='missing')assert.equal(updates.length,0);
    }
  }
  const before=fetches,res=response(); await handler({query:{state:'bad',code:'fixture'}},res);
  assert.equal(res.statusCode,400);assert.equal(fetches,before);
  online=true;failSave=false;
  const future=()=>new Date(Date.now()+180*86400000).toISOString();
  const row={mp_access_token:'enc:v1:existing',mp_refresh_token:'enc:v1:refresh',mp_token_expires_at:future()};
  const previous=fetches;
  assert.equal(await ctx.obtenerTokenMpVigente('demo',row),'existing');assert.equal(fetches,previous,'fresh credentials do not require login or refresh');
  row.mp_token_expires_at=new Date(Date.now()+3600000).toISOString();
  assert.equal(await ctx.obtenerTokenMpVigente('demo',row),'new-access');
  assert.equal(row.mp_refresh_token,'enc:new-refresh','rotated credentials update the caller as well as storage');
  failSave=true;
  const stale={mp_access_token:'enc:v1:old',mp_refresh_token:'enc:v1:refresh',mp_token_expires_at:new Date().toISOString()};
  assert.equal(await ctx.obtenerTokenMpVigente('demo',stale),'old','failed persistence does not report a saved refresh');
  failSave=false;tokenOk=false;
  assert.equal(await ctx.obtenerTokenMpVigente('demo',stale),'old','HTTP failures cannot install returned credentials');
  console.log('PASS OAuth: signed origin, tampering, success/cancellation/errors, encrypted persistence, deposit preservation and automatic refresh; no real Mercado Pago or database requests.');
})().catch(error=>{console.error(error);process.exitCode=1});
