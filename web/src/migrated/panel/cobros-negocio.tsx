import React, { useEffect, useState } from "react";
import {
  MercadoPagoConexion_getSlug as getSlug,
  MercadoPagoConexion_getToken as getToken,
} from "./common";
import { costos, type Regla } from "./costos";
import "./cobros-negocio.css";

const acreditacion = [
  ["al instante", 6.6],
  ["en 10 días", 4.6],
  ["en 18 días", 3.35],
  ["en 35 días", 1.56],
] as const;
const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});
const planes = { gratis: "Gratis", basico: "Básico", premium: "Premium" };
const secciones = ["Calcular costos", "Tipo de cobro", "Métodos de pago"];
const metodos = ["Mercado Pago", "Transferencia", "Efectivo"];
type Config = {
  plan: string;
  planes: Record<string, Regla>;
  porcentaje_sena: number;
  metodo_pago: string;
  agenda_sin_pagos: boolean;
  acepta_efectivo: boolean;
  acepta_transferencia: boolean;
  cbu_final: string;
  mp_conectado: boolean;
};

async function json(url: string, init: RequestInit = {}) {
  const token = getToken();
  if (!token) throw Error("Volvé a ingresar al panel.");
  const res = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: "Bearer " + token,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok)
    throw Error(
      res.status === 503 && res.headers.get("X-Turnits-Environment") === "staging" && url.includes("/mp/connect/")
        ? "Staging tiene deshabilitada la vinculación real con Mercado Pago."
        : res.status === 401
        ? "Tu sesión venció."
        : "El servidor rechazó la operación (" + res.status + ").",
    );
  if (!res.headers.get("content-type")?.includes("application/json"))
    throw Error("Respuesta inesperada del servidor.");
  const data = await res.json();
  if (data.success === false) throw Error("No se pudo completar la operación.");
  return data;
}
function Calculadora({
  config,
  api,
  slug,
  logos,
}: {
  config: Config;
  api: string;
  slug: string;
  logos: string[];
}) {
  const [plan, setPlan] = useState(config.plan);
  const [inverso, invertir] = useState(false);
  const [valor, cambiar] = useState("");
  const [tasa, setTasa] = useState<number | null>(null);
  const [referencia, setReferencia] = useState("");
  const [info, setInfo] = useState("Cargando comisiones de las reservas…");
  const [revision, reintentar] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    json(api + "/comisiones-turnits/" + slug, { signal: controller.signal })
      .then((data) => {
        const m = data.metricas_mes;
        const r = m.comision_mercado_pago / m.ingreso_mercado_pago_con_detalle;
        if (
          Number.isFinite(r) &&
          r >= 0 &&
          r + config.planes[plan].tasa < 0.99 &&
          m.turnos_mp_con_detalle > 0
        ) {
          setTasa(r);
          setInfo(
            "Tasa estimada con " +
              m.turnos_mp_con_detalle +
              " reservas con detalle del mes: " +
              (r * 100).toLocaleString("es-AR", { maximumFractionDigits: 2 }) +
              "%.",
          );
        } else {
          setTasa(null);
          setInfo("Sin datos suficientes de Mercado Pago este mes.");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setTasa(null);
          setInfo("No se pudieron cargar las comisiones.");
        }
      });
    return () => controller.abort();
  }, [api, slug, revision, plan]);
  const tasaAplicada = tasa ?? (referencia ? Number(referencia) / 100 : null);
  return (
    <>
      <div className="cb-line">
        {["¿Cuánto recibo?", "¿Cuánto debo cobrar?"].map((label, i) => (
          <button
            key={label}
            aria-pressed={inverso === !!i}
            onClick={() => invertir(!!i)}
          >
            {label}
          </button>
        ))}
        <select
          aria-label="Plan simulado"
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
        >
          {Object.keys(config.planes)
            .filter((p) => p !== "basico" || config.plan === p)
            .map((p) => (
              <option key={p} value={p}>
                Plan {planes[p]}
              </option>
            ))}
        </select>
      </div>
      <label>
        Valor a {inverso ? "recibir" : "cobrar"}
        <input
          inputMode="numeric"
          placeholder="$ 0"
          value={valor ? "$ " + Number(valor).toLocaleString("es-AR") : ""}
          onChange={(e) => {
            const v = e.target.value.replace(/[$.\s]/g, "");
            if (/^\d{0,9}$/.test(v)) cambiar(v);
          }}
        />
      </label>
      {!Number(valor) && (
        <small>Ingresá un importe mayor que cero para calcular.</small>
      )}
      <small>
        {info}{" "}
        {info.startsWith("No se pudieron") && (
          <button onClick={() => reintentar(revision + 1)}>Reintentar</button>
        )}
      </small>
      {tasa === null && info.startsWith("Sin datos") && (
        <label>
          Simular plazo de acreditación
          <select
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
          >
            <option value="">Elegí un plazo para estimar Mercado Pago</option>
            {acreditacion.map(([plazo, r]) => (
              <option key={plazo} value={r}>
                Dinero {plazo} · {r.toLocaleString("es-AR")}% de referencia
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="cb-results">
        {metodos.map((m, i) => {
          const resultado =
            Number(valor) > 0 && (i !== 0 || tasaAplicada !== null)
              ? costos(
                  Number(valor),
                  inverso,
                  config.planes[plan],
                  i === 0 ? tasaAplicada : 0,
                )
              : null;
          return (
            <article key={m}>
              <h3>
                {m} {logos[i] && <img src={logos[i]} alt="" />}
              </h3>
              <output>
                {resultado ? pesos.format(resultado.resultado) : "—"}
              </output>
              {resultado && (
                <small>
                  Turnits {pesos.format(resultado.turnits)}
                  {i === 0 && <> · Mercado Pago {pesos.format(resultado.mp)}</>}
                </small>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}

export default function CobrosNegocio({ baseUrl, iconos }: any) {
  const api = baseUrl.replace(/\/+$/, ""),
    slug = encodeURIComponent(getSlug()),
    url = api + "/settings/" + slug + "?vista=cobros";
  const [tab, setTab] = useState(0),
    [config, setConfig] = useState<Config | null>(null),
    [revision, retry] = useState(0);
  const [draft, setDraft] = useState({
    metodo_pago: "total",
    porcentaje_sena: 20,
    agenda_sin_pagos: false,
  });
  const [cbu, setCbu] = useState(""),
    [editBank, editar] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const logos = [
    iconos?.logoMercadoPago,
    iconos?.logoTransferencia,
    iconos?.logoEfectivo,
  ];
  useEffect(() => {
    const controller = new AbortController();
    setConfig(null);
    setNotice("");
    json(url, { signal: controller.signal })
      .then(({ settings: s }) => {
        if (!s?.planes?.[s.plan])
          throw Error("Configuración de pagos incompleta.");
        setConfig(s);
        const retorno = new URL(window.location.href);
        const estado = retorno.searchParams.get("status");
        if (estado === "mp_success" || estado === "mp_error") {
          setTab(2);
          setNotice(estado === "mp_success" && s.mp_conectado ? "Cuenta de Mercado Pago vinculada." : "No se pudo completar la vinculación con Mercado Pago.");
          retorno.searchParams.delete("status");
          retorno.searchParams.delete("reason");
          window.history.replaceState(window.history.state, "", retorno);
        }
        setDraft({
          metodo_pago: s.metodo_pago === "sena" ? "sena" : "total",
          porcentaje_sena: Math.min(
            100,
            Math.max(20, Number(s.porcentaje_sena) || 20),
          ),
          agenda_sin_pagos: s.agenda_sin_pagos === true,
        });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setNotice(e.message);
      });
    return () => controller.abort();
  }, [url, revision]);
  if (!config)
    return (
      <p role="status">
        {notice || "Cargando configuración de cobros…"}{" "}
        {notice && (
          <button onClick={() => retry(revision + 1)}>Reintentar</button>
        )}
      </p>
    );
  const offline = config.planes[config.plan].mediosOffline;
  async function guardar(body: object, cambios: Partial<Config>) {
    setBusy(true);
    setNotice("Guardando…");
    try {
      await json(url, { method: "PUT", body: JSON.stringify(body) });
      setConfig((c) => ({ ...c, ...cambios }));
      setNotice("Guardado");
      setCbu("");
      editar(false);
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function conectar() {
    setBusy(true);
    setNotice("Abriendo Mercado Pago…");
    try {
      const data = await json(api + "/mp/connect/" + slug, { method: "POST" });
      if (!data.authorization_url)
        throw Error("No se pudo iniciar la vinculación.");
      window.location.assign(data.authorization_url);
    } catch (e) {
      setNotice(e.message);
      setBusy(false);
    }
  }
  return (
    <div className="cb-panel">
      <nav aria-label="Secciones de cobro">
        {secciones.map((s, i) => (
          <button
            key={s}
            disabled={busy}
            aria-pressed={tab === i}
            onClick={() => {
              setTab(i);
              setNotice("");
            }}
          >
            {s}
          </button>
        ))}
      </nav>
      <h1>{secciones[tab]}</h1>
      <p>
        {
          [
            "Consultá cuánto recibís por cada método de pago.",
            "Configurá el pago para validar una reserva.",
            "Configurá dónde recibís los ingresos.",
          ][tab]
        }
      </p>
      <fieldset disabled={busy} className="cb-card">
        {tab === 0 && (
          <Calculadora config={config} api={api} slug={slug} logos={logos} />
        )}
        {tab === 1 && (
          <>
            <h2>Configuración de cobro</h2>
            <div className="cb-line">
              {["sena", "total"].map((m, i) => (
                <button
                  key={m}
                  aria-pressed={draft.metodo_pago === m}
                  onClick={() => {
                    setNotice("");
                    setDraft({ ...draft, metodo_pago: m });
                  }}
                >
                  {i ? "Totalidad" : "Seña"}
                </button>
              ))}
            </div>
            <label>
              Porcentaje de {draft.metodo_pago === "sena" ? "seña" : "cobro"}{" "}
              <b>
                {draft.metodo_pago === "sena" ? draft.porcentaje_sena : 100}%
              </b>
              <input
                type="range"
                min="20"
                max="100"
                disabled={draft.metodo_pago === "total"}
                value={
                  draft.metodo_pago === "total" ? 100 : draft.porcentaje_sena
                }
                onChange={(e) => {
                  setNotice("");
                  setDraft({
                    ...draft,
                    porcentaje_sena: Number(e.target.value),
                  });
                }}
              />
            </label>
            <h2>Agenda sin cobro</h2>
            {offline ? (
              <div className="cb-line">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    aria-pressed={draft.agenda_sin_pagos === v}
                    onClick={() => {
                      setNotice("");
                      setDraft({ ...draft, agenda_sin_pagos: v });
                    }}
                  >
                    {v ? "Sí" : "No"}
                  </button>
                ))}
              </div>
            ) : (
              <small>Necesitas mejorar tu plan</small>
            )}
            <button className="cb-save" onClick={() => guardar(draft, draft)}>
              Guardar configuración
            </button>
          </>
        )}
        {tab === 2 &&
          metodos.map((m, i) => (
            <div className="cb-method" key={m}>
              <div>
                <h2>
                  {m} {logos[i] && <img src={logos[i]} alt="" />}
                </h2>
                {i === 0 ? (
                  <>
                    <p>
                      {config.mp_conectado
                        ? "Cuenta vinculada"
                        : "Cuenta sin vincular"}
                    </p>
                    <button className="cb-mp" onClick={conectar}>
                      {config.mp_conectado
                        ? "Volver a vincular"
                        : "Vincular tu cuenta"}{" "}
                      ↗
                    </button>
                  </>
                ) : !offline ? (
                  <small>Necesitas mejorar tu plan</small>
                ) : i === 1 ? (
                  <>
                    <p>
                      {config.cbu_final
                        ? "CBU •••• " + config.cbu_final
                        : "Sin CBU vinculado"}
                    </p>
                    {editBank ? (
                      <>
                        <input
                          aria-label="Nuevo CBU de 22 dígitos"
                          autoComplete="off"
                          type="password"
                          inputMode="numeric"
                          maxLength={22}
                          value={cbu}
                          onChange={(e) => {
                            if (/^\d*$/.test(e.target.value))
                              setCbu(e.target.value);
                          }}
                        />
                        <button
                          disabled={cbu.length !== 22}
                          onClick={() =>
                            guardar(
                              {
                                acepta_transferencia: true,
                                datos_bancarios: { cbu },
                              },
                              {
                                acepta_transferencia: true,
                                cbu_final: cbu.slice(-4),
                              },
                            )
                          }
                        >
                          Guardar CBU
                        </button>
                        <button
                          onClick={() => {
                            editar(false);
                            setCbu("");
                          }}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button className="cb-bank" onClick={() => editar(true)}>
                        {config.cbu_final ? "Cambiar CBU" : "Vincular un CBU"}{" "}
                        ↗
                      </button>
                    )}
                    {config.cbu_final && !editBank && (
                      <button
                        onClick={() =>
                          guardar(
                            {
                              acepta_transferencia:
                                !config.acepta_transferencia,
                            },
                            {
                              acepta_transferencia:
                                !config.acepta_transferencia,
                            },
                          )
                        }
                      >
                        {config.acepta_transferencia
                          ? "Deshabilitar"
                          : "Habilitar"}{" "}
                        transferencia
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    className="cb-green"
                    onClick={() =>
                      guardar(
                        { acepta_efectivo: !config.acepta_efectivo },
                        { acepta_efectivo: !config.acepta_efectivo },
                      )
                    }
                  >
                    {config.acepta_efectivo ? "Deshabilitar" : "Habilitar"}{" "}
                    efectivo
                  </button>
                )}
              </div>
              {i === 0 ? (
                <div>
                  <h3>Comisiones por plazo de acreditación</h3>
                  <div className="cb-rates">
                    {acreditacion.map(([plazo, tasa]) => (
                      <div key={plazo}>
                        Dinero {plazo}
                        <strong>
                          {tasa.toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                          })}
                          %
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="cb-detail">Sin comisión de Mercado Pago</div>
              )}
            </div>
          ))}
      </fieldset>
      <p role="status">{notice}</p>
    </div>
  );
}
