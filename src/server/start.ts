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

const port = listenPort()
serve({ fetch: app.fetch, port }, () => {
  console.log(`Fagus en http://localhost:${port}`)
})

function listenPort(): number {
  const raw = process.env.PORT
  if (raw === undefined || raw === "") return 4173
  const port = Number(raw)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer from 1 to 65535")
  }
  return port
}
