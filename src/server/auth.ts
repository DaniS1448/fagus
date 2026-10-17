import { basicAuth } from "hono/basic-auth"
import type { Hono } from "hono"

const HEALTH_PATH = "/api/health"

export function protectApp(app: Hono): void {
  const user = process.env.BASIC_AUTH_USER
  const password = process.env.BASIC_AUTH_PASSWORD
  if (!user && !password) return
  if (!user || !password) {
    throw new Error("Set both BASIC_AUTH_USER and BASIC_AUTH_PASSWORD")
  }

  const credentials = { username: user, password }
  app.use("*", async (c, next) => {
    if (c.req.path === HEALTH_PATH) return next()
    return basicAuth(credentials)(c, next)
  })
}
