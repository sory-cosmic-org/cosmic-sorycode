import { afterEach, beforeEach, describe, expect } from "bun:test"
import { Effect, Exit, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Auth } from "../../src/auth"
import { forwardedPortUrl, node as CodespacesNode, Service as Codespaces } from "../../src/git/codespaces"
import { testEffect } from "../lib/effect"

const codespace = {
  name: "sory-code-a1b2c3",
  display_name: null,
  state: "Available",
  repository: { full_name: "sory-cosmic/sory-code" },
  git_status: { ref: "dev" },
  machine: { name: "standardLinux32gb" },
  web_url: "https://github.com/codespaces/sory-code-a1b2c3",
  last_used_at: "2026-09-03T12:00:00Z",
}

const jsonResponse = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } })

let authStore: Record<string, Auth.Info> = {}

const fakeAuthNode = LayerNode.make({
  service: Auth.Service,
  layer: Layer.succeed(
    Auth.Service,
    Auth.Service.of({
      get: (id: string) => Effect.sync(() => authStore[id]),
      all: () => Effect.sync(() => ({ ...authStore })),
      set: (key: string, info: Auth.Info) =>
        Effect.sync(() => {
          authStore[key] = info
        }),
      remove: (key: string) =>
        Effect.sync(() => {
          delete authStore[key]
        }),
    }),
  ),
  deps: [],
})

const it = testEffect(LayerNode.compile(LayerNode.group([CodespacesNode, fakeAuthNode])))

const realFetch = globalThis.fetch
let seen: Array<{ url: string; method: string; authorization: string | null; body: string | null }> = []

function stubFetch(handler: (url: string, method: string, body: string | null) => Response | Promise<Response>) {
  seen = []
  globalThis.fetch = (async (input: string | URL | Request, init?: { method?: string; headers?: HeadersInit; body?: BodyInit }) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    const headers = new Headers(input instanceof Request ? input.headers : init?.headers)
    const body = typeof init?.body === "string" ? init.body : null
    seen.push({ url, method: init?.method ?? "GET", authorization: headers.get("authorization"), body })
    return handler(url, init?.method ?? "GET", body)
  }) as typeof fetch
}

afterEach(() => {
  globalThis.fetch = realFetch
})

beforeEach(() => {
  authStore = { github: { type: "api", key: "tok" } }
})

describe("forwardedPortUrl", () => {
  it.effect("builds the stable public port url", () =>
    Effect.gen(function* () {
      expect(forwardedPortUrl("sory-code-a1b2c3", 4096)).toBe("https://sory-code-a1b2c3-4096.app.github.dev")
    }),
  )
})

