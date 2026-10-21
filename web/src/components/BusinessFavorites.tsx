import * as React from "react";
import { Link } from "react-router";
import { appConfig } from "../config";
import { consumerHeaders } from "../shared/consumer-session";
import "./BusinessFavorites.css";

const FavoritesContext = React.createContext<any>(null);
export function BusinessFavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = React.useState<string[]>([]);
  const [services, setServices] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [pending, setPending] = React.useState<string[]>([]);
  const [revision, setRevision] = React.useState(0);
  const locks = React.useRef(new Set<string>());
  const signedIn = !!consumerHeaders().Authorization;
  React.useEffect(() => {
    if (!signedIn) { setFavorites([]); setServices([]); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch(appConfig.apiUrl + "/browse/favoritos", { headers: consumerHeaders(), signal: controller.signal, cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.success || !Array.isArray(data.favoritos)) throw new Error();
        setFavorites(data.favoritos);
        setServices(data.servicios || []);
      }).catch(() => { if (!controller.signal.aborted) setError("No pudimos cargar tus favoritos."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [signedIn, revision]);
  const toggle = async (slug: string, service = false) => {
    const key = service ? `service:${slug}` : slug;
    if (loading || locks.current.has(key)) return;
    locks.current.add(key); setPending(value => [...value, key]); setError("");
    const selected = (service ? services : favorites).includes(slug);
    try {
      const response = await fetch(`${appConfig.apiUrl}/browse/${service ? "servicios-favoritos" : "favoritos"}/${encodeURIComponent(slug)}`, { method: selected ? "DELETE" : "PUT", headers: consumerHeaders() });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "No pudimos actualizar tus favoritos.");
      (service ? setServices : setFavorites)(value => selected ? value.filter(item => item !== slug) : [...new Set([...value, slug])]);
    } catch (failure: any) { setError(failure.message || "No pudimos actualizar tus favoritos."); }
    finally { locks.current.delete(key); setPending(value => value.filter(item => item !== key)); }
  };
  return <FavoritesContext.Provider value={{ favorites, services, loading, error, pending, signedIn, toggle, retry: () => setRevision(value => value + 1) }}>{children}</FavoritesContext.Provider>;
}
export const useBusinessFavorites = () => React.useContext(FavoritesContext);
export function FavoriteButton({ slug, serviceId, name, compact = false }: { slug?: string; serviceId?: string; name: string; compact?: boolean }) {
  const favorites = useBusinessFavorites();
  const id = serviceId || slug;
  if (!id || !favorites) return null;
  const selected = (serviceId ? favorites.services : favorites.favorites).includes(id);
  const label = selected ? `Quitar ${name} de favoritos` : `Guardar ${name} en favoritos`;
  const icon = <svg width="20" height="20" viewBox="0 0 24 24" fill={selected ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg>;
  return <div className={`business-favorite${compact ? " business-favorite-compact" : ""}`}>
    {favorites.signedIn ? <button type="button" className="business-favorite-button" aria-label={label} aria-pressed={selected} title={label} disabled={favorites.loading || favorites.pending.includes(serviceId ? `service:${id}` : id) || !!favorites.error} onClick={() => favorites.toggle(id, !!serviceId)}>{icon}{!compact && <span>{selected ? "En tus favoritos" : serviceId ? "Guardar servicio" : "Guardar negocio"}</span>}</button>
      : <Link className="business-favorite-button" to="/login?tipo=usuario" aria-label="Iniciá sesión para guardar este negocio" title="Iniciá sesión para guardar favoritos">{icon}{!compact && <span>Guardar negocio</span>}</Link>}
    {!compact && favorites.error && <p role="alert">{favorites.error} <button type="button" onClick={favorites.retry}>Reintentar</button></p>}
  </div>;
}
