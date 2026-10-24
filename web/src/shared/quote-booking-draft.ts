export type QuoteBookingDraft = {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  countryCode: string;
  serviceId: string;
};

const STORAGE_KEY = "turnits_quote_booking_draft";

export function saveQuoteBookingDraft(draft: QuoteBookingDraft) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {}
}

export function readQuoteBookingDraft(): QuoteBookingDraft | null {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const draft = JSON.parse(value);
    if (!draft || typeof draft !== "object") return null;
    return {
      nombre: typeof draft.nombre === "string" ? draft.nombre.slice(0, 80) : "",
      apellido: typeof draft.apellido === "string" ? draft.apellido.slice(0, 80) : "",
      email: typeof draft.email === "string" ? draft.email.slice(0, 254) : "",
      telefono: typeof draft.telefono === "string" ? draft.telefono.replace(/\D/g, "").slice(0, 15) : "",
      countryCode: typeof draft.countryCode === "string" ? draft.countryCode.slice(0, 3) : "AR",
      serviceId: typeof draft.serviceId === "string" ? draft.serviceId.slice(0, 80) : "",
    };
  } catch {
    return null;
  }
}

export function clearQuoteBookingDraft() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}
