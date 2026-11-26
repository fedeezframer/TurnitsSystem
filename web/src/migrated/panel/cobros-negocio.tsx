import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  SeccionHeader,
  MercadoPagoConexion_getSlug as getSlug,
  MercadoPagoConexion_getToken as getToken,
  MercadoPagoConexion_CBU_REGEX,
  MercadoPagoConexion_ALIAS_REGEX,
  Pagos_baselineDesdeSettings,
  TurnitsGlobalSaveManager_get,
} from "./common";
import { costos, type Regla } from "./costos";
import "./cobros-negocio.css";
import { seccionesPagos } from "./secciones-pagos";
import LoadingRunner from "../../components/LoadingRunner";
import BackButton from "../../components/BackButton";

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

const emptyBank = { titular: "", banco: "", cbu: "", alias: "" };
type BankFields = typeof emptyBank;

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
function MetodoIcono({indice, logo}: {indice: number, logo?: string}) {
  const fallback = ["/assets/panel-nav/ix_money-alt.svg", "/assets/panel-nav/ant-design_home-outlined.svg", "/assets/panel-nav/ix_money-alt.svg"];
  return <span className={"cb-icon cb-icon-" + indice}><img src={logo || fallback[indice]} alt=""/></span>;
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
            .map((p) => (
              <option key={p} value={p}>
                Plan {planes[p]}
              </option>
            ))}
        </select>
      </div>
      <label className="cb-amount">
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
                <MetodoIcono indice={i} logo={logos[i]} /> {m}
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

