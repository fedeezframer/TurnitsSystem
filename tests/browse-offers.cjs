const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const NativeDate=Date, now=Date.parse('2026-10-19T14:00:00Z');
const id=n=>String(n).padStart(8,'0')+'-1111-4111-8111-111111111111';
const data={
 usuarios:[{slug:'fixture',activo:true,plan:'premium',mp_access_token:'PRIVATE',horarios:{},excepciones:[],anticipacion_minutos:30}],
 negocio_perfiles:[{slug:'fixture',publicado:true}],
 servicios:Array.from({length:6},(_,n)=>({id:id(n+1),slug:'fixture',nombre:'Servicio '+n,activo:'true',precio:15000,duracion:30})),
 equipo:[{id:id(20),slug:'fixture',activo:true,es_dueño:true},{id:id(21),slug:'fixture',activo:true,es_dueño:false}],
 servicio_equipo:[],turnits_offers:[],turnos:[],
};
for(const s of data.servicios)for(const m of data.equipo){data.servicio_equipo.push({servicio_id:s.id,equipo_id:m.id,precio_override:null});data.turnits_offers.push({id:id(100+data.turnits_offers.length),slug:'fixture',servicio_id:s.id,equipo_id:m.id,precio_minimo:10000,activo:true});}
data.turnos.push({slug:'fixture',fecha:'2026-10-19',hora:'12:00',estado:'pendiente',equipo_id:null,servicio_id:id(1),duracion_reservada:30});
let waiting=[],logs=[],wave=0,failTable='',validations=0,commissions=0;
class Query{
 constructor(table){this.table=table;this.filters=[];this.fields='*';}
 select(fields){this.fields=fields;return this;}
 eq(k,v){this.filters.push(row=>row[k]===v);return this;}
 in(k,values){this.filters.push(row=>values.includes(row[k]));return this;}
 or(expression){const match=expression.match(/^equipo_id.eq.([^,]+),equipo_id.is.null$/);assert(match);this.filters.push(row=>row.equipo_id===match[1]||row.equipo_id==null);return this;}
 limit(n){this.max=n;return this;}
 maybeSingle(){this.single=true;return this;}
 then(resolve,reject){logs.push({table:this.table,fields:this.fields,wave});return new Promise(done=>waiting.push(()=>{
   if(this.table===failTable)return done({data:null,error:new Error('fixture database failure')});
   let rows=data[this.table].filter(row=>this.filters.every(f=>f(row))).slice(0,this.max||1000);
   if(this.fields!=='*')rows=rows.map(row=>Object.fromEntries(this.fields.split(',').map(key=>[key.trim(),row[key.trim()]])));
   done({data:this.single?rows[0]||null:rows,error:null});
 })).then(resolve,reject);}
}
const supabase={from:table=>new Query(table)},routes=new Map(),pass=(_q,_s,next)=>next();
const app=Object.fromEntries(['get','post','put'].map(method=>[method,(url,...handlers)=>routes.set(method+' '+url,handlers)]));
const availableSource=fs.readFileSync('api/server.js','utf8');
const start=availableSource.indexOf('async function promoDisponibilidad(');
const ctx={supabase,obtenerIntervalosDia:()=>[[690,840]],promoError:message=>Object.assign(new Error(message),{promoValidacion:true})};
vm.createContext(ctx);vm.runInContext(availableSource.slice(start,availableSource.indexOf("app.get('/promociones/:slug'",start))+';this.available=promoDisponibilidad;',ctx);
async function call(){
 waiting=[];logs=[];wave=0;validations=0;commissions=0;let answered=false;
 const response={status:200,status(code){this.statusCode=code;return this;},json(body){this.body=JSON.parse(JSON.stringify(body));answered=true;return this;}};
 const handlers=routes.get('get /browse/ofertas');const run=handlers.at(-1)({params:{},query:{},headers:{}},response);
 for(let limit=0;!answered&&limit<300;limit++){await new Promise(setImmediate);if(waiting.length){wave++;waiting.splice(0).forEach(release=>release());}}
 await run;assert(answered);return {status:response.statusCode||200,body:response.body,rounds:wave,reads:logs.length,logs:[...logs],validations,commissions};
}
(async()=>{
 global.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};
 try{
  const {createBrowse}=await import(pathToFileURL(path.resolve(process.argv[2]||'api/browse.js')));
  const multer=()=>({single:()=>pass});multer.memoryStorage=()=>({});
  createBrowse({app,supabase,multer,jwt:{},bcrypt:{},consumerAccounts:{},requireAuth:pass,limiterAuth:pass,limiterBooking:pass,
   configForMember:u=>u,intervals:ctx.obtenerIntervalosDia,available:ctx.available,
   validateMember:async(_slug,member)=>{validations++;if(member===id(22))throw Error('branch disabled');},checkCommissions:async()=>{commissions++;return false;}});
  const first=await call();assert.equal(first.status,200);assert.equal(first.body.ofertas.length,18);
  assert(first.body.ofertas.every(o=>o.hora==='12:30'||o.hora==='12:00'&&o.equipo_id===id(21)),'owner legacy appointments and pending bookings block overlapping offers');
  assert(first.body.ofertas.every(o=>o.precio=== (o.hora==='12:00'?12000:14000)),'same progressive pricing');
  assert(!JSON.stringify(first.body).includes('PRIVATE'),'payment credentials never leave the server');
  assert.equal(new Set(first.body.ofertas.map(o=>o.servicio_id)).size,6);
  if(!process.argv[2]){
   assert.equal(first.validations,2,'branch validation shared per professional within one request');
   assert.equal(first.commissions,1,'billing status shared per business');
   assert.equal(first.logs.filter(l=>l.fields==='hora,servicio_id,duracion_reservada').length,2,'one occupancy query per professional/date');
   assert.equal(first.logs.filter(l=>l.fields==='id,duracion').length,1,'one duration lookup per business');
   assert(first.rounds<=8,'bounded parallel workers avoid one sequential pipeline per offer');
  }
  const before=first.body;
  // A second HTTP request must observe reservations made since the first.
  data.turnos.push({slug:'fixture',fecha:'2026-10-19',hora:'12:30',estado:'confirmado',equipo_id:id(21),servicio_id:id(1),duracion_reservada:30});
  const second=await call();assert.equal(second.body.ofertas.length,12,'availability is fresh on every listing request');
  data.equipo[0].activo=false;
  const disabled=await call();assert.equal(disabled.body.ofertas.length,6,'inactive professional disappears');
  failTable='servicios';assert.equal((await call()).status,503,'database errors are not reported as an empty list');failTable='';
  data.equipo[0].activo=true;data.turnos.pop();data.usuarios[0].mp_access_token='';
  assert.equal((await call()).body.ofertas.length,0,'payment connection is still required');
  data.usuarios[0].mp_access_token='PRIVATE';data.usuarios[0].agenda_sin_pagos=true;
  assert.equal((await call()).body.ofertas.length,0,'no-pay agenda hides paid Offers');
  data.usuarios[0].agenda_sin_pagos=false;data.usuarios[0].estado_suscripcion='suspendido';
  assert.equal((await call()).body.ofertas.length,0,'suspended businesses never publish offers');
  if(process.env.OFFERS_SNAPSHOT)fs.writeFileSync(process.env.OFFERS_SNAPSHOT,JSON.stringify(before));
  if(process.env.OFFERS_BASELINE)assert.deepEqual(before,JSON.parse(fs.readFileSync(process.env.OFFERS_BASELINE,'utf8')),'listing matches previous implementation field for field');
  console.log(JSON.stringify({pass:true,offers:first.body.ofertas.length,reads:first.reads,rounds:first.rounds,professionalChecks:first.validations,billingChecks:first.commissions,checks:'pricing, bounded parallelism, per-request reads, fresh occupancy, inactive/suspended accounts, no payment connection, errors and private fields'}));
 }finally{global.Date=NativeDate;}
})().catch(error=>{console.error(error);process.exitCode=1});
