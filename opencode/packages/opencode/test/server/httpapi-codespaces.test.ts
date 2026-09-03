import { NodeHttpServer } from "@effect/platform-node"
import { describe, expect } from "bun:test"
import { Context, Effect, Layer, Option } from "effect"
import { HttpClient, HttpClientRequest, HttpRouter } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Auth } from "../../src/auth"
import { Config } from "../../src/config/config"
import { Installation } from "../../src/installation"
import { RemoteGitProviderError, Service as RemoteGit } from "../../src/git/remote"
import { Service as Codespaces } from "../../src/git/codespaces"
import { MoveSession } from "@opencode-ai/core/control-plane/move-session"
import { ServerAuth } from "../../src/server/auth"
import { RootHttpApi } from "../../src/server/routes/instance/httpapi/api"
import { controlHandlers } from "../../src/server/routes/instance/httpapi/handlers/control"
import { controlPlaneHandlers } from "../../src/server/routes/instance/httpapi/handlers/control-plane"
import { globalHandlers } from "../../src/server/routes/instance/httpapi/handlers/global"
import { gitHandlers } from "../../src/server/routes/instance/httpapi/handlers/git"
import { authorizationLayer } from "../../src/server/routes/instance/httpapi/middleware/authorization"
import { schemaErrorLayer } from "../../src/server/routes/instance/httpapi/middleware/schema-error"
import { Service as WorkspaceSecret } from "../../src/control-plane/workspace-secret"
import { testEffect } from "../lib/effect"

const codespace = {
  name: "sory-code-abc123",
  displayName: null,
  state: "Available",
  runtime: "running",
  repository: "sory-cosmic/sory-code",
  branch: "dev",
  machine: "standardLinux32gb",
  webUrl: "https://github.com/codespaces/x",
  lastUsedAt: "2026-09-03T12:00:00Z",
} as const

let secretStore: Record<string, string> = {}

const apiLayer = HttpRouter.serve(
  HttpApiBuilder.layer(RootHttpApi).pipe(
    Layer.provide([controlHandlers, controlPlaneHandlers, globalHandlers, gitHandlers]),
    Layer.provide([authorizationLayer, schemaErrorLayer]),
    // Raw HttpApi routes expose an opaque handler context at the request boundary.
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
    HttpRouter.provideRequest(Layer.succeedContext(Context.empty() as Context.Context<unknown>)),
  ),
  { disableListenLog: true, disableLogger: true },
).pipe(
  Layer.provideMerge(NodeHttpServer.layerTest),
  Layer.provide(Layer.mock(Auth.Service)({})),
  Layer.provide(Layer.mock(Config.Service)({})),
  Layer.provide(
    Layer.mock(RemoteGit)({
      identity: () => Effect.succeed({ id: 1, login: "test", name: null, avatarUrl: null, url: "" }),
      listRepositories: () => Effect.succeed({ items: [], page: 1, perPage: 30, hasNext: false }),
      listBranches: () => Effect.succeed({ items: [], page: 1, perPage: 30, hasNext: false }),
      listPipelines: () => Effect.succeed({ items: [], page: 1, perPage: 30, hasNext: false }),
    }),
  ),
  Layer.provide(
    Layer.mock(Codespaces)({
      list: () => Effect.succeed([codespace]),
      listForRepository: () => Effect.succeed([codespace]),
      get: (name: string) =>
        name === "gone"
          ? Effect.fail(new RemoteGitProviderError("github", 404, "GitHub did not find this codespace."))
          : Effect.succeed(codespace),
      create: () => Effect.succeed({ ...codespace, state: "Provisioning", runtime: "provisioning" }),
      start: () => Effect.succeed({ ...codespace, state: "Starting", runtime: "starting" }),
      stop: () => Effect.succeed({ ...codespace, state: "Shutdown", runtime: "stopped" }),
      remove: () => Effect.void,
      listMachines: () =>
        Effect.succeed([
          { name: "standardLinux32gb", displayName: "4 cores", cpus: 4, memoryInBytes: 16, storageInBytes: 128, prebuildAvailability: null },
        ]),
      listDevcontainers: () =>
        Effect.succeed([{ path: ".devcontainer/devcontainer.json", name: null, displayName: "Default" }]),
      tokenScopes: () => Effect.succeed(["repo", "codespace"]),
    }),
  ),
  Layer.provide(
    Layer.mock(WorkspaceSecret)({
      get: (workspaceID: string, key: string) => Effect.succeed(secretStore[`${workspaceID}:${key}`]),
      has: (workspaceID: string, key: string) => Effect.succeed(secretStore[`${workspaceID}:${key}`] !== undefined),
      set: (workspaceID: string, key: string, value: string) =>
        Effect.sync(() => {
          secretStore[`${workspaceID}:${key}`] = value
        }),
      remove: (workspaceID: string, key: string) =>
        Effect.sync(() => {
          delete secretStore[`${workspaceID}:${key}`]
        }),
    }),
  ),
  Layer.provide(Layer.mock(MoveSession.Service)({})),
  Layer.provide(
    Layer.mock(Installation.Service)({
      method: () => Effect.succeed("npm"),
      latest: () => Effect.succeed("9.9.9"),
      upgrade: () => Effect.void,
    }),
  ),
  Layer.provide(ServerAuth.Config.configLayer({ password: Option.none(), username: "opencode" })),
)
const it = testEffect(apiLayer)

