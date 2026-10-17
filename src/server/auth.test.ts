import { Hono } from "hono"
import { afterEach, describe, expect, it } from "vitest"
import { protectApp } from "./auth"

const originalUser = process.env.BASIC_AUTH_USER
const originalPassword = process.env.BASIC_AUTH_PASSWORD

afterEach(() => {
  restore("BASIC_AUTH_USER", originalUser)
  restore("BASIC_AUTH_PASSWORD", originalPassword)
})

describe("protectApp", () => {
  it("leaves routes open when credentials are unset", async () => {
    delete process.env.BASIC_AUTH_USER
    delete process.env.BASIC_AUTH_PASSWORD
    const app = protectedApp()

    const response = await app.request("/api/projects")

    expect(response.status).toBe(200)
  })

  it("rejects a request without credentials", async () => {
    process.env.BASIC_AUTH_USER = "studio"
    process.env.BASIC_AUTH_PASSWORD = "secret"
    const app = protectedApp()

    const response = await app.request("/api/projects")

    expect(response.status).toBe(401)
    expect(response.headers.get("WWW-Authenticate")).toContain("Basic")
  })

  it("allows an authorized request and the health check", async () => {
    process.env.BASIC_AUTH_USER = "studio"
    process.env.BASIC_AUTH_PASSWORD = "secret"
    const app = protectedApp()
    const authorization = `Basic ${Buffer.from("studio:secret").toString("base64")}`

    const health = await app.request("/api/health")
    const projects = await app.request("/api/projects", { headers: { authorization } })

    expect(health.status).toBe(200)
    expect(projects.status).toBe(200)
  })

  it("refuses to start when only one credential is set", () => {
    process.env.BASIC_AUTH_USER = "studio"
    delete process.env.BASIC_AUTH_PASSWORD

    expect(() => protectApp(new Hono())).toThrow(/BASIC_AUTH_USER and BASIC_AUTH_PASSWORD/)
  })
})

function protectedApp(): Hono {
  const app = new Hono()
  protectApp(app)
  app.get("/api/health", (c) => c.json({ ok: true }))
  app.get("/api/projects", (c) => c.json({ ok: true }))
  return app
}

function restore(name: "BASIC_AUTH_USER" | "BASIC_AUTH_PASSWORD", value: string | undefined) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}
