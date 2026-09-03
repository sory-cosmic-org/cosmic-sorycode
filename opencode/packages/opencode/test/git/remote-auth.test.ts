import { afterEach, beforeEach, describe, expect } from "bun:test"
import { Effect, Exit, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Auth } from "../../src/auth"
import { node as RemoteGitNode, RemoteGitProviderError, tokenFromEnv, Service as RemoteGit } from "../../src/git/remote"
import { testEffect } from "../lib/effect"

const user = {
  id: 1,
  login: "sory",
  name: "Sory",
  avatar_url: null,
  html_url: "https://github.com/sory",
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

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

const it = testEffect(LayerNode.compile(LayerNode.group([RemoteGitNode, fakeAuthNode])))

const realFetch = globalThis.fetch
let seen: Array<{ url: string; authorization: string | null }> = []

function stubFetch(handler: (url: string) => Response | Promise<Response>) {
  seen = []
  globalThis.fetch = (async (input: string | URL | Request, init?: { headers?: HeadersInit }) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    const headers = new Headers(input instanceof Request ? input.headers : init?.headers)
    seen.push({ url, authorization: headers.get("authorization") })
    return handler(url)
  }) as typeof fetch
}

afterEach(() => {
  globalThis.fetch = realFetch
})

beforeEach(() => {
  authStore = {}
})

describe("tokenFromEnv", () => {
  it.effect("reads a stored api token", () =>
    Effect.gen(function* () {
      expect(tokenFromEnv({ OPENCODE_AUTH_CONTENT: JSON.stringify({ github: { type: "api", key: "tok" } }) })).toBe(
        "tok",
      )
    }),
  )

  it.effect("ignores missing, foreign, and malformed values", () =>
    Effect.gen(function* () {
      expect(tokenFromEnv({})).toBeUndefined()
      expect(tokenFromEnv({ OPENCODE_AUTH_CONTENT: "nope{" })).toBeUndefined()
      expect(tokenFromEnv({ OPENCODE_AUTH_CONTENT: JSON.stringify({ github: { type: "oauth", access: "x" } }) })).toBeUndefined()
      expect(tokenFromEnv({ OPENCODE_AUTH_CONTENT: JSON.stringify({ other: { type: "api", key: "x" } }) })).toBeUndefined()
    }),
  )
})

describe("RemoteGit token auth", () => {
  it.effect("connect validates the token, stores it, and returns the identity", () =>
    Effect.gen(function* () {
      stubFetch(() => jsonResponse(user))
      const remote = yield* RemoteGit

      const identity = yield* remote.connect({ token: "  tok  " })
      expect(identity).toMatchObject({ login: "sory", url: "https://github.com/sory" })

      const auth = yield* Auth.Service
      expect(yield* auth.get("github")).toEqual({ type: "api", key: "tok" })
      expect(seen[0]?.authorization).toBe("Bearer tok")
    }),
  )

  it.effect("connect rejects an empty token without any request", () =>
    Effect.gen(function* () {
      stubFetch(() => jsonResponse(user))
      const remote = yield* RemoteGit

      const exit = yield* Effect.exit(remote.connect({ token: "   " }))
      expect(Exit.isFailure(exit)).toBe(true)
      expect(String(exit)).toContain("GitHub token is required")
      expect(seen).toEqual([])
    }),
  )

  it.effect("connect rejects a refused token with a clear message", () =>
    Effect.gen(function* () {
      stubFetch(() => jsonResponse({ message: "Bad credentials" }, 401))
      const remote = yield* RemoteGit

      const exit = yield* Effect.exit(remote.connect({ token: "bad" }))
      expect(Exit.isFailure(exit)).toBe(true)
      expect(String(exit)).toContain("GitHub rejected this token")
    }),
  )

  it.effect("api calls use the stored token as bearer", () =>
    Effect.gen(function* () {
      stubFetch((url) => (url.endsWith("/user") ? jsonResponse(user) : jsonResponse([])))
      const remote = yield* RemoteGit
      yield* remote.connect({ token: "tok" })

      const repos = yield* remote.listRepositories({ page: 1, perPage: 30 })
      expect(repos.items).toEqual([])
      expect(seen.at(-1)?.authorization).toBe("Bearer tok")
      expect(seen.at(-1)?.url).toContain("/user/repos")
    }),
  )

  it.effect("status reports the token connection without leaking it", () =>
    Effect.gen(function* () {
      stubFetch(() => jsonResponse(user))
      const remote = yield* RemoteGit
      yield* remote.connect({ token: "tok" })

      expect(yield* remote.status()).toEqual({ state: "connected", login: "sory", source: "token" })
    }),
  )

  it.effect("status reports disconnected when the token stops working", () =>
    Effect.gen(function* () {
      stubFetch(() => jsonResponse({ message: "Bad credentials" }, 401))
      const remote = yield* RemoteGit
      const auth = yield* Auth.Service
      yield* auth.set("github", { type: "api", key: "stale" })

      expect(yield* remote.status()).toEqual({ state: "disconnected" })
    }),
  )

  it.effect("disconnect removes the stored token", () =>
    Effect.gen(function* () {
      stubFetch(() => jsonResponse(user))
      const remote = yield* RemoteGit
      yield* remote.connect({ token: "tok" })
      yield* remote.disconnect()

      const auth = yield* Auth.Service
      expect(yield* auth.get("github")).toBeUndefined()
      expect(RemoteGitProviderError.prototype).toBeDefined()
    }),
  )
})
