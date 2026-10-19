// Share only concurrent, fresh GETs. Completed responses are never cached, so
// edits, plan changes and a different account always get a new server response.
const pending = new Map<string, Promise<Response>>();

export function fetchPanelRead(url: string, init: RequestInit = {}) {
  if (init.signal || init.body || (init.method || "GET").toUpperCase() !== "GET")
    return fetch(url, init);

  const options = { ...init, method: "GET", cache: "no-store" as RequestCache };
  const { headers, ...rest } = options;
  const key = JSON.stringify([
    url,
    [...new Headers(headers).entries()].sort(),
    Object.entries(rest).sort(([a], [b]) => a.localeCompare(b)),
  ]);
  let request = pending.get(key);
  if (!request) {
    request = fetch(url, options);
    pending.set(key, request);
    const clear = () => {
      if (pending.get(key) === request) pending.delete(key);
    };
    void request.then(clear, clear);
  }
  // Every caller owns its response body, including unsuccessful HTTP responses.
  return request.then((response) => response.clone());
}
