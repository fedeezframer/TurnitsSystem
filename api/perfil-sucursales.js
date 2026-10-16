import crypto from "node:crypto";
import {
  SOCIAL_LINKS,
  normalizarEnlaceRed,
} from "../web/src/shared/socials.js";

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
  data.instagram = normalizarEnlaceRed("instagram", data.instagram);
  if (data.instagram.length > 250)
    throw new Error("Revisá el enlace de Instagram.");
  if (body.redes_sociales !== undefined) {
    if (
      !body.redes_sociales ||
      typeof body.redes_sociales !== "object" ||
      Array.isArray(body.redes_sociales) ||
      Object.keys(body.redes_sociales).some(
        (key) =>
          !SOCIAL_LINKS.some((red) => red.key === key && key !== "instagram"),
      )
    )
      throw new Error("Revisá los enlaces de redes sociales.");
    data.redes_sociales = Object.fromEntries(
      Object.entries(body.redes_sociales)
        .map(([key, value]) => [key, normalizarEnlaceRed(key, value)])
        .filter(([, value]) => value),
    );
  }
  if (data.sitio_web) {
    const u = new URL(data.sitio_web);
    if (u.protocol !== "https:" || u.username || u.password)
      throw new Error("El sitio web debe comenzar con https://.");
  }
  if (typeof body.publicado !== "boolean" || !Array.isArray(body.fotos))
    throw new Error("Revisá la publicación y las fotos.");
  data.publicado = body.publicado;
  data.fotos = [...new Set(body.fotos)];
  for (const key of ["foto_perfil_url", "banner_url"]) {
    if (!Object.hasOwn(body, key)) continue;
    if (typeof body[key] !== "string") throw new Error("Imagen inválida.");
    data[key] = body[key].trim();
  }
  for (const photo of [
    ...data.fotos,
    data.foto_perfil_url,
    data.banner_url,
  ].filter((p) => p !== undefined && p !== "")) {
    if (typeof photo !== "string") throw new Error("Foto inválida.");
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
      res.status(schema ? 409 : e.status || 500).json({
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
        "slug,business_name,logo_url,plan,tema,activo,estado_suscripcion,fecha_vencimiento",
      )
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) fail("Negocio no encontrado.", 404);
    return data;
  };
  const leerPerfil = async (slug, publico = false) => {
    const campos = publico
      ? "nombre,descripcion,categoria,direccion,ciudad,provincia,telefono_publico,instagram,sitio_web,fotos"
      : "*";
    const consultar = (columnas) => {
      let q = supabase
        .from("negocio_perfiles")
        .select(columnas)
        .eq("slug", slug);
      if (publico) q = q.eq("publicado", true);
      return q.maybeSingle();
    };
    let result = await consultar(
        campos + ",redes_sociales,foto_perfil_url,banner_url",
      ),
      redes_habilitadas = true,
      imagenes_habilitadas = true;
    if (result.error && faltaSchemaSucursales(result.error)) {
      imagenes_habilitadas = false;
      result = await consultar(campos + ",redes_sociales");
    }
    if (result.error && faltaSchemaSucursales(result.error)) {
      redes_habilitadas = false;
      result = await consultar(campos);
    }
    return { ...result, redes_habilitadas, imagenes_habilitadas };
  };
  const rows = async (slug) => {
    let [{ data: sucursales, error }, { data: equipo, error: ee }] =
      await Promise.all([
        supabase
          .from("sucursales")
          .select(
            "id,nombre,direccion,activo,admin_equipo_id,created_at,es_principal,latitud,longitud",
          )
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
    let mapa_habilitado = !error;
    if (error && faltaSchemaSucursales(error)) {
      const legacy = await supabase
        .from("sucursales")
        .select("id,nombre,direccion,activo,admin_equipo_id,created_at")
        .eq("slug", slug)
        .order("created_at");
      sucursales = legacy.data;
      error = legacy.error;
      mapa_habilitado = false;
    }
    if (error || ee) throw error || ee;
    const principal = (sucursales || []).find((s) => s.es_principal);
    return {
      sucursales: (sucursales || []).filter((s) => !s.es_principal),
      equipo: equipo || [],
      mapa_habilitado,
      principal: principal
        ? { ...principal, registro_id: principal.id, id: "principal" }
        : {
            id: "principal",
            nombre: "Sede principal",
            direccion: "",
            activo: true,
            admin_equipo_id: null,
            latitud: null,
            longitud: null,
          },
    };
  };
  const owner = (req, res, next) =>
    req.empleado
      ? res.status(403).json({
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
      .select("*")
      .eq("slug", slug)
      .eq("admin_equipo_id", req.empleado.id)
      .eq("activo", true)
      .maybeSingle();
    if (error) {
      if (faltaSchemaSucursales(error)) return null;
      throw error;
    }
    if (data && (req.empleado.sucursal_id || null) !== (data.es_principal ? null : data.id)) return null;
    return data?.es_principal
      ? { ...data, registro_id: data.id, id: "principal" }
      : data;
  };
  const idEquipoSede = (sucursal) =>
    sucursal.id === "principal" ? null : sucursal.id;
  const scopeSede = (query, sucursal) =>
    sucursal.id === "principal"
      ? query.is("sucursal_id", null)
      : query.eq("sucursal_id", sucursal.id);
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
        return res.status(403).json({
          success: false,
          error: "No tenés permiso para administrar esta sucursal.",
        });
      if (req.params.id) {
        const { data, error } = await scopeSede(
          supabase
            .from("equipo")
            .select("id")
            .eq("id", req.params.id)
            .eq("slug", sucursal.slug),
          sucursal,
        )
          .eq("es_dueño", false)
          .maybeSingle();
        if (error) throw error;
        if (!data)
          return res.status(404).json({
            success: false,
            error: "Miembro no encontrado en tu sucursal.",
          });
      }
      req.sucursalAdmin = { ...req.sucursalAdmin, ...sucursal };
      next();
    } catch (e) {
      res.status(500).json({
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
      const { data, error, redes_habilitadas, imagenes_habilitadas } =
        await leerPerfil(slug);
      if (error && !faltaSchemaSucursales(error)) throw error;
      res.json({
        success: true,
        habilitado: !error,
        redes_habilitadas,
        imagenes_habilitadas,
        tema: ["basico", "premium"].includes(user.plan) ? user.tema || {} : {},
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
          redes_sociales: {},
          fotos: [],
          foto_perfil_url: user.logo_url || "",
          banner_url: "",
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
      const user = await negocio(slug);
      let perfil;
      try {
        perfil = validarPerfil(req.body || {});
      } catch (e) {
        fail(e.message);
      }
      const existente = await leerPerfil(slug);
      if (existente.error) throw existente.error;
      if (!existente.redes_habilitadas) {
        if (Object.keys(perfil.redes_sociales || {}).length)
          fail(
            "Falta instalar la actualización de redes sociales del perfil.",
            409,
          );
        delete perfil.redes_sociales;
      } else if (!Object.hasOwn(perfil, "redes_sociales"))
        perfil.redes_sociales = existente.data?.redes_sociales || {};
      for (const key of ["foto_perfil_url", "banner_url"]) {
        if (!existente.imagenes_habilitadas) {
          if (perfil[key])
            fail(
              "Falta instalar la actualización de imágenes del perfil.",
              409,
            );
          delete perfil[key];
        } else if (!Object.hasOwn(perfil, key))
          perfil[key] = existente.data
            ? existente.data[key] || ""
            : key === "foto_perfil_url"
              ? user.logo_url || ""
              : "";
      }
      if (!existente.imagenes_habilitadas && perfil.fotos.length > 8)
        fail(
          "Falta instalar la actualización de imágenes para ampliar la galería.",
          409,
        );
      // Sólo fotos subidas por este negocio al bucket público; nunca datos de la cuenta.
      const prefix = supabase.storage
        .from("logos")
        .getPublicUrl(`${slug}/perfil/`).data.publicUrl;
      if (
        [...perfil.fotos, perfil.banner_url]
          .filter(Boolean)
          .some(
            (url) =>
              !url.startsWith(prefix) || url.slice(prefix.length).includes("/"),
          )
      )
        fail("Subí las fotos desde este perfil.");
      if (
        perfil.foto_perfil_url &&
        perfil.foto_perfil_url !== user.logo_url &&
        (!perfil.foto_perfil_url.startsWith(prefix) ||
          perfil.foto_perfil_url.slice(prefix.length).includes("/"))
      )
        fail("Subí la foto desde este perfil.");
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
          ? res.status(400).json({
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
      const { error } = await supabase.storage.from("logos").upload(path, b, {
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
      const { data, error } = await leerPerfil(slug, true);
      if (error && !faltaSchemaSucursales(error)) throw error;
      if (!data) fail("Perfil no publicado.", 404);
      res.json({
        success: true,
        perfil: {
          ...data,
          slug,
          tema: ["basico", "premium"].includes(user.plan)
            ? user.tema || {}
            : {},
        },
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
        (b.id !== null && b.id !== "principal" && !UUID.test(b.id)) ||
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
      const mapa =
        Object.hasOwn(b, "latitud") ||
        Object.hasOwn(b, "longitud") ||
        b.id === "principal";
      if (
        mapa &&
        !(
          (b.latitud === null && b.longitud === null) ||
          (typeof b.latitud === "number" &&
            Number.isFinite(b.latitud) &&
            Math.abs(b.latitud) <= 90 &&
            typeof b.longitud === "number" &&
            Number.isFinite(b.longitud) &&
            Math.abs(b.longitud) <= 180)
        )
      )
        fail(
          "Marcá una ubicación válida en el mapa o quitá ambas coordenadas.",
        );
      if (b.id && b.id !== "principal") {
        const { data: existing, error: existingError } = await supabase
          .from("sucursales")
          .select("*")
          .eq("slug", slug)
          .eq("id", b.id)
          .maybeSingle();
        if (existingError) throw existingError;
        if (!existing || existing.es_principal)
          fail("Sucursal no encontrada.", 404);
      }
      const { data, error } = await supabase.rpc(
        mapa ? "guardar_sucursal_mapa" : "guardar_sucursal",
        {
          p_slug: slug,
          p_id: b.id === "principal" ? null : b.id,
          p_nombre: b.nombre.trim(),
          p_direccion: b.direccion.trim(),
          p_activo: b.activo,
          p_admin: b.admin_equipo_id,
          p_miembros: [...new Set(b.miembros)],
          ...(mapa
            ? {
                p_principal: b.id === "principal",
                p_latitud: b.latitud,
                p_longitud: b.longitud,
              }
            : {}),
        },
      );
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
      if (!data.sucursales.length && !data.principal.registro_id)
        return res.json({ success: true, sucursales: [] });
      const publicas = [
        ...(data.principal.activo ? [data.principal] : []),
        ...data.sucursales.filter((s) => s.activo),
      ];
      res.json({
        success: true,
        sucursales: publicas.map(
          ({ id, nombre, direccion, latitud, longitud }) => ({
            id,
            nombre,
            direccion,
            latitud: latitud ?? null,
            longitud: longitud ?? null,
            equipo_ids: data.equipo
              .filter(
                (e) =>
                  isActivo(e.activo) && (e.sucursal_id || "principal") === id,
              )
              .map((e) => e.id),
          }),
        ),
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
          scopeSede(
            supabase
              .from("equipo")
              .select(
                "id,nombre,apellido,color,foto_url,activo,login_activado,es_dueño",
              )
              .eq("slug", sucursal.slug),
            sucursal,
          ).order("created_at"),
          scopeSede(
            supabase
              .from("turnos")
              .select(
                "id,fecha,hora,nombre,apellido,servicio_nombre,equipo_nombre,equipo_id,estado,metodo_pago,pago_estado",
              )
              .eq("slug", sucursal.slug),
            sucursal,
          )
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
    return !!data && (data.sucursal_id || "principal") === branch.id;
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
        .filter((e) =>
          e.sucursal_id
            ? activas.has(e.sucursal_id)
            : !premium(user) || data.principal.activo,
        )
        .map((e) => e.id),
    );
    return equipo.filter((e) => permitidos.has(e.id));
  };
  const validarEquipoReserva = async (slug, id) => {
    if (!id || !UUID.test(id)) {
      const user = await negocio(slug);
      if (!premium(user)) return;
      const data = await rows(slug);
      if (!data.principal.activo)
        throw new Error(
          "La sede principal no está disponible para nuevas reservas.",
        );
      return;
    }
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
    if (!miembro.sucursal_id) {
      const user = await negocio(slug);
      if (!premium(user)) return;
      const data = await rows(slug);
      if (!data.principal.activo)
        throw new Error(
          "La sede principal no está disponible para nuevas reservas.",
        );
      return;
    }
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
    idEquipoSede,
  };
}
