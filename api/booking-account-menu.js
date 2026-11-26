const PAGE_SIZE = 12;
const read = ({ data, error }) => {
  if (error) throw error;
  return data;
};
const distinct = items => [...new Set(items.filter(Boolean))];

export function registerBookingAccountMenu({ app, supabase, auth, limiterRead, limiterAuth, cleanSlug, tickets, rescheduleUrl, validPhone }) {
  const wrap = handler => async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      await handler(req, res);
    } catch (error) {
      console.error("Menú de cliente:", error.code || error.name);
      res.status(500).json({ success: false, error: "No pudimos cargar o actualizar tu cuenta." });
    }
  };

  app.get("/browse/mi-cuenta/turnos", limiterRead, auth, wrap(async (req, res) => {
    const page = Number(req.query.page || 0);
    if (!Number.isSafeInteger(page) || page < 0 || page > 1000) {
      return res.status(400).json({ success: false, error: "Página de reservas inválida." });
    }
    const offset = page * PAGE_SIZE;
    const consumerId = req.consumer.id;
    const slug = cleanSlug(req.query.slug || "");
    const [rows, plans] = await Promise.all([
      supabase.from("turnos").select("id,slug,servicio_id,servicio_nombre,equipo_id,fecha,hora,estado,gestion_token,browse_tipo,pago_estado")
        .eq("consumidor_id", consumerId).or("browse_tipo.is.null,browse_tipo.neq.offer,pago_estado.in.(aprobado,reembolsado)")
        .order("fecha", { ascending: false }).order("hora", { ascending: false }).order("id").range(offset, offset + PAGE_SIZE).then(read),
      slug && page === 0 ? tickets(slug, consumerId) : [],
    ]);
    const visible = rows.slice(0, PAGE_SIZE);
    const serviceIds = distinct(visible.map(row => row.servicio_id));
    const businessSlugs = distinct(visible.map(row => row.slug));
    const planIds = plans.map(plan => plan.id);
    const [services, businesses, claims] = await Promise.all([
      serviceIds.length ? supabase.from("servicios").select("id,descripcion,slug").in("id", serviceIds).then(read) : [],
      businessSlugs.length ? supabase.from("usuarios").select("slug,business_name").in("slug", businessSlugs).then(read) : [],
      planIds.length ? supabase.from("membresia_canje").select("periodo_id,turno_id,usa_servicio,productos").in("periodo_id", planIds)
        .not("turno_id", "is", null).is("devuelto_at", null).order("vence_at", { ascending: false }).limit(20).then(read) : [],
    ]);
    const claimsIds = distinct(claims.map(claim => claim.turno_id));
    const skuIds = distinct(claims.flatMap(claim => Object.keys(claim.productos)));
    const [visits, products] = await Promise.all([
      claimsIds.length ? supabase.from("turnos").select("id,servicio_nombre,fecha,hora").eq("consumidor_id", consumerId).in("id", claimsIds).then(read) : [],
      skuIds.length ? supabase.from("extras").select("id,nombre").eq("slug", slug).in("id", skuIds).then(read) : [],
    ]);
    const time = row => Date.parse(`${row.fecha}T${String(row.hora).slice(0, 5)}:00-03:00`);
    const reservas = visible.map(row => {
      const service = services.find(item => item.id === row.servicio_id && item.slug === row.slug);
      const upcoming = time(row) >= Date.now() && ["confirmado", "pendiente"].includes(row.estado);
      return {
        id: row.id, servicio: row.servicio_nombre || "Reserva", negocio: businesses.find(item => item.slug === row.slug)?.business_name || row.slug,
        imagen: service?.descripcion?.match(/^\[img:(.*?)\]/s)?.[1]?.trim() || null,
        fecha: row.fecha, hora: row.hora, estado: row.estado, actual: upcoming,
        reprogramar: upcoming && row.gestion_token && !row.browse_tipo ? rescheduleUrl(row.id, row.gestion_token, row.slug) : null,
      };
    });
    const suscripciones = plans.map(plan => ({
      id: plan.id, nombre: plan.nombre,
      tickets: [...Object.values(plan.servicios), ...Object.values(plan.productos)].reduce((sum, amount) => sum + amount, 0),
      usos: claims.filter(claim => claim.periodo_id === plan.id).slice(0, 3).flatMap(claim => {
        const visit = visits.find(row => row.id === claim.turno_id);
        if (!visit) return [];
        return [
          ...(claim.usa_servicio ? [{ nombre: visit.servicio_nombre || "Servicio", cantidad: 1 }] : []),
          ...Object.entries(claim.productos).map(([id, cantidad]) => ({ nombre: products.find(product => product.id === id)?.nombre || "Producto", cantidad })),
        ];
      }).slice(0, 4),
    }));
    res.json({ success: true, reservas, suscripciones, hay_mas: rows.length > PAGE_SIZE });
  }));

  app.patch("/browse/mi-cuenta/datos", limiterAuth, auth, wrap(async (req, res) => {
    const { campo, valor } = req.body || {};
    const allowed = ["nombre_persona", "apellido", "telefono"];
    const sanitized = typeof valor === "string" && campo === "telefono" ? valor.replace(/[\s()-]/g, "") : valor;
    if (!allowed.includes(campo) || typeof valor !== "string" || valor.length > 100 ||
        (campo === "telefono" ? !validPhone(sanitized) : !valor.trim() || valor.trim().length > 80 || /[\x00-\x1f]/.test(valor))) {
      return res.status(400).json({ success: false, error: "Revisá el valor ingresado." });
    }
    const next = campo === "telefono" ? sanitized.replace(/^\+/, "") : valor.trim();
    read(await supabase.from("consumidores").update({ [campo]: next }).eq("id", req.consumer.id));
    res.json({ success: true, valor: next });
  }));
}
