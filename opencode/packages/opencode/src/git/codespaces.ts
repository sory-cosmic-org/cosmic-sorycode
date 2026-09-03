import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Context, Effect, Layer } from "effect"
import { Auth } from "@/auth"
import { RemoteGitProviderError, tokenFromEnv } from "./remote"

// Official GitHub Codespaces REST API client.
// https://docs.github.com/en/rest/codespaces
//
// Unlike the snapshot downloader, this client never transfers file contents:
// listing, creating, starting and stopping a codespace costs a handful of
// API requests. Files stay inside the codespace; execution reaches them
// through the remote workspace target (control-plane), never through Replit.

export type CodespaceRuntime = "running" | "stopped" | "starting" | "stopping" | "provisioning" | "failed" | "deleted" | "unknown"

export type Codespace = {
  readonly name: string
  readonly displayName: string | null
  readonly state: string
  readonly runtime: CodespaceRuntime
  readonly repository: string
  readonly branch: string
  readonly machine: string | null
  readonly webUrl: string
  readonly lastUsedAt: string
}

export type CodespaceMachine = {
  readonly name: string
  readonly displayName: string
  readonly cpus: number
  readonly memoryInBytes: number
  readonly storageInBytes: number
  readonly prebuildAvailability: string | null
}

export type DevcontainerConfig = {
  readonly path: string
  readonly name: string | null
  readonly displayName: string | null
}

export type CodespaceCreateInput = {
  readonly owner: string
  readonly repository: string
  readonly branch: string
  readonly machine?: string
  readonly devcontainerPath?: string
  readonly displayName?: string
}

export interface Interface {
  readonly list: (input?: { readonly repositoryID?: number }) => Effect.Effect<readonly Codespace[], RemoteGitProviderError, Auth.Service>
  readonly listForRepository: (input: {
    readonly owner: string
    readonly repository: string
  }) => Effect.Effect<readonly Codespace[], RemoteGitProviderError, Auth.Service>
  readonly get: (name: string) => Effect.Effect<Codespace, RemoteGitProviderError, Auth.Service>
  readonly create: (input: CodespaceCreateInput) => Effect.Effect<Codespace, RemoteGitProviderError, Auth.Service>
  readonly start: (name: string) => Effect.Effect<Codespace, RemoteGitProviderError, Auth.Service>
  readonly stop: (name: string) => Effect.Effect<Codespace, RemoteGitProviderError, Auth.Service>
  readonly remove: (name: string) => Effect.Effect<void, RemoteGitProviderError, Auth.Service>
  readonly listMachines: (input: {
    readonly owner: string
    readonly repository: string
  }) => Effect.Effect<readonly CodespaceMachine[], RemoteGitProviderError, Auth.Service>
  readonly listDevcontainers: (input: {
    readonly owner: string
    readonly repository: string
  }) => Effect.Effect<readonly DevcontainerConfig[], RemoteGitProviderError, Auth.Service>
  // Classic PAT scopes from the x-oauth-scopes response header. Empty for
  // fine-grained tokens (GitHub omits the header); callers must only warn
  // when the header is present and "codespace" is missing.
  readonly tokenScopes: () => Effect.Effect<readonly string[], RemoteGitProviderError, Auth.Service>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Codespaces") {}

export type GithubCodespaceResponse = {
  name: string
  display_name: string | null
  state: string
  repository: { full_name: string }
  git_status: { ref: string }
  machine: { name: string } | null
  web_url: string
  last_used_at: string
}

type GithubCodespaceListResponse = {
  total_count: number
  codespaces: GithubCodespaceResponse[]
}

type GithubMachineResponse = {
  name: string
  display_name: string
  cpus: number
  memory_in_bytes: number
  storage_in_bytes: number
  prebuild_availability: string | null
}

type GithubMachineListResponse = {
  total_count: number
  machines: GithubMachineResponse[]
}

type GithubDevcontainerListResponse = {
  total_count: number
  devcontainers: Array<{ path: string; name?: string | null; display_name?: string | null }>
}

class CodespacesRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly scopes?: string,
  ) {
    super(message)
  }
}

