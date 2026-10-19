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
  const [memberId, setMemberId] = React.useState("");
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
      <p className="service-browse-loading" role="status">
        Cargando T-Coins y Offers…
      </p>
    );
  const rewards = draft.recompensas.filter(
    (r: any) => r.servicio_id === serviceId && r.tipo === "servicio",
  );
  const offers = draft.offers.filter((o: any) => o.servicio_id === serviceId);
  const members = data.equipo.filter(
    (m: any) => m.activo === true || m.activo === "true",
  );
  const selectedMember =
    memberId ||
    offers[0]?.equipo_id ||
    (members.length === 1 ? members[0].id : "");
  const offer = offers.find((o: any) => o.equipo_id === selectedMember);
  const normalPrice = Math.max(
    0,
    Math.min(
      price,
      Number(
        data.servicios.find((s: any) => s.id === serviceId)?.precio ?? price,
      ),
    ),
  );
  const saveReward = (row: any, values: any) =>
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
  const setMinimum = (value: string) => {
    if (!selectedMember) return;
    update((d) => {
      const existing = d.offers.find(
        (o: any) =>
          o.servicio_id === serviceId && o.equipo_id === selectedMember,
      );
      if (value === "")
        return {
          ...d,
          offers: d.offers.filter((o: any) => o.id !== existing?.id),
        };
      const values = { precio_minimo: Number(value) };
      return {
        ...d,
        offers: existing
          ? d.offers.map((o: any) =>
              o.id === existing.id ? { ...o, ...values } : o,
            )
          : [
              ...d.offers,
              {
                id: crypto.randomUUID(),
                servicio_id: serviceId,
                equipo_id: selectedMember,
                ...values,
                activo: true,
              },
            ],
      };
    });
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
        </div>
        {(rewards.length ? rewards : [null]).map((r: any, index: number) => (
          <Reward
            key={index}
            row={r}
            price={normalPrice}
            save={(values) => saveReward(r, values)}
          />
        ))}
      </fieldset>
      <fieldset disabled={busy} aria-label="Turnits Offers de este servicio">
        <div className="service-browse-heading">
          <div>
            <h4>
              <Icon />
              Turnits Offers
            </h4>
            <p>Establece un descuento para horas donde no hay reservas.</p>
          </div>
        </div>
        {members.length > 1 && (
          <select
            className="service-browse-professional"
            aria-label="Profesional de la Offer"
            value={selectedMember}
            onChange={(e) => setMemberId(e.target.value)}
          >
            <option value="">Elegí un profesional</option>
            {members.map((m: any) => (
              <option key={m.id} value={m.id}>
                {m.nombre} {m.apellido}
              </option>
            ))}
          </select>
        )}
        <div className="service-browse-minimum-row">
          <input
            type="number"
            min="0.01"
            step="0.01"
            max={price > 0 ? price - 0.01 : undefined}
            aria-label="Tarifa mínima"
            placeholder="Tarifa Mínima"
            value={offer?.precio_minimo ?? ""}
            disabled={!selectedMember}
            onChange={(e) => setMinimum(e.target.value)}
          />
          <span>
            La tarifa mínima es el valor al que aceptas rebajarte para el
            descuento
          </span>
        </div>
        {offer &&
          (offer.precio_minimo <= 0 || offer.precio_minimo >= price) && (
            <p className="service-browse-error" role="alert">
              La tarifa mínima debe ser mayor a $0 y menor al precio del
              profesional.
            </p>
          )}
        {!members.length && (
          <p className="service-browse-hint">
            Asigná el servicio a un profesional para configurar Offers.
          </p>
        )}
        <p className="service-browse-explanation">
          Turnits rebajará el precio normal hasta llegar a la tarifa mínima para
          los horarios en los que queda poca antelación y no son reservados.
          Estas rebajas se realizan automáticamente a medida que sea más
          probable que no se reserve.
        </p>
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
          <input
            className="service-browse-object service-browse-amount"
            aria-label="Importe del premio condicional"
            type="number"
            inputMode="decimal"
            min="0.01"
            max={maxAmount}
            step="0.01"
            placeholder="Importe ($)"
            value={amount}
            onChange={(e) => changeAmount(e.target.value)}
          />
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
