import { InlineLoading } from "../../components/LoadingRunner"
import * as React from "react";
import { useBrowseBusiness } from "./browse-config";
import "./service-browse-config.css";

function Icon({ coin = false }: { coin?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={["service-browse-icon", coin ? "coin" : "fire"].join(" ")}
    />
  );
}

function MemberAvatar({ member }: { member: any }) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [member.foto_url]);
  if (member.foto_url && !failed) return <img className="service-offer-avatar service-offer-photo" src={member.foto_url} alt="" onError={() => setFailed(true)} />;
  const color = /^#[0-9a-f]{3,8}$/i.test(member.color || "") ? member.color : "#64748b";
  return <span className="service-offer-avatar service-offer-initial" style={{ "--member-color": color } as React.CSSProperties} aria-hidden="true">{String(member.nombre || "?").trim().slice(0, 1).toLocaleUpperCase("es-AR")}</span>;
}

export default function ServiceBrowseConfig({
  api,
  serviceId,
  name: _name,
  price,
}: {
  api: string;
  serviceId: string;
  name: string;
  price: number;
}) {
  const { data, draft, error, busy, update, retry } = useBrowseBusiness(api);
  const [offerEnabled, setOfferEnabled] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    const reset = () => setOfferEnabled(null);
    window.addEventListener("turnits_global_discarded", reset);
    return () => window.removeEventListener("turnits_global_discarded", reset);
  }, []);
  if (error)
    return (
      <div className="service-browse-config">
        <p role="alert">{error}</p>
        <button type="button" onClick={retry}>
          Reintentar
        </button>
      </div>
    );
  if (!data)
    return (
      <InlineLoading label="Cargando Offers…" />
    );
  const offers = draft.offers.filter((o: any) => o.servicio_id === serviceId);
  const service = data.servicios.find((s: any) => s.id === serviceId);
  const assignments = service?.servicio_equipo || [];
  const members = data.equipo.filter((m: any) =>
    (m.activo === true || m.activo === "true") &&
    (!service?.owner_equipo_id || service.owner_equipo_id === m.id),
  );
  const minimum = offers[0]?.precio_minimo ?? "";
  const enableOffer = offerEnabled ?? offers.some((o: any) => o.activo === true);
  const normalPrice = Math.max(0, Math.min(price, Number(data.servicios.find((s: any) => s.id === serviceId)?.precio ?? price)));
  const memberPrice = (member: any) => Number(assignments.find((a: any) => a.equipo_id === member.id)?.precio_override ?? price);
  const selectedMembers = members.filter((member: any) => offers.some((o: any) => o.equipo_id === member.id));
  const maximumMinimum = Math.min(...(selectedMembers.length ? selectedMembers : members).map(memberPrice));
  const setMinimum = (value: string) => {
    update(d => ({ ...d, offers: d.offers.map((o: any) => o.servicio_id === serviceId ? { ...o, precio_minimo: Number(value) } : o) }));
  };
  const toggleMember = (member: any, selected: boolean) => {
    update(d => ({ ...d, offers: selected
      ? [...d.offers, { id: crypto.randomUUID(), servicio_id: serviceId, equipo_id: member.id, precio_minimo: Number(minimum), activo: enableOffer }]
      : d.offers.filter((o: any) => !(o.servicio_id === serviceId && o.equipo_id === member.id)) }));
  };
  return (
    <div className="service-browse-config">
      {normalPrice > 0 ? <fieldset disabled={busy} aria-label="Turnits Offers de este servicio">
        <div className="service-browse-heading">
          <div><h4><Icon />Turnits Offers</h4><p>Ofrecé horarios libres cerca del límite de reserva.</p></div>
          <label className="service-browse-toggle">
            <span>Habilitar</span>
            <input type="checkbox" role="switch" aria-label="Habilitar Turnits Offers"
              checked={enableOffer} disabled={!members.length}
              onChange={e => {
                const enabled = e.target.checked;
                setOfferEnabled(enabled);
                update(d => ({
                  ...d,
                  offers: !offers.length && enabled && members.length
                    ? [...d.offers, { id: crypto.randomUUID(), servicio_id: serviceId, equipo_id: members[0].id, precio_minimo: 0, activo: true }]
                    : d.offers.filter((o: any) => enabled || o.servicio_id !== serviceId || o.precio_minimo > 0)
                        .map((o: any) => o.servicio_id === serviceId ? { ...o, activo: enabled } : o),
                }));
              }} />
          </label>
        </div>
        {data.agendaSinPagos && <p className="service-browse-notice" role="status">Para publicar Offers, activá los cobros online en Pagos. La agenda de este negocio está configurada sin pagos.</p>}
        {!data.mercadoPagoConectado && <p className="service-browse-notice" role="status">Conectá Mercado Pago para cobrar las reservas de Turnits Offers.</p>}
        <fieldset className="service-browse-controls" disabled={!enableOffer}>
          <label className="service-browse-minimum-label">
            Tarifa mínima
            <div className="service-browse-money">
              <span aria-hidden="true">$</span>
              <input className="svc-input" type="number" inputMode="decimal" min="0.01" step="0.01"
                max={Number.isFinite(maximumMinimum) ? maximumMinimum - 0.01 : undefined}
                aria-label="Tarifa mínima" placeholder="Ej. 5.000" value={minimum || ""}
                disabled={!offers.length} onChange={e => setMinimum(e.target.value)} />
            </div>
          </label>
          {members.length > 0 && <fieldset className="service-browse-members">
            <legend>Profesionales que ofrecen el beneficio</legend>
            {members.map((member: any) => <label key={member.id} className={`service-offer-member${offers.some((o: any) => o.equipo_id === member.id) ? " is-selected" : ""}`}>
              <input type="checkbox" checked={offers.some((o: any) => o.equipo_id === member.id)}
                onChange={e => toggleMember(member, e.target.checked)} />
              <MemberAvatar member={member} />
              <span className="service-offer-member-copy"><strong>{member.nombre} {member.apellido}</strong>{!offers.some((o: any) => o.equipo_id === member.id) && !assignments.some((a: any) => a.equipo_id === member.id) && <small>Si lo seleccionás, este perfil ofrecerá el servicio.</small>}</span>
            </label>)}
          </fieldset>}
          {enableOffer && (!offers.length || Number(minimum) <= 0 || Number(minimum) >= maximumMinimum) &&
            <p className="service-browse-error" role="alert">
              Elegí al menos un profesional y una tarifa mayor a $0, menor al precio de todos los seleccionados.
            </p>}
          <p className="service-browse-explanation">
            La Offer aparece dentro de la última hora antes del límite de reserva. El descuento aumenta al acercarse ese límite y llega a la tarifa mínima en los últimos 15 minutos. Solo participan los profesionales marcados.
          </p>
          <p className="service-browse-hint">Se aplica con Guardar cambios del panel.</p>
        </fieldset>
        {!members.length && <p className="service-browse-hint">Asigná este servicio a un profesional activo para configurar Offers.</p>}
      </fieldset> : <p className="service-browse-hint">Turnits Offers requiere un precio y horarios fijos; en las consultas, el precio y la fecha se acuerdan por chat.</p>}
    </div>
  );
}