export default function CobrosNegocio({ baseUrl, iconos, vista, isMobile }: any) {
  const api = baseUrl.replace(/\/+$/, ""),
    slug = encodeURIComponent(getSlug()),
    url = api + "/settings/" + slug + "?vista=cobros";
  const seccion = seccionesPagos.find(s => s.id === vista) || seccionesPagos[0];
  const [config, setConfig] = useState<Config | null>(null),
    [revision, retry] = useState(0);
  const [draft, setDraft] = useState({
    metodo_pago: "total",
    porcentaje_sena: 20,
    agenda_sin_pagos: false,
  });
  const [bank, setBank] = useState(emptyBank),
    [bankLoading, setBankLoading] = useState(false),
    [editBank, editar] = useState(false),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(() => Boolean(TurnitsGlobalSaveManager_get()?.isSaving())),
    [notice, setNotice] = useState("");
  const bankDraftStart = React.useRef<{ datos_bancarios: BankFields; acepta_transferencia: boolean } | null>(null);
  const previousCbu = React.useRef("");
  const bankMaskedStart = React.useRef("");
  const bankRequest = React.useRef<AbortController | null>(null);
  const bankTrigger = React.useRef<HTMLButtonElement>(null);
  const bankBack = React.useRef<HTMLButtonElement>(null);
  const restoreBankFocus = React.useRef(false);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (editBank) {
      bankBack.current?.focus({ preventScroll: true });
    } else if (restoreBankFocus.current) {
      restoreBankFocus.current = false;
      bankTrigger.current?.focus({ preventScroll: true });
    }
  }, [editBank]);
  const logos = [
    iconos?.logoMercadoPago,
    iconos?.logoTransferencia,
    iconos?.logoEfectivo,
  ];
  useEffect(() => { setNotice(""); }, [vista]);
  useEffect(() => {
    const controller = new AbortController();
    setConfig(null);
    setNotice("");
    json(url, { signal: controller.signal })
      .then(({ settings: s }) => {
        if (!s?.planes?.[s.plan])
          throw Error("Configuración de pagos incompleta.");
        const manager = TurnitsGlobalSaveManager_get();
        const baseline = Pagos_baselineDesdeSettings(s);
        manager?.setBaseline("pagos", baseline);
        const pending = manager?.getPending("pagos") || {};
        const pagosActuales = {
          ...baseline,
          ...pending,
          datos_bancarios: { ...baseline.datos_bancarios, ...pending.datos_bancarios },
        };
        (window as any).getPagosConfig = () => pagosActuales;
        setConfig({
          ...s,
          ...pagosActuales,
          cbu_final: pagosActuales.datos_bancarios.cbu?.slice(-4) || s.cbu_final,
        });
        const retorno = new URL(window.location.href);
        const estado = retorno.searchParams.get("status");
        if (estado === "mp_success" || estado === "mp_error") {
          setNotice(estado === "mp_success" && s.mp_conectado ? "Cuenta de Mercado Pago vinculada." : "No se pudo completar la vinculación con Mercado Pago.");
        }
        setDraft({
          metodo_pago: pagosActuales.metodo_pago === "sena" ? "sena" : "total",
          porcentaje_sena: Math.min(
            100,
            Math.max(20, Number(pagosActuales.porcentaje_sena) || 20),
          ),
          agenda_sin_pagos: pagosActuales.agenda_sin_pagos === true,
        });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setNotice(e.message);
      });
    return () => controller.abort();
  }, [url, revision]);
  useEffect(() => {
    const onSaved = (event: any) => {
      if (event.detail?.section !== "pagos") return;
      const saved = event.detail.data || {};
      setConfig((current) => current ? {
        ...current,
        ...saved,
        cbu_final: saved.datos_bancarios?.cbu?.slice(-4) || current.cbu_final,
      } : current);
      setDraft((current) => ({
        ...current,
        metodo_pago: saved.metodo_pago === "sena" ? "sena" : "total",
        porcentaje_sena: Math.min(100, Math.max(20, Number(saved.porcentaje_sena) || 20)),
        agenda_sin_pagos: saved.agenda_sin_pagos === true,
      }));
      if (event.detail.submitted?.datos_bancarios) {
        setBank(emptyBank);
        editar(false);
        previousCbu.current = "";
        bankDraftStart.current = null;
      } else if (bankDraftStart.current) {
        bankDraftStart.current.acepta_transferencia = saved.acepta_transferencia === true;
      }
      setNotice("");
    };
    const onDiscarded = () => {
      bankRequest.current?.abort();
      bankDraftStart.current = null;
      previousCbu.current = "";
      setBank(emptyBank);
      setBankLoading(false);
      editar(false);
      retry(value => value + 1);
    };
    const onSaveState = (event: Event) => setSaving((event as CustomEvent).detail?.saving === true);
    window.addEventListener("turnits_global_save_state", onSaveState);
    window.addEventListener("turnits_global_saved", onSaved);
    window.addEventListener("turnits_global_discarded", onDiscarded);
    return () => {
      bankRequest.current?.abort();
      window.removeEventListener("turnits_global_save_state", onSaveState);
      window.removeEventListener("turnits_global_saved", onSaved);
      window.removeEventListener("turnits_global_discarded", onDiscarded);
    };
  }, []);
  useEffect(() => () => TurnitsGlobalSaveManager_get()?.setBlocker("pagos", ""), []);
  if (!config)
    return notice ? (
      <p role="status">
        {notice}{" "}<button onClick={() => retry(revision + 1)}>Reintentar</button>
      </p>
    ) : <LoadingRunner card size="compact" label="Cargando configuración de cobros…" />;
  const offline = config.planes[config.plan].mediosOffline;
  function publicarPagos(cambios: Record<string, any>) {
    const actual = (window as any).getPagosConfig?.() || Pagos_baselineDesdeSettings(config);
    const siguiente = { ...actual, ...cambios };
    if (cambios.datos_bancarios) {
      siguiente.datos_bancarios = { ...actual.datos_bancarios, ...cambios.datos_bancarios };
    }
    (window as any).getPagosConfig = () => siguiente;
    window.dispatchEvent(new CustomEvent("pagos_changed", { detail: siguiente }));
    setConfig((current) => current ? {
      ...current,
      ...cambios,
      ...(cambios.datos_bancarios ? {
        cbu_final: cambios.datos_bancarios.cbu?.slice(-4) || bankMaskedStart.current,
      } : {}),
    } : current);
  }
  function actualizarBorradorPagos(next: typeof draft) {
    setDraft(next);
    publicarPagos(next);
  }
  async function openBank() {
    const current = (window as any).getPagosConfig?.() || Pagos_baselineDesdeSettings(config);
    bankDraftStart.current = {
      datos_bancarios: current.datos_bancarios,
      acepta_transferencia: current.acepta_transferencia,
    };
    bankMaskedStart.current = config?.cbu_final || "";
    let stored = current.datos_bancarios;
    setNotice("");
    if (bankMaskedStart.current && !stored.cbu) {
      const request = new AbortController();
      bankRequest.current = request;
      setBankLoading(true);
      try {
        const { settings } = await json(api + "/settings/" + slug, { signal: request.signal });
        stored = Pagos_baselineDesdeSettings(settings).datos_bancarios;
        if (!stored.cbu) throw Error("No pudimos cargar los datos bancarios.");
      } catch (error) {
        if (!request.signal.aborted) setNotice(error instanceof Error ? error.message : "No pudimos cargar los datos bancarios.");
        return;
      } finally {
        if (!request.signal.aborted) setBankLoading(false);
      }
      if (request.signal.aborted) return;
    }
    previousCbu.current = stored.cbu;
    setBank({ ...stored, cbu: "" });
    editar(true);
  }

  function updateBank(next: BankFields) {
    setBank(next);
    const start = bankDraftStart.current;
    const cbu = next.cbu || previousCbu.current;
    const alias = next.alias.trim();
    const error = !MercadoPagoConexion_CBU_REGEX.test(cbu) ? "Ingresá los 22 dígitos del CBU para guardar los cambios."
      : alias && !MercadoPagoConexion_ALIAS_REGEX.test(alias) ? "Revisá el alias antes de guardar."
      : "";
    TurnitsGlobalSaveManager_get()?.setBlocker("pagos", error);
    if (error) {
      if (start) publicarPagos(start);
      return;
    }
    publicarPagos({
      acepta_transferencia: next.cbu ? true : start?.acepta_transferencia,
      datos_bancarios: { ...next, titular: next.titular.trim(), banco: next.banco.trim(), alias, cbu },
    });
  }

  function cancelBank() {
    if (bankDraftStart.current) publicarPagos(bankDraftStart.current);
    TurnitsGlobalSaveManager_get()?.setBlocker("pagos", "");
    bankDraftStart.current = null;
    previousCbu.current = "";
    restoreBankFocus.current = true;
    editar(false);
    setBank(emptyBank);
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
      <SeccionHeader title={seccion.titulo} subtitle={seccion.descripcion} isMobile={isMobile} />
      <fieldset disabled={busy || saving} aria-label={seccion.titulo} className={"cb-card cb-" + vista}>
        {vista === "costos" && (
          <Calculadora config={config} api={api} slug={slug} logos={logos} />
        )}
        {vista === "tipo" && (
          <>
            <h2>Configuración de cobro</h2>
            <div className="cb-line">
              {["sena", "total"].map((m, i) => (
                <button
                  key={m}
                  aria-pressed={draft.metodo_pago === m}
                  onClick={() => {
                    setNotice("");
                    actualizarBorradorPagos({ ...draft, metodo_pago: m });
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
              <small>El mínimo de la seña es 20%.</small>
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
                  actualizarBorradorPagos({
                    ...draft,
                    porcentaje_sena: Number(e.target.value),
                  });
                }}
              />
            </label>
            <h2>Agenda sin cobro</h2>
            <p className="cb-help">Permití reservar sin realizar un pago previo.</p>
            {offline ? (
              <div className="cb-line">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    aria-pressed={draft.agenda_sin_pagos === v}
                    onClick={() => {
                      setNotice("");
                      actualizarBorradorPagos({ ...draft, agenda_sin_pagos: v });
                    }}
                  >
                    {v ? "Sí" : "No"}
                  </button>
                ))}
              </div>
            ) : (
              <small>Necesitas mejorar tu plan</small>
            )}
          </>
        )}
        {vista === "metodos" &&
          metodos.map((m, i) => (
            <div className="cb-method" key={m}>
              <div>
                <h2>
                  <MetodoIcono indice={i} logo={logos[i]} /> {m}
                </h2>
                {i > 0 && <p className="cb-help">{i === 1 ? "Revisá el comprobante para aceptar la reserva." : "Aceptá la reserva desde tu agenda."}</p>}
                {i === 0 ? (
                  <>
                    <p>
                      {config.mp_conectado
                        ? "Cuenta vinculada"
                        : "Cuenta sin vincular"}
                    </p>
                    <button type="button" className="cb-payment-action" onClick={conectar}>
                      {config.mp_conectado ? "Volver a vincular" : "Vincular tu cuenta"}
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
                    {!editBank && (
                      <div className="cb-payment-actions">
                        <button ref={bankTrigger} type="button" className="cb-payment-action" disabled={bankLoading} onClick={openBank}>
                          {bankLoading ? "Cargando datos…" : config.cbu_final ? "Editar datos bancarios" : "Vincular un CBU"}
                        </button>
                        {config.cbu_final && (
                          <button type="button" className="cb-payment-action"
                            onClick={() => publicarPagos({ acepta_transferencia: !config.acepta_transferencia })}>
                            {config.acepta_transferencia ? "Deshabilitar transferencia" : "Habilitar transferencia"}
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    className="cb-payment-action"
                    onClick={() => publicarPagos({ acepta_efectivo: !config.acepta_efectivo })}
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
              {i === 1 && offline && (
                <AnimatePresence initial={false}>
                  {editBank && (
                    <motion.div className="cb-bank-panel"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0, pointerEvents: "none" }}
                      transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeInOut" }}>
                      <div className="cb-bank-form" role="group" aria-labelledby="cb-bank-heading">
                        <header>
                          <div>
                            <h3 id="cb-bank-heading">Datos de la cuenta bancaria</h3>
                            <p>Estos datos se muestran al cliente cuando elige pagar por transferencia.</p>
                          </div>
                          <BackButton ref={bankBack} onClick={cancelBank} aria-label="Volver a medios de pago" />
                        </header>
                        <div className="cb-bank-fields">
                          <label>Nombre del titular
                            <input value={bank.titular} placeholder="Nombre y apellido" maxLength={80}
                              onChange={event => updateBank({ ...bank, titular: event.target.value })} />
                          </label>
                          <label>Banco
                            <input value={bank.banco} placeholder="Nombre del banco" maxLength={60}
                              onChange={event => updateBank({ ...bank, banco: event.target.value })} />
                          </label>
                          <label>{previousCbu.current ? "Nuevo CBU (opcional)" : "CBU"}
                            <input value={bank.cbu} placeholder={previousCbu.current ? "Conservar CBU actual" : "22 dígitos"}
                              type="password" inputMode="numeric" autoComplete="off" maxLength={22}
                              onChange={event => updateBank({ ...bank, cbu: event.target.value.replace(/\D/g, "") })} />
                            {bank.cbu.length > 0 && bank.cbu.length < 22 && <small>{bank.cbu.length} de 22 dígitos</small>}
                          </label>
                          <label>Alias (opcional)
                            <input value={bank.alias} placeholder="Ej. mi.alias.banco" maxLength={30}
                              autoCapitalize="none" spellCheck={false}
                              onChange={event => updateBank({ ...bank, alias: event.target.value })} />
                            {bank.alias.trim() && !MercadoPagoConexion_ALIAS_REGEX.test(bank.alias.trim()) &&
                              <small>Usá entre 6 y 30 letras, números, puntos o guiones.</small>}
                          </label>
                        </div>
                        <p className="cb-bank-save-hint">Aplicá los cambios con Guardar en el encabezado.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          ))}
      </fieldset>
      {notice && <p className="cb-notice" role="status">{notice}</p>}
    </div>
  );
}
