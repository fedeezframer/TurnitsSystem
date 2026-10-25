import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import { createHash } from "node:crypto"
import { startupPreloaderHtml } from "./src/shared/brand-preloader.ts"
import { sessionStartupHtml, sessionPreloadHtml } from "./src/shared/session-startup.ts"

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_")
  const siteUrl = new URL(process.env.VITE_SITE_URL || env.VITE_SITE_URL || "https://turnits-web.onrender.com")
  const apiUrl = new URL(process.env.VITE_API_URL || env.VITE_API_URL || "https://negosocio.onrender.com", siteUrl)
  const startupApiUrl = (process.env.VITE_API_URL || env.VITE_API_URL || (command === "serve" ? "/api" : "https://negosocio.onrender.com")).replace(/\/+$/, "")
  if (!["https:", "http:"].includes(siteUrl.protocol)) throw new Error("VITE_SITE_URL debe ser una URL HTTP o HTTPS")
  if (!["https:", "http:"].includes(apiUrl.protocol)) throw new Error("VITE_API_URL debe ser una URL HTTP o HTTPS")

  return {
  plugins: [react(), {
    name: "turnits-public-metadata",
    transformIndexHtml: {
      order: "pre",
      handler: html => html.replaceAll("__TURNITS_PUBLIC_ORIGIN__", siteUrl.origin).replaceAll("__TURNITS_API_ORIGIN__", apiUrl.origin).replace("<!-- TURNITS_SESSION_STARTUP -->", sessionStartupHtml(startupApiUrl)).replace("<!-- TURNITS_STARTUP_PRELOADER -->", startupPreloaderHtml()),
    },
  }, {
    name: "turnits-session-module-preload",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const assets = { panel: ["/src/migrated/panel/index.tsx"], browse: ["/src/pages/Browse.tsx"] }
        if (ctx.bundle) {
          const chunks = Object.values(ctx.bundle).filter(chunk => chunk.type === "chunk")
          const collect = (suffix: string) => {
            const root = chunks.find(chunk => chunk.facadeModuleId?.replaceAll("\\", "/").endsWith(suffix))
            if (!root) throw new Error(`No se encontró la entrada para precargar ${suffix}`)
            const files = new Set<string>()
            const visit = (file: string) => {
              if (files.has(file)) return
              files.add(file)
              const chunk = ctx.bundle![file]
              if (chunk?.type === "chunk") chunk.imports.forEach(visit)
            }
            visit(root.fileName)
            return [...files].map(file => "/" + file)
          }
          assets.panel = collect("/src/migrated/panel/index.tsx")
          assets.browse = collect("/src/pages/Browse.tsx")
        }
        const page = html.replace("<!-- TURNITS_SESSION_PRELOAD -->", sessionPreloadHtml(assets))
        if (!ctx.bundle) return page
        const hashes = [...page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
          .filter(([, attrs, code]) => !/\bsrc\s*=/i.test(attrs) && code.trim())
          .map(([, , code]) => `'sha256-${createHash("sha256").update(code).digest("base64")}'`)
        const policy = `script-src 'self' ${hashes.join(" ")} https://accounts.google.com https://apis.google.com https://sdk.mercadopago.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'`
        return page.replace(/<head>/i, `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`)
      },
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
