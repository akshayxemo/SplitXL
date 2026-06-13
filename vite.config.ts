import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"
import path from "path"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons.svg", "apple-touch-icon.png", "android-chrome-192x192.png", "android-chrome-512x512.png", "favicon.ico", "favicon-16x16.png", "favicon-32x32.png"],
      manifest: {
        name: "SplitXL",
        short_name: "SplitXL",
        description: "Expense tracker and group expense splitter",
        theme_color: "#a855f7",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@react-pdf/renderer")) return "pdf"
          if (id.includes("recharts")) return "charts"
          if (id.includes("dexie")) return "db"
          if (
            id.includes("lucide-react") ||
            id.includes("@radix-ui")
          ) return "ui"
          if (
            id.includes("react-router-dom") ||
            id.includes("react-dom") ||
            (id.includes("node_modules/react/") && !id.includes("react-router"))
          ) return "react-vendor"
        },
      },
    },
  },
})