function Reward({
  row,
  price,
  save,
}: {
  row: any;
  price: number;
  save: (values: any) => void;
}) {
  const [mode, setMode] = React.useState<"complete" | "conditional" | null>(
    row ? (row.copago > 0 ? "conditional" : "complete") : null,
  );
  const [coins, setCoins] = React.useState(row ? String(row.monedas) : "");
  const [amount, setAmount] = React.useState(
    row?.copago > 0 ? String(row.copago) : "",
  );
  const maxAmount = Math.floor(price * 100) / 100;
  const commit = (
    nextMode: typeof mode,
    nextCoins: string,
    nextAmount: string,
  ) => {
    const count = Number(nextCoins),
      cash = nextMode === "complete" ? 0 : Number(nextAmount);
    if (
      !nextMode ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 100000 ||
      (nextMode === "conditional" && !(cash > 0))
    )
      return;
    save({ monedas: count, copago: Math.min(maxAmount, cash), activo: true });
  };
  const chooseMode = (next: "complete" | "conditional") => {
    setMode(next);
    if (next === "conditional" && row && !Number(amount))
      save({ activo: false });
    commit(next, coins, amount);
  };
  const changeAmount = (value: string) => {
    const limited =
      value === ""
        ? ""
        : String(
            Math.min(
              maxAmount,
              Math.max(0, Math.round(Number(value) * 100) / 100),
            ),
          );
    setAmount(limited);
    if (limited === "" || Number(limited) === 0) {
      if (row) save({ activo: false });
    } else commit(mode, coins, limited);
  };
  return (
    <div className="service-browse-reward">
      <div
        className="service-browse-modes"
        role="group"
        aria-label="Tipo de premio"
      >
        <button
          type="button"
          aria-pressed={mode === "complete"}
          onClick={() => chooseMode("complete")}
        >
          Premio Completo
        </button>
        <button
          type="button"
          aria-pressed={mode === "conditional"}
          onClick={() => chooseMode("conditional")}
        >
          Premio Condicional
        </button>
      </div>
      <div className="service-browse-equation">
        {mode === "conditional" ? (
          <div className="service-browse-money">
            <span aria-hidden="true">$</span>
            <input
              className="svc-input"
              aria-label="Importe del premio condicional"
              type="number"
              inputMode="decimal"
              min="0.01"
              max={maxAmount}
              step="0.01"
              placeholder="Importe"
              value={amount}
              onChange={(e) => changeAmount(e.target.value)}
            />
          </div>
        ) : (
          <span className="service-browse-object">Este servicio</span>
        )}
        <span>{mode === "complete" ? "por" : "+"}</span>
        <label className="service-browse-coins">
          <input
            aria-label="T-Coins requeridos"
            type="number"
            inputMode="numeric"
            min="1"
            max="100000"
            step="1"
            placeholder="5"
            disabled={!mode}
            value={coins}
            onChange={(e) => {
              const value =
                e.target.value === ""
                  ? ""
                  : String(
                      Math.min(
                        100000,
                        Math.max(1, Math.trunc(Number(e.target.value))),
                      ),
                    );
              setCoins(value);
              commit(mode, value, amount);
            }}
          />
          <Icon coin />
        </label>
      </div>
    </div>
  );
}
