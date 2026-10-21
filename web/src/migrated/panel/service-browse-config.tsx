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

export default function ServiceBrowseConfig({
  api,
  serviceId,
  name,
  price,
}: {
  api: string;
  serviceId: string;
  name: string;
  price: number;
}) {
  const { data, draft, error, busy, update, retry } = useBrowseBusiness(api);
  const [coinsEnabled, setCoinsEnabled] = React.useState<boolean | null>(null);
  const [offerEnabled, setOfferEnabled] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    const reset = () => { setOfferEnabled(null); setCoinsEnabled(null); };
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
      <InlineLoading label="Cargando T-Coins y Offers…" />
    );
  const serviceRewards = draft.recompensas.filter(
    (r: any) => r.servicio_id === serviceId,
  );
  const rewards = serviceRewards.filter((r: any) => r.tipo === "servicio");
  const offers = draft.offers.filter((o: any) => o.servicio_id === serviceId);
  const service = data.servicios.find((s: any) => s.id === serviceId);
  const assignments = service?.servicio_equipo || [];
  const members = data.equipo.filter((m: any) =>
    (m.activo === true || m.activo === "true") &&
    (!service?.owner_equipo_id || service.owner_equipo_id === m.id),
  );
  const minimum = offers[0]?.precio_minimo ?? "";
  const enableCoins = coinsEnabled ?? serviceRewards.some((r: any) => r.activo);
  const enableOffer = offerEnabled ?? offers.some((o: any) => o.activo === true);
  const memberPrice = (member: any) => Number(assignments.find((a: any) => a.equipo_id === member.id)?.precio_override ?? price);
  const selectedMembers = members.filter((member: any) => offers.some((o: any) => o.equipo_id === member.id));
  const maximumMinimum = Math.min(...(selectedMembers.length ? selectedMembers : members).map(memberPrice));
  const normalPrice = Math.max(
    0,
    Math.min(
      price,
      Number(
        data.servicios.find((s: any) => s.id === serviceId)?.precio ?? price,
      ),
    ),
  );
  const saveReward = (row: any, values: any) => {
    setCoinsEnabled(true);
    update((d) => ({
      ...d,
      recompensas: row
        ? d.recompensas.map((r: any) =>
            r.id === row.id ? { ...r, ...values } : r,
          )
        : [
            ...d.recompensas,
            {
              id: crypto.randomUUID(),
              nombre: name.trim() || "Premio por este servicio",
              tipo: "servicio",
              objeto_id: serviceId,
              servicio_id: serviceId,
              stock: null,
              ...values,
            },
          ],
    }));
  };
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
      <fieldset disabled={busy} aria-label="T-Coins de este servicio">
        <div className="service-browse-heading">
          <div>
            <h4>
              <Icon coin />
              T-Coins
            </h4>
            <p>Ofrece premios a los usuarios que más consumen.</p>
          </div>
          <span className="service-browse-rate">
            1 <Icon coin /> = $10.000 gastados en Turnits
          </span>
          <label className="service-browse-toggle">
            <span>Habilitar</span>
            <input
              type="checkbox"
              role="switch"
              aria-label="Habilitar T-Coins"
              checked={enableCoins}
              onChange={(e) => {
                const enabled = e.target.checked;
                setCoinsEnabled(enabled);
                if (serviceRewards.length)
                  update((d) => ({
                    ...d,
                    recompensas: d.recompensas.map((r: any) =>
                      r.servicio_id === serviceId
                        ? { ...r, activo: enabled }
                        : r,
                    ),
                  }));
              }}
            />
          </label>
        </div>
        <fieldset className="service-browse-controls" disabled={!enableCoins}>
          {(rewards.length ? rewards : [null]).map((r: any, index: number) => (
            <Reward
              key={index}
              row={r}
              price={normalPrice}
              save={(values) => saveReward(r, values)}
            />
          ))}
        </fieldset>
      </fieldset>
      <fieldset disabled={busy} aria-label="Turnits Offers de este servicio">
        <div className="service-browse-heading">
          <div><h4><Icon />Turnits Offers</h4><p>Definí la tarifa mínima y quiénes ofrecen este beneficio.</p></div>
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
            {members.map((member: any) => <label key={member.id}>
              <input type="checkbox" checked={offers.some((o: any) => o.equipo_id === member.id)}
                onChange={e => toggleMember(member, e.target.checked)} />
              <span>{member.nombre} {member.apellido}{!assignments.some((a: any) => a.equipo_id === member.id) && <small>Se asignará a este servicio al guardar.</small>}</span>
            </label>)}
          </fieldset>}
          {enableOffer && (!offers.length || Number(minimum) <= 0 || Number(minimum) >= maximumMinimum) &&
            <p className="service-browse-error" role="alert">
              Elegí al menos un profesional y una tarifa mayor a $0, menor al precio de todos los seleccionados.
            </p>}
          <p className="service-browse-explanation">
            Es el precio más bajo que aceptás por este servicio. El descuento aumenta automáticamente al acercarse el horario, sin bajar de esta tarifa. Solo participan los profesionales marcados.
          </p>
          <p className="service-browse-hint">Se aplica con Guardar cambios del panel.</p>
        </fieldset>
        {!members.length && <p className="service-browse-hint">Asigná este servicio a un profesional activo para configurar Offers.</p>}
      </fieldset>
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
