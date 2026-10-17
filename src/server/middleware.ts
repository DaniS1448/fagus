import type { IncomingMessage, ServerResponse } from "node:http"
import { getRequestListener } from "@hono/node-server"
import { createApp } from "./app"

const listener = getRequestListener(createApp().fetch)

export function createApiMiddleware() {
  return (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    const url = req.url ?? ""
    if (!url.startsWith("/api")) {
      next()
      return
    }
    listener(req, res)
  }
}