describe("Codespaces API client", () => {
  it.effect("fails without any request when github is not connected", () =>
    Effect.gen(function* () {
      authStore = {}
      stubFetch(() => jsonResponse({ codespaces: [], total_count: 0 }))
      const codespaces = yield* Codespaces

      const exit = yield* Effect.exit(codespaces.list())
      expect(Exit.isFailure(exit)).toBe(true)
      expect(String(exit)).toContain("not connected")
      expect(seen).toEqual([])
    }),
  )

  it.effect("lists codespaces with mapped runtime states", () =>
    Effect.gen(function* () {
      stubFetch(() => jsonResponse({ total_count: 2, codespaces: [codespace, { ...codespace, name: "old", state: "Shutdown" }] }))
      const codespaces = yield* Codespaces

      const items = yield* codespaces.list()
      expect(items).toHaveLength(2)
      expect(items[0]).toMatchObject({ name: "sory-code-a1b2c3", runtime: "running", repository: "sory-cosmic/sory-code", branch: "dev" })
      expect(items[1]?.runtime).toBe("stopped")
      expect(seen[0]).toMatchObject({ method: "GET", authorization: "Bearer tok" })
      expect(seen[0]?.url).toBe("https://api.github.com/user/codespaces")
    }),
  )

  it.effect("maps unknown states without inventing a status", () =>
    Effect.gen(function* () {
      stubFetch(() => jsonResponse({ ...codespace, state: "Exporting" }))
      const codespaces = yield* Codespaces

      expect((yield* codespaces.get("sory-code-a1b2c3")).runtime).toBe("unknown")
    }),
  )

  it.effect("creates a codespace with ref, machine, and display name", () =>
    Effect.gen(function* () {
      stubFetch(() => jsonResponse({ ...codespace, state: "Provisioning" }, 201))
      const codespaces = yield* Codespaces

      const created = yield* codespaces.create({
        owner: "sory-cosmic",
        repository: "sory-code",
        branch: "dev",
        machine: "standardLinux32gb",
        displayName: "Sory Code",
      })
      expect(created.runtime).toBe("provisioning")
      expect(seen[0]?.method).toBe("POST")
      expect(seen[0]?.url).toBe("https://api.github.com/repos/sory-cosmic/sory-code/codespaces")
      expect(JSON.parse(seen[0]?.body ?? "{}")).toEqual({
        ref: "dev",
        machine: "standardLinux32gb",
        display_name: "Sory Code",
      })
    }),
  )

  it.effect("starts, stops, and removes a codespace", () =>
    Effect.gen(function* () {
      stubFetch((url, method) => {
        if (method === "DELETE") return new Response(null, { status: 202 })
        if (url.endsWith("/stop")) return jsonResponse({ ...codespace, state: "Shutdown" })
        return jsonResponse({ ...codespace, state: "Starting" })
      })
      const codespaces = yield* Codespaces

      expect((yield* codespaces.start("sory-code-a1b2c3")).runtime).toBe("starting")
      expect((yield* codespaces.stop("sory-code-a1b2c3")).runtime).toBe("stopped")
      yield* codespaces.remove("sory-code-a1b2c3")
      expect(seen.at(-1)?.method).toBe("DELETE")
    }),
  )

  it.effect("explains a 403 as a scope or access problem, without the raw body", () =>
    Effect.gen(function* () {
      stubFetch(() => jsonResponse({ message: "Forbidden", documentation_url: "https://docs/x".padEnd(400, "y") }, 403))
      const codespaces = yield* Codespaces

      const exit = yield* Effect.exit(codespaces.list())
      expect(Exit.isFailure(exit)).toBe(true)
      expect(String(exit)).toContain("codespace scope")
      expect(String(exit)).not.toContain("padEnd")
      expect(String(exit).length).toBeLessThan(600)
    }),
  )

  it.effect("reports a missing codespace explicitly on 404", () =>
    Effect.gen(function* () {
      stubFetch(() => jsonResponse({ message: "Not Found" }, 404))
      const codespaces = yield* Codespaces

      const exit = yield* Effect.exit(codespaces.get("gone"))
      expect(Exit.isFailure(exit)).toBe(true)
      expect(String(exit)).toContain("did not find")
    }),
  )

  it.effect("lists machines and devcontainers for repository selection", () =>
    Effect.gen(function* () {
      stubFetch((url) =>
        url.endsWith("/machines")
          ? jsonResponse({
              total_count: 1,
              machines: [
                { name: "standardLinux32gb", display_name: "4 cores", cpus: 4, memory_in_bytes: 16, storage_in_bytes: 128, prebuild_availability: "none" },
              ],
            })
          : jsonResponse({ total_count: 1, devcontainers: [{ path: ".devcontainer/devcontainer.json", display_name: "Default" }] }),
      )
      const codespaces = yield* Codespaces

      const machines = yield* codespaces.listMachines({ owner: "sory-cosmic", repository: "sory-code" })
      expect(machines[0]).toMatchObject({ name: "standardLinux32gb", cpus: 4 })
      const devcontainers = yield* codespaces.listDevcontainers({ owner: "sory-cosmic", repository: "sory-code" })
      expect(devcontainers[0]).toMatchObject({ path: ".devcontainer/devcontainer.json" })
    }),
  )

  it.effect("reads classic token scopes from the response header", () =>
    Effect.gen(function* () {
      stubFetch(() => jsonResponse({ login: "sory" }, 200, { "x-oauth-scopes": "repo, codespace" }))
      const codespaces = yield* Codespaces

      expect(yield* codespaces.tokenScopes()).toEqual(["repo", "codespace"])
    }),
  )
})
