import * as React from "react";
import { useBrowseBusiness } from "./browse-config";
import "./service-browse-config.css";

function Icon({ coin = false }: { coin?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`service-browse-icon ${coin ? "coin" : "fire"}`}
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
  const [newMode, setNewMode] = React.useState<
    "complete" | "conditional" | null
  >(null);
  const [conditionalIds, setConditionalIds] = React.useState<string[]>([]);
  const [memberId, setMemberId] = React.useState("");
  const [newCoins, setNewCoins] = React.useState("");
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
    (r: any) => r.servicio_id === serviceId,
  );
  const offers = draft.offers.filter((o: any) => o.servicio_id === serviceId);
  const members = data.equipo.filter(
    (m: any) => m.activo === true || m.activo === "true",
  );
  const products = data.productos.filter(
    (p: any) => p.activo === true || p.activo === "true",
  );
  const selectedMember =
    memberId ||
    offers[0]?.equipo_id ||
    (members.length === 1 ? members[0].id : "");
  const offer = offers.find((o: any) => o.equipo_id === selectedMember);
  const patchReward = (row: any, values: any) =>
    update((d) => ({
      ...d,
      recompensas: d.recompensas.map((r: any) =>
        r.id === row.id ? { ...r, ...values } : r,
      ),
    }));
  const createReward = (coins: number) => {
    if (!Number.isInteger(coins) || coins < 1 || coins > 100000) return;
    const rewardId = crypto.randomUUID();
    if (newMode === "conditional") setConditionalIds((v) => [...v, rewardId]);
    update((d) => ({
      ...d,
      recompensas: [
        ...d.recompensas,
        {
          id: rewardId,
          nombre: name.trim() || "Premio por este servicio",
          tipo: "servicio",
          objeto_id: serviceId,
          servicio_id: serviceId,
          monedas: coins,
          copago: 0,
          stock: null,
          activo: newMode === "complete",
        },
      ],
    }));
    setNewMode(null);
    setNewCoins("");
  };
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
        {rewards.map((r: any) => (
          <Reward
            key={r.id}
            row={r}
            conditional={
              r.tipo === "producto" ||
              Number(r.copago) > 0 ||
              conditionalIds.includes(r.id)
            }
            products={products}
            price={price}
            patch={(v) => patchReward(r, v)}
            remove={() =>
              update((d) => ({
                ...d,
                recompensas: d.recompensas.filter((v: any) => v.id !== r.id),
              }))
            }
          />
        ))}
        {(!rewards.length || newMode) && (
          <div className="service-browse-reward">
            <div
              className="service-browse-modes"
              role="group"
              aria-label="Tipo de premio"
            >
              <button
                type="button"
                aria-pressed={newMode === "complete"}
                onClick={() => setNewMode("complete")}
              >
                Premio Completo
              </button>
              <button
                type="button"
                aria-pressed={newMode === "conditional"}
                onClick={() => setNewMode("conditional")}
              >
                Premio Condicional
              </button>
            </div>
            <div className="service-browse-equation">
              <span className="service-browse-object">Este servicio</span>
              <span>+</span>
              <label className="service-browse-coins">
                <input
                  aria-label="T-Coins requeridos para el nuevo premio"
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  placeholder="5"
                  disabled={!newMode}
                  value={newCoins}
                  onChange={(e) => setNewCoins(e.target.value)}
                  onBlur={() => createReward(Number(newCoins))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      createReward(Number(newCoins));
                    }
                  }}
                />
                <Icon coin />
              </label>
            </div>
            {newMode === "conditional" && (
              <p className="service-browse-hint">
                Indicá los T-Coins y elegí el producto o el importe adicional
                del premio.
              </p>
            )}
          </div>
        )}
        {rewards.length > 0 && !newMode && (
          <button
            className="service-browse-text-button"
            type="button"
            onClick={() => setNewMode("complete")}
          >
            Agregar otro premio
          </button>
        )}
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
        {offer && (
          <button
            type="button"
            className="service-browse-text-button"
            onClick={() =>
              update((d) => ({
                ...d,
                offers: d.offers.map((o: any) =>
                  o.id === offer.id ? { ...o, activo: !o.activo } : o,
                ),
              }))
            }
          >
            {offer.activo
              ? "Deshabilitar Offer temporalmente"
              : "Reactivar Offer"}
          </button>
        )}
      </fieldset>
    </div>
  );
}

function Reward({
  row,
  conditional,
  products,
  price,
  patch,
  remove,
}: {
  row: any;
  conditional: boolean;
  products: any[];
  price: number;
  patch: (v: any) => void;
  remove: () => void;
}) {
  const [mode, setMode] = React.useState(
    conditional ? "conditional" : "complete",
  );
  const chooseMode = (next: string) => {
    setMode(next);
    if (next === "complete")
      patch({ tipo: "servicio", objeto_id: row.servicio_id, copago: 0 });
    else if (row.tipo === "servicio" && !row.copago) patch({ activo: false });
  };
  const invalidCondition =
    mode === "conditional" && row.tipo === "servicio" && !(row.copago > 0);
  return (
    <div className="service-browse-reward">
      <div
        className="service-browse-modes"
        role="group"
        aria-label={`Tipo de premio: ${row.nombre}`}
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
          <select
            className="service-browse-object"
            aria-label="Premio a entregar"
            value={row.tipo === "producto" ? row.objeto_id : "service"}
            onChange={(e) =>
              patch({
                tipo: e.target.value === "service" ? "servicio" : "producto",
                objeto_id:
                  e.target.value === "service"
                    ? row.servicio_id
                    : e.target.value,
                copago: 0,
                activo: e.target.value !== "service" && row.activo,
              })
            }
          >
            <option value="service">Este servicio</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        ) : (
          <span className="service-browse-object">Este servicio</span>
        )}
        <span>+</span>
        <label className="service-browse-coins">
          <input
            type="number"
            aria-label="T-Coins requeridos"
            min="1"
            max="100000"
            step="1"
            value={row.monedas}
            onChange={(e) => patch({ monedas: Number(e.target.value) })}
          />
          <Icon coin />
        </label>
      </div>
      {mode === "conditional" && (
        <div className="service-browse-condition">
          {row.tipo === "producto" ? (
            <span>
              El cliente debe reservar y abonar este servicio para recibir el
              producto.
            </span>
          ) : (
            <label>
              Importe adicional en el local{" "}
              <input
                aria-label="Importe adicional en el local"
                type="number"
                min="0.01"
                max={price - 0.01}
                step="0.01"
                placeholder="$"
                value={row.copago || ""}
                onChange={(e) => patch({ copago: Number(e.target.value) })}
              />
            </label>
          )}
        </div>
      )}
      {!row.activo && (
        <button
          type="button"
          className="service-browse-text-button"
          disabled={invalidCondition}
          onClick={() => patch({ activo: true })}
        >
          Publicar premio
        </button>
      )}
      <details className="service-browse-options">
        <summary>Opciones del premio</summary>
        <div>
          <label>
            Nombre del premio
            <input
              maxLength={100}
              value={row.nombre}
              onChange={(e) => patch({ nombre: e.target.value })}
            />
          </label>
          <label>
            Unidades disponibles
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Sin límite"
              value={row.stock ?? ""}
              onChange={(e) =>
                patch({
                  stock: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
          {row.activo && (
            <button type="button" onClick={() => patch({ activo: false })}>
              Deshabilitar premio temporalmente
            </button>
          )}
          <button
            type="button"
            className="service-browse-remove"
            onClick={remove}
          >
            Quitar premio
          </button>
        </div>
      </details>
    </div>
  );
}
