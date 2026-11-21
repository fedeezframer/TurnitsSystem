import * as React from "react";
import "./offer-cards.css";

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export function OfferCards({ offers, services, members, busy, onCreate, onEdit, onToggle, onDelete }: {
  offers: any[]; services: any[]; members: any[]; busy: boolean;
  onCreate: () => void; onEdit: (id: string) => void; onToggle: (id: string) => void; onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = React.useState<"all" | "active" | "paused">("all");
  const [search, setSearch] = React.useState("");
  const rows = offers.filter(offer => {
    if (filter === "active" && !offer.activo) return false;
    if (filter === "paused" && offer.activo) return false;
    const service = services.find(item => item.id === offer.servicio_id);
    const member = members.find(item => item.id === offer.equipo_id);
    return [service?.nombre, member?.nombre, member?.apellido].filter(Boolean).join(" ").toLocaleLowerCase("es-AR").includes(search.toLocaleLowerCase("es-AR"));
  }).sort((a, b) => Number(b.activo) - Number(a.activo));
  return <div className="offer-catalog">
    <div className="offer-catalog-toolbar">
      <input type="search" aria-label="Buscar ofertas" placeholder="Buscar servicio o profesional" value={search} onChange={event => setSearch(event.target.value)} />
      <div role="group" aria-label="Filtrar ofertas" className="offer-catalog-filters">{([["all", "Todas"], ["active", "Activas"], ["paused", "Pausadas"]] as const).map(([id, label]) => <button type="button" key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
      <button type="button" className="offer-catalog-create" disabled={busy || !services.length || !members.length} onClick={onCreate}>Crear +</button>
    </div>
    {!offers.length && <p className="offer-catalog-empty">Todavía no hay ofertas. Creá una para ocupar horarios libres con un precio especial.</p>}
    {!!offers.length && !rows.length && <p className="offer-catalog-empty">No hay ofertas que coincidan con esos filtros.</p>}
    <div className="offer-catalog-grid">{rows.map(offer => {
      const service = services.find(item => item.id === offer.servicio_id);
      const member = members.find(item => item.id === offer.equipo_id);
      const image = service?.imagen_url || String(service?.descripcion || "").match(/^\[img:(.*?)\]/s)?.[1];
      const windows = offer.franjas?.length ? offer.franjas.map((window: any) => `${DAYS[window.dia]} ${window.desde}–${window.hasta}`).join(" · ") : "Todos los horarios libres";
      return <article className="offer-catalog-card" key={offer.id}>
        <div className="offer-catalog-cover">{image ? <img src={image} alt="" /> : <span>{(service?.nombre || "Oferta").slice(0, 1)}</span>}<b>{offer.activo ? "Activa" : "Pausada"}</b></div>
        <div className="offer-catalog-body"><strong>{service?.nombre || "Elegí un servicio"}</strong><span>Con {member ? `${member.nombre} ${member.apellido || ""}`.trim() : "un profesional"}</span><div className="offer-catalog-prices"><b>{Number(offer.precio_minimo) > 0 ? `Desde $${Number(offer.precio_minimo).toLocaleString("es-AR")}` : "Definí la tarifa mínima"}</b>{Number(service?.precio) > 0 && <s>${Number(service.precio).toLocaleString("es-AR")}</s>}</div><small>{windows}</small></div>
        <div className="offer-catalog-actions"><button type="button" onClick={() => onEdit(offer.id)}>Editar</button><details><summary aria-label={`Más opciones para ${service?.nombre || "la oferta"}`}>···</summary><div><button type="button" onClick={() => onToggle(offer.id)}>{offer.activo ? "Pausar" : "Activar"}</button><button type="button" onClick={() => onDelete(offer.id)}>Eliminar</button></div></details></div>
      </article>;
    })}</div>
  </div>;
}
