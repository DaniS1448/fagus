import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "fagus-api",
      async configureServer(server) {
        const { createApiMiddleware } = await import("./src/server/middleware")
        server.middlewares.use(createApiMiddleware())
      },
      async configurePreviewServer(server) {
        const { createApiMiddleware } = await import("./src/server/middleware")
        server.middlewares.use(createApiMiddleware())
      },
    },
  ],
  server: {
    port: 5173,
    watch: {
      ignored: ["**/data/**"],
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
