import framerProps from "./framer-props.json"

export const appConfig = {
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
