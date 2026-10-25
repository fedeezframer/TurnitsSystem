import jwt from "jsonwebtoken";

const audience = "turnits-receipt";
const fields = "id,slug,nombre,apellido,fecha,hora,servicio_nombre,equipo_nombre,precio_cobrado,monto_pagado,porcentaje_sena,tipo_cobro,metodo_pago,pago_estado,estado,fecha_pago,extras,monto_extras,tc_gastados";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Separate signing context: a receipt capability can never become a session.
export function createReceiptAccess({ secret, supabase, consumerAccounts }) {
  const key = () => {
    const value = typeof secret === "function" ? secret() : secret;
    if (!value) throw new Error("Receipt signing secret is missing");
    return value;
  };
  function issue({ slug, turnoId, pendingId }) {
    if (!slug || (!turnoId && !pendingId)) throw new Error("Receipt scope is missing");
    return jwt.sign({ slug, ...(turnoId ? { turnoId } : { pendingId }) }, key() + ":receipt", {
      algorithm: "HS256", audience, expiresIn: "30d",
    });
  }
  function url(base, scope) {
    const value = new URL(base);
    value.searchParams.set("slug", scope.slug);
    if (scope.turnoId) value.searchParams.set("turno_id", scope.turnoId);
    value.searchParams.set("receipt_token", issue(scope));
    return value.toString();
  }
  async function identity(req) {
    const receiptToken = req.headers["x-receipt-token"] || req.query.receipt_token;
    if (receiptToken) {
      const scope = jwt.verify(receiptToken, key() + ":receipt", { algorithms: ["HS256"], audience });
      if (typeof scope.slug !== "string" || (!scope.turnoId && !scope.pendingId)) throw new Error("Invalid receipt scope");
      return { kind: "receipt", ...scope };
    }
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new Error("Missing receipt credentials");
    const scope = jwt.verify(header.slice(7), key(), { algorithms: ["HS256"] });
    if (scope.rol === "consumidor" && scope.consumidorId) {
      const user = await consumerAccounts.findById(scope.consumidorId);
      if (user?.activo === true && user.email_verificado === true) return { kind: "consumer", consumerId: user.id };
    }
    if (scope.rol === "owner" && scope.slug) {
      const { data, error } = await supabase.from("usuarios").select("id,activo").eq("slug", scope.slug).maybeSingle();
      if (error) throw error;
      if (data && [true, "true"].includes(data.activo) && data.id === scope.negocioId) return { kind: "owner", slug: scope.slug };
    }
    throw new Error("Unauthorized receipt session");
  }
  function handler(byPayment = false) {
    return async (req, res) => {
      res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
      let access;
      try { access = await identity(req); }
      catch { return res.status(401).json({ success: false, error: "El comprobante requiere un enlace válido o una sesión autorizada." }); }
      const slug = req.query.slug;
      const id = byPayment ? req.query.payment_id : req.params.id;
      if (typeof slug !== "string" || !/^[a-z0-9_-]{1,100}$/.test(slug) ||
          typeof id !== "string" || (byPayment ? !/^\d{1,30}$/.test(id) : !uuid.test(id))) {
        return res.status(400).json({ success: false, error: "Parámetros inválidos." });
      }
      if ((access.kind === "receipt" || access.kind === "owner") && access.slug !== slug) {
        return res.status(403).json({ success: false, error: "No autorizado para este comprobante." });
      }
      try {
        let query = supabase.from("turnos").select(fields).eq("slug", slug).eq(byPayment ? "payment_id" : "id", id);
        if (access.kind === "consumer") query = query.eq("consumidor_id", access.consumerId);
        if (access.kind === "receipt") {
          if (access.turnoId) query = query.eq("id", access.turnoId);
          else {
            const { data: pending, error } = await supabase.from("pagos_pendientes")
              .select("payment_id,browse_turno_id").eq("id", access.pendingId).eq("slug", slug).maybeSingle();
            if (error) throw error;
            if (!pending || (!pending.browse_turno_id && !pending.payment_id)) return res.status(404).json({ success: false, error: "Comprobante no disponible." });
            query = pending.browse_turno_id ? query.eq("id", pending.browse_turno_id) : query.eq("payment_id", String(pending.payment_id));
          }
        }
        const { data: turno, error } = await query.maybeSingle();
        if (error) throw error;
        if (!turno) return res.status(404).json({ success: false, error: "Comprobante no disponible." });
        return res.json({ success: true, turno: { ...turno, monto_pendiente_local: Math.max(Number(turno.precio_cobrado || 0) - Number(turno.monto_pagado || 0), 0) } });
      } catch {
        return res.status(500).json({ success: false, error: "No se pudo consultar el comprobante." });
      }
    };
  }
  return { issue, url, handler };
}
