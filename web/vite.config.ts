import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // GitHub Pages project sites live under /<repo>/ — set VITE_BASE_PATH (the workflow does this).
  const base = env.VITE_BASE_PATH || "/";
  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icons/favicon-64.png", "icons/apple-touch-icon.png", "icons/logo.png"],
        manifest: {
          name: "Regal Creative Desk",
          short_name: "Creative Desk",
          description: "Regal Jewellers creative operations: campaigns, tasks, approvals and artwork corrections.",
          theme_color: "#570718",
          background_color: "#f7f6f2",
          display: "standalone",
          orientation: "any",
          start_url: base,
          scope: base,
          icons: [
            { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
          navigateFallback: "index.html",
          navigateFallbackDenylist: [/^\/__\//],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
        },
      }),
    ],
    build: {
      target: "es2022",
      cssCodeSplit: true,
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes("node_modules/@firebase/firestore")) return "firestore";
            if (id.includes("node_modules/firebase") || id.includes("node_modules/@firebase")) return "firebase";
            if (id.includes("node_modules/react")) return "react";
          },
        },
      },
    },
  };
});