const GITHUB_API = "https://api.github.com"
const GITHUB_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
} as const

export function toRuntime(state: string): CodespaceRuntime {
  switch (state) {
    case "Available":
      return "running"
    case "Shutdown":
    case "Archived":
      return "stopped"
    case "Starting":
      return "starting"
    case "ShuttingDown":
      return "stopping"
    case "Created":
    case "Queued":
    case "Provisioning":
    case "Updating":
    case "Rebuilding":
      return "provisioning"
    case "Failed":
      return "failed"
    case "Deleted":
    case "Moved":
      return "deleted"
    default:
      return "unknown"
  }
}

export function toCodespace(data: GithubCodespaceResponse): Codespace {
  return {
    name: data.name,
    displayName: data.display_name,
    state: data.state,
    runtime: toRuntime(data.state),
    repository: data.repository.full_name,
    branch: data.git_status.ref,
    machine: data.machine?.name ?? null,
    webUrl: data.web_url,
    lastUsedAt: data.last_used_at,
  }
}

// A forwarded port inside a codespace is reachable at a stable public URL.
// Visibility (private/org/public) is managed separately; the OpenCode server
// inside the codespace keeps its own password authentication.
export function forwardedPortUrl(codespaceName: string, port: number) {
  return `https://${codespaceName}-${port}.app.github.dev`
}

function scopeHint(status: number) {
  if (status === 401) return "GitHub rejected the stored token. Reconnect GitHub with a token that has the repo and codespace scopes."
  if (status === 403)
    return "GitHub refused this Codespaces operation. The token needs the codespace scope (classic) or the Codespaces permission (fine-grained), and the account needs Codespaces access."
  if (status === 404) return "GitHub did not find this codespace or repository. It may have been deleted, or the token cannot see it."
  if (status === 422) return "GitHub rejected the codespace parameters (machine, devcontainer path, or billing limit)."
  return undefined
}

function toProviderError(error: unknown) {
  if (error instanceof RemoteGitProviderError) return error
  if (error instanceof CodespacesRequestError) {
    const hint = scopeHint(error.status)
    const message = hint ?? error.message ?? "GitHub Codespaces request failed"
    return new RemoteGitProviderError("github", error.status, message)
  }
  return new RemoteGitProviderError("github", undefined, error instanceof Error ? error.message : String(error))
}

// Plain transport for non-Effect call sites (workspace adapters). Takes an
// explicit token, throws RemoteGitProviderError only, never logs the token.
export async function requestWithToken<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  try {
    return (await request<T>(method, path, token, body)).data
  } catch (error) {
    throw toProviderError(error)
  }
}

async function request<T>(method: string, path: string, token: string, body?: unknown): Promise<{ data: T; scopes: string }> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: { ...GITHUB_HEADERS, Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const scopes = response.headers.get("x-oauth-scopes") ?? ""
  if (!response.ok) {
    const text = await response.text()
    throw new CodespacesRequestError(response.status, text.slice(0, 300), scopes)
  }
  if (response.status === 202 && !response.headers.get("content-length")) {
    // DELETE returns 202 with an empty body.
    return { data: undefined as T, scopes }
  }
  return { data: (await response.json()) as T, scopes }
}

const storedToken = Effect.fn("Codespaces.storedToken")(function* () {
  const auth = yield* Auth.Service
  const value = yield* auth.get("github").pipe(Effect.catch(() => Effect.succeed(undefined)))
  if (!value || typeof value !== "object") return undefined
  const record = value as { type?: unknown; key?: unknown }
  if (record.type !== "api" || typeof record.key !== "string" || !record.key) return undefined
  return record.key
})

