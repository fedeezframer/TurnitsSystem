import framerProps from "./framer-props.json"

const staging = import.meta.env.VITE_APP_ENV === "staging";
if (staging && (!import.meta.env.VITE_API_URL || new URL(import.meta.env.VITE_API_URL).hostname === "negosocio.onrender.com")) throw new Error("Staging cannot use the production API.");

export const appConfig = {
  staging,
  siteUrl: (import.meta.env.VITE_SITE_URL || (staging ? window.location.origin : "https://turnits.com")).replace(/\/+$/, ""),
  quoteBookingEnabled: import.meta.env.VITE_QUOTE_BOOKING_ENABLED === "true",
  apiUrl: (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "/api" : "https://negosocio.onrender.com")).replace(/\/+$/, ""),
  logoUrl: import.meta.env.VITE_LOGO_URL || framerProps.panel.logoImage,
  loginLogoUrl: import.meta.env.VITE_LOGIN_LOGO_URL || framerProps.login.logoUrl,
  registerLogoUrl: import.meta.env.VITE_REGISTER_LOGO_URL || framerProps.register.logoUrl,
  accentColor: framerProps.panel.accentColor,
  mpClientId: import.meta.env.VITE_MP_CLIENT_ID || "",
  // Valores recuperados de los componentes publicados en Framer.
  // API, rutas y sesión se definen en la app; los recursos se sirven localmente.
  panel: framerProps.panel,
  booking: framerProps.booking,
  login: framerProps.login,
  register: framerProps.register,
}
