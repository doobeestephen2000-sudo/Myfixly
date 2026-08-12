import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const appBase = process.env.PUBLIC_BASE_PATH ?? "/";
const isCapacitorBuild = process.env.CAPACITOR_BUILD === "true";

export default defineConfig({
  base: appBase,
  plugins: [
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
      router: { basepath: appBase === "/" ? "/" : appBase.replace(/\/$/, "") },
      spa: isCapacitorBuild
        ? {
            enabled: true,
            prerender: { outputPath: "/index.html" },
          }
        : undefined,
    }),
    viteReact(),
  ],
  resolve: {
    alias: {
      "@/components": path.resolve(__dirname, "./src/components"),
      "@/lib": path.resolve(__dirname, "./src/components/lib"),
      "@/integrations": path.resolve(__dirname, "./src/components/integration"),
      "@/hooks": path.resolve(__dirname, "./src/components/hooks"),
    },
  },
  server: {
    host: "::",
    port: 8080,
  },
});
