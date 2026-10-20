import * as React from "react";
import "./BrowseCalendar.css";
import { calendarMonthDays, shiftCalendarDay, shiftCalendarMonth, calendarLabel, calendarDate } from "../shared/browse-calendar.js";

const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const visibleAppointment = (turn: any) => turn.estado !== "cancelado" && (turn.browse_tipo !== "offer" || turn.pago_estado === "aprobado");

export default function BrowseCalendar({ today, appointments, businesses, onDetails, busy, onExplore }: any) {
  const [selected, setSelected] = React.useState(() => appointments
    .filter((t: any) => visibleAppointment(t) && t.fecha >= today && t.fecha.slice(0, 7) === today.slice(0, 7))
    .map((t: any) => t.fecha).sort()[0] || today);
  const [month, setMonth] = React.useState(today.slice(0, 7));
  const grid = React.useRef<HTMLDivElement>(null);
  const focusDay = React.useRef<string | null>(null);
  const days = React.useMemo(() => calendarMonthDays(month), [month]);
  const byDate = React.useMemo(() => {
    const map = new Map<string, any[]>();
    for (const t of appointments) {
      if (!visibleAppointment(t)) continue;
      map.set(t.fecha, [...(map.get(t.fecha) || []), t]);
    }
    map.forEach(items => items.sort((a, b) => String(a.hora).localeCompare(String(b.hora))));
    return map;
  }, [appointments]);
  const previousToday = React.useRef(today);
  React.useEffect(() => {
    if (selected === previousToday.current) {
      setSelected(today);
      setMonth(today.slice(0, 7));
    }
    previousToday.current = today;
  }, [today]);
  React.useEffect(() => {
    if (!focusDay.current) return;
    grid.current?.querySelector<HTMLElement>('[data-day="' + focusDay.current + '"]')?.focus();
    focusDay.current = null;
  }, [selected, month]);

  function select(day: string, focus = false) {
    if (focus) focusDay.current = day;
    setSelected(day);
    setMonth(day.slice(0, 7));
  }
  function changeMonth(delta: number) {
    const next = shiftCalendarMonth(month, delta);
    const firstAppointment = [...byDate.keys()].filter(day => day.startsWith(next)).sort()[0];
    select(next === today.slice(0, 7) ? today : firstAppointment || next + "-01");
  }
  function keyDown(event: React.KeyboardEvent, day: string) {
    const weekday = (calendarDate(day).getUTCDay() + 6) % 7;
    const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday };
    if (event.key in delta) {
      event.preventDefault();
      select(shiftCalendarDay(day, delta[event.key]), true);
    }
  }

  const events = byDate.get(selected) || [];
  const monthCount = appointments.filter((t: any) => visibleAppointment(t) && t.fecha.startsWith(month)).length;
  const fullDate = (day: string) => calendarLabel(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return <section className="browse-user-calendar" aria-label="Calendario de tus turnos">
    <div className="browse-calendar-month">
      <header className="browse-user-calendar-toolbar">
        <div>
          <h2 aria-live="polite">{calendarLabel(month + "-01", { month: "long", year: "numeric" })}</h2>
          <p>{monthCount ? monthCount + (monthCount === 1 ? " turno este mes" : " turnos este mes") : "Elegí un día para ver tus turnos"}</p>
        </div>
        <nav aria-label="Cambiar mes">
          <button className="browse-calendar-today" onClick={() => select(today)}>Hoy</button>
          <button aria-label="Mes anterior" onClick={() => changeMonth(-1)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12 5-5 5 5 5"/></svg></button>
          <button aria-label="Mes siguiente" onClick={() => changeMonth(1)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5"/></svg></button>
        </nav>
      </header>
      <div className="browse-calendar-weekdays" aria-hidden="true">{WEEKDAYS.map(day => <abbr key={day} title={day}>{day.slice(0, 3)}</abbr>)}</div>
      <div className="browse-user-calendar-grid" ref={grid} role="group" aria-label={"Días de " + calendarLabel(month + "-01", { month: "long", year: "numeric" })}>
        {days.map(day => {
          const dayEvents = byDate.get(day) || [];
          return <button key={day} data-day={day}
            className={"browse-user-calendar-day" + (!day.startsWith(month) ? " outside-month" : "") + (day === today ? " is-today" : "") + (day === selected ? " is-selected" : "")}
            tabIndex={day === selected ? 0 : -1} aria-pressed={day === selected} aria-current={day === today ? "date" : undefined}
            aria-label={fullDate(day) + ", " + dayEvents.length + (dayEvents.length === 1 ? " turno" : " turnos")}
            onClick={() => select(day)} onKeyDown={event => keyDown(event, day)}>
            <span className="browse-calendar-number">{Number(day.slice(-2))}</span>
            {dayEvents.length > 0 && <span className="browse-calendar-day-events" aria-hidden="true"><i/><span>{dayEvents.length} {dayEvents.length === 1 ? "turno" : "turnos"}</span></span>}
          </button>;
        })}
      </div>
      <div className="browse-user-calendar-legend"><span><i className="today"/>Hoy</span><span><i/>Con turnos</span></div>
    </div>
    <div className="browse-calendar-day-panel" aria-label={"Turnos del " + fullDate(selected)}>
      <header className="browse-calendar-day-heading" aria-live="polite">
        <span>{selected === today ? "Hoy" : calendarLabel(selected, { weekday: "long" })}</span>
        <h2>{calendarLabel(selected, { day: "numeric", month: "long" })}</h2>
        <p>{events.length ? events.length + (events.length === 1 ? " turno programado" : " turnos programados") : "No tenés turnos para este día"}</p>
      </header>
      {events.length ? <div className="browse-user-calendar-turnos" key={selected}>{events.map(t => {
        const business = businesses.find((n: any) => n.slug === t.slug);
        return <article key={t.id}>
          <time dateTime={t.fecha + "T" + String(t.hora).slice(0, 5)}>{String(t.hora).slice(0, 5)}<span>hs</span></time>
          <div className="browse-calendar-turn-info">
            <div className="browse-calendar-business"><span className="browse-calendar-avatar">{business?.foto_perfil_url ? <img src={business.foto_perfil_url} alt=""/> : (business?.nombre || t.slug || "T").slice(0, 1).toUpperCase()}</span><span>{business?.nombre || t.slug}</span></div>
            <h3>{t.servicio_nombre}</h3>
            {t.equipo_nombre && <p>Con {t.equipo_nombre}</p>}
            <button disabled={busy} onClick={() => onDetails(t)} aria-label={"Ver detalles de " + t.servicio_nombre + " a las " + String(t.hora).slice(0, 5)}>Ver detalles<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg></button>
          </div>
        </article>;
      })}</div> : <div className="browse-calendar-empty-day">
        <svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="16" width="40" height="38" rx="9"/><path d="M12 28h40M23 11v10m18-10v10M25 40h14"/></svg>
        <p>Tu día está libre</p><span>Encontrá un servicio y reservá tu próximo turno.</span>
        <button onClick={onExplore}>Explorar servicios</button>
      </div>}
    </div>
  </section>;
}