const requireToken = Effect.fn("Codespaces.requireToken")(function* () {
  const token = tokenFromEnv() ?? (yield* storedToken())
  if (!token)
    return yield* Effect.fail(
      new RemoteGitProviderError("github", undefined, "GitHub is not connected. Connect GitHub before managing codespaces."),
    )
  return token
})

function call<T>(method: string, path: string, body?: unknown) {
  return Effect.flatMap(requireToken(), (token) =>
    Effect.tryPromise({
      try: () => request<T>(method, path, token, body).then((result) => result.data),
      catch: toProviderError,
    }),
  )
}

const service: Interface = {
  list: Effect.fn("Codespaces.list")(function* (input) {
    const query = input?.repositoryID ? `?repository_id=${input.repositoryID}` : ""
    const data = yield* call<GithubCodespaceListResponse>("GET", `/user/codespaces${query}`)
    return data.codespaces.map(toCodespace)
  }),
  listForRepository: Effect.fn("Codespaces.listForRepository")(function* (input) {
    const data = yield* call<GithubCodespaceListResponse>(
      "GET",
      `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repository)}/codespaces`,
    )
    return data.codespaces.map(toCodespace)
  }),
  get: Effect.fn("Codespaces.get")(function* (name) {
    const data = yield* call<GithubCodespaceResponse>("GET", `/user/codespaces/${encodeURIComponent(name)}`)
    return toCodespace(data)
  }),
  create: Effect.fn("Codespaces.create")(function* (input) {
    const data = yield* call<GithubCodespaceResponse>(
      "POST",
      `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repository)}/codespaces`,
      {
        ref: input.branch,
        ...(input.machine ? { machine: input.machine } : {}),
        ...(input.devcontainerPath ? { devcontainer_path: input.devcontainerPath } : {}),
        ...(input.displayName ? { display_name: input.displayName } : {}),
      },
    )
    return toCodespace(data)
  }),
  start: Effect.fn("Codespaces.start")(function* (name) {
    const data = yield* call<GithubCodespaceResponse>("POST", `/user/codespaces/${encodeURIComponent(name)}/start`)
    return toCodespace(data)
  }),
  stop: Effect.fn("Codespaces.stop")(function* (name) {
    const data = yield* call<GithubCodespaceResponse>("POST", `/user/codespaces/${encodeURIComponent(name)}/stop`)
    return toCodespace(data)
  }),
  remove: Effect.fn("Codespaces.remove")(function* (name) {
    yield* call<unknown>("DELETE", `/user/codespaces/${encodeURIComponent(name)}`)
  }),
  listMachines: Effect.fn("Codespaces.listMachines")(function* (input) {
    const data = yield* call<GithubMachineListResponse>(
      "GET",
      `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repository)}/codespaces/machines`,
    )
    return data.machines.map((item) => ({
      name: item.name,
      displayName: item.display_name,
      cpus: item.cpus,
      memoryInBytes: item.memory_in_bytes,
      storageInBytes: item.storage_in_bytes,
      prebuildAvailability: item.prebuild_availability,
    }))
  }),
  listDevcontainers: Effect.fn("Codespaces.listDevcontainers")(function* (input) {
    const data = yield* call<GithubDevcontainerListResponse>(
      "GET",
      `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repository)}/codespaces/devcontainers`,
    )
    return data.devcontainers.map((item) => ({
      path: item.path,
      name: item.name ?? null,
      displayName: item.display_name ?? null,
    }))
  }),
  tokenScopes: Effect.fn("Codespaces.tokenScopes")(function* () {
    const token = yield* requireToken()
    const result = yield* Effect.tryPromise({
      try: () => request<unknown>("GET", "/user", token),
      catch: toProviderError,
    })
    return result.scopes
      .split(",")
      .map((scope) => scope.trim())
      .filter((scope) => scope.length > 0)
  }),
}

const layer = Layer.effect(
  Service,
  Effect.map(Auth.Service, () => Service.of(service)),
)

export const node = LayerNode.make({ service: Service, layer, deps: [Auth.node] })
