import crypto from "node:crypto";

const tables = {servicios:"servicios", extras:"extras", promociones:"promociones"};
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
const active = item => item && (item.activo === true || item.activo === "true");
const cents = amount => Math.round(Number(amount) * 100);
const day = () => new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Argentina/Buenos_Aires"}).format(new Date());
const fail = message => {throw Object.assign(new Error(message),{promoValidacion:true})};
const read = ({data,error}) => {if(error) throw error; return data};
const response = handler => async (req,res) => {
  res.set("Cache-Control","no-store");
  try {res.json({success:true,...await handler(req)})}
  catch(error){res.status(error.promoValidacion?400:500).json({success:false,error:error.promoValidacion?error.message:"No se pudo procesar la oferta."})}
};

export function clientOffers({app,db,requireAuth,limiter,variant,branchPanel,resolvePublicPromo}) {
  async function item(slug,table,id,req) {
    const source=req?branchPanel.from(req,table):db.from(table);
    const row=read(await source.select("*").eq("slug",slug).eq("id",id).maybeSingle());
    if(!active(row)) fail("Un elemento del catálogo ya no está disponible.");
    return row;
  }
  app.get("/admin/clientes/:slug",requireAuth,response(async req=>{
    const slug=req.params.slug;
    const plan=read(await db.from("usuarios").select("plan").eq("slug",slug).single()).plan;
    const customers=new Map(), today=day();
    const now=new Intl.DateTimeFormat("en-GB",{timeZone:"America/Argentina/Buenos_Aires",hour:"2-digit",minute:"2-digit"}).format(new Date());
    for(let start=0;;start+=1000){
      const page=read(await branchPanel.from(req,"turnos").select("id,nombre,apellido,telefono,email,fecha,hora,estado,monto_pagado").eq("slug",slug).neq("estado","cancelado").order("fecha",{ascending:false}).order("id").range(start,start+999));
      for(const row of page){
        const key=row.telefono || row.email;
        if(!key)continue;
        if(!customers.has(key))customers.set(key,{bookingId:row.id,nombre:row.nombre || "—",apellido:row.apellido,email:row.email,telefono:row.telefono,turnos:0,total:0,visits:new Set()});
        const customer=customers.get(key);
        customer.turnos++;
        customer.total+=Number(row.monto_pagado || 0);
        if(row.estado==="completado" || (row.estado==="confirmado" && (row.fecha<today || (row.fecha===today && row.hora.slice(0,5)<=now))))customer.visits.add(row.fecha);
      }
      if(page.length<1000)break;
    }
    const limit=plan==="premium"?Infinity:plan==="basico"?50:10;
    const clientes=[...customers.values()].slice(0,limit).map(({visits,...customer})=>{
      const dates=[...visits].sort(),last=dates.at(-1);
      const daysSince=last?Math.round((Date.parse(today)-Date.parse(last))/86400000):null;
      const ultimaVisita=daysSince===null?null:daysSince===0?"Hoy":daysSince===1?"Ayer":"Hace "+daysSince+" días";
      const intervalo=dates.length<2?null:Math.round((Date.parse(last)-Date.parse(dates[0]))/86400000/(dates.length-1));
      if(plan!=="premium" && plan!=="basico"){delete customer.telefono;delete customer.email}
      return {...customer,ultimaVisita,intervalo};
    });
    return {plan,clientes,total:customers.size};
  }));
  app.post("/admin/ofertas-cliente/:slug",requireAuth,limiter,response(async req=>{
    const {slug}=req.params;
    const {lines,price,date,time,validity,bookingId}=req.body;
    const customer=read(await branchPanel.from(req,"turnos").select("telefono,nombre,apellido,email").eq("slug",slug).eq("id",bookingId).maybeSingle());
    if(!customer?.telefono || !/^\d{7,15}$/.test(customer.telefono.replace(/\D/g,"")))fail("Esta reserva no tiene teléfono de contacto.");
    const plan=read(await db.from("usuarios").select("plan").eq("slug",slug).maybeSingle());
    if(!["basico","premium"].includes(plan?.plan))fail("Tu plan no incluye promociones personales.");
    if(!Array.isArray(lines)||!lines.length||lines.length>30||!["semana","mes","dia"].includes(validity))fail("Revisá la selección y la vigencia.");
    const today=day();
    if(date || time || validity==="dia"){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||!(Date.parse(date+"T"+time+":00-03:00")>Date.now()))fail("Elegí un día y horario futuros.");
    }
    const until=validity==="dia"?date:new Date(Date.parse(today+"T12:00:00Z")+(validity==="mes"?29:6)*86400000).toISOString().slice(0,10);
    if(date && date>until)fail("El turno queda fuera de la vigencia.");
    const entries=[], sources=[];
    let original=0;
    for(const line of lines){
      if(!Object.hasOwn(tables,line.category)||!Number.isInteger(line.count)||line.count<1||line.count>50)fail("Cantidad o categoría inválida.");
      const row=await item(slug,line.category,line.id,req);
      const promo=line.category==="promociones";
      original+=cents(promo?row.precio_final:row.precio)*line.count;
      if(promo) sources.push(row.id);
      const parts=promo?row.items:[{id:row.id,nombre:row.nombre,precio:row.precio,tipo:line.category==="extras"?"producto":"servicio",cantidad:1}];
      for(const part of parts){
        const count=part.cantidad*line.count;
        const existing=entries.find(e=>e.id===part.id && e.tipo===part.tipo);
        if(existing)existing.cantidad+=count;
        else entries.push({id:part.id,nombre:part.nombre,precio:Number(part.precio),tipo:part.tipo,cantidad:count});
      }
    }
    const final=cents(price);
    if(!Number.isSafeInteger(original)||!Number.isSafeInteger(final)||final<=0||final>=original)fail("El precio promocional debe ser positivo y menor al original.");
    const token=crypto.randomBytes(32).toString("base64url"),code=crypto.randomInt(100000,1000000).toString();
    read(await db.from("ofertas_cliente").insert({slug,token_hash:digest(token),code_hash:digest(token+code),telefono:customer.telefono,contacto:customer,staff_ids:req.sucursalAdmin?.equipo_ids || null,items:entries,fuentes:sources,precio:final/100,original:original/100,fecha:date||null,hora:time||null,vence:until}));
    return {token,code,telefono:customer.telefono};
  }));
  async function load(slug,token){
    if(!/^[\w-]{43}$/.test(token))fail("El enlace no es válido.");
    const row=read(await db.from("ofertas_cliente").select("*").eq("slug",slug).eq("token_hash",digest(token)).maybeSingle());
    if(!row||row.vence<day()||row.reserva_confirmada)fail("La oferta venció o ya fue utilizada.");
    return row;
  }
  app.get("/ofertas-cliente/:slug/:token",limiter,response(async req=>{
    const row=await load(req.params.slug,req.params.token);
    return {oferta:{items:row.items,precio:row.precio,original:row.original,fecha:row.fecha,hora:row.hora,vence:row.vence}};
  }));
  app.post("/ofertas-cliente/:slug/:token/contacto",limiter,response(async req=>{
    const row=await load(req.params.slug,req.params.token);
    if(digest(req.params.token+String(req.body.code))!==row.code_hash)fail("El código no coincide con el mensaje de WhatsApp.");
    return {contacto:row.contacto};
  }));
  return async function resolve(slug,key,service,date,staff,redeem){
    const token=key.slice(3),row=await load(slug,token);
    if(row.staff_ids && ((staff && !row.staff_ids.includes(staff)) || (redeem && !staff)))fail("Elegí un profesional de la sucursal de la oferta.");
    if(row.canje && redeem && !redeem.online)fail("Esta oferta ya tiene un pago iniciado.");
    const primary=row.items.find(i=>i.tipo==="servicio");
    if(!service || (primary && service!==primary.id))fail("Elegí el servicio correspondiente para reservar.");
    if(date && (date>row.vence || date<day() || (row.fecha && date!==row.fecha)))fail("La fecha no corresponde a la oferta.");
    if(redeem && (String(redeem.phone).replace(/\D/g,"")!==row.telefono.replace(/\D/g,"") || digest(token+String(redeem.code))!==row.code_hash || (row.hora && redeem.time!==row.hora)))fail("Revisá el teléfono, el código de WhatsApp y el horario de la oferta.");
    for(const id of row.fuentes){
      const promo=await item(slug,"promociones",id);
      await resolvePublicPromo(slug,id,promo.items.find(i=>i.tipo==="servicio")?.id,date,staff);
    }
    const entries=primary?row.items:[...row.items,{id:service,tipo:"servicio",cantidad:1}];
    let duration=0,capacity=Infinity,base=0,weight=0;
    const products=[],items=[];
    for(const entry of entries){
      const product=entry.tipo==="producto";
      let current=await item(slug,product?"extras":"servicios",entry.id);
      if(staff && current.owner_equipo_id && current.owner_equipo_id!==staff)fail("Este profesional no ofrece un elemento seleccionado.");
      if(!product){
        if(staff && !read(await db.from("servicio_equipo").select("id").eq("servicio_id",entry.id).eq("equipo_id",staff).maybeSingle()))fail("Este profesional no ofrece el servicio.");
        current=await variant(slug,entry.id,staff,current);
        duration+=Number(current.duracion||30)*entry.cantidad;
        capacity=Math.min(capacity,Number(current.capacidad||1));
        if(!primary)base=cents(current.precio);
      }
      const amount=cents(entry.precio ?? current.precio)*entry.cantidad;
      if(primary||product)weight+=amount;
      items.push({...entry,nombre:current.nombre});
      if(product)products.push({id:entry.id,nombre:current.nombre,cantidad:entry.cantidad,weight:amount});
    }
    let allocated=0,cumulative=0;
    const extras=products.map(({weight:part,...product})=>{
      cumulative+=part;
      const target=weight?Math.round(cents(row.precio)*cumulative/weight):0;
      const precio=(target-allocated)/100;allocated=target;
      return {...product,precio,promo_incluido:true};
    });
    const total=cents(row.precio)+base;
    return {id:row.id,personal_id:row.id,intento:row.canje || crypto.randomUUID(),nombre:primary?"Promoción personal":items.at(-1).nombre,tipo:"combo",servicio_id:service,items,extras,precio_original:Number(row.original)+base/100,precio_final:total/100,precioServicio:(total-allocated)/100,montoExtras:allocated/100,duracion:duration,capacidad:capacity};
  };
}
