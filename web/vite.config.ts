import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_")
  const siteUrl = new URL(process.env.VITE_SITE_URL || env.VITE_SITE_URL || "https://turnits-web.onrender.com")
  if (!["https:", "http:"].includes(siteUrl.protocol)) throw new Error("VITE_SITE_URL debe ser una URL HTTP o HTTPS")

  return {
  plugins: [react(), {
    name: "turnits-public-metadata",
    transformIndexHtml: {
      order: "pre",
      handler: html => html.replaceAll("__TURNITS_PUBLIC_ORIGIN__", siteUrl.origin),
    },
  }],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "https://negosocio.onrender.com",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, ""),
        configure: proxy => {
          // El proxy de desarrollo hace la consulta desde Node.
          proxy.on("proxyReq", request => request.removeHeader("origin"))
        },
      },
    },
  },
  build: { sourcemap: false },
  }
})
