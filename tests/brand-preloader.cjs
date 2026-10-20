const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');const ts=require('../web/node_modules/typescript');
const source=fs.readFileSync('web/src/shared/brand-preloader.ts','utf8');const compiledExports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:compiledExports});const markup=compiledExports.startupPreloaderHtml();const script=markup.replace(/^<script>/,'').replace(/<\/script>$/,'');
for(const pathname of ['/panel/fede','/panel','/browse','/browse/','/app','/app/','/login','/register','/agenda/fede','/perfil/fede','/publicaciones/fede','/success','/pendiente','/error','/reprogramar','/planes','/']){
 let inserted=0;const container={dataset:{},classList:{contains:()=>false,add:()=>{}},dispatchEvent(){}};
 vm.runInNewContext(script,{location:{pathname},document:{currentScript:{insertAdjacentHTML(){inserted++}},getElementById:()=>container},Image:class{},Event:class{}});
 assert.equal(inserted,/^\/(?:panel|browse)(?:\/|$)/i.test(pathname)?1:0,pathname);
}
console.log('PASS startup HTML executes without syntax errors; handwritten preloader exists only on /panel and /browse, never /app, booking, profile, login or public pages.');

