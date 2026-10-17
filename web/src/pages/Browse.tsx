import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { appConfig } from "../config";
import { ACCOUNT_CATEGORIES } from "../shared/categories.js";
import { consumerHeaders } from "../shared/consumer-session";
import "./Browse.css";

type View = "inicio" | "ofertas" | "agenda" | "buscar" | "coins" | "perfil";
const money = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n || 0);
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const dateLabel = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  });
const clean = (s: string) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const rewardCash = (item: any, memberId: string) =>
  item.tipo === "producto"
    ? Number(
        item.servicio.equipo.find((e: any) => e.id === memberId)?.precio ??
          item.servicio.precio,
      )
    : Number(item.copago || 0);
export function BrowseIcon({
  name,
  ...props
}: {
  name: string;
  [key: string]: any;
}) {
  const paths: Record<string, React.ReactNode> = {
    inicio: (
      <>
        <path d="m3 10 9-8 9 8M5 9v12h5v-7h4v7h5V9" />
        <path d="M8 11h1" />
      </>
    ),
    ofertas: (
      <path d="M13 2c1 5-3 6-2 10 2-1 3-3 3-5 5 4 7 8 4 12-4 5-13 2-13-4 0-3 2-5 3-7 0 4 1 4 2 5-2-5 3-7 3-11Z" />
    ),
    agenda: (
      <>
        <rect x="3" y="5" width="18" height="17" rx="1" />
        <path d="M7 2v6m10-6v6M3 10h18M7 14h1m4 0h1m4 0h1M7 18h1m4 0h1m4 0h1" />
      </>
    ),
    buscar: (
      <>
        <circle cx="10" cy="10" r="7" />
        <path d="m15 15 6 6" />
      </>
    ),
    coins: (
      <g transform="rotate(24 12 12)">
        <ellipse cx="11" cy="12" rx="5" ry="10" />
        <path d="M11 2h4c7 0 7 20 0 20h-4M16 6h3m-2 5h4m-5 5h3" />
      </g>
    ),
    perfil: (
      <>
        <circle cx="12" cy="7" r="4" fill="currentColor" stroke="none" />
        <path
          d="M4 22v-4a8 8 0 0 1 16 0v4Z"
          fill="currentColor"
          stroke="none"
        />
      </>
    ),
    pin: (
      <>
        <path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 0 1 14 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    estrella: <path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" />,
    imagen: (
      <>
        <rect x="2" y="3" width="20" height="18" rx="2" />
        <circle cx="16" cy="8" r="2" />
        <path d="m2 17 6-7 7 8 3-3 4 5" />
      </>
    ),
    candado: (
      <>
        <rect x="4" y="10" width="16" height="12" rx="1" />
        <path d="M7 10V7a5 5 0 0 1 10 0v3M12 15v3" />
      </>
    ),
    correo: (
      <>
        <rect x="2" y="4" width="20" height="16" rx="1" />
        <path d="m2 4 10 9L22 4M2 20l7-8m13 8-7-8" />
      </>
    ),
    papelera: (
      <>
        <path d="M3 5h18M9 5V2h6v3M5 5l1 17h12l1-17M10 9v9m4-9v9" />
      </>
    ),
    brillo: (
      <path d="M12 2v20M3 12h18M12 5c0 6-1 7-6 7 5 0 6 1 6 7 0-6 1-7 6-7-5 0-6-1-6-7Z" />
    ),
    salir: (
      <>
        <path d="M10 3H3v18h7m5-5 5-4-5-4m-8 4h13" />
      </>
    ),
  };
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name] || paths.buscar}
    </svg>
  );
}
function Avatar({ name, src }: any) {
  return (
    <span className="browse-avatar">
      {src ? (
        <img src={src} alt="" />
      ) : (
        String(name || "T")
          .slice(0, 1)
          .toUpperCase()
      )}
    </span>
  );
}
function Empty({ children }: any) {
  return <p className="browse-empty">{children}</p>;
}
function Distance({ item, location }: any) {
  const n = item?.negocio;
  if (!location || n?.latitud == null || n?.longitud == null) return null;
  const rad = (x: number) => (x * Math.PI) / 180;
  const a =
    Math.sin(rad(n.latitud - location.lat) / 2) ** 2 +
    Math.cos(rad(location.lat)) *
      Math.cos(rad(n.latitud)) *
      Math.sin(rad(n.longitud - location.lon) / 2) ** 2;
  const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (
    <span className="browse-distance">
      {km.toFixed(1)} km
      <BrowseIcon name="pin" width="13" height="13" />
    </span>
  );
}
function Card({ item, location, onReserve, kind = "servicio" }: any) {
  const s = item.servicio || item,
    n = item.negocio || s.negocio;
  return (
    <article
      className={`browse-card ${kind === "offer" ? "browse-card-offer" : ""}`}
    >
      <div className="browse-card-photo">
        {s.imagen ? (
          <img
            src={s.imagen}
            alt={s.nombre}
            loading="lazy"
            onError={(e) => (e.currentTarget.style.visibility = "hidden")}
          />
        ) : (
          <BrowseIcon name="imagen" />
        )}
        <Avatar name={n?.nombre} src={n?.foto_perfil_url} />
        <Link
          className="browse-card-profile"
          to={`/perfil/${encodeURIComponent(s.slug)}`}
        >
          Ver Perfil
        </Link>
        {kind === "offer" && (
          <span className="browse-card-fire">
            <BrowseIcon name="ofertas" />
          </span>
        )}
      </div>
      <div className="browse-card-content">
        <div className="browse-card-business">
          <span>{n?.nombre || s.slug}</span>
          <Distance item={{ negocio: n }} location={location} />
        </div>
        <div className="browse-card-name">
          {kind === "reward" ? item.nombre : s.nombre}
          {kind === "offer" && <b className="browse-time">{item.hora}hs</b>}
        </div>
        <div className="browse-card-footer">
          <div className="browse-card-price">
            {kind === "reward" ? (
              <>
                {item.tipo === "producto"
                  ? money(s.precio) + " + "
                  : Number(item.copago) > 0
                    ? money(item.copago) + " + "
                    : ""}
                {item.monedas}
                <BrowseIcon name="coins" width="22" height="25" />
              </>
            ) : (
              <>
                {money(Number(s.precio))}
                {s.precio_original > Number(s.precio) && (
                  <del>{money(s.precio_original)}</del>
                )}
              </>
            )}
          </div>
          <div className="browse-card-actions">
            {kind !== "offer" && (
              <Link to={`/agenda/${encodeURIComponent(s.slug)}`}>
                Ver Agenda
              </Link>
            )}
            {kind === "servicio" ? (
              <Link
                className="browse-pill"
                to={`/agenda/${encodeURIComponent(s.slug)}?servicio_id=${encodeURIComponent(s.id)}`}
              >
                Reservar
              </Link>
            ) : (
              <button
                className="browse-pill"
                type="button"
                onClick={() => onReserve(item)}
              >
                {kind === "reward" ? "Canjear" : "Reservar"}
              </button>
            )}
          </div>
        </div>
        {kind === "offer" && (
          <small>
            El descuento termina en{" "}
            {Math.max(
              0,
              Math.ceil((Date.parse(item.cierre) - Date.now()) / 60000),
            )}{" "}
            min
          </small>
        )}
        {kind === "reward" && item.tipo === "producto" && (
          <small>Producto al consumir {s.nombre}</small>
        )}
      </div>
    </article>
  );
}
function Modal({ title, children, onClose, busy = false }: any) {
  const heading = React.useId(),
    ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="browse-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className="browse-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={heading}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) onClose();
          if (e.key === "Tab") {
            const fields = ref.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled),input,select,a[href]",
            );
            if (!fields?.length) return;
            const first = fields[0],
              last = fields[fields.length - 1];
            if (
              e.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === ref.current)
            ) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <button
          className="browse-close"
          aria-label="Cerrar"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
        <h2 id={heading}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export default function Browse() {
  const navigate = useNavigate(),
    [params, setParams] = useSearchParams(),
    rawView = params.get("vista") || "inicio",
    view: View = [
      "inicio",
      "ofertas",
      "agenda",
      "buscar",
      "coins",
      "perfil",
    ].includes(rawView)
      ? (rawView as View)
      : "inicio";
  const [catalog, setCatalog] = React.useState<any>({
      servicios: [],
      negocios: [],
      recompensas: [],
    }),
    [me, setMe] = React.useState<any>(null),
    [offers, setOffers] = React.useState<any[]>([]),
    [loading, setLoading] = React.useState(true),
    [error, setError] = React.useState(""),
    [offerError, setOfferError] = React.useState(""),
    [query, setQuery] = React.useState(""),
    [category, setCategory] = React.useState(""),
    [more, setMore] = React.useState(false),
    [location, setLocation] = React.useState<any>(null),
    [geoError, setGeoError] = React.useState(""),
    [selectedDate, setSelectedDate] = React.useState(today()),
    [modal, setModal] = React.useState<any>(null),
    [busy, setBusy] = React.useState(false),
    [actionError, setActionError] = React.useState(""),
    [notice, setNotice] = React.useState(""),
    [slots, setSlots] = React.useState<any[]>([]),
    [slotLoading, setSlotLoading] = React.useState(false),
    [form, setForm] = React.useState<any>({}),
    [revision, setRevision] = React.useState(0);
  const searchInput = React.useRef<HTMLInputElement>(null);
  const changeView = (v: View) => {
    setParams(v === "inicio" ? {} : { vista: v });
    setNotice("");
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };
  React.useEffect(() => {
    if (view === "buscar" && !loading)
      searchInput.current?.focus({ preventScroll: true });
  }, [view, loading]);
  const api = React.useCallback(
    async (path: string, options: RequestInit = {}) => {
      const r = await fetch(appConfig.apiUrl + path, {
        ...options,
        headers: { ...consumerHeaders(), ...options.headers },
        cache: "no-store",
      });
      const d = await r.json().catch(() => null);
      if (r.status === 401) {
        navigate("/login?tipo=usuario", { replace: true });
        throw new Error("Iniciá sesión para continuar.");
      }
      if (!r.ok || !d?.success)
        throw new Error(
          d?.error || "No pudimos conectar con Turnits. Volvé a intentar.",
        );
      return d;
    },
    [navigate],
  );
  React.useEffect(() => {
    document.title = "Turnits | Browse";
    return () => {
      document.title = "Turnits";
    };
  }, []);
  React.useEffect(() => {
    if (!consumerHeaders().Authorization) {
      navigate("/login?tipo=usuario", { replace: true });
      return;
    }
    const controller = new AbortController();
    setError("");
    Promise.all([
      api("/browse/catalogo", { signal: controller.signal }),
      api("/browse/me", { signal: controller.signal }),
    ])
      .then(([c, m]) => {
        setCatalog(c);
        setMe(m);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, navigate, revision]);
  React.useEffect(() => {
    if (view !== "ofertas") return;
    let active = true;
    const controller = new AbortController();
    const load = () =>
      api("/browse/ofertas", { signal: controller.signal })
        .then((d) => {
          if (active) {
            setOffers(d.ofertas);
            setOfferError("");
          }
        })
        .catch((e) => {
          if (active && !controller.signal.aborted) setOfferError(e.message);
        });
    load();
    const timer = setInterval(load, 30000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [view, api, revision]);
  React.useEffect(() => {
    if (modal?.type !== "reward" || !form.fecha || !form.equipo_id) return;
    const controller = new AbortController();
    setSlotLoading(true);
    setSlots([]);
    setForm((f: any) => ({ ...f, hora: "" }));
    fetch(
      `${appConfig.apiUrl}/slots-disponibles/${encodeURIComponent(modal.item.slug)}?fecha=${form.fecha}&servicio_id=${modal.item.servicio_id}&equipo_id=${form.equipo_id}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok || !d.success)
          throw new Error(d.error || "No pudimos cargar los horarios.");
        setSlots((d.slots || []).filter((s: any) => !s.lleno));
      })
      .catch((e) => {
        if (!controller.signal.aborted) setActionError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSlotLoading(false);
      });
    return () => controller.abort();
  }, [modal, form.fecha, form.equipo_id]);
  const open = (data: any) => {
    setActionError("");
    setForm({});
    setModal(data);
  };
  const act = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      await fn();
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const post = (path: string, body: any) =>
    api(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const logout = () => {
    [
      "access_token",
      "auth_token",
      "user_slug",
      "auth_slug",
      "account_type",
      "user_email",
    ].forEach((k) => localStorage.removeItem(k));
    navigate("/login?tipo=usuario", { replace: true });
  };
  const eligible = catalog.servicios.filter(
    (s: any) =>
      !category ||
      s.negocio?.rubro === category ||
      clean(s.negocio?.categoria).includes(
        clean(
          ACCOUNT_CATEGORIES.find((c) => c.id === category)?.label || category,
        ),
      ),
  );
  const matches = eligible.filter(
    (s: any) =>
      !query ||
      clean(
        [
          s.nombre,
          s.negocio?.nombre,
          s.negocio?.ciudad,
          s.negocio?.categoria,
        ].join(" "),
      ).includes(clean(query)),
  );
  const recommended = [...eligible].sort(
    (a: any, b: any) =>
      Number(me?.perfil?.intereses?.includes(b.negocio.rubro)) -
      Number(me?.perfil?.intereses?.includes(a.negocio.rubro)),
  );
  const suggestions = [...new Set(catalog.servicios.map((s: any) => s.nombre))]
    .filter((s: any) => !query || clean(s).includes(clean(query)))
    .slice(0, 8) as string[];
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(`${today()}T12:00:00`);
    d.setDate(d.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const appointments = me?.turnos || [],
    events = appointments.filter(
      (t: any) => t.fecha === selectedDate && t.estado !== "cancelado",
    );
  const recent = appointments.find(
      (t: any) => t.estado === "confirmado" && t.fecha < today(),
    ),
    recentService = catalog.servicios.find(
      (s: any) => s.id === recent?.servicio_id,
    );
  const searchBox = (
    <label className="browse-search">
      <BrowseIcon name="buscar" width="21" height="21" />
      <input
        ref={searchInput}
        type="search"
        placeholder="Buscar"
        aria-label="Buscar servicios o negocios"
        value={query}
        onFocus={() => {
          if (view !== "buscar") changeView("buscar");
        }}
        onChange={(e) => setQuery(e.target.value)}
      />
    </label>
  );
  const status = loading ? (
    <p className="browse-empty" role="status">
      Cargando tu espacio…
    </p>
  ) : error ? (
    <div className="browse-empty" role="alert">
      {error}
      <button
        className="browse-pill"
        onClick={() => {
          setLoading(true);
          setRevision((v) => v + 1);
        }}
      >
        Reintentar
      </button>
    </div>
  ) : null;
  const reserveOffer = async (item: any) => {
    const d = await post("/browse/reservar", {
      slug: item.slug,
      servicio_id: item.servicio_id,
      equipo_id: item.equipo_id,
      fecha: item.fecha,
      hora: item.hora,
      oferta_id: item.id,
      precio: Number(item.precio),
    });
    setModal({ type: "pay", turno: d.turno });
    setRevision((v) => v + 1);
  };
  return (
    <div className="browse">
      <header className="browse-header">
        <Link
          to="/browse"
          aria-label="Turnits, inicio"
          className="browse-wordmark"
        >
          turnits
        </Link>
        <div>
          <button
            aria-label="T-Coins"
            className={view === "coins" ? "selected" : ""}
            onClick={() => changeView("coins")}
          >
            <BrowseIcon name="coins" />
          </button>
          <button
            aria-label="Mi perfil"
            className={view === "perfil" ? "selected" : ""}
            onClick={() => changeView("perfil")}
          >
            <BrowseIcon name="perfil" />
          </button>
        </div>
      </header>
      <main className={`browse-main browse-view-${view}`}>
        {status}
        {!status && (
          <>
            {view === "inicio" && (
              <>
                {searchBox}
                <section className="browse-home-intro">
                  <h1>¡Hola, {me?.perfil?.nombre_persona || "bienvenido"}!</h1>
                  <p>Explorá los servicios y ofertas de hoy</p>
                </section>
                <div className="browse-home-layout">
                  {recent && recentService ? (
                    <article className="browse-last-visit">
                      <img
                        src={
                          recentService.imagen ||
                          recentService.negocio.banner_url
                        }
                        alt={recentService.nombre}
                      />
                      <Avatar
                        name={recentService.negocio.nombre}
                        src={recentService.negocio.foto_perfil_url}
                      />
                      <span className="browse-last-service">
                        {recentService.nombre}
                      </span>
                      <div>
                        ¿Cómo te fue en {recentService.negocio.nombre}?
                        <p>Las reseñas estarán disponibles próximamente.</p>
                      </div>
                    </article>
                  ) : (
                    <div className="browse-welcome">
                      <h2>Tu próximo turno empieza acá</h2>
                      <p>
                        Encontrá un servicio y reservá en la agenda del negocio.
                      </p>
                    </div>
                  )}
                  <section className="browse-categories">
                    <h2>Categorías</h2>
                    <div className="browse-category-art">
                      <svg viewBox="22 525 400 300" aria-hidden="true">
                        <image
                          href="/assets/browse/categories-reference.jpg"
                          width="440"
                          height="945"
                        />
                      </svg>
                      <button
                        aria-label="Barberías"
                        onClick={() => {
                          setCategory("barberia");
                          changeView("buscar");
                        }}
                      />
                      <button
                        aria-label="Estética, manicura y peluquería"
                        onClick={() => {
                          setCategory("manicura");
                          changeView("buscar");
                        }}
                      />
                      <button
                        aria-label="Consultoría"
                        onClick={() => {
                          setCategory("consultoria");
                          changeView("buscar");
                        }}
                      />
                      <button
                        aria-label="Más categorías"
                        onClick={() => setMore(!more)}
                      />
                    </div>
                    {more && (
                      <div className="browse-category-options">
                        {ACCOUNT_CATEGORIES.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setCategory(c.id);
                              changeView("buscar");
                            }}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
                <section className="browse-discovery">
                  <h2>Servicios que pueden interesarte</h2>
                  <p>Según los rubros que elegiste</p>
                  <div className="browse-card-grid">
                    {recommended.slice(0, 18).map((s: any) => (
                      <Card key={s.id} item={s} location={location} />
                    ))}
                  </div>
                  {!recommended.length && (
                    <Empty>
                      Todavía no hay servicios publicados. Volvé a mirar pronto.
                    </Empty>
                  )}
                </section>
              </>
            )}
            {view === "buscar" && (
              <>
                <h1>¿Qué estás buscando?</h1>
                <p>Buscá el perfil o servicio que querés</p>
                {searchBox}
                <div className="browse-filters">
                  <button
                    className={!category ? "selected" : ""}
                    onClick={() => setCategory("")}
                  >
                    Todos
                  </button>
                  {ACCOUNT_CATEGORIES.map((c) => (
                    <button
                      key={c.id}
                      className={category === c.id ? "selected" : ""}
                      onClick={() => setCategory(category === c.id ? "" : c.id)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <button
                  className="browse-location"
                  onClick={() => {
                    setGeoError("");
                    if (!navigator.geolocation) {
                      setGeoError(
                        "Tu navegador no permite consultar la ubicación.",
                      );
                      return;
                    }
                    navigator.geolocation.getCurrentPosition(
                      (p) =>
                        setLocation({
                          lat: p.coords.latitude,
                          lon: p.coords.longitude,
                        }),
                      () =>
                        setGeoError(
                          "No pudimos obtener tu ubicación. Podés seguir buscando por nombre o ciudad.",
                        ),
                      { timeout: 15000, maximumAge: 300000 },
                    );
                  }}
                >
                  <BrowseIcon name="pin" width="16" height="16" />
                  {location
                    ? "Ubicación activada"
                    : "Mostrar distancias con mi ubicación"}
                </button>
                {geoError && <p role="status">{geoError}</p>}
                {!query && !category && (
                  <section className="browse-suggestions">
                    <h2>Podría interesarte</h2>
                    {suggestions.map((s) => (
                      <button key={s} onClick={() => setQuery(s)}>
                        <BrowseIcon name="brillo" />
                        {s}
                      </button>
                    ))}
                  </section>
                )}
                <div className="browse-card-grid">
                  {matches.map((s: any) => (
                    <Card key={s.id} item={s} location={location} />
                  ))}
                </div>
                {!matches.length && (
                  <Empty>No encontramos servicios con esa búsqueda.</Empty>
                )}
              </>
            )}
            {view === "ofertas" && (
              <>
                <h1>Turnits Offers</h1>
                <p>
                  Encontrá servicios con descuentos en horarios especiales.
                  ¡Aprovechalos antes de que alguien más los reserve!
                </p>
                {offerError && <p role="alert">{offerError}</p>}
                <div className="browse-card-grid">
                  {offers.map((o: any) => {
                    const s = catalog.servicios.find(
                      (s: any) => s.id === o.servicio_id,
                    );
                    return (
                      s && (
                        <Card
                          key={o.id + o.fecha + o.hora}
                          kind="offer"
                          item={{
                            ...s,
                            ...o,
                            negocio: s.negocio,
                            imagen: o.imagen || s.imagen,
                          }}
                          location={location}
                          onReserve={(item: any) =>
                            open({ type: "offer", item })
                          }
                        />
                      )
                    );
                  })}
                </div>
                {!offerError && !offers.length && (
                  <Empty>
                    No hay ofertas activas ahora. Los descuentos aparecen en la
                    última hora antes del cierre de reservas de cada horario.
                  </Empty>
                )}
              </>
            )}
            {view === "coins" && (
              <>
                <h1>T-Coins</h1>
                <p>
                  Acumulá T-Coins y canjealos por descuentos, combos o servicios
                </p>
                <section className="browse-wallet">
                  <div>
                    <span>Tenés</span>
                    <strong>
                      {me?.billetera?.saldo || 0}
                      <BrowseIcon name="coins" />
                    </strong>
                  </div>
                  <div>
                    <b>$10.000 = 1 T-Coin</b>
                    <p>
                      Sólo se suman con pagos de reservas hechos dentro de
                      Turnits
                    </p>
                  </div>
                </section>
                <h2 className="browse-rewards-title">Canjeá tus T-Coins</h2>
                <div className="browse-card-grid">
                  {catalog.recompensas.map((r: any) => (
                    <Card
                      key={r.id}
                      kind="reward"
                      item={r}
                      location={location}
                      onReserve={(item) => {
                        open({ type: "reward", item });
                        setForm({
                          fecha: today(),
                          equipo_id: item.servicio.equipo[0]?.id || "",
                          hora: "",
                        });
                      }}
                    />
                  ))}
                </div>
                {!catalog.recompensas.length && (
                  <Empty>
                    Los negocios todavía no publicaron recompensas. Tus T-Coins
                    se guardan para futuros canjes.
                  </Empty>
                )}
                {me?.billetera?.movimientos?.length > 0 && (
                  <details className="browse-movements">
                    <summary>Movimientos de T-Coins</summary>
                    {me.billetera.movimientos.map((m: any) => (
                      <div key={m.id}>
                        <span>
                          {new Date(m.created_at).toLocaleDateString("es-AR")} ·{" "}
                          {m.motivo === "canje"
                            ? "Canje"
                            : m.motivo === "canje_cancelado"
                              ? "Canje cancelado"
                              : m.motivo === "pago_revertido"
                                ? "Pago revertido"
                                : "Pago de reserva"}
                        </span>
                        <b>
                          {m.monedas > 0 ? "+" : ""}
                          {m.monedas}
                        </b>
                      </div>
                    ))}
                  </details>
                )}
              </>
            )}
            {view === "agenda" && (
              <>
                <h1>Tu agenda</h1>
                <p>Gestioná todos tus turnos desde aquí</p>
                <div className="browse-calendar">
                  {Array.from({ length: 7 }, (_, row) => (
                    <React.Fragment key={row}>
                      {days.slice(row * 4, row * 4 + 4).map((d) => (
                        <button
                          key={d}
                          className={`${d === selectedDate ? "selected" : ""}${appointments.some((t: any) => t.fecha === d && t.estado !== "cancelado") ? " has-events" : ""}`}
                          onClick={() => setSelectedDate(d)}
                        >
                          {d === today() ? "Hoy" : dateLabel(d)}
                        </button>
                      ))}
                      {days
                        .slice(row * 4, row * 4 + 4)
                        .includes(selectedDate) && (
                        <section className="browse-calendar-events">
                          <span>{dateLabel(selectedDate)}</span>
                          {events.length ? (
                            events.map((t: any) => (
                              <div key={t.id}>
                                <Avatar
                                  name={
                                    catalog.negocios.find(
                                      (n: any) => n.slug === t.slug,
                                    )?.nombre || t.slug
                                  }
                                />
                                <span>{t.servicio_nombre}</span>
                                <strong>{String(t.hora).slice(0, 5)}hs</strong>
                                <button
                                  onClick={() =>
                                    act(async () => {
                                      const d = await api(
                                        "/browse/turnos/" + t.id,
                                      );
                                      open({
                                        type: "appointment",
                                        item: d.turno,
                                      });
                                    })
                                  }
                                >
                                  Ver Detalles
                                </button>
                              </div>
                            ))
                          ) : (
                            <p>No tenés turnos para este día.</p>
                          )}
                        </section>
                      )}
                    </React.Fragment>
                  ))}
                </div>
                {appointments.some((t: any) => t.fecha < today()) && (
                  <details className="browse-history">
                    <summary>Turnos anteriores</summary>
                    {appointments
                      .filter((t: any) => t.fecha < today())
                      .slice(0, 30)
                      .map((t: any) => (
                        <button
                          key={t.id}
                          onClick={() =>
                            act(async () => {
                              const d = await api("/browse/turnos/" + t.id);
                              open({ type: "appointment", item: d.turno });
                            })
                          }
                        >
                          {dateLabel(t.fecha)} · {t.servicio_nombre} ·{" "}
                          {t.estado}
                        </button>
                      ))}
                  </details>
                )}
              </>
            )}
            {view === "perfil" && (
              <>
                <h1>Perfil</h1>
                <p>Los prestadores te verán así</p>
                <section className="browse-profile-heading">
                  <label
                    className="browse-profile-photo"
                    aria-label="Subir foto de perfil"
                  >
                    <Avatar
                      name={me?.perfil?.nombre_persona}
                      src={me?.perfil?.foto_url}
                    />
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        act(async () => {
                          if (file.size > 3 * 1024 * 1024)
                            throw new Error("La foto debe pesar hasta 3 MB.");
                          const data = new FormData();
                          data.append("imagen", file);
                          await api("/browse/perfil/foto", {
                            method: "POST",
                            body: data,
                          });
                          setRevision((v) => v + 1);
                          setNotice("Foto actualizada.");
                        });
                      }}
                    />
                    <span>
                      <BrowseIcon name="imagen" />
                    </span>
                  </label>
                  <div>
                    <h2>
                      {me?.perfil?.nombre_persona} {me?.perfil?.apellido}
                    </h2>
                    <p>Turnos realizados: {me?.realizados || 0}</p>
                  </div>
                </section>
                <div className="browse-profile-settings">
                  <label>
                    Correo electrónico
                    <input value={me?.perfil?.email || ""} readOnly />
                  </label>
                  <label>
                    Teléfono
                    <input
                      value={"+" + (me?.perfil?.telefono || "")}
                      readOnly
                    />
                  </label>
                  <button
                    className="browse-profile-action"
                    onClick={() => {
                      open({ type: "profile" });
                      setForm({
                        ...me.perfil,
                        telefono: "+" + me.perfil.telefono,
                      });
                    }}
                  >
                    Editar mis datos
                    <BrowseIcon name="perfil" />
                  </button>
                  <button
                    className="browse-profile-action"
                    onClick={() => open({ type: "password" })}
                  >
                    Cambiar contraseña
                    <BrowseIcon name="candado" />
                  </button>
                  <button
                    className="browse-profile-action"
                    onClick={() => open({ type: "email" })}
                  >
                    Cambiar correo electrónico
                    <BrowseIcon name="correo" />
                  </button>
                  <button
                    className="browse-profile-action danger"
                    onClick={() => open({ type: "delete" })}
                  >
                    Eliminar mi cuenta
                    <BrowseIcon name="papelera" />
                  </button>
                </div>
                <button className="browse-logout" onClick={logout}>
                  <BrowseIcon name="salir" />
                  Cerrar sesión
                </button>
              </>
            )}
            {notice && (
              <p role="status" className="browse-notice">
                {notice}
              </p>
            )}
            {actionError && !modal && (
              <p role="alert" className="browse-error">
                {actionError}
              </p>
            )}
          </>
        )}
      </main>
      <nav className="browse-dock" aria-label="Navegación de Browse">
        {(["inicio", "ofertas", "agenda", "buscar"] as View[]).map((v) => (
          <button
            key={v}
            className={view === v ? "selected" : ""}
            aria-label={
              {
                inicio: "Inicio",
                ofertas: "Ofertas",
                agenda: "Tu agenda",
                buscar: "Buscar",
              }[v as "inicio"]
            }
            aria-current={view === v ? "page" : undefined}
            onClick={() => changeView(v)}
          >
            <BrowseIcon name={v} />
          </button>
        ))}
      </nav>
      {modal && (
        <Modal
          title={
            {
              offer: "Reservá esta oferta",
              pay: "Completá tu reserva",
              reward: "Canjeá tus T-Coins",
              appointment: "Detalle del turno",
              profile: "Editá tus datos",
              password: "Cambiar contraseña",
              email: "Cambiar correo electrónico",
              delete: "Eliminar mi cuenta",
            }[modal.type as "offer"]
          }
          busy={busy}
          onClose={() => setModal(null)}
        >
          {modal.type === "offer" && (
            <>
              <h3>{modal.item.nombre}</h3>
              <p>
                {dateLabel(modal.item.fecha)} · {modal.item.hora}hs
              </p>
              <strong>{money(modal.item.precio)}</strong>
              <p>
                El precio se confirma al reservar. El horario queda apartado
                mientras completás el pago, hasta el cierre de reservas.
              </p>
              <button
                className="browse-pill"
                disabled={busy}
                onClick={() => act(() => reserveOffer(modal.item))}
              >
                Continuar
              </button>
            </>
          )}
          {modal.type === "pay" && (
            <>
              <p>
                Tu horario está apartado. Pagá{" "}
                {money(Number(modal.turno.precio_cobrado))} antes de{" "}
                {new Date(modal.turno.browse_cierre).toLocaleTimeString(
                  "es-AR",
                  { hour: "2-digit", minute: "2-digit" },
                )}
                hs para confirmarlo.
              </p>
              <button
                className="browse-pill"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    const d = await post(
                      `/browse/ofertas/${modal.turno.id}/pagar`,
                      {},
                    );
                    window.location.assign(d.payment_url);
                  })
                }
              >
                Pagar con Mercado Pago
              </button>
              <p>
                Podés usar tu tarjeta o el dinero de tu cuenta de Mercado Pago.
              </p>
            </>
          )}
          {modal.type === "reward" && (
            <>
              <h3>{modal.item.nombre}</h3>
              <p>
                {modal.item.monedas} T-Coins
                {modal.item.tipo === "producto"
                  ? ` + ${money(rewardCash(modal.item, form.equipo_id))} por ${modal.item.servicio.nombre}`
                  : Number(modal.item.copago) > 0
                    ? ` + ${money(modal.item.copago)}`
                    : ""}
              </p>
              <p>
                Los importes adicionales se abonan en el local. El canje no
                tiene comisión de Turnits.
              </p>
              <label>
                Profesional
                <select
                  value={form.equipo_id || ""}
                  onChange={(e) =>
                    setForm({ ...form, equipo_id: e.target.value })
                  }
                >
                  {modal.item.servicio.equipo.map((e: any) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Día
                <input
                  type="date"
                  min={today()}
                  value={form.fecha || ""}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                />
              </label>
              <label>
                Horario
                <select
                  value={form.hora || ""}
                  onChange={(e) => setForm({ ...form, hora: e.target.value })}
                >
                  <option value="">
                    {slotLoading
                      ? "Cargando…"
                      : slots.length
                        ? "Elegí un horario"
                        : "No hay horarios disponibles"}
                  </option>
                  {slots.map((s) => (
                    <option key={s.hora} value={s.hora}>
                      {s.hora}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="browse-pill"
                disabled={
                  busy ||
                  !form.hora ||
                  (me?.billetera?.saldo || 0) < modal.item.monedas
                }
                onClick={() =>
                  act(async () => {
                    await post("/browse/reservar", {
                      slug: modal.item.slug,
                      servicio_id: modal.item.servicio_id,
                      equipo_id: form.equipo_id,
                      fecha: form.fecha,
                      hora: form.hora,
                      recompensa_id: modal.item.id,
                      precio: rewardCash(modal.item, form.equipo_id),
                    });
                    setModal(null);
                    setNotice(
                      "Canje confirmado. Ya podés ver el turno en tu agenda.",
                    );
                    setRevision((v) => v + 1);
                  })
                }
              >
                {(me?.billetera?.saldo || 0) < modal.item.monedas
                  ? "Te faltan T-Coins"
                  : "Confirmar canje"}
              </button>
            </>
          )}
          {modal.type === "appointment" && (
            <>
              <h3>{modal.item.servicio_nombre}</h3>
              <p>
                {dateLabel(modal.item.fecha)} ·{" "}
                {String(modal.item.hora).slice(0, 5)}hs
              </p>
              <p>{modal.item.equipo_nombre}</p>
              <p>
                Estado: {modal.item.estado} · Pago: {modal.item.pago_estado}
              </p>
              {modal.item.tc_gastados > 0 && (
                <p>T-Coins canjeados: {modal.item.tc_gastados}</p>
              )}
              <p>
                Total: {money(Number(modal.item.precio_cobrado))} · Abonado:{" "}
                {money(Number(modal.item.monto_pagado))}
              </p>
              {modal.item.browse_tipo === "offer" &&
                modal.item.estado === "pendiente" &&
                Date.parse(modal.item.browse_cierre) > Date.now() && (
                  <button
                    className="browse-pill"
                    onClick={() => setModal({ type: "pay", turno: modal.item })}
                  >
                    Continuar pago
                  </button>
                )}
              {modal.item.gestion_token &&
                modal.item.estado !== "cancelado" && (
                  <Link
                    className="browse-pill"
                    to={`/reprogramar?turno_id=${modal.item.id}&slug=${encodeURIComponent(modal.item.slug)}&token=${encodeURIComponent(modal.item.gestion_token)}`}
                  >
                    Gestionar turno
                  </Link>
                )}
            </>
          )}
          {["profile", "password", "email", "delete"].includes(modal.type) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act(async () => {
                  if (modal.type === "profile") {
                    await api("/browse/perfil", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        nombre_persona: form.nombre_persona,
                        apellido: form.apellido,
                        telefono: form.telefono,
                      }),
                    });
                    setNotice("Datos actualizados.");
                  } else if (modal.type === "password") {
                    await post("/browse/perfil/password", {
                      actual: form.password,
                      nueva: form.nueva,
                    });
                    setNotice("Contraseña actualizada.");
                  } else if (modal.type === "delete") {
                    await post("/browse/perfil/eliminar", {
                      password: form.password,
                      confirmacion: form.confirmacion,
                    });
                    logout();
                    return;
                  } else if (!form.enviado) {
                    await post("/browse/perfil/email", {
                      email: form.email,
                      password: form.password,
                    });
                    setForm({ ...form, enviado: true, password: "" });
                    return;
                  } else {
                    await post("/browse/perfil/email/verificar", {
                      codigo: form.codigo,
                    });
                    setNotice("Correo actualizado.");
                  }
                  setModal(null);
                  setRevision((v) => v + 1);
                });
              }}
            >
              {modal.type === "profile" ? (
                <>
                  {["nombre_persona", "apellido", "telefono"].map((key, i) => (
                    <label key={key}>
                      {["Nombre", "Apellido", "Teléfono internacional"][i]}
                      <input
                        required
                        value={form[key] || ""}
                        onChange={(e) =>
                          setForm({ ...form, [key]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                </>
              ) : (
                <>
                  {modal.type === "delete" && (
                    <>
                      <p>
                        Se eliminarán tu perfil, tus T-Coins y tu acceso. Los
                        turnos ya reservados siguen en la agenda del negocio;
                        gestioná esas reservas antes de continuar.
                      </p>
                      <label>
                        Escribí ELIMINAR
                        <input
                          required
                          value={form.confirmacion || ""}
                          onChange={(e) =>
                            setForm({ ...form, confirmacion: e.target.value })
                          }
                        />
                      </label>
                    </>
                  )}
                  {modal.type === "email" &&
                    (form.enviado ? (
                      <label>
                        Código enviado al correo nuevo
                        <input
                          required
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          pattern="[0-9]{6}"
                          maxLength={6}
                          value={form.codigo || ""}
                          onChange={(e) =>
                            setForm({ ...form, codigo: e.target.value })
                          }
                        />
                      </label>
                    ) : (
                      <label>
                        Nuevo correo
                        <input
                          required
                          type="email"
                          value={form.email || ""}
                          onChange={(e) =>
                            setForm({ ...form, email: e.target.value })
                          }
                        />
                      </label>
                    ))}
                  {!form.enviado && (
                    <label>
                      Contraseña actual
                      <input
                        required
                        type="password"
                        autoComplete="current-password"
                        value={form.password || ""}
                        onChange={(e) =>
                          setForm({ ...form, password: e.target.value })
                        }
                      />
                    </label>
                  )}
                  {modal.type === "password" && (
                    <label>
                      Nueva contraseña
                      <input
                        required
                        minLength={6}
                        type="password"
                        autoComplete="new-password"
                        value={form.nueva || ""}
                        onChange={(e) =>
                          setForm({ ...form, nueva: e.target.value })
                        }
                      />
                    </label>
                  )}
                </>
              )}
              <button
                disabled={busy}
                className={`browse-pill${modal.type === "delete" ? " danger" : ""}`}
                type="submit"
              >
                {modal.type === "email"
                  ? form.enviado
                    ? "Verificar correo"
                    : "Enviar código"
                  : modal.type === "delete"
                    ? "Eliminar mi cuenta"
                    : "Guardar cambios"}
              </button>
            </form>
          )}
          {busy && <p role="status">Procesando…</p>}
          {actionError && (
            <p role="alert" className="browse-error">
              {actionError}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
