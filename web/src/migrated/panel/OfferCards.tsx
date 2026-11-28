import PanelEmptyState from "../../components/PanelEmptyState"
import * as React from "react";
import { CatalogToolbar } from "./CatalogToolbar";
import { ServiciosManager_RowMenu } from "./servicios";
import "./offer-cards.css";

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
function OfferCardActions({ offer, service, editIcon, onEdit, onToggle, onDelete }: {
  offer: any; service: any; editIcon?: string;
  onEdit: (id: string) => void; onToggle: (id: string) => void; onDelete: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const anchor = React.useRef<HTMLButtonElement>(null);
  const regularPrice = Number(service?.precio);
  const minimumPrice = Number(offer.precio_minimo);
  const discount = regularPrice > minimumPrice && minimumPrice > 0 ? Math.round((1 - minimumPrice / regularPrice) * 100) : 0;
  React.useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!anchor.current?.contains(target) && !target.closest(".svc-row-menu")) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return <div className="offer-catalog-actions">
    <span className="offer-catalog-discount">{discount > 0 ? `${discount}% OFF` : minimumPrice > 0 ? `Desde $${minimumPrice.toLocaleString("es-AR")}` : "Sin tarifa"}</span>
    <button className="svc-edit-button" type="button" onClick={() => onEdit(offer.id)}>{editIcon ? <img src={editIcon} alt="" /> : <span aria-hidden="true">✎</span>}Editar</button>
    <button className="svc-more-button" type="button" ref={anchor} aria-label={`Opciones de ${service?.nombre || "la oferta"}`} aria-expanded={open} onClick={() => setOpen(value => !value)}>•••</button>
    {open && <ServiciosManager_RowMenu anchor={anchor}><button type="button" onClick={() => { setOpen(false); onToggle(offer.id); }}>{offer.activo ? "Pausar" : "Activar"}</button><button type="button" className="is-danger" onClick={() => { setOpen(false); onDelete(offer.id); }}>Eliminar</button></ServiciosManager_RowMenu>}
  </div>;
}
export function OfferCards({ offers, services, members, busy, editIcon, onCreate, onEdit, onToggle, onDelete }: {
  offers: any[]; services: any[]; members: any[]; busy: boolean;
  editIcon?: string;
  onCreate: () => void; onEdit: (id: string) => void; onToggle: (id: string) => void; onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = React.useState<"all" | "active" | "paused">("all");
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<"status" | "service" | "price">("status");
  const rows = offers.filter(offer => {
    if (filter === "active" && !offer.activo) return false;
    if (filter === "paused" && offer.activo) return false;
    const service = services.find(item => item.id === offer.servicio_id);
    const member = members.find(item => item.id === offer.equipo_id);
    return [service?.nombre, member?.nombre, member?.apellido].filter(Boolean).join(" ").toLocaleLowerCase("es-AR").includes(search.toLocaleLowerCase("es-AR"));
  }).sort((a, b) => sort === "service" ? String(services.find(item => item.id === a.servicio_id)?.nombre || "").localeCompare(String(services.find(item => item.id === b.servicio_id)?.nombre || ""), "es") : sort === "price" ? Number(a.precio_minimo) - Number(b.precio_minimo) : Number(b.activo) - Number(a.activo));
  return <div className="offer-catalog">
    <CatalogToolbar<"all" | "active" | "paused", "status" | "service" | "price"> filters={[{id:"all",label:"Todas"},{id:"active",label:"Activas"},{id:"paused",label:"Pausadas"}]} label="ofertas" filterValue={filter} onFilter={setFilter} sort={sort} onSort={setSort} opcionesOrden={[{id:"status",label:"Activas primero"},{id:"service",label:"Servicio A-Z"},{id:"price",label:"Tarifa más baja"}]} search={search} onSearch={setSearch} onCreate={!busy && services.length && members.length ? onCreate : undefined} />
    {!offers.length && <PanelEmptyState fullPage>Todavía no hay ofertas. Creá una para ocupar horarios libres con un precio especial.</PanelEmptyState>}
    {!!offers.length && !rows.length && <PanelEmptyState fullPage>No hay ofertas que coincidan con esos filtros.</PanelEmptyState>}
    <div className="offer-catalog-grid">{rows.map(offer => {
      const service = services.find(item => item.id === offer.servicio_id);
      const member = members.find(item => item.id === offer.equipo_id);
      const image = service?.imagen_url || String(service?.descripcion || "").match(/^\[img:(.*?)\]/s)?.[1];
      const windows = offer.franjas?.length ? offer.franjas.map((window: any) => `${DAYS[window.dia]} ${window.desde}–${window.hasta}`).join(" · ") : "Todos los horarios libres";
      return <article className="offer-catalog-card" key={offer.id}>
        <div className="offer-catalog-cover">{image ? <img src={image} alt="" /> : <span>{(service?.nombre || "Oferta").slice(0, 1)}</span>}<b>{offer.activo ? "Activa" : "Pausada"}</b></div>
        <div className="offer-catalog-body"><strong>{service?.nombre || "Elegí un servicio"}</strong><span>Con {member ? `${member.nombre} ${member.apellido || ""}`.trim() : "un profesional"}</span><div className="offer-catalog-prices"><b>{Number(offer.precio_minimo) > 0 ? `Desde $${Number(offer.precio_minimo).toLocaleString("es-AR")}` : "Definí la tarifa mínima"}</b>{Number(service?.precio) > 0 && <s>${Number(service.precio).toLocaleString("es-AR")}</s>}</div><small>{windows}</small></div>
        <OfferCardActions offer={offer} service={service} editIcon={editIcon} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} />
      </article>;
    })}</div>
  </div>;
}
