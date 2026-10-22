import * as React from "react";
import { appConfig } from "../config";

const requests = new Map<string, Promise<boolean>>();
export async function loadQuoteMode(api: string, slug: string) {
  if (!appConfig.quoteBookingEnabled || !slug) return false;
  const key = `${api.replace(/\/+$/, "")}/negocio/${encodeURIComponent(slug)}`;
  if (!requests.has(key)) requests.set(key, fetch(key, { cache: "no-store" }).then(async response => {
    const data = await response.json();
    if (!response.ok || !data.success) throw Error("No pudimos verificar la modalidad de la agenda.");
    return data.negocio?.modo_agenda === "presupuesto";
  }).catch(failure => { requests.delete(key); throw failure; }));
  return requests.get(key)!;
}
export function useQuoteMode(api = appConfig.apiUrl) {
  const slug = localStorage.getItem("user_slug") || "";
  const [mode, setMode] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    loadQuoteMode(api, slug).then(value => { if (active) setMode(value); }).catch(() => {});
    return () => { active = false; };
  }, [api, slug]);
  return mode;
}
