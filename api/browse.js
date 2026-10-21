import crypto from "node:crypto";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const active = (v) => v === true || v === "true";
const result = (r) => {
  if (r.error) throw r.error;
  return r.data;
};
const fail = (text, status = 400) => {
  throw Object.assign(new Error(text), { publicMessage: text, status });
};
const freshRead = (_key, load) => load();
// Share promises only inside one listing request. Booking/checkout calls use
// fresh reads and the database still claims each appointment atomically.
function requestReads() {
  const pending = new Map();
  return (key, load) => {
    const id = JSON.stringify(key);
    if (!pending.has(id)) pending.set(id, Promise.resolve().then(load));
    return pending.get(id);
  };
}
async function mapLimited(items, limit, fn) {
  const output = new Array(items.length);
  let next = 0, failed = false;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (!failed && next < items.length) {
      const index = next++;
      try { output[index] = await fn(items[index]); }
      catch (error) { failed = true; throw error; }
    }
  }));
  return output;
}
export function offerPrice(price, minimum, remaining) {
  if (
    !Number.isFinite(price) ||
    !Number.isFinite(minimum) || !Number.isFinite(remaining) ||
    minimum <= 0 ||
    minimum >= price ||
    remaining <= 0 ||
    remaining > 60
  )
    return null;
  return (
    Math.round(
      (price -
        (price - minimum) *
          (remaining <= 15 ? 1 : remaining <= 30 ? 0.6 : 0.2)) *
        100,
    ) / 100
  );
}
export const argentinaDate = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
export function createBrowse({
  app,
  supabase,
  jwt,
  bcrypt,
  requireAuth,
  consumerAccounts,
  limiterAuth,
  limiterBooking,
  limiterRead = limiterBooking,
  multer,
  configForMember,
  intervals,
  available,
  validateMember,
  checkCommissions,
  createCheckout,
  notifyBooking,
  mail,
  secret = process.env.JWT_SECRET,
}) {
  const route = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      console.error("Browse:", e.code || e.name);
      res
        .status(e.status || (["P0001", "23505"].includes(e.code) ? 409 : 503))
        .json({
          success: false,
          error:
            e.publicMessage ||
            (e.code === "P0001"
              ? e.message
              : "No pudimos completar la operación. Volvé a intentar."),
        });
    }
  };
  const consumer = route(async (req, res) => {
    const raw = req.headers.authorization?.split(" ")[1];
    let token;
    try {
      token = jwt.verify(raw, secret);
    } catch {
      fail("Iniciá sesión con tu cuenta de usuario.", 401);
    }
    if (token.rol !== "consumidor" || !UUID.test(token.consumidorId || ""))
      fail("Ingresá con una cuenta de usuario.", 403);
    const c = result(
      await supabase
        .from("consumidores")
        .select(
          "id,nombre_persona,apellido,email,telefono,foto_url,intereses,activo,email_verificado",
        )
        .eq("id", token.consumidorId)
        .maybeSingle(),
    );
    if (!c?.activo || !c?.email_verificado)
      fail("Tu sesión ya no está activa.", 401);
    req.consumer = c;
    req.browseNext();
  });
  const auth = (req, res, next) => {
    req.browseNext = next;
    return consumer(req, res);
  };
  const owner = (req, res, next) => {
    if (
      req.empleado ||
      req.sucursalAdmin ||
      req.auth?.rol === "empleado" ||
      req.auth?.rol === "consumidor"
    )
      return res.status(403).json({
        success: false,
        error: "Sólo el dueño general puede configurar Offers y T-Coins.",
      });
    next();
  };
  const visibleBusiness = async (slug) => {
    const [n, p] = await Promise.all([
      supabase.from("usuarios").select("*").eq("slug", slug).maybeSingle(),
      supabase
        .from("negocio_perfiles")
        .select("slug")
        .eq("slug", slug)
        .eq("publicado", true)
        .maybeSingle(),
    ]);
    const u = result(n);
    if (
      !u ||
      !active(u.activo) ||
      u.estado_suscripcion === "suspendido" ||
      (u.fecha_vencimiento && Date.parse(u.fecha_vencimiento) <= Date.now()) ||
      !result(p)
    )
      fail("El negocio no está disponible.", 404);
    return u;
  };
  const context = async (slug, serviceId, memberId, read = freshRead) => {
    const user = await read(["business", slug], () => visibleBusiness(slug));
    const [s, e, v] = await Promise.all([
      read(["service", slug, serviceId], () => supabase
        .from("servicios")
        .select("*")
        .eq("slug", slug)
        .eq("id", serviceId)
        .maybeSingle()),
      read(["member", slug, memberId], () => supabase
        .from("equipo")
        .select("*")
        .eq("slug", slug)
        .eq("id", memberId)
        .maybeSingle()),
      read(["variant", serviceId, memberId], () => supabase
        .from("servicio_equipo")
        .select("*")
        .eq("servicio_id", serviceId)
        .eq("equipo_id", memberId)
        .maybeSingle()),
    ]);
    const service = result(s),
      member = result(e),
      variant = result(v);
    if (
      !service ||
      !active(service.activo) ||
      !member ||
      !active(member.activo) ||
      !variant ||
      (service.owner_equipo_id && service.owner_equipo_id !== member.id)
    )
      fail("El servicio no está disponible para ese profesional.");
    try {
      await read(["branch-valid", slug, memberId], () => validateMember(slug, memberId));
    } catch {
      fail("El profesional no está disponible en esa sucursal.");
    }
    return {
      user,
      member,
      service: {
        ...service,
        precio: Number(variant.precio_override ?? service.precio),
      },
      config: configForMember(user, member),
    };
  };
  const image = (s) =>
    String(s?.descripcion || "").match(/^\[img:(.*?)\]/s)?.[1] || "";
  async function catalog() {
    const profiles =
      result(
        await supabase
          .from("negocio_perfiles")
          .select(
            "slug,nombre,descripcion,categoria,ciudad,provincia,fotos,foto_perfil_url,banner_url",
          )
          .eq("publicado", true)
          .order("updated_at", { ascending: false })
          .limit(150),
      ) || [];
    if (!profiles.length)
      return { servicios: [], negocios: [], recompensas: [] };
    const slugs = profiles.map((p) => p.slug);
    const [nr, sr, er, vr, rr, br] = await Promise.all([
      supabase
        .from("usuarios")
        .select(
          "slug,business_name,rubro,activo,plan,estado_suscripcion,fecha_vencimiento" + (process.env.QUOTE_BOOKING_ENABLED === "true" ? ",modo_agenda" : ""),
        )
        .in("slug", slugs),
      supabase
        .from("servicios")
        .select(
          "id,slug,nombre,descripcion,precio,duracion,owner_equipo_id,activo,orden",
        )
        .in("slug", slugs)
        .eq("activo", "true")
        .order("orden")
        .limit(1000),
      supabase
        .from("equipo")
        .select("id,slug,nombre,apellido,activo,sucursal_id")
        .in("slug", slugs)
        .eq("activo", true),
      supabase
        .from("servicio_equipo")
        .select(
          "servicio_id,equipo_id,precio_override,imagen_url_override,servicios!inner(slug)",
        )
        .in("servicios.slug", slugs)
        .limit(10000),
      supabase
        .from("turnits_recompensas")
        .select("*")
        .in("slug", slugs)
        .eq("activo", true),
      supabase
        .from("sucursales")
        .select("id,slug,nombre,latitud,longitud,es_principal")
        .in("slug", slugs)
        .eq("activo", true),
    ]);
    const users = (result(nr) || []).filter(
      (n) =>
        active(n.activo) &&
        n.estado_suscripcion !== "suspendido" &&
        (!n.fecha_vencimiento || Date.parse(n.fecha_vencimiento) > Date.now()),
    );
    const branches = result(br) || [],
      members = (result(er) || []).filter(
        (m) =>
          !m.sucursal_id ||
          branches.some(
            (b) =>
              b.id === m.sucursal_id &&
              (b.es_principal ||
                users.find((n) => n.slug === m.slug)?.plan === "premium"),
          ),
      ),
      variants = result(vr) || [],
      services = result(sr) || [],
      rewards = result(rr) || [];
    const businesses = profiles
      .filter((p) => users.some((n) => n.slug === p.slug))
      .map((p) => {
        const n = users.find((n) => n.slug === p.slug),
          b =
            branches.find((b) => b.slug === p.slug && b.es_principal) ||
            branches.find((b) => b.slug === p.slug);
        return {
          ...p,
          nombre: p.nombre || n.business_name,
          rubro: n.rubro || "",
          modo_agenda: process.env.QUOTE_BOOKING_ENABLED === "true" ? n.modo_agenda || "normal" : "normal",
          latitud: b?.latitud ?? null,
          longitud: b?.longitud ?? null,
          sucursales: [
            ...branches.filter((branch) => branch.slug === p.slug && (branch.es_principal || n.plan === "premium")).map(branch=>({...branch,id:branch.es_principal?"principal":branch.id})),
            ...(!branches.some(branch=>branch.slug===p.slug && branch.es_principal) && members.some(member=>member.slug===p.slug && !member.sucursal_id) ? [{id:"principal",nombre:"Sede principal",latitud:null,longitud:null}] : []),
          ],
        };
      });
    const items = [];
    for (const s of services) {
      const business = businesses.find((b) => b.slug === s.slug);
      if (!business) continue;
      const options = variants.filter(
        (v) =>
          v.servicio_id === s.id &&
          members.some((m) => m.id === v.equipo_id && m.slug === s.slug) &&
          (!s.owner_equipo_id || v.equipo_id === s.owner_equipo_id),
      );
      if (!options.length) continue;
      const best = options.reduce((a, b) =>
        Number(a.precio_override ?? s.precio) <=
        Number(b.precio_override ?? s.precio)
          ? a
          : b,
      );
      items.push({
        id: s.id,
        slug: s.slug,
        nombre: s.nombre,
        precio: Number(best.precio_override ?? s.precio),
        duracion: s.duracion,
        imagen:
          best.imagen_url_override ||
          image(s) ||
          business.fotos?.[0] ||
          business.banner_url ||
          "",
        negocio: business,
        equipo: options.map((v) => ({
          id: v.equipo_id,
          nombre: members.find((m) => m.id === v.equipo_id)?.nombre,
          sucursal_id: members.find((m) => m.id === v.equipo_id)?.sucursal_id || "principal",
          precio: Number(v.precio_override ?? s.precio),
        })),
      });
    }
    return {
      servicios: items,
      negocios: businesses,
      recompensas: rewards
        .filter(
          (r) => r.stock !== 0 && items.some((s) => s.id === r.servicio_id),
        )
        .map((r) => ({
          ...r,
          servicio: items.find((s) => s.id === r.servicio_id),
          negocio: businesses.find((b) => b.slug === r.slug),
        })),
    };
  }
  app.get(
    "/browse/catalogo",
    limiterRead,
    route(async (req, res) => {
      res.json({ success: true, ...(await catalog()) });
    }),
  );
  app.get("/browse/favoritos", auth, route(async (req, res) => {
    const rows = result(await supabase.from("consumidor_favoritos").select("slug").eq("consumidor_id", req.consumer.id).order("created_at", { ascending: false }));
    const services = result(await supabase.from("consumidor_servicios_favoritos").select("servicio_id").eq("consumidor_id", req.consumer.id).order("created_at", { ascending: false }));
    res.json({ success: true, favoritos: (rows || []).map(row => row.slug), servicios: (services || []).map(row => row.servicio_id) });
  }));
  app.put("/browse/servicios-favoritos/:id", auth, limiterRead, route(async (req, res) => {
    const service = (await catalog()).servicios.find(item => item.id === req.params.id);
    if (!service) fail("Servicio no disponible.", 404);
    result(await supabase.from("consumidor_servicios_favoritos").upsert({ consumidor_id: req.consumer.id, servicio_id: service.id }, { onConflict: "consumidor_id,servicio_id", ignoreDuplicates: true }));
    res.json({ success: true });
  }));
  app.delete("/browse/servicios-favoritos/:id", auth, limiterRead, route(async (req, res) => {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id || "")) fail("Servicio inválido.");
    result(await supabase.from("consumidor_servicios_favoritos").delete().eq("consumidor_id", req.consumer.id).eq("servicio_id", req.params.id));
    res.json({ success: true });
  }));
  app.put("/browse/favoritos/:slug", auth, limiterRead, route(async (req, res) => {
    const slug = req.params.slug;
    if (!/^[a-z0-9_-]{1,100}$/.test(slug || "")) fail("Negocio inválido.");
    await visibleBusiness(slug);
    result(await supabase.from("consumidor_favoritos").upsert({ consumidor_id: req.consumer.id, slug }, { onConflict: "consumidor_id,slug", ignoreDuplicates: true }));
    res.json({ success: true });
  }));
  app.delete("/browse/favoritos/:slug", auth, limiterRead, route(async (req, res) => {
    const slug = req.params.slug;
    if (!/^[a-z0-9_-]{1,100}$/.test(slug || "")) fail("Negocio inválido.");
    result(await supabase.from("consumidor_favoritos").delete().eq("consumidor_id", req.consumer.id).eq("slug", slug));
    res.json({ success: true });
  }));
  app.get(
    "/browse/me",
    auth,
    route(async (req, res) => {
      const c = req.consumer;
      const [tr, wr, mr] = await Promise.all([
        supabase
          .from("turnos")
          .select(
            "id,slug,fecha,hora,servicio_id,servicio_nombre,equipo_id,equipo_nombre,precio_cobrado,monto_pagado,estado,pago_estado,metodo_pago,browse_tipo,browse_cierre,tc_gastados",
          )
          .eq("consumidor_id", c.id)
          .order("fecha", { ascending: false })
          .order("hora", { ascending: false })
          .limit(400),
        supabase
          .from("tc_billeteras")
          .select("saldo,gasto_centavos")
          .eq("consumidor_id", c.id)
          .maybeSingle(),
        supabase
          .from("tc_movimientos")
          .select("id,monedas,motivo,created_at")
          .eq("consumidor_id", c.id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      const turnos = (result(tr) || []).filter((t) => t.browse_tipo !== "offer" || ["aprobado", "reembolsado"].includes(t.pago_estado)),
        wallet = result(wr);
      res.json({
        success: true,
        perfil: {
          id: c.id,
          nombre_persona: c.nombre_persona,
          apellido: c.apellido,
          email: c.email,
          telefono: c.telefono,
          foto_url: c.foto_url,
          intereses: c.intereses,
        },
        turnos,
        realizados: turnos.filter(
          (t) =>
            t.estado === "confirmado" &&
            new Date(`${t.fecha}T${String(t.hora).slice(0, 5)}:00-03:00`) <
              new Date(),
        ).length,
        billetera: {
          saldo: wallet?.saldo || 0,
          gasto_centavos: wallet?.gasto_centavos || 0,
          movimientos: result(mr) || [],
        },
      });
    }),
  );
  app.get(
    "/browse/identidad",
    auth,
    route(async (req, res) => {
      const {
        id,
        nombre_persona,
        apellido,
        email,
        telefono,
        foto_url,
        intereses,
      } = req.consumer;
      res.json({
        success: true,
        perfil: {
          id,
          nombre_persona,
          apellido,
          email,
          telefono,
          foto_url,
          intereses,
        },
      });
    }),
  );
  app.put(
    "/browse/perfil",
    limiterAuth,
    auth,
    route(async (req, res) => {
      const { nombre_persona, apellido, telefono } = req.body || {};
      if (
        [nombre_persona, apellido].some(
          (v) =>
            typeof v !== "string" ||
            !v.trim() ||
            v.trim().length > 80 ||
            /[\x00-\x1f]/.test(v),
        ) ||
        typeof telefono !== "string" ||
        !/^\+?[0-9]{7,15}$/.test(telefono)
      )
        fail("Revisá tus datos y el teléfono internacional.");
      result(
        await supabase
          .from("consumidores")
          .update({
            nombre_persona: nombre_persona.trim(),
            apellido: apellido.trim(),
            telefono: telefono.replace("+", ""),
          })
          .eq("id", req.consumer.id),
      );
      res.json({ success: true });
    }),
  );
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024 },
    fileFilter: (_req, file, cb) =>
      cb(
        null,
        ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype),
      ),
  }).single("imagen");
  app.post(
    "/browse/perfil/foto",
    limiterAuth,
    auth,
    (req, res, next) =>
      upload(req, res, (e) =>
        e
          ? res.status(400).json({
              success: false,
              error: "Usá una imagen JPG, PNG o WebP de hasta 3 MB.",
            })
          : next(),
      ),
    route(async (req, res) => {
      const f = req.file;
      if (!f) fail("Seleccioná una imagen.");
      const type = f.mimetype.split("/")[1],
        path = `consumidores/${req.consumer.id}/${crypto.randomUUID()}.${type}`;
      result(
        await supabase.storage
          .from("logos")
          .upload(path, f.buffer, { contentType: f.mimetype, upsert: false }),
      );
      const url = supabase.storage.from("logos").getPublicUrl(path)
        .data.publicUrl;
      result(
        await supabase
          .from("consumidores")
          .update({ foto_url: url })
          .eq("id", req.consumer.id),
      );
      res.json({ success: true, url });
    }),
  );
  app.post(
    "/browse/perfil/password",
    limiterAuth,
    auth,
    route(async (req, res) => {
      const { actual, nueva } = req.body || {},
        c = await consumerAccounts.findByEmail(req.consumer.email);
      if (
        typeof actual !== "string" ||
        !(await bcrypt.compare(actual, c.password))
      )
        fail("La contraseña actual no es correcta.", 401);
      if (
        typeof nueva !== "string" ||
        nueva.length < 6 ||
        Buffer.byteLength(nueva) > 72
      )
        fail("Usá una contraseña de entre 6 y 72 bytes.");
      result(
        await supabase
          .from("consumidores")
          .update({
            password: await bcrypt.hash(nueva, 10),
            reset_token: null,
            reset_token_expiry: null,
          })
          .eq("id", c.id),
      );
      res.json({ success: true });
    }),
  );
  app.post(
    "/browse/perfil/eliminar",
    limiterAuth,
    auth,
    route(async (req, res) => {
      const c = await consumerAccounts.findByEmail(req.consumer.email);
      if (
        req.body?.confirmacion !== "ELIMINAR" ||
        typeof req.body.password !== "string" ||
        !(await bcrypt.compare(req.body.password, c.password))
      )
        fail("Confirmá con tu contraseña y la palabra ELIMINAR.", 401);
      result(await supabase.from("consumidores").delete().eq("id", c.id));
      res.json({ success: true });
    }),
  );
  const emailHash = (id, code) =>
    crypto
      .createHmac("sha256", secret)
      .update(`browse-email:${id}:${code}`)
      .digest("hex");
  app.post(
    "/browse/perfil/email",
    limiterAuth,
    auth,
    route(async (req, res) => {
      const c = await consumerAccounts.findByEmail(req.consumer.email),
        email =
          typeof req.body.email === "string"
            ? req.body.email.trim().toLowerCase()
            : "";
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254 ||
        email === c.email
      )
        fail("Ingresá un correo nuevo válido.");
      if (
        typeof req.body.password !== "string" ||
        !(await bcrypt.compare(req.body.password, c.password))
      )
        fail("La contraseña actual no es correcta.", 401);
      const p = result(
        await supabase
          .from("browse_cambios_email")
          .select("enviado")
          .eq("consumidor_id", c.id)
          .maybeSingle(),
      );
      if (p && Date.now() - Date.parse(p.enviado) < 60000)
        fail("Esperá un minuto antes de pedir otro código.", 429);
      const existing = await consumerAccounts.findByEmail(email);
      if (existing)
        fail("Ya existe una cuenta de usuario con ese correo.", 409);
      const codigo = String(crypto.randomInt(100000, 1000000));
      result(
        await supabase.from("browse_cambios_email").upsert(
          {
            consumidor_id: c.id,
            email,
            codigo_hash: emailHash(c.id, codigo),
            intentos: 0,
            vence: new Date(Date.now() + 15 * 60000).toISOString(),
            enviado: new Date().toISOString(),
          },
          { onConflict: "consumidor_id" },
        ),
      );
      await mail({
        action: "verificarCodigo",
        email,
        nombre: c.nombre_persona,
        codigo,
      });
      res.json({ success: true });
    }),
  );
  app.post(
    "/browse/perfil/email/verificar",
    limiterAuth,
    auth,
    route(async (req, res) => {
      if (
        typeof req.body.codigo !== "string" ||
        !/^\d{6}$/.test(req.body.codigo)
      )
        fail("Ingresá el código de seis dígitos.");
      if (
        !result(
          await supabase.rpc("browse_cambiar_email", {
            p_consumidor: req.consumer.id,
            p_hash: emailHash(req.consumer.id, req.body.codigo),
          }),
        )
      )
        fail("Código incorrecto o vencido.");
      res.json({ success: true });
    }),
  );
  app.get(
    "/browse/ofertas",
    limiterRead,
    route(async (req, res) => {
      const configs =
          result(
            await supabase
              .from("turnits_offers")
              .select("*")
              .eq("activo", true)
              .limit(150),
          ) || [];
      const read = requestReads();
      const batches = await mapLimited(configs, 6, async (o) => {
        const offers = [];
        try {
          const ctx = await context(o.slug, o.servicio_id, o.equipo_id, read);
          if (
            ctx.config.agenda_sin_pagos || !ctx.config.mp_access_token ||
            (await read(["commissions", o.slug, ctx.user.plan], () => checkCommissions(o.slug, ctx.user.plan)))
          )
            return offers;
          const duration = Number(ctx.service.duracion || 30),
            lead =
              Number.isInteger(Number(ctx.config.anticipacion_minutos)) &&
              Number(ctx.config.anticipacion_minutos) >= 1
                ? Math.min(43200, Number(ctx.config.anticipacion_minutos))
                : 30;
          for (const today of new Set([
            argentinaDate(new Date(Date.now() + lead * 60000)),
            argentinaDate(new Date(Date.now() + (lead + 60) * 60000)),
          ]))
            for (const [start, end] of intervals(
              ctx.config.horarios,
              ctx.config.excepciones,
              today,
            ) || []) {
              for (let m = start; m + duration <= end; m += duration) {
                const hora = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
                  cierre = new Date(
                    new Date(`${today}T${hora}:00-03:00`).getTime() -
                      lead * 60000,
                  ),
                  remaining = (cierre - Date.now()) / 60000,
                  price = offerPrice(
                    ctx.service.precio,
                    Number(o.precio_minimo),
                    remaining,
                  );
                if (price === null) continue;
                try {
                  await available(
                    o.slug,
                    today,
                    hora,
                    { duracion: duration, capacidad: 1 },
                    ctx.config,
                    ctx.member,
                    ctx.service.id,
                    read,
                  );
                } catch (e) {
                  if (e.promoValidacion) continue;
                  throw e;
                }
                offers.push({
                  id: o.id,
                  slug: o.slug,
                  servicio_id: o.servicio_id,
                  equipo_id: o.equipo_id,
                  sucursal_id: ctx.member.sucursal_id || "principal",
                  nombre: ctx.service.nombre,
                  precio: price,
                  precio_original: ctx.service.precio,
                  precio_minimo: Number(o.precio_minimo),
                  fecha: today,
                  hora,
                  cierre: cierre.toISOString(),
                  imagen: image(ctx.service),
                });
              }
            }
        } catch (e) {
          if (!e.publicMessage && !e.promoValidacion) throw e;
        }
        return offers;
      });
      res.json({
        success: true,
        ofertas: batches.flat(),
        server_time: new Date().toISOString(),
      });
    }),
  );
  // Opening an Offer is read-only. The server supplies the price and validates
  // the exact service, professional and provider's booking deadline.
  async function quoteOffer(id, input) {
    if (!UUID.test(id || "") || !/^\d{4}-\d{2}-\d{2}$/.test(input.fecha || "") || !/^\d{2}:\d{2}$/.test(input.hora || ""))
      fail("Revisá la oferta y el horario.");
    const offer = result(await supabase.from("turnits_offers").select("*").eq("id", id).eq("activo", true).maybeSingle());
    if (!offer || offer.slug !== input.slug || offer.servicio_id !== input.servicio_id || offer.equipo_id !== input.equipo_id)
      fail("Esta oferta ya no está disponible.", 409);
    const ctx = await context(offer.slug, offer.servicio_id, offer.equipo_id);
    if (ctx.config.agenda_sin_pagos || !ctx.config.mp_access_token || await checkCommissions(offer.slug, ctx.user.plan)) fail("El negocio desactivó los cobros o la oferta no admite pagos en este momento.", 409);
    const lead = Number.isInteger(Number(ctx.config.anticipacion_minutos)) && Number(ctx.config.anticipacion_minutos) >= 1 ? Math.min(43200, Number(ctx.config.anticipacion_minutos)) : 30;
    const start = new Date(`${input.fecha}T${input.hora}:00-03:00`);
    const close = new Date(start.getTime() - lead * 60000);
    const price = offerPrice(ctx.service.precio, Number(offer.precio_minimo), (close.getTime() - Date.now()) / 60000);
    if (!Number.isFinite(start.getTime()) || argentinaDate(start) !== input.fecha || price === null) fail("Esta oferta finalizó. Elegí otro horario.", 409);
    const minute = Number(input.hora.slice(0, 2)) * 60 + Number(input.hora.slice(3));
    const duration = Number(ctx.service.duracion || 30);
    if (!(intervals(ctx.config.horarios, ctx.config.excepciones, input.fecha) || []).some(([start, end]) => minute >= start && minute + duration <= end && (minute - start) % duration === 0)) fail("Este horario ya no está disponible.", 409);
    return { ctx, quote: { id: offer.id, slug: offer.slug, servicio_id: offer.servicio_id, equipo_id: offer.equipo_id, sucursal_id: ctx.member.sucursal_id || "principal", fecha: input.fecha, hora: input.hora, precio: price, precio_original: ctx.service.precio, cierre: close.toISOString() } };
  }
  app.get("/browse/ofertas/:id/cotizacion", limiterRead, (req,res,next)=>req.headers.authorization?auth(req,res,next):next(), route(async (req, res) => {
    const { quote } = await quoteOffer(req.params.id, req.query);
    if(req.consumer){
      const held=result(await supabase.from("turnos").select("precio_cobrado").eq("consumidor_id",req.consumer.id).eq("browse_referencia",quote.id).eq("fecha",quote.fecha).eq("hora",quote.hora).eq("estado","pendiente").gt("browse_cierre",new Date().toISOString()).limit(1).maybeSingle());
      if(held)quote.precio=Number(held.precio_cobrado);
    }
    res.set?.("Cache-Control", "no-store");
    res.json({ success: true, oferta: quote });
  }));
  app.post("/browse/ofertas/:id/checkout", limiterBooking, auth, route(async (req, res) => {
    const { ctx, quote } = await quoteOffer(req.params.id, req.body || {});
    const contact = {
      nombre: String(req.body.nombre ?? req.consumer.nombre_persona).trim(),
      apellido: String(req.body.apellido ?? req.consumer.apellido ?? "").trim(),
      telefono: String(req.body.telefono ?? req.consumer.telefono).replace(/\D/g, ""),
      email: String(req.body.email ?? req.consumer.email).trim().toLowerCase(),
    };
    if(contact.nombre.length < 2 || contact.nombre.length > 100 || contact.apellido.length > 100 || !/^\d{5,18}$/.test(contact.telefono) || contact.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) fail("Revisá tus datos de contacto.");
    // Reuse a payment already in progress. A retry must never claim a second
    // slot, nor block its own slot when availability is checked again.
    const pending = result(await supabase.from("turnos").select("*").eq("consumidor_id", req.consumer.id).eq("browse_tipo", "offer").eq("estado", "pendiente").gt("browse_cierre", new Date().toISOString()).order("browse_cierre").limit(1).maybeSingle());
    let turno = pending;
    if (pending && (pending.browse_referencia !== quote.id || pending.fecha !== quote.fecha || String(pending.hora).slice(0, 5) !== quote.hora)) {
      const params = new URLSearchParams({ servicio_id: pending.servicio_id, equipo_id: pending.equipo_id, fecha: pending.fecha, hora: String(pending.hora).slice(0, 5), browse_offer_id: pending.browse_referencia });
      return res.status(409).json({ success: false, error: "Tenés un pago de otra oferta en curso. Podés retomarlo antes de elegir otra.", agenda_url: `/agenda/${encodeURIComponent(pending.slug)}?${params}` });
    }
    if(pending && Number(req.body.precio)!==Number(pending.precio_cobrado))return res.status(409).json({success:false,error:"Ya iniciaste un pago para este horario. Revisá el importe para retomarlo.",oferta:{...quote,precio:Number(pending.precio_cobrado)}});
    if (!turno) {
      // The accepted amount is checked again in the database. URL prices are
      // never used, and the existing booking guard claims the slot atomically.
      if (Number(req.body.precio) !== quote.precio) return res.status(409).json({ success: false, error: "El descuento se actualizó. Revisá el nuevo importe antes de pagar.", oferta: quote });
      await available(quote.slug, quote.fecha, quote.hora, { duracion: Number(ctx.service.duracion || 30), capacidad: 1 }, ctx.config, ctx.member, quote.servicio_id);
      turno = result(await supabase.rpc("browse_reservar", { p_consumidor: req.consumer.id, p_slug: quote.slug, p_servicio: quote.servicio_id, p_equipo: quote.equipo_id, p_fecha: quote.fecha, p_hora: quote.hora, p_recompensa: null, p_offer: quote.id, p_precio: quote.precio, p_cierre: quote.cierre }));
    }
    result(await supabase.from("turnos").update(contact).eq("id", turno.id).eq("consumidor_id", req.consumer.id).eq("estado", "pendiente"));
    res.json(await createCheckout({...turno,...contact}, ctx, false));
  }));
  app.post(
    "/browse/reservar",
    limiterBooking,
    auth,
    route(async (req, res) => {
      const {
        slug,
        servicio_id,
        equipo_id,
        fecha,
        hora,
        recompensa_id,
        oferta_id,
        precio,
      } = req.body || {};
      if (oferta_id) fail("Continuá desde la agenda para pagar esta oferta.", 409);
      if (
        typeof slug !== "string" ||
        !UUID.test(servicio_id || "") ||
        !UUID.test(equipo_id || "") ||
        !/^\d{4}-\d{2}-\d{2}$/.test(fecha || "") ||
        !/^\d{2}:\d{2}$/.test(hora || "") ||
        !!recompensa_id === !!oferta_id ||
        ![recompensa_id, oferta_id].filter(Boolean).every((id) => UUID.test(id))
      )
        fail("Revisá el servicio y el horario.");
      const ctx = await context(slug, servicio_id, equipo_id);
      if (await checkCommissions(slug, ctx.user.plan))
        fail("La agenda está pausada. Contactá al negocio.", 403);
      const inicio = new Date(`${fecha}T${hora}:00-03:00`),
        lead =
          Number.isInteger(Number(ctx.config.anticipacion_minutos)) &&
          Number(ctx.config.anticipacion_minutos) >= 1
            ? Math.min(43200, Number(ctx.config.anticipacion_minutos))
            : 30,
        cierre = new Date(inicio.getTime() - lead * 60000);
      if (!Number.isFinite(inicio.getTime()) || cierre <= new Date())
        fail("Ese horario ya no admite reservas.");
      await available(
        slug,
        fecha,
        hora,
        { duracion: Number(ctx.service.duracion || 30), capacidad: 1 },
        ctx.config,
        ctx.member,
        servicio_id,
      );
      if (oferta_id && !ctx.config.mp_access_token)
        fail(
          "El negocio debe conectar Mercado Pago para ofrecer este horario.",
        );
      if (!Number.isFinite(precio) || precio < 0)
        fail("Revisá el precio de la reserva.");
      const turno = result(
        await supabase.rpc("browse_reservar", {
          p_consumidor: req.consumer.id,
          p_slug: slug,
          p_servicio: servicio_id,
          p_equipo: equipo_id,
          p_fecha: fecha,
          p_hora: hora,
          p_recompensa: recompensa_id || null,
          p_offer: oferta_id || null,
          p_precio: precio,
          p_cierre: oferta_id ? cierre.toISOString() : null,
        }),
      );
      if (!oferta_id) notifyBooking(turno, ctx.user);
      res.status(201).json({
        success: true,
        turno: {
          id: turno.id,
          slug: turno.slug,
          precio_cobrado: turno.precio_cobrado,
          browse_cierre: turno.browse_cierre,
        },
        requiere_pago: !!oferta_id,
      });
    }),
  );
  app.post(
    "/browse/ofertas/:id/pagar",
    limiterBooking,
    auth,
    route(async (req, res) => {
      if (!UUID.test(req.params.id)) fail("Reserva inválida.");
      const t = result(
        await supabase
          .from("turnos")
          .select("*")
          .eq("id", req.params.id)
          .eq("consumidor_id", req.consumer.id)
          .eq("browse_tipo", "offer")
          .maybeSingle(),
      );
      if (!t || t.estado !== "pendiente" || t.pago_estado === "aprobado")
        fail("Esta reserva ya no está pendiente.");
      if (!t.browse_cierre || Date.parse(t.browse_cierre) <= Date.now())
        fail("Finalizó el plazo para pagar esta oferta.");
      const ctx = await context(t.slug, t.servicio_id, t.equipo_id);
      if (await checkCommissions(t.slug, ctx.user.plan))
        fail("La agenda está pausada. Contactá al negocio.", 403);
      res.json(await createCheckout(t, ctx, req.body?.card_checkout === true));
    }),
  );
  app.get(
    "/browse/turnos/:id",
    auth,
    route(async (req, res) => {
      if (!UUID.test(req.params.id)) fail("Turno inválido.");
      const t = result(
        await supabase
          .from("turnos")
          .select(
            "id,slug,nombre,apellido,email,telefono,fecha,hora,servicio_nombre,equipo_nombre,estado,pago_estado,precio_cobrado,monto_pagado,metodo_pago,tipo_cobro,extras,monto_extras,gestion_token,browse_tipo,browse_cierre,tc_gastados",
          )
          .eq("id", req.params.id)
          .eq("consumidor_id", req.consumer.id)
          .maybeSingle(),
      );
      if (!t || (t.browse_tipo === "offer" && !["aprobado", "reembolsado"].includes(t.pago_estado))) fail("Turno no encontrado.", 404);
      res.json({ success: true, turno: t });
    }),
  );
  app.get(
    "/admin/browse/:slug",
    requireAuth,
    owner,
    route(async (req, res) => {
      const slug = req.params.slug;
      const [o, r, s, e, x] = await Promise.all([
        supabase.from("turnits_offers").select("*").eq("slug", slug),
        supabase.from("turnits_recompensas").select("*").eq("slug", slug),
        supabase
          .from("servicios")
          .select("id,nombre,precio,owner_equipo_id,activo,servicio_equipo(equipo_id,precio_override)")
          .eq("slug", slug),
        supabase
          .from("equipo")
          .select("id,nombre,apellido,foto_url,color,activo")
          .eq("slug", slug),
        supabase
          .from("extras")
          .select("id,nombre,precio,activo")
          .eq("slug", slug),
      ]);
      res.json({
        success: true,
        offers: result(o) || [],
        recompensas: result(r) || [],
        servicios: result(s) || [],
        equipo: result(e) || [],
        productos: result(x) || [],
      });
    }),
  );
  app.put(
    "/admin/browse/:slug",
    requireAuth,
    owner,
    route(async (req, res) => {
      const { offers, recompensas } = req.body || {},
        slug = req.params.slug;
      if (
        !Array.isArray(offers) ||
        !Array.isArray(recompensas) ||
        offers.length > 100 ||
        recompensas.length > 100
      )
        fail("Revisá la configuración.");
      const cleanOffers = [],
        cleanRewards = [];
      for (const o of offers) {
        if (
          !UUID.test(o.id || "") ||
          !UUID.test(o.servicio_id || "") ||
          !UUID.test(o.equipo_id || "") ||
          (o.activo !== undefined && typeof o.activo !== "boolean") ||
          !Number.isFinite(o.precio_minimo) ||
          o.precio_minimo <= 0
        )
          fail(
            "Revisá el servicio, profesional y tarifa mínima de cada Offer.",
          );
        const s = result(
            await supabase
              .from("servicios")
              .select("nombre,precio,owner_equipo_id")
              .eq("id", o.servicio_id)
              .eq("slug", slug)
              .maybeSingle(),
          ),
          e = result(
            await supabase
              .from("equipo")
              .select("id,nombre,activo")
              .eq("id", o.equipo_id)
              .eq("slug", slug)
              .maybeSingle(),
          ),
          v = result(
            await supabase
              .from("servicio_equipo")
              .select("precio_override")
              .eq("servicio_id", o.servicio_id)
              .eq("equipo_id", o.equipo_id)
              .maybeSingle(),
          );
        if (
          !s ||
          !e ||
          (o.activo === true && !active(e.activo)) ||
          (s.owner_equipo_id && s.owner_equipo_id !== e.id) ||
          (o.activo === true && o.precio_minimo >= Number(v?.precio_override ?? s.precio))
        )
          fail(
            `Revisá la Offer de ${s?.nombre || "este servicio"} para ${e?.nombre || "el profesional"}: la tarifa mínima debe ser menor a $${Number(v?.precio_override ?? s?.precio ?? 0).toLocaleString("es-AR")}.`,
          );
        cleanOffers.push({
          id: o.id,
          slug,
          servicio_id: o.servicio_id,
          equipo_id: o.equipo_id,
          precio_minimo: o.precio_minimo,
          activo: o.activo === true,
          updated_at: new Date().toISOString(),
        });
      }
      for (const r of recompensas) {
        if (
          !UUID.test(r.id || "") ||
          !["servicio", "producto"].includes(r.tipo) ||
          !UUID.test(r.objeto_id || "") ||
          !UUID.test(r.servicio_id || "") ||
          typeof r.nombre !== "string" ||
          !r.nombre.trim() ||
          r.nombre.length > 100 ||
          !Number.isInteger(r.monedas) ||
          r.monedas < 1 ||
          r.monedas > 100000 ||
          !Number.isFinite(r.copago) ||
          r.copago < 0 ||
          (r.stock !== null && (!Number.isInteger(r.stock) || r.stock < 0)) ||
          typeof r.activo !== "boolean"
        )
          fail("Revisá los datos de las recompensas.");
        const s = result(
            await supabase
              .from("servicios")
              .select("id,precio")
              .eq("id", r.servicio_id)
              .eq("slug", slug)
              .maybeSingle(),
          ),
          object = result(
            await supabase
              .from(r.tipo === "servicio" ? "servicios" : "extras")
              .select("id")
              .eq("id", r.objeto_id)
              .eq("slug", slug)
              .maybeSingle(),
          );
        if (
          !s ||
          !object ||
          (r.tipo === "servicio" && r.objeto_id !== r.servicio_id)
        )
          fail("Elegí elementos de tu propio catálogo.");
        if (r.tipo === "servicio" && r.copago > Number(s.precio))
          fail("El importe adicional no puede superar el precio normal del servicio.");
        cleanRewards.push({
          id: r.id,
          slug,
          nombre: r.nombre.trim(),
          tipo: r.tipo,
          objeto_id: r.objeto_id,
          servicio_id: r.servicio_id,
          monedas: r.monedas,
          copago: r.tipo === "producto" ? 0 : r.copago,
          stock: r.stock,
          activo: r.activo,
          expected_updated_at: r.updated_at || null,
          updated_at: new Date().toISOString(),
        });
      }
      result(
        await supabase.rpc("browse_guardar_config", {
          p_slug: slug,
          p_offers: cleanOffers,
          p_recompensas: cleanRewards,
        }),
      );
      const [savedOffers, savedRewards] = await Promise.all([
        supabase.from("turnits_offers").select("*").eq("slug", slug),
        supabase.from("turnits_recompensas").select("*").eq("slug", slug),
      ]);
      res.json({
        success: true,
        offers: result(savedOffers) || [],
        recompensas: result(savedRewards) || [],
      });
    }),
  );
  return { auth, context };
}
