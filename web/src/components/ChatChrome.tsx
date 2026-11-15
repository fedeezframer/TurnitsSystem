import * as React from "react";
import { Link } from "react-router";
import { appConfig } from "../config";

export function ChatIcon({ name, size = 24 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    chat: <path d="M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.8L3 21l1.3-4.6A9 9 0 1 1 21 11.5Z" />,
    tag: <><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42Z" /><circle cx="7.5" cy="7.5" r=".5" fill="currentColor" /></>,
    "align-left": <><line x1="21" x2="3" y1="6" y2="6" /><line x1="15" x2="3" y1="12" y2="12" /><line x1="17" x2="3" y1="18" y2="18" /></>,
    dollar: <><line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    coin: <><ellipse cx="12" cy="12" rx="5" ry="9" transform="rotate(23 12 12)" /><path d="m9 4 5 2m-7 9 5 2m-3-6 5 2m2-9 2 1c3 1 3 6 1 10s-5 7-8 6l-2-1" /></>,
    user: <><circle cx="12" cy="6.5" r="4" fill="currentColor" stroke="none" /><path d="M4 22v-3a8 8 0 0 1 16 0v3Z" fill="currentColor" stroke="none" /></>,
    back: <path d="m10 6-5 5 5 5M5 11h9a5 5 0 0 1 5 5v4" />,
    send: <path d="M3 12h17m-7-7 7 7-7 7" />,
    plus: <><circle cx="12" cy="12" r="9" /><path d="M12 6v12M6 12h12" /></>,
    tool: <path d="M4.16061 9.81433L9.81761 4.15733M13.3536 7.69233L7.69661 13.3493M10.0496 11.4623L11.4636 10.0483L19.1296 16.5353C19.3234 16.6999 19.481 16.9029 19.5925 17.1314C19.7039 17.36 19.7668 17.6091 19.7771 17.8632C19.7874 18.1173 19.745 18.3707 19.6524 18.6075C19.5599 18.8444 19.4193 19.0594 19.2394 19.2392C19.0596 19.419 18.8445 19.5595 18.6076 19.6519C18.3707 19.7444 18.1173 19.7867 17.8632 19.7763C17.6092 19.7659 17.36 19.7029 17.1315 19.5914C16.903 19.4799 16.7001 19.3222 16.5356 19.1283L10.0496 11.4623ZM15.1206 7.33933C14.8393 7.62054 14.4579 7.77851 14.0601 7.77851C13.6624 7.77851 13.2809 7.62054 12.9996 7.33933L10.1716 4.51133C9.89823 4.22856 9.74686 3.84973 9.75009 3.45643C9.75332 3.06313 9.9109 2.68683 10.1889 2.40859C10.4669 2.13035 10.843 1.97241 11.2363 1.96881C11.6296 1.96521 12.0086 2.11623 12.2916 2.38933L15.1216 5.21833C15.4028 5.49962 15.5608 5.88109 15.5608 6.27883C15.5608 6.67658 15.4018 7.05804 15.1206 7.33933ZM7.34261 15.1173C7.06131 15.3985 6.67985 15.5565 6.28211 15.5565C5.88436 15.5565 5.5029 15.3985 5.22161 15.1173L2.39261 12.2893C2.11121 12.0079 1.95312 11.6263 1.95312 11.2283C1.95312 10.8304 2.11121 10.4487 2.39261 10.1673C2.674 9.88594 3.05565 9.72785 3.45361 9.72785C3.85156 9.72785 4.23321 9.88594 4.51461 10.1673L7.34261 12.9963C7.62381 13.2776 7.78179 13.6591 7.78179 14.0568C7.78179 14.4546 7.62381 14.836 7.34261 15.1173Z" strokeWidth={2} strokeLinejoin="round" />,
    home: <path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10" />,
    flame: <path d="M13 2c2 5-3 6-1 10 1-2 3-2 4-5 3 3 5 6 4 9a8 8 0 0 1-16-1c0-5 5-6 4-10 3 1 3 3 3 4 2-3 1-5 2-7Z" />,
    calendar: <><rect x="4" y="5" width="16" height="17" rx="2" /><path d="M8 2v6m8-6v6M4 10h16M8 14h1m3 0h1m3 0h1m-9 4h1m3 0h1m3 0h1" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    photo: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="2" /><path d="m3 17 6-6 4 4 3-3 5 5" /></>,
    camera: <><path d="M4 7h3l1.5-2h7L17 7h3v12H4z" /><circle cx="12" cy="13" r="4" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
export function ChatAvatar({ name, src }: { name: string; src?: string }) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [src]);
  const palette = ["#4d60b9", "#7bb442", "#b86049", "#b74c96", "#6243b8"];
  const color = palette[Array.from(name).reduce((total, letter) => total + (letter.codePointAt(0) || 0), 0) % palette.length];
  return <span className="chat-avatar" style={{ backgroundColor: color }}>{src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} /> : name.trim().slice(0, 1).toLocaleUpperCase("es-AR")}</span>;
}
export function ChatHeader({ business, messagesOnly = false }: { business: boolean; messagesOnly?: boolean }) {
  const wordmark = <span className="chat-wordmark" aria-label={appConfig.staging ? "Turnits, entorno de pruebas" : "Turnits"}>turnits</span>;
  return <header className="chat-topbar">{messagesOnly ? wordmark : <Link className="chat-wordmark" to={business ? "/panel" : "/"} aria-label={appConfig.staging ? "Turnits, entorno de pruebas" : "Turnits, inicio"}>turnits</Link>}{!messagesOnly && business && <nav aria-label="Tu cuenta"><Link className="active" to="/consultas" aria-label="Mensajes" aria-current="page"><ChatIcon name="chat" /></Link><Link to="/panel" aria-label="Mi panel"><ChatIcon name="user" /></Link></nav>}</header>;
}
export function ChatBottomNav({ business }: { business: boolean }) {
  return <nav className="chat-bottom-nav" aria-label="Navegación principal"><Link to={business ? "/panel" : "/browse"} aria-label="Inicio"><ChatIcon name="home" size={28} /></Link><Link to={business ? "/panel" : "/browse?vista=ofertas"} aria-label={business ? "Mi negocio" : "Ofertas"}><ChatIcon name="flame" size={28} /></Link><Link to={business ? "/panel" : "/browse?vista=agenda"} aria-label="Agenda"><ChatIcon name="calendar" size={28} /></Link><Link to={business ? "/panel" : "/browse?vista=buscar"} aria-label="Buscar"><ChatIcon name="search" size={28} /></Link></nav>;
}
