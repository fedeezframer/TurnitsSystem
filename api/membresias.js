const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const FIELDS = "id,nombre,descripcion,precio_mensual,servicio_ids,producto_ids,publicado,imagen_url,cantidades_servicios";
const CATALOGS = [["servicios", "servicio_ids"], ["extras", "producto_ids"]];

function parseUrl(value) {
  try { return new URL(value); } catch { return null; }
}

export function registerMembresias({ app, supabase, requireAuth, cleanSlug, isActivo, diasHastaVencer }) {
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

  async function catalog(slug) {
    const results = await Promise.all(CATALOGS.map(([table]) =>
      supabase.from(table).select("id,nombre,activo").eq("slug", slug).order("nombre")
    ));
    return results.map(({ data, error }) => {
      if (error) throw error;
      return new Map(data.map(item => [item.id, item]));
    });
  }

  app.get(path, requireAuth, ownerOnly, handle(async (req, res, slug) => {
    const [{ data, error }, [services, products]] = await Promise.all([
      supabase.from("membresias").select(FIELDS).eq("slug", slug).order("created_at", { ascending: false }),
      catalog(slug),
    ]);
    if (error) throw error;
    res.json({ success: true, membresias: data, servicios: [...services.values()], productos: [...products.values()] });
  }));

  const save = handle(async (req, res, slug) => {
    const { id } = req.params;
    const { nombre, descripcion, precio_mensual, servicio_ids, producto_ids, publicado, imagen_url, cantidades_servicios } = req.body || {};
    const validIds = ids => Array.isArray(ids) && ids.length <= 100 &&
      ids.every(value => typeof value === "string" && UUID.test(value)) &&
      new Set(ids.map(value => value.toLowerCase())).size === ids.length;
    if ((id && !UUID.test(id)) || typeof nombre !== "string" || !nombre.trim() || nombre.trim().length > 100 ||
        typeof descripcion !== "string" || descripcion.length > 600 || typeof publicado !== "boolean" ||
        typeof precio_mensual !== "number" || !/^\d{1,10}(?:\.\d{1,2})?$/.test(String(precio_mensual)) || precio_mensual <= 0 ||
        !validIds(servicio_ids) || !validIds(producto_ids) || servicio_ids.length + producto_ids.length > 100 ||
        servicio_ids.length + producto_ids.length === 0) {
      return res.status(400).json({ success: false, error: "Completá el nombre, un precio mensual válido y entre 1 y 100 elementos del catálogo." });
    }

    const payload = {
      nombre: nombre.trim(), descripcion: descripcion.trim(), precio_mensual, publicado,
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

    if (cantidades_servicios !== undefined) {
      const selection = new Set(payload.servicio_ids);
      if (!cantidades_servicios || typeof cantidades_servicios !== "object" || Array.isArray(cantidades_servicios) ||
          Object.entries(cantidades_servicios).some(([key, amount]) =>
            !selection.has(key) || !Number.isInteger(amount) || amount < 1 || amount > 99)) {
        return res.status(400).json({ success: false, error: "Cada servicio debe incluir entre 1 y 99 usos al mes." });
      }
      payload.cantidades_servicios = cantidades_servicios;
    }

    const maps = await catalog(slug);
    const valid = CATALOGS.every(([, field], index) => payload[field].every(value => maps[index].get(value)?.activo === true));
    if (!valid) {
      return res.status(400).json({ success: false, error: "Elegí servicios y productos activos de tu catálogo." });
    }

    const table = supabase.from("membresias");
    const query = id ? table.update(payload).eq("slug", slug).eq("id", id) : table.insert({ ...payload, slug });
    const { data, error } = await query.select(FIELDS).maybeSingle();
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

  app.get("/membresias/:slug", handle(async (req, res, slug) => {
    const { data: plans, error } = await supabase.from("membresias").select(FIELDS)
      .eq("slug", slug).eq("publicado", true).order("created_at", { ascending: false });
    if (error) throw error;
    if (!plans.length) return res.json({ success: true, membresias: [] });

    const [{ data: business, error: businessError }, maps] = await Promise.all([
      supabase.from("usuarios").select("activo,estado_suscripcion,fecha_vencimiento").eq("slug", slug).maybeSingle(),
      catalog(slug),
    ]);
    if (businessError) throw businessError;
    if (!isActivo(business?.activo) || business.estado_suscripcion === "suspendido" ||
        (business.fecha_vencimiento && diasHastaVencer(business.fecha_vencimiento) <= 0)) {
      return res.json({ success: true, membresias: [] });
    }

    const membresias = plans.flatMap(({ id, nombre, descripcion, precio_mensual, imagen_url, cantidades_servicios, ...plan }) => {
      const [servicios, productos] = CATALOGS.map(([, field], index) => plan[field].map(key => maps[index].get(key)));
      if ([...servicios, ...productos].some(item => !item?.activo)) return [];
      const servicios_incluidos = servicios.map(item => ({
        nombre: item.nombre, cantidad: cantidades_servicios[item.id] ?? 1,
      }));
      return [{
        id, nombre, descripcion, precio_mensual, imagen_url, servicios_incluidos,
        servicios: servicios.map(item => item.nombre), productos: productos.map(item => item.nombre),
      }];
    });
    res.json({ success: true, membresias });
  }));
}
