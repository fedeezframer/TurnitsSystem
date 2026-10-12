export const appConfig = {
  apiUrl: (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "/api" : "https://negosocio.onrender.com")).replace(/\/+$/, ""),
  logoUrl: import.meta.env.VITE_LOGO_URL || "/assets/turnits-logo.svg",
  accentColor: "#196b1f",
  mpClientId: import.meta.env.VITE_MP_CLIENT_ID || "",
  // Los props de imágenes, iconos y colores de Framer se configuran acá.
  panel: {} as Record<string, unknown>,
  booking: {} as Record<string, unknown>,
}
