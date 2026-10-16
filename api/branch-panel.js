// Branch administrators keep employee sessions. Their scope is resolved from
// the database on every authenticated request, never from a client-supplied id.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMPTY = "00000000-0000-0000-0000-000000000000";
export function branchQuery(req, query, table = "turnos") {
  const branch = req.sucursalAdmin;
  if (!branch) return query;
  if (table === "finanzas_gastos")
    return query.eq("sucursal_id", branch.registro_id || branch.id);
  return branch.id === "principal"
    ? query.is("sucursal_id", null)
    : query.eq("sucursal_id", branch.id);
}
export function branchMemberQuery(req, query, column = "equipo_id") {
  if (!req.sucursalAdmin) return query;
  return query.in(
    column,
    req.sucursalAdmin.equipo_ids.length
      ? req.sucursalAdmin.equipo_ids
      : [EMPTY],
  );
}
export function branchCatalogQuery(req, query) {
  if (!req.sucursalAdmin) return query;
  return query.or(
    `owner_equipo_id.is.null,owner_equipo_id.in.(${(req.sucursalAdmin.equipo_ids.length ? req.sucursalAdmin.equipo_ids : [EMPTY]).join(",")})`,
  );
}
export function branchRouteAllowed(req) {
  const rules = {
    GET: [
      /^\/sesion\/panel\/[^/]+$/,
      /^\/settings\/[^/]+$/,
      /^\/admin-stats\/[^/]+$/,
      /^\/agenda\/[^/]+$/,
      /^\/admin\/(servicios|extras|promociones|equipo)\/[^/]+$/,
      /^\/admin\/equipo\/[^/]+\/(servicios-disponibles|promociones-disponibles|neto|config)$/,
      /^\/admin\/rendimiento-equipo(?:-resumen)?\/[^/]+$/,
      /^\/admin\/turnos-pendientes\/[^/]+$/,
      /^\/admin\/turnos\/[^/]+\/comprobante$/,
      /^\/admin\/reprogramaciones\/[^/]+$/,
      /^\/finanzas\/[^/]+$/,
      /^\/notificaciones\/[^/]+$/,
    ],
    POST: [
      /^\/admin\/equipo$/,
      /^\/admin\/equipo\/upload-foto$/,
      /^\/admin\/equipo\/[^/]+\/(servicios|promociones)$/,
      /^\/admin\/turnos\/manual$/,
      /^\/finanzas\/[^/]+\/gastos$/,
      /^\/push\/subscribe$/,
    ],
    PUT: [
      /^\/admin\/equipo\/[^/]+$/,
      /^\/admin\/equipo\/[^/]+\/config$/,
      /^\/admin\/equipo\/[^/]+\/servicios\/[^/]+$/,
      /^\/turnos\/[^/]+$/,
      /^\/admin\/reprogramaciones\/[^/]+$/,
      /^\/finanzas\/[^/]+\/gastos\/[^/]+$/,
      /^\/notificaciones\/[^/]+\/leida$/,
      /^\/notificaciones\/[^/]+\/leer-todas$/,
    ],
    DELETE: [
      /^\/admin\/equipo\/[^/]+$/,
      /^\/admin\/equipo\/[^/]+\/(servicios|promociones)\/[^/]+$/,
      /^\/finanzas\/[^/]+\/gastos\/[^/]+$/,
      /^\/notificaciones\/[^/]+$/,
      /^\/push\/subscribe$/,
    ],
  };
  return (rules[req.method] || []).some((pattern) => pattern.test(req.path));
}
export function createBranchPanel({ app, supabase, requireAuth, cleanSlug }) {
  const from = (req, table) => {
    if (!req.sucursalAdmin) return supabase.from(table);
    const build = () => supabase.from(table);
    const filter = (query) => {
      if (["turnos", "equipo", "finanzas_gastos"].includes(table))
        return branchQuery(req, query, table);
      if (["servicio_equipo", "promocion_equipo"].includes(table))
        return branchMemberQuery(req, query);
      if (table === "notificaciones")
        return query.eq("data->>sucursal_id", req.sucursalAdmin.id);
      if (["servicios", "extras", "promociones"].includes(table))
        return branchCatalogQuery(req, query);
      if (table === "reprogramaciones") {
        const column = "turnos.sucursal_id";
        return req.sucursalAdmin.id === "principal"
          ? query.is(column, null)
          : query.eq(column, req.sucursalAdmin.id);
      }
      throw new Error(`Tabla sin alcance de sucursal: ${table}`);
    };
    const scopedData = (data) => {
      if (!["turnos", "equipo", "finanzas_gastos"].includes(table)) return data;
      const row = (value) => ({
        ...value,
        sucursal_id:
          table === "finanzas_gastos"
            ? req.sucursalAdmin.registro_id || req.sucursalAdmin.id
            : req.sucursalAdmin.id === "principal"
              ? null
              : req.sucursalAdmin.id,
      });
      return Array.isArray(data) ? data.map(row) : row(data);
    };
    return {
      select: (columns = "*", options) =>
        filter(
          build().select(
            table === "reprogramaciones"
              ? columns.includes("turnos!inner(")
                ? columns.replace("turnos!inner(", "turnos!inner(sucursal_id,")
                : `${columns},turnos!inner(sucursal_id)`
              : columns,
            options,
          ),
        ),
      // PostgREST cannot filter UPDATE through an unembedded relationship.
      // The guard already checked this exact request's target appointment.
      update: (data) =>
        table === "reprogramaciones"
          ? build()
              .update(data)
              .eq("id", req.sucursalAdmin.reprogramacion_id || EMPTY)
              .eq("slug", req.auth.slug)
          : filter(build().update(data)),
      delete: () => filter(build().delete()),
      insert: (data) => build().insert(scopedData(data)),
      upsert: (data, options) => build().upsert(scopedData(data), options),
    };
  };
  const deny = (
    message = "Esta acción está reservada al dueño general.",
    status = 403,
  ) => Object.assign(new Error(message), { status, publicMessage: message });
  const guard = async (req) => {
    if (!branchRouteAllowed(req)) throw deny();
    const branch = req.sucursalAdmin;
    const { data: members, error } = await branchQuery(
      req,
      supabase.from("equipo").select("id,es_dueño").eq("slug", req.auth.slug),
      "equipo",
    );
    if (error) throw error;
    branch.equipo_ids = (members || []).map((m) => m.id);
    const member = req.path.match(/^\/admin\/equipo\/([^/]+)(?:\/|$)/)?.[1];
    if (req.params.id && member && member !== "upload-foto") {
      const target = (members || []).find((m) => m.id === req.params.id);
      if (!target || (req.method !== "GET" && target.es_dueño))
        throw deny("Integrante no encontrado en tu sucursal.", 404);
      if (
        req.params.id === req.empleado.id &&
        req.path === `/admin/equipo/${req.params.id}` &&
        (req.method === "DELETE" ||
          (req.method === "PUT" &&
            Object.keys(req.body || {}).some(
              (key) =>
                !["slug", "nombre", "apellido", "color", "foto_url"].includes(
                  key,
                ),
            )))
      )
        throw deny("El dueño general administra tu acceso y tu rol.");
    }
    for (const id of [req.query?.equipo_id, req.body?.equipo_id].filter(
      Boolean,
    )) {
      if (!UUID.test(id) || !branch.equipo_ids.includes(id))
        throw deny("Integrante no encontrado en tu sucursal.", 404);
    }
    if (req.path === "/admin/turnos/manual" && !req.body?.equipo_id)
      throw deny("Elegí un profesional de esta sucursal.", 400);
    let turnId;
    if (
      /^\/turnos\//.test(req.path) ||
      /^\/admin\/turnos\/[^/]+\/comprobante$/.test(req.path)
    )
      turnId = req.params.id;
    if (req.method === "PUT" && /^\/admin\/reprogramaciones\//.test(req.path)) {
      const { data: change, error: ce } = await supabase
        .from("reprogramaciones")
        .select("turno_id")
        .eq("id", req.params.id)
        .eq("slug", req.auth.slug)
        .maybeSingle();
      if (ce) throw ce;
      if (!change) throw deny("Solicitud no encontrada.", 404);
      turnId = change.turno_id;
      branch.reprogramacion_id = req.params.id;
    }
    if (turnId) {
      const { data: turn, error: te } = await branchQuery(
        req,
        supabase
          .from("turnos")
          .select("id")
          .eq("id", turnId)
          .eq("slug", req.auth.slug),
      ).maybeSingle();
      if (te) throw te;
      if (!turn) throw deny("Turno no encontrado en tu sucursal.", 404);
    }
    if (
      req.path.endsWith("/config") &&
      req.method === "PUT" &&
      Object.keys(req.body || {}).some(
        (key) =>
          !["slug", "horarios", "excepciones", "anticipacion_minutos"].includes(
            key,
          ),
      )
    )
      throw deny("La configuración de cobros está reservada al dueño general.");
    if (/^\/notificaciones\//.test(req.path) && req.params.id) {
      const { data: notification, error: ne } = await from(
        req,
        "notificaciones",
      )
        .select("id")
        .eq("id", req.params.id)
        .eq("slug", req.auth.slug)
        .maybeSingle();
      if (ne) throw ne;
      if (!notification) throw deny("Notificación no encontrada.", 404);
    }
  };
  app.get("/sesion/panel/:slug", requireAuth, (req, res) => {
    const branch = req.sucursalAdmin;
    res.json({
      success: true,
      tipo: branch ? "admin_sucursal" : req.empleado ? "empleado" : "owner",
      sucursal: branch
        ? {
            id: branch.id,
            nombre: branch.nombre,
            registro_id: branch.registro_id || branch.id,
            equipo_id: req.empleado.id,
            nombre_admin: req.empleado.nombre,
          }
        : null,
    });
  });
  app.get("/admin/equipo/:id/config", requireAuth, async (req, res) => {
    try {
      const slug = cleanSlug(req.query.slug || req.auth.slug);
      const [{ data: member, error }, { data: user, error: ue }] =
        await Promise.all([
          supabase
            .from("equipo")
            .select("id,horarios,excepciones,anticipacion_minutos")
            .eq("id", req.params.id)
            .eq("slug", slug)
            .maybeSingle(),
          supabase
            .from("usuarios")
            .select("horarios,excepciones,anticipacion_minutos,plan")
            .eq("slug", slug)
            .maybeSingle(),
        ]);
      if (error || ue) throw error || ue;
      if (!member || !user)
        return res
          .status(404)
          .json({ success: false, error: "Integrante no encontrado." });
      res.json({
        success: true,
        settings: {
          plan: user.plan,
          horarios: member.horarios ?? user.horarios ?? {},
          excepciones: member.excepciones ?? user.excepciones ?? [],
          anticipacion_minutos:
            member.anticipacion_minutos ?? user.anticipacion_minutos ?? 30,
        },
      });
    } catch {
      res
        .status(500)
        .json({
          success: false,
          error: "No se pudo cargar la disponibilidad.",
        });
    }
  });
  return { guard, from };
}
