import * as React from "react";
import { Link } from "react-router";
import { appConfig } from "../config";

export function ChatIcon({ name, size = 24 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    chat: <path d="M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.8L3 21l1.3-4.6A9 9 0 1 1 21 11.5Z" />,
    coin: <><ellipse cx="12" cy="12" rx="5" ry="9" transform="rotate(23 12 12)" /><path d="m9 4 5 2m-7 9 5 2m-3-6 5 2m2-9 2 1c3 1 3 6 1 10s-5 7-8 6l-2-1" /></>,
    user: <><circle cx="12" cy="6.5" r="4" fill="currentColor" stroke="none" /><path d="M4 22v-3a8 8 0 0 1 16 0v3Z" fill="currentColor" stroke="none" /></>,
    back: <path d="m10 6-5 5 5 5M5 11h9a5 5 0 0 1 5 5v4" />,
    send: <path d="M3 12h17m-7-7 7 7-7 7" />,
    plus: <><circle cx="12" cy="12" r="9" /><path d="M12 6v12M6 12h12" /></>,
    tool: <><path d="m5 7 4-4 4 4-4 4zM7 5l2-2m2 6 9 9-3 3-9-9M3 10l3-3 5 5-3 3zM14 4l3 3-3 3" /></>,
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
  return <header className="chat-topbar">{messagesOnly ? wordmark : <Link className="chat-wordmark" to={business ? "/panel" : "/browse"} aria-label={appConfig.staging ? "Turnits, entorno de pruebas" : "Turnits, inicio"}>turnits</Link>}{!messagesOnly && <nav aria-label="Tu cuenta"><Link className="active" to="/consultas" aria-label="Mensajes" aria-current="page"><ChatIcon name="chat" /></Link><Link to={business ? "/panel" : "/browse?vista=coins"} aria-label={business ? "Mi panel" : "Mis TCoins"}><ChatIcon name="coin" /></Link><Link to={business ? "/panel" : "/browse?vista=perfil"} aria-label="Mi perfil"><ChatIcon name="user" /></Link></nav>}</header>;
}
export function ChatBottomNav({ business }: { business: boolean }) {
  return <nav className="chat-bottom-nav" aria-label="Navegación principal"><Link to={business ? "/panel" : "/browse"} aria-label="Inicio"><ChatIcon name="home" size={28} /></Link><Link to={business ? "/panel" : "/browse?vista=ofertas"} aria-label={business ? "Mi negocio" : "Ofertas"}><ChatIcon name="flame" size={28} /></Link><Link to={business ? "/panel" : "/browse?vista=agenda"} aria-label="Agenda"><ChatIcon name="calendar" size={28} /></Link><Link to={business ? "/panel" : "/browse?vista=buscar"} aria-label="Buscar"><ChatIcon name="search" size={28} /></Link></nav>;
}
