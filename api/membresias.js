const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const FIELDS = "id,nombre,descripcion,precio_mensual,servicio_ids,producto_ids,publicado,imagen_url,cantidades_servicios,cantidades_productos,profesional_ids";
const CATALOGS = [["servicios", "servicio_ids"], ["extras", "producto_ids"]];

function parseUrl(value) {
  try { return new URL(value); } catch { return null; }
}

export function registerMembresias({ app, supabase, requireAuth, cleanSlug, isActivo, diasHastaVencer, catalogoConProfesionales }) {
  const path = "/admin/membresias/:slug";

  const handle = (action) => async (req, res) => {
    const slug = cleanSlug(req.params.slug);
    res.set("Cache-Control", "no-store");
    if (!slug) return res.status(400).json({ success: false, error: "Negocio inválido." });
    try {
      return await action(req, res, slug);
    } catch (error) {
      console.error("Membresías:", error.code || error.name);
      return res.status(500).json({ success: false, error: "No pudimos completar la operación." });
    }
  };

  const ownerOnly = (req, res, next) => {
    if (req.empleado || req.sucursalAdmin) {
      return res.status(403).json({ success: false, error: "Solo el titular puede administrar las suscripciones." });
    }
    next();
  };

  async function catalog(slug, includeTeam = false) {
    const base = "id,nombre,activo,precio,descripcion,owner_equipo_id";
    const [services, products, team] = await Promise.all([
      supabase.from("servicios").select(base).eq("slug", slug).order("nombre"),
      supabase.from("extras").select(base + ",imagen_url").eq("slug", slug).order("nombre"),
      includeTeam ? supabase.from("equipo").select("id,nombre,apellido,foto_url,color").eq("slug", slug).eq("activo", true).order("nombre") : { data: [] },
    ]);
    for (const result of [services, products, team]) if (result.error) throw result.error;
    const enriched = await catalogoConProfesionales(slug, services.data, "servicio");
    return {
      maps: [enriched, products.data].map(items => new Map(items.map(item => [item.id, item]))),
      team: team.data,
    };
  }

  const offersAll = (services, serviceIds, memberId) =>
    serviceIds.every(id => services.get(id)?.profesionales.some(person => person.id === memberId));

  app.get(path, requireAuth, ownerOnly, handle(async (req, res, slug) => {
    const [{ data, error }, { maps: [services, products], team }] = await Promise.all([
      supabase.from("membresias").select(FIELDS).eq("slug", slug).order("created_at", { ascending: false }),
      catalog(slug, true),
    ]);
    if (error) throw error;
    res.json({ success: true, membresias: data, servicios: [...services.values()], productos: [...products.values()], equipo: team });
  }));

  const save = handle(async (req, res, slug) => {
    const { id } = req.params;
    const { nombre, descripcion, precio_mensual, servicio_ids, producto_ids, publicado, imagen_url, cantidades_servicios, cantidades_productos, profesional_ids, id_creacion } = req.body || {};
    const validIds = ids => Array.isArray(ids) && ids.length <= 100 &&
      ids.every(value => typeof value === "string" && UUID.test(value)) &&
      new Set(ids.map(value => value.toLowerCase())).size === ids.length;
    if ((id && !UUID.test(id)) || typeof nombre !== "string" || !nombre.trim() || nombre.trim().length > 100 ||
        typeof descripcion !== "string" || descripcion.length > 600 ||
        ((!id || publicado !== undefined) && typeof publicado !== "boolean") ||
        (id_creacion !== undefined && (id || typeof id_creacion !== "string" || !UUID.test(id_creacion))) ||
        typeof precio_mensual !== "number" || !/^\d{1,10}(?:\.\d{1,2})?$/.test(String(precio_mensual)) || precio_mensual <= 0 ||
        !validIds(servicio_ids) || !validIds(producto_ids) || servicio_ids.length + producto_ids.length > 100 ||
        servicio_ids.length + producto_ids.length === 0) {
      return res.status(400).json({ success: false, error: "Completá el nombre, un precio mensual válido y entre 1 y 100 elementos del catálogo." });
    }

    const payload = {
      nombre: nombre.trim(), descripcion: descripcion.trim(), precio_mensual,
      ...(publicado === undefined ? {} : { publicado }),
      servicio_ids: servicio_ids.map(value => value.toLowerCase()),
      producto_ids: producto_ids.map(value => value.toLowerCase()),
    };
    if (imagen_url !== undefined) {
      if (imagen_url === null) {
        payload.imagen_url = null;
      } else {
        const image = typeof imagen_url === "string" ? parseUrl(imagen_url) : null;
        const storage = parseUrl(supabase.supabaseUrl || "");
        if (!image || !storage || image.origin !== storage.origin || image.username || image.password ||
            image.search || image.hash || !/^\/storage\/v1\/object\/public\/servicios\/[^/]+\/\d+\.(?:png|webp|jpg)$/.test(image.pathname)) {
          return res.status(400).json({ success: false, error: "Subí una imagen desde el editor de la suscripción." });
        }
        payload.imagen_url = image.href;
      }
    }

    for (const [field, amounts, ids] of [
      ["cantidades_servicios", cantidades_servicios, payload.servicio_ids],
      ["cantidades_productos", cantidades_productos, payload.producto_ids],
    ]) {
      if (amounts === undefined) continue;
      const selection = new Set(ids);
      if (!amounts || typeof amounts !== "object" || Array.isArray(amounts) ||
          Object.entries(amounts).some(([key, amount]) =>
            !selection.has(key) || !Number.isInteger(amount) || amount < 1 || amount > 99)) {
        return res.status(400).json({ success: false, error: "Cada servicio o producto debe incluir entre 1 y 99 unidades." });
      }
      payload[field] = amounts;
    }

    if (profesional_ids !== undefined && !validIds(profesional_ids)) {
      return res.status(400).json({ success: false, error: "La selección de profesionales es inválida." });
    }
    const { maps, team } = await catalog(slug, Boolean(profesional_ids?.length));
    const valid = CATALOGS.every(([, field], index) => payload[field].every(value => maps[index].get(value)?.activo === true));
    if (!valid) {
      return res.status(400).json({ success: false, error: "Elegí servicios y productos activos de tu catálogo." });
    }

    if (profesional_ids !== undefined) {
      payload.profesional_ids = profesional_ids.map(value => value.toLowerCase());
      const active = new Set(team.map(person => person.id));
      if (!payload.profesional_ids.every(member => active.has(member) && offersAll(maps[0], payload.servicio_ids, member))) {
        return res.status(400).json({ success: false, error: "Elegí profesionales activos que ofrezcan todos los servicios incluidos." });
      }
    }

    const table = supabase.from("membresias");
    const query = id ? table.update(payload).eq("slug", slug).eq("id", id)
      : table.insert({ ...payload, slug, ...(id_creacion ? { id: id_creacion } : {}) });
    let { data, error } = await query.select(FIELDS).maybeSingle();
    if (error?.code === "23505" && id_creacion) {
      // Reintentar un alta del guardado global conserva el mismo ID.
      ({ data, error } = await supabase.from("membresias").update(payload)
        .eq("slug", slug).eq("id", id_creacion).select(FIELDS).maybeSingle());
    }
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: "Suscripción no encontrada." });
    res.status(id ? 200 : 201).json({ success: true, membresia: data });
  });
  app.post(path, requireAuth, ownerOnly, save);
  app.put(path + "/:id", requireAuth, ownerOnly, save);

  app.put(path + "/:id/despublicar", requireAuth, ownerOnly, handle(async (req, res, slug) => {
    const { id } = req.params;
    if (!UUID.test(id)) return res.status(400).json({ success: false, error: "Suscripción inválida." });
    const { data, error } = await supabase.from("membresias").update({ publicado: false })
      .eq("slug", slug).eq("id", id).select(FIELDS).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: "Suscripción no encontrada." });
    res.json({ success: true, membresia: data });
  }));

  app.delete(path + "/:id", requireAuth, ownerOnly, handle(async (req, res, slug) => {
    const { id } = req.params;
    if (!UUID.test(id)) return res.status(400).json({ success: false, error: "Suscripción inválida." });
    const { error } = await supabase.from("membresias").delete().eq("slug", slug).eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  }));

  app.get("/membresias/:slug", handle(async (req, res, slug) => {
    const { data: plans, error } = await supabase.from("membresias").select(FIELDS)
      .eq("slug", slug).eq("publicado", true).order("created_at", { ascending: false });
    if (error) throw error;
    if (!plans.length) return res.json({ success: true, membresias: [] });

    const [{ data: business, error: businessError }, { maps, team }] = await Promise.all([
      supabase.from("usuarios").select("activo,estado_suscripcion,fecha_vencimiento").eq("slug", slug).maybeSingle(),
      catalog(slug, plans.some(plan => plan.profesional_ids.length > 0)),
    ]);
    if (businessError) throw businessError;
    if (!isActivo(business?.activo) || business.estado_suscripcion === "suspendido" ||
        (business.fecha_vencimiento && diasHastaVencer(business.fecha_vencimiento) <= 0)) {
      return res.json({ success: true, membresias: [] });
    }

    const membresias = plans.flatMap(({ id, nombre, descripcion, precio_mensual, imagen_url, cantidades_servicios, cantidades_productos, ...plan }) => {
      const [servicios, productos] = CATALOGS.map(([, field], index) => plan[field].map(key => maps[index].get(key)));
      if ([...servicios, ...productos].some(item => !item?.activo)) return [];
      const servicios_incluidos = servicios.map(item => ({
        nombre: item.nombre, cantidad: cantidades_servicios[item.id] ?? 1,
      }));
      const precio_original = servicios.reduce((sum, item) => sum + (Number(item.precio) || 0) * (cantidades_servicios[item.id] ?? 1), 0) +
        productos.reduce((sum, item) => sum + (Number(item.precio) || 0) * (cantidades_productos[item.id] ?? 1), 0);
      const productos_incluidos = productos.map(item => ({
        nombre: item.nombre, cantidad: cantidades_productos[item.id] ?? 1,
      }));
      const portada = [...servicios].sort((a, b) => (cantidades_servicios[b.id] ?? 1) - (cantidades_servicios[a.id] ?? 1))
        .map(item => item.imagen_url || item.descripcion?.match(/^\[img:(.*?)\]/s)?.[1]?.trim()).find(Boolean);
      const profesionales = team.filter(person => plan.profesional_ids.includes(person.id) && offersAll(maps[0], plan.servicio_ids, person.id))
        .map(({ nombre, apellido }) => [nombre, apellido].filter(Boolean).join(" "));
      return [{
        id, nombre, descripcion, precio_mensual, precio_original, imagen_url: imagen_url || portada || null, servicios_incluidos, productos_incluidos, profesionales,
        servicios: servicios.map(item => item.nombre), productos: productos.map(item => item.nombre),
      }];
    });
    res.json({ success: true, membresias });
  }));
}