describe("codespaces HttpApi", () => {
  it.live("lists codespaces and maps states", () =>
    Effect.gen(function* () {
      secretStore = {}
      const response = yield* HttpClientRequest.get("/git/codespaces").pipe(HttpClient.execute)
      expect(response.status).toBe(200)
      expect(yield* response.json).toEqual([codespace])
    }),
  )

  it.live("gets one codespace and reports a missing one explicitly", () =>
    Effect.gen(function* () {
      const ok = yield* HttpClientRequest.get("/git/codespaces/sory-code-abc123").pipe(HttpClient.execute)
      expect(ok.status).toBe(200)
      expect((yield* ok.json as { runtime: string }).runtime).toBe("running")

      const missing = yield* HttpClientRequest.get("/git/codespaces/gone").pipe(HttpClient.execute)
      expect(missing.status).toBe(502)
      const body = (yield* missing.json) as { data: { message: string } }
      expect(body.data.message).toContain("did not find")
    }),
  )

  it.live("creates, starts, stops, and deletes a codespace", () =>
    Effect.gen(function* () {
      const created = yield* HttpClientRequest.post("/git/repositories/sory-cosmic/sory-code/codespaces").pipe(
        HttpClientRequest.bodyJsonUnsafe({ branch: "dev", machine: "standardLinux32gb" }),
        HttpClient.execute,
      )
      expect(created.status).toBe(200)
      expect((yield* created.json as { runtime: string }).runtime).toBe("provisioning")

      const started = yield* HttpClientRequest.post("/git/codespaces/sory-code-abc123/start").pipe(HttpClient.execute)
      expect((yield* started.json as { runtime: string }).runtime).toBe("starting")

      const stopped = yield* HttpClientRequest.post("/git/codespaces/sory-code-abc123/stop").pipe(HttpClient.execute)
      expect((yield* stopped.json as { runtime: string }).runtime).toBe("stopped")

      const deleted = yield* HttpClientRequest.make("DELETE")("/git/codespaces/sory-code-abc123").pipe(HttpClient.execute)
      expect(deleted.status).toBe(200)
    }),
  )

  it.live("lists machines, devcontainers, and token scopes", () =>
    Effect.gen(function* () {
      const machines = yield* HttpClientRequest.get("/git/repositories/sory-cosmic/sory-code/codespaces/machines").pipe(
        HttpClient.execute,
      )
      expect((yield* machines.json as Array<{ name: string }>)[0]?.name).toBe("standardLinux32gb")

      const devcontainers = yield* HttpClientRequest.get(
        "/git/repositories/sory-cosmic/sory-code/codespaces/devcontainers",
      ).pipe(HttpClient.execute)
      expect((yield* devcontainers.json as Array<{ path: string }>)[0]?.path).toBe(".devcontainer/devcontainer.json")

      const scopes = yield* HttpClientRequest.get("/git/token-scopes").pipe(HttpClient.execute)
      expect(yield* scopes.json).toEqual(["repo", "codespace"])
    }),
  )

  it.live("stores a server password without ever returning it", () =>
    Effect.gen(function* () {
      const set = yield* HttpClientRequest.post("/git/workspaces/wrk_test/server-password").pipe(
        HttpClientRequest.bodyJsonUnsafe({ workspaceID: "wrk_test", password: "super-secretpw" }),
        HttpClient.execute,
      )
      expect(set.status).toBe(200)

      const status = yield* HttpClientRequest.get("/git/workspaces/wrk_test/server-password").pipe(HttpClient.execute)
      expect(yield* status.json).toEqual({ set: true })
      expect(JSON.stringify(yield* status.json)).not.toContain("super-secretpw")

      const missing = yield* HttpClientRequest.get("/git/workspaces/wrk_other/server-password").pipe(HttpClient.execute)
      expect(yield* missing.json).toEqual({ set: false })
    }),
  )

  it.live("rejects a short server password with 400", () =>
    Effect.gen(function* () {
      const response = yield* HttpClientRequest.post("/git/workspaces/wrk_test/server-password").pipe(
        HttpClientRequest.bodyJsonUnsafe({ workspaceID: "wrk_test", password: "short" }),
        HttpClient.execute,
      )
      expect(response.status).toBe(400)
    }),
  )
})
