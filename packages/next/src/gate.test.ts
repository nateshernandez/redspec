import { afterEach, describe, expect, it } from "vitest"
import { createSpecProxy } from "./gate"

const NODE_ENV = process.env.NODE_ENV

/** `NODE_ENV` is readonly in the Next types but writable at runtime. */
const setEnv = (value: string) => {
  ;(process.env as Record<string, string>).NODE_ENV = value
}

afterEach(() => setEnv(NODE_ENV ?? "test"))

const request = (pathname: string) =>
  ({ nextUrl: { pathname } }) as Parameters<ReturnType<typeof createSpecProxy>>[0]

const status = (proxy: ReturnType<typeof createSpecProxy>, path: string) =>
  proxy(request(path)).status

describe("the production gate", () => {
  it("404s the route and everything under it in production", () => {
    setEnv("production")
    const proxy = createSpecProxy({ route: "/spec" })
    expect(status(proxy, "/spec")).toBe(404)
    expect(status(proxy, "/spec/access")).toBe(404)
    expect(status(proxy, "/spec/access/STATE-access-door")).toBe(404)
  })

  it("lets everything else through", () => {
    setEnv("production")
    const proxy = createSpecProxy({ route: "/spec" })
    expect(status(proxy, "/")).not.toBe(404)
    // A sibling route that merely starts with the same characters is not under it.
    expect(status(proxy, "/specials")).not.toBe(404)
  })

  it("is open in development", () => {
    setEnv("development")
    expect(status(createSpecProxy({ route: "/spec" }), "/spec")).not.toBe(404)
  })

  it("stays shut in production when publish is not asked for", () => {
    setEnv("production")
    expect(status(createSpecProxy({ route: "/spec", publish: false }), "/spec")).toBe(404)
  })

  it("serves the board in production only when publish is asked for", () => {
    setEnv("production")
    const proxy = createSpecProxy({ route: "/spec", publish: true })
    expect(status(proxy, "/spec")).not.toBe(404)
    expect(status(proxy, "/spec/access")).not.toBe(404)
  })
})
