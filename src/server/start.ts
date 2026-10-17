import { serve } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
import { readFileSync } from "node:fs"
import { createApp } from "./app"

const app = createApp()
app.use("/assets/*", serveStatic({ root: "./dist" }))
app.get("*", (c) => {
  if (c.req.path.startsWith("/api")) return c.json({ error: "No encontrado" }, 404)
  return c.html(readFileSync("./dist/index.html", "utf8"))
})

const port = 4173
serve({ fetch: app.fetch, port }, () => {
  console.log(`Fagus en http://localhost:${port}`)
})
