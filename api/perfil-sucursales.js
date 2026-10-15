import crypto from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const faltaSchemaSucursales = (e) =>
  ["42P01", "42703", "PGRST204", "PGRST205", "PGRST202", "42883"].includes(
    e?.code,
  );
export function validarPerfil(body) {
  const limits = {
    nombre: 100,
    descripcion: 1500,
    categoria: 80,
    direccion: 200,
    ciudad: 100,
    provincia: 100,
    telefono_publico: 30,
    instagram: 250,
    sitio_web: 300,
  };
  const data = {};
  for (const [key, max] of Object.entries(limits)) {
    if (typeof body[key] !== "string" || body[key].trim().length > max)
      throw new Error("Revisá los campos del perfil.");
    data[key] = body[key].trim();
  }
  if (!data.nombre) throw new Error("Escribí el nombre del negocio.");
  if (
    data.telefono_publico &&
    !/^[+\d\s()\-]{5,30}$/.test(data.telefono_publico)
  )
    throw new Error("Revisá el teléfono público.");
  if (
    data.instagram &&
    !/^https:\/\/(www\.)?instagram\.com\/[a-z\d_.\/-]+\/?$/i.test(
      data.instagram,
    )
  )
    throw new Error("Usá el enlace completo de Instagram.");
  if (data.sitio_web) {
    const u = new URL(data.sitio_web);
    if (u.protocol !== "https:" || u.username || u.password)
      throw new Error("El sitio web debe comenzar con https://.");
  }
  if (
    typeof body.publicado !== "boolean" ||
    !Array.isArray(body.fotos) ||
    body.fotos.length > 8
  )
    throw new Error("Revisá la publicación y las fotos.");
  data.publicado = body.publicado;
  data.fotos = [...new Set(body.fotos)];
  for (const photo of data.fotos) {
    const u = new URL(photo);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      photo.length > 1200
    )
      throw new Error("Foto inválida.");
  }
  return data;
}
export function crearSucursales({
  app,
  supabase,
  requireAuth,
  cleanSlug,
  isActivo,
  invalidateCache,
  multer,
}) {
  const asyncRoute = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      const schema = faltaSchemaSucursales(e);
      res
        .status(schema ? 409 : e.status || 500)
        .json({
          success: false,
          codigo: schema ? "instalar_perfil_sucursales" : undefined,
          error: schema
            ? "Falta instalar la actualización de Perfil y Sucursales en la base de datos."
            : e.publicMessage ||
              "No se pudo completar el cambio. Volvé a intentarlo.",
        });
    }
  };
  const fail = (message, status = 400) => {
    throw Object.assign(new Error(message), { status, publicMessage: message });
  };
  const premium = (user) =>
    user?.plan === "premium" &&
    isActivo(user.activo) &&
    user.estado_suscripcion !== "suspendido" &&
    (!user.fecha_vencimiento || new Date(user.fecha_vencimiento) > new Date());
  const negocio = async (slug) => {
    const { data, error } = await supabase
      .from("usuarios")
      .select(
        "slug,business_name,logo_url,plan,activo,estado_suscripcion,fecha_vencimiento",
      )
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) fail("Negocio no encontrado.", 404);
    return data;
  };
  const rows = async (slug) => {
    const [{ data: sucursales, error }, { data: equipo, error: ee }] =
      await Promise.all([
        supabase
          .from("sucursales")
          .select("id,nombre,direccion,activo,admin_equipo_id,created_at")
          .eq("slug", slug)
          .order("created_at"),
        supabase
          .from("equipo")
          .select(
            "id,nombre,apellido,foto_url,color,activo,es_dueño,sucursal_id,login_email,login_activado",
          )
          .eq("slug", slug)
          .order("created_at"),
      ]);
    if (error || ee) throw error || ee;
    return { sucursales: sucursales || [], equipo: equipo || [] };
  };
  const owner = (req, res, next) =>
    req.empleado
      ? res
          .status(403)
          .json({
            success: false,
            error: "Sólo el dueño general puede modificar esta configuración.",
          })
      : next();
  const resolverAdmin = async (req) => {
    if (!req.empleado) return null;
    const slug = cleanSlug(req.params.slug || req.auth.slug),
      user = await negocio(slug);
    if (!premium(user)) return null;
    const { data, error } = await supabase
      .from("sucursales")
      .select("id,slug,nombre,direccion,activo")
      .eq("slug", slug)
      .eq("admin_equipo_id", req.empleado.id)
      .eq("activo", true)
      .maybeSingle();
    if (error) {
      if (faltaSchemaSucursales(error)) return null;
      throw error;
    }
    return data;
  };
  const equipoMiddleware = async (req, res, next) => {
    if (
      req.auth.rol !== "superadmin" &&
      [req.body?.slug, req.query?.slug].some(
        (slug) => slug && cleanSlug(slug) !== req.auth.slug,
      )
    )
      return res
        .status(403)
        .json({ success: false, error: "No autorizado para ese negocio." });
    if (!req.empleado) return next();
    try {
      const sucursal = await resolverAdmin(req);
      if (!sucursal)
        return res
          .status(403)
          .json({
            success: false,
            error: "No tenés permiso para administrar esta sucursal.",
          });
      if (req.params.id) {
        const { data, error } = await supabase
          .from("equipo")
          .select("id")
          .eq("id", req.params.id)
          .eq("slug", sucursal.slug)
          .eq("sucursal_id", sucursal.id)
          .eq("es_dueño", false)
          .maybeSingle();
        if (error) throw error;
        if (!data)
          return res
            .status(404)
            .json({
              success: false,
              error: "Miembro no encontrado en tu sucursal.",
            });
      }
      req.sucursalAdmin = sucursal;
      next();
    } catch (e) {
      res
        .status(500)
        .json({
          success: false,
          error: "No se pudo verificar el acceso a la sucursal.",
        });
    }
  };
  app.get(
    "/admin/perfil/:slug",
    requireAuth,
    owner,
    asyncRoute(async (req, res) => {
      const slug = cleanSlug(req.params.slug),
        user = await negocio(slug);
      const { data, error } = await supabase
        .from("negocio_perfiles")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error && !faltaSchemaSucursales(error)) throw error;
      res.json({
        success: true,
        habilitado: !error,
        logo_url: user.logo_url,
        perfil: data || {
          nombre: user.business_name || "",
          descripcion: "",
          categoria: "",
          direccion: "",
          ciudad: "",
          provincia: "",
          telefono_publico: "",
          instagram: "",
          sitio_web: "",
          fotos: [],
          publicado: false,
        },
      });
    }),
  );
  app.put(
    "/admin/perfil/:slug",
    requireAuth,
    owner,
    asyncRoute(async (req, res) => {
      const slug = cleanSlug(req.params.slug);
      let perfil;
      try {
        perfil = validarPerfil(req.body || {});
      } catch (e) {
        fail(e.message);
      }
      // Sólo fotos subidas por este negocio al bucket público; nunca datos de la cuenta.
      const prefix = supabase.storage
        .from("logos")
        .getPublicUrl(`${slug}/perfil/`).data.publicUrl;
      if (
        perfil.fotos.some(
          (url) =>
            !url.startsWith(prefix) || url.slice(prefix.length).includes("/"),
        )
      )
        fail("Subí las fotos desde este perfil.");
      const { data, error } = await supabase
        .from("negocio_perfiles")
        .upsert({ slug, ...perfil, updated_at: new Date().toISOString() })
        .select("*")
        .single();
      if (error) throw error;
      invalidateCache(slug);
      res.json({ success: true, perfil: data });
    }),
  );
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  }).single("foto");
  app.post(
    "/admin/perfil/:slug/foto",
    requireAuth,
    owner,
    (req, res, next) =>
      upload(req, res, (e) =>
        e
          ? res
              .status(400)
              .json({
                success: false,
                error: "Usá una imagen JPG, PNG o WebP de hasta 3 MB.",
              })
          : next(),
      ),
    asyncRoute(async (req, res) => {
      const slug = cleanSlug(req.params.slug),
        b = req.file?.buffer;
      if (!b) fail("Elegí una foto.");
      const type = b.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
        ? "jpg"
        : b
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          ? "png"
          : b.toString("ascii", 0, 4) === "RIFF" &&
              b.toString("ascii", 8, 12) === "WEBP"
            ? "webp"
            : null;
      if (!type) fail("Usá una imagen JPG, PNG o WebP.");
      const { error: pe } = await supabase
        .from("negocio_perfiles")
        .select("slug")
        .eq("slug", slug)
        .limit(1);
      if (pe) throw pe;
      const path = `${slug}/perfil/${crypto.randomUUID()}.${type}`;
      const { error } = await supabase.storage
        .from("logos")
        .upload(path, b, {
          contentType: type === "jpg" ? "image/jpeg" : `image/${type}`,
          upsert: false,
        });
      if (error) throw error;
      res.json({
        success: true,
        url: supabase.storage.from("logos").getPublicUrl(path).data.publicUrl,
      });
    }),
  );
  app.get(
    "/perfil/:slug",
    asyncRoute(async (req, res) => {
      const slug = cleanSlug(req.params.slug),
        user = await negocio(slug);
      if (!isActivo(user.activo)) fail("Perfil no disponible.", 404);
      const { data, error } = await supabase
        .from("negocio_perfiles")
        .select(
          "nombre,descripcion,categoria,direccion,ciudad,provincia,telefono_publico,instagram,sitio_web,fotos",
        )
        .eq("slug", slug)
        .eq("publicado", true)
        .maybeSingle();
      if (error && !faltaSchemaSucursales(error)) throw error;
      if (!data) fail("Perfil no publicado.", 404);
      res.json({
        success: true,
        perfil: { ...data, slug, logo_url: user.logo_url },
      });
    }),
  );
  app.get(
    "/admin/sucursales/:slug",
    requireAuth,
    owner,
    asyncRoute(async (req, res) => {
      const slug = cleanSlug(req.params.slug),
        user = await negocio(slug);
      let data;
      try {
        data = await rows(slug);
      } catch (e) {
        if (!faltaSchemaSucursales(e)) throw e;
        return res.json({
          success: true,
          habilitado: false,
          premium: premium(user),
          sucursales: [],
          equipo: [],
        });
      }
      res.json({
        success: true,
        habilitado: true,
        premium: premium(user),
        ...data,
      });
    }),
  );
  app.put(
    "/admin/sucursales/:slug",
    requireAuth,
    owner,
    asyncRoute(async (req, res) => {
      const slug = cleanSlug(req.params.slug);
      if (!premium(await negocio(slug)))
        fail("Sucursales requiere Premium vigente.", 403);
      const b = req.body || {};
      if (
        (b.id !== null && !UUID.test(b.id)) ||
        typeof b.nombre !== "string" ||
        !b.nombre.trim() ||
        b.nombre.trim().length > 80 ||
        typeof b.direccion !== "string" ||
        b.direccion.length > 200 ||
        typeof b.activo !== "boolean" ||
        !Array.isArray(b.miembros) ||
        b.miembros.length > 500 ||
        b.miembros.some((id) => !UUID.test(id)) ||
        (b.admin_equipo_id !== null && !UUID.test(b.admin_equipo_id))
      )
        fail("Revisá el nombre, la dirección y los miembros de la sucursal.");
      if (b.admin_equipo_id && !b.miembros.includes(b.admin_equipo_id))
        fail("El encargado debe estar asignado a la sucursal.");
      const { data, error } = await supabase.rpc("guardar_sucursal", {
        p_slug: slug,
        p_id: b.id,
        p_nombre: b.nombre.trim(),
        p_direccion: b.direccion.trim(),
        p_activo: b.activo,
        p_admin: b.admin_equipo_id,
        p_miembros: [...new Set(b.miembros)],
      });
      if (error) {
        if (faltaSchemaSucursales(error)) throw error;
        if (error.code === "23505")
          fail("Ya existe una sucursal con ese nombre o ese encargado.");
        if (error.code === "P0001") fail(error.message);
        throw error;
      }
      invalidateCache(slug);
      res.json({ success: true, id: data, ...(await rows(slug)) });
    }),
  );
  // Se devuelve sólo la asignación pública, nunca correos de acceso ni permisos.
  app.get(
    "/sucursales/:slug",
    asyncRoute(async (req, res) => {
      const slug = cleanSlug(req.params.slug),
        user = await negocio(slug);
      if (!isActivo(user.activo)) fail("Negocio no disponible.", 404);
      if (!premium(user)) return res.json({ success: true, sucursales: [] });
      let data;
      try {
        data = await rows(slug);
      } catch (e) {
        if (!faltaSchemaSucursales(e)) throw e;
        return res.json({ success: true, sucursales: [] });
      }
      if (!data.sucursales.length)
        return res.json({ success: true, sucursales: [] });
      const publicas = [
        {
          id: "principal",
          nombre: "Sede principal",
          direccion: "",
          activo: true,
        },
        ...data.sucursales.filter((s) => s.activo),
      ];
      res.json({
        success: true,
        sucursales: publicas.map(({ id, nombre, direccion }) => ({
          id,
          nombre,
          direccion,
          equipo_ids: data.equipo
            .filter(
              (e) =>
                isActivo(e.activo) && (e.sucursal_id || "principal") === id,
            )
            .map((e) => e.id),
        })),
      });
    }),
  );
  app.get(
    "/empleado/:slug/sucursal",
    requireAuth,
    asyncRoute(async (req, res) => {
      const sucursal = await resolverAdmin(req);
      if (!sucursal)
        return res.json({
          success: true,
          sucursal: null,
          equipo: [],
          turnos: [],
        });
      const [{ data: equipo, error }, { data: turnos, error: te }] =
        await Promise.all([
          supabase
            .from("equipo")
            .select("id,nombre,apellido,color,foto_url,activo,login_activado")
            .eq("slug", sucursal.slug)
            .eq("sucursal_id", sucursal.id)
            .order("created_at"),
          supabase
            .from("turnos")
            .select(
              "id,fecha,hora,nombre,apellido,servicio_nombre,equipo_nombre,equipo_id,estado,metodo_pago,pago_estado",
            )
            .eq("slug", sucursal.slug)
            .eq("sucursal_id", sucursal.id)
            .gte(
              "fecha",
              new Date().toLocaleDateString("en-CA", {
                timeZone: "America/Argentina/Buenos_Aires",
              }),
            )
            .neq("estado", "cancelado")
            .order("fecha")
            .order("hora")
            .limit(500),
        ]);
      if (error || te) throw error || te;
      res.json({
        success: true,
        sucursal,
        equipo: equipo || [],
        turnos: turnos || [],
      });
    }),
  );
  const puedeGestionarTurno = async (req, turno) => {
    if (turno.equipo_id === req.empleado?.id) return true;
    const branch = await resolverAdmin(req);
    if (!branch) return false;
    const { data, error } = await supabase
      .from("turnos")
      .select("sucursal_id")
      .eq("id", turno.id)
      .eq("slug", branch.slug)
      .maybeSingle();
    if (error) throw error;
    return data?.sucursal_id === branch.id;
  };
  const filtroEquipoPublico = async (slug, equipo) => {
    const user = await negocio(slug);
    let data;
    try {
      data = await rows(slug);
    } catch (e) {
      if (faltaSchemaSucursales(e)) return equipo;
      throw e;
    }
    const activas = new Set(
      premium(user)
        ? data.sucursales.filter((s) => s.activo).map((s) => s.id)
        : [],
    );
    const permitidos = new Set(
      data.equipo
        .filter((e) => !e.sucursal_id || activas.has(e.sucursal_id))
        .map((e) => e.id),
    );
    return equipo.filter((e) => permitidos.has(e.id));
  };
  const validarEquipoReserva = async (slug, id) => {
    if (!id || !UUID.test(id)) return;
    const { data: miembro, error } = await supabase
      .from("equipo")
      .select("sucursal_id")
      .eq("slug", slug)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      if (faltaSchemaSucursales(error)) return;
      throw error;
    }
    if (!miembro) throw new Error("El profesional no está disponible.");
    if (!miembro.sucursal_id) return;
    const { data: sucursal, error: se } = await supabase
      .from("sucursales")
      .select("id")
      .eq("slug", slug)
      .eq("id", miembro.sucursal_id)
      .eq("activo", true)
      .maybeSingle();
    if (se) throw se;
    if (!sucursal || !premium(await negocio(slug)))
      throw new Error(
        "El profesional o su sucursal no está disponible para nuevas reservas.",
      );
  };
  return {
    equipoMiddleware,
    puedeGestionarTurno,
    filtroEquipoPublico,
    resolverAdmin,
    validarEquipoReserva,
  };
}
