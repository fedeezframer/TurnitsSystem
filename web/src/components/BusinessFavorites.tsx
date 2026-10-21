import * as React from "react";
import { Link } from "react-router";
import { appConfig } from "../config";
import { consumerHeaders } from "../shared/consumer-session";
import "./BusinessFavorites.css";

const FavoritesContext = React.createContext<any>(null);
export function BusinessFavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [pending, setPending] = React.useState<string[]>([]);
  const [revision, setRevision] = React.useState(0);
  const locks = React.useRef(new Set<string>());
  const signedIn = !!consumerHeaders().Authorization;
  React.useEffect(() => {
    if (!signedIn) { setFavorites([]); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch(appConfig.apiUrl + "/browse/favoritos", { headers: consumerHeaders(), signal: controller.signal, cache: "no-store" })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.success || !Array.isArray(data.favoritos)) throw new Error();
        setFavorites(data.favoritos);
      }).catch(() => { if (!controller.signal.aborted) setError("No pudimos cargar tus favoritos."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [signedIn, revision]);
  const toggle = async (slug: string) => {
    if (loading || locks.current.has(slug)) return;
    locks.current.add(slug); setPending(value => [...value, slug]); setError("");
    const selected = favorites.includes(slug);
    try {
      const response = await fetch(`${appConfig.apiUrl}/browse/favoritos/${encodeURIComponent(slug)}`, { method: selected ? "DELETE" : "PUT", headers: consumerHeaders() });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "No pudimos actualizar tus favoritos.");
      setFavorites(value => selected ? value.filter(item => item !== slug) : [...new Set([...value, slug])]);
    } catch (failure: any) { setError(failure.message || "No pudimos actualizar tus favoritos."); }
    finally { locks.current.delete(slug); setPending(value => value.filter(item => item !== slug)); }
  };
  return <FavoritesContext.Provider value={{ favorites, loading, error, pending, signedIn, toggle, retry: () => setRevision(value => value + 1) }}>{children}</FavoritesContext.Provider>;
}
export const useBusinessFavorites = () => React.useContext(FavoritesContext);
export function FavoriteButton({ slug, name, compact = false }: { slug?: string; name: string; compact?: boolean }) {
  const favorites = useBusinessFavorites();
  if (!slug || !favorites) return null;
  const selected = favorites.favorites.includes(slug);
  const label = selected ? `Quitar ${name} de favoritos` : `Guardar ${name} en favoritos`;
  const icon = <svg width="20" height="20" viewBox="0 0 24 24" fill={selected ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg>;
  return <div className={`business-favorite${compact ? " business-favorite-compact" : ""}`}>
    {favorites.signedIn ? <button type="button" className="business-favorite-button" aria-label={label} aria-pressed={selected} title={label} disabled={favorites.loading || favorites.pending.includes(slug) || !!favorites.error} onClick={() => favorites.toggle(slug)}>{icon}{!compact && <span>{selected ? "En tus favoritos" : "Guardar negocio"}</span>}</button>
      : <Link className="business-favorite-button" to="/login?tipo=usuario" aria-label="Iniciá sesión para guardar este negocio" title="Iniciá sesión para guardar favoritos">{icon}{!compact && <span>Guardar negocio</span>}</Link>}
    {!compact && favorites.error && <p role="alert">{favorites.error} <button type="button" onClick={favorites.retry}>Reintentar</button></p>}
  </div>;
}
