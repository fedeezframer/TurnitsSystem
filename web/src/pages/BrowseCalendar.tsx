import * as React from "react";
import {
  calendarMonthDays,
  shiftCalendarMonth,
  shiftCalendarDay,
  calendarLabel,
} from "../shared/browse-calendar.js";

export default function BrowseCalendar({
  today,
  appointments,
  businesses,
  onDetails,
  busy,
  onExplore,
}: any) {
  const [month, setMonth] = React.useState(today.slice(0, 7));
  const [selected, setSelected] = React.useState(today);
  const grid = React.useRef<HTMLDivElement>(null);
  const days = calendarMonthDays(month);
  const byDate = React.useMemo(() => {
    const grouped = new Map<string, any[]>();
    appointments
      .filter((t: any) => t.estado !== "cancelado")
      .forEach((t: any) =>
        grouped.set(t.fecha, [...(grouped.get(t.fecha) || []), t]),
      );
    grouped.forEach((items) =>
      items.sort((a, b) => String(a.hora).localeCompare(String(b.hora))),
    );
    return grouped;
  }, [appointments]);
  const events = byDate.get(selected) || [];
  const select = (day: string, focus = false) => {
    setSelected(day);
    setMonth(day.slice(0, 7));
    if (focus)
      requestAnimationFrame(() =>
        grid.current
          ?.querySelector<HTMLButtonElement>(`[data-day="${day}"]`)
          ?.focus(),
      );
  };
  const previousToday = React.useRef(today);
  React.useEffect(() => {
    if (selected === previousToday.current) {
      setSelected(today);
      setMonth(today.slice(0, 7));
    }
    previousToday.current = today;
  }, [today]);
  const moveMonth = (delta: number) => {
    const next = shiftCalendarMonth(month, delta);
    setMonth(next);
    setSelected(next === today.slice(0, 7) ? today : next + "-01");
  };
  const business = (t: any) => businesses.find((n: any) => n.slug === t.slug);
  return (
    <div className="browse-agenda-layout">
      <section className="browse-month" aria-label="Calendario de tus turnos">
        <div className="browse-month-toolbar">
          <h2 aria-live="polite">
            {calendarLabel(month + "-01", { month: "long", year: "numeric" })}
          </h2>
          <div>
            <button
              className="browse-month-today"
              onClick={() => select(today)}
            >
              Hoy
            </button>
            <button aria-label="Mes anterior" onClick={() => moveMonth(-1)}>
              ‹
            </button>
            <button aria-label="Mes siguiente" onClick={() => moveMonth(1)}>
              ›
            </button>
          </div>
        </div>
        <div className="browse-calendar" ref={grid}>
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
            <span className="browse-weekday" key={d}>
              {d}
            </span>
          ))}
          {days.map((day: string) => {
            const items = byDate.get(day) || [];
            return (
              <button
                key={day}
                data-day={day}
                className={`browse-day${day === selected ? " selected" : ""}${day === today ? " is-today" : ""}${day.slice(0, 7) !== month ? " outside-month" : ""}${items.length ? " has-events" : ""}`}
                aria-label={`${calendarLabel(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${day === today ? ", hoy" : ""}, ${items.length} ${items.length === 1 ? "turno" : "turnos"}`}
                aria-pressed={day === selected}
                aria-current={day === today ? "date" : undefined}
                tabIndex={day === selected ? 0 : -1}
                onClick={() => select(day)}
                onKeyDown={(e) => {
                  const delta: Record<string, number> = {
                    ArrowLeft: -1,
                    ArrowRight: 1,
                    ArrowUp: -7,
                    ArrowDown: 7,
                  };
                  if (delta[e.key]) {
                    e.preventDefault();
                    select(shiftCalendarDay(day, delta[e.key]), true);
                  }
                }}
              >
                <span className="browse-day-number">
                  {Number(day.slice(8))}
                </span>
                {items.length > 0 && (
                  <>
                    <span className="browse-day-dot" />
                    <span className="browse-day-preview">
                      {items.slice(0, 2).map((t) => (
                        <span key={t.id}>
                          <b>{String(t.hora).slice(0, 5)}</b>{" "}
                          {t.servicio_nombre}
                        </span>
                      ))}
                      {items.length > 2 && (
                        <small>+{items.length - 2} más</small>
                      )}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
        <div className="browse-calendar-legend">
          <span /> Día con turnos <span className="today" /> Hoy
        </div>
      </section>
      <section
        className="browse-calendar-events"
        aria-label="Turnos del día seleccionado"
        aria-live="polite"
      >
        <div className="browse-day-heading">
          <span>{calendarLabel(selected, { weekday: "long" })}</span>
          <h2>{calendarLabel(selected, { day: "numeric", month: "long" })}</h2>
          <p>
            {events.length
              ? `${events.length} ${events.length === 1 ? "turno programado" : "turnos programados"}`
              : "Tu día, sin compromisos"}
          </p>
        </div>
        {events.length ? (
          events.map((t: any) => {
            const n = business(t);
            return (
              <article className="browse-appointment" key={t.id}>
                <time>
                  {String(t.hora).slice(0, 5)}
                  <small>hs</small>
                </time>
                <div className="browse-appointment-info">
                  <span className="browse-appointment-business">
                    {n?.foto_perfil_url ? (
                      <img src={n.foto_perfil_url} alt="" />
                    ) : (
                      <i>
                        {(n?.nombre || t.slug || "T").slice(0, 1).toUpperCase()}
                      </i>
                    )}
                    {n?.nombre || t.slug}
                  </span>
                  <h3>{t.servicio_nombre}</h3>
                  {t.equipo_nombre && <p>{t.equipo_nombre}</p>}
                  <span
                    className={`browse-booking-status ${t.estado === "pendiente" ? "pending" : ""}`}
                  >
                    {t.estado === "pendiente" ? "Pendiente" : "Confirmado"}
                  </span>
                </div>
                <button disabled={busy} onClick={() => onDetails(t)}>
                  Ver Detalles
                </button>
              </article>
            );
          })
        ) : (
          <div className="browse-day-empty">
            <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <rect
                x="13"
                y="15"
                width="38"
                height="38"
                rx="8"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M23 10v10m18-10v10M13 27h38M25 38l5 5 10-11"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p>No tenés turnos para este día.</p>
            <button onClick={onExplore}>Explorar servicios</button>
          </div>
        )}
      </section>
    </div>
  );
}
