import { ReplitConnectors } from "@replit/connectors-sdk"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Context, Effect, Layer } from "effect"
import { Auth } from "@/auth"

export type Provider = "github" | "gitlab"

export type Repository = {
  readonly id: number
  readonly provider: Provider
  readonly owner: string
  readonly name: string
  readonly fullName: string
  readonly description: string | null
  readonly url: string
  readonly private: boolean
  readonly defaultBranch: string
  readonly updatedAt: string | null
}

export type Identity = {
  readonly id: number
  readonly login: string
  readonly name: string | null
  readonly avatarUrl: string | null
  readonly url: string
}

export type Branch = {
  readonly name: string
  readonly protected: boolean
}

export type Pipeline = {
  readonly id: number
  readonly name: string
  readonly status: string
  readonly conclusion: string | null
  readonly url: string | null
  readonly updatedAt: string | null
}

export type PageInput = {
  readonly page: number
  readonly perPage: number
}

export type PageResult<T> = {
  readonly items: readonly T[]
  readonly page: number
  readonly perPage: number
  readonly hasNext: boolean
}

export class RemoteGitProviderError extends Error {
  readonly _tag = "RemoteGitProviderError"

  constructor(
    readonly provider: Provider,
    readonly status: number | undefined,
    message: string,
  ) {
    super(message)
  }
}

export interface Interface {
  readonly identity: () => Effect.Effect<Identity, RemoteGitProviderError>
  readonly listRepositories: (
    input: PageInput & { readonly query?: string },
  ) => Effect.Effect<PageResult<Repository>, RemoteGitProviderError>
  readonly listBranches: (
    input: PageInput & { readonly owner: string; readonly repository: string },
  ) => Effect.Effect<PageResult<Branch>, RemoteGitProviderError>
  readonly listPipelines: (input: {
    readonly owner: string
    readonly repository: string
    readonly branch?: string
    readonly page: number
    readonly perPage: number
  }) => Effect.Effect<PageResult<Pipeline>, RemoteGitProviderError>
  readonly status: () => Effect.Effect<ConnectionStatus, RemoteGitProviderError>
  readonly connect: (input: { readonly token: string }) => Effect.Effect<Identity, RemoteGitProviderError>
  readonly disconnect: () => Effect.Effect<void, RemoteGitProviderError>
}

export type ConnectionStatus = {
  readonly state: "connected" | "disconnected"
  readonly login?: string
  readonly source?: "token" | "connector"
}

export class Service extends Context.Service<Service, Interface>()("@opencode/RemoteGit") {}

type GithubRefResponse = {
  object: {
    sha: string
  }
}

type GithubTreeResponse = {
  truncated: boolean
  tree: Array<{
    path: string
    mode: string
    type: "blob" | "tree" | "commit"
    sha: string
  }>
}

type GithubBlobResponse = {
  content: string
  encoding: "base64"
}

export type RemoteRepositoryFile = {
  readonly path: string
  readonly content: Buffer
  readonly executable: boolean
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export async function downloadRepositorySnapshot(
  input: {
    readonly owner: string
    readonly repository: string
    readonly branch: string
  },
  opts?: { readonly token?: string },
) {
  const token = opts?.token ?? tokenFromEnv()
  const json = <T>(path: string) => githubJson<T>(path, token)
  const ref = await json<GithubRefResponse>(
    `/repos/${encodePath(input.owner)}/${encodePath(input.repository)}/git/ref/heads/${encodePath(input.branch)}`,
  )
  const tree = await json<GithubTreeResponse>(
    `/repos/${encodePath(input.owner)}/${encodePath(input.repository)}/git/trees/${encodePath(ref.object.sha)}?recursive=1`,
  )
  if (tree.truncated) {
    throw new RemoteGitProviderError("github", undefined, "GitHub repository tree is too large to download safely")
  }
  const blobs = tree.tree.filter((item) => item.type === "blob")
  const files: RemoteRepositoryFile[] = []
  for (let offset = 0; offset < blobs.length; offset += 4) {
    const batch = blobs.slice(offset, offset + 4)
    const downloaded = await Promise.all(
      batch.map(async (item) => {
        const normalized = item.path.replaceAll("\\", "/")
        if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
          throw new RemoteGitProviderError("github", undefined, `Unsafe path returned by GitHub: ${item.path}`)
        }
        const blob = await json<GithubBlobResponse>(
          `/repos/${encodePath(input.owner)}/${encodePath(input.repository)}/git/blobs/${encodePath(item.sha)}`,
        )
        if (blob.encoding !== "base64") {
          throw new RemoteGitProviderError("github", undefined, `Unsupported GitHub blob encoding for ${item.path}`)
        }
        return {
          path: normalized,
          content: Buffer.from(blob.content, "base64"),
          executable: item.mode === "100755",
        } satisfies RemoteRepositoryFile
      }),
    )
    files.push(...downloaded)
    if (offset + batch.length < blobs.length) await sleep(500)
  }
  return files
}

type GithubRepository = {
  id: number
  name: string
  full_name: string
  owner: { login: string }
  description: string | null
  html_url: string
  private: boolean
  default_branch: string
  updated_at: string | null
}

type GithubUser = {
  id: number
  login: string
  name: string | null
  avatar_url: string | null
  html_url: string
}

type GithubBranch = {
  name: string
  protected: boolean
}

type GithubWorkflowRun = {
  id: number
  name: string | null
  status: string
  conclusion: string | null
  html_url: string | null
  updated_at: string | null
}

type GithubSearchResponse = {
  items: GithubRepository[]
  total_count: number
}

type GithubWorkflowRunsResponse = {
  total_count: number
  workflow_runs: GithubWorkflowRun[]
}

class GithubRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfter?: number,
    readonly rateLimitReset?: number,
  ) {
    super(message)
  }
}

const connectors = new ReplitConnectors()

const GITHUB_AUTH_KEY = "github"
const GITHUB_API = "https://api.github.com"
const GITHUB_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
} as const

function tokenFromAuthValue(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined
  const record = value as { type?: unknown; key?: unknown }
  if (record.type !== "api" || typeof record.key !== "string" || !record.key) return undefined
  return record.key
}

// Reads a previously connected GitHub token without Effect services, for
// plain async call paths (snapshot download, adapters). Never logs it.
export function tokenFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  try {
    const data = JSON.parse(env.OPENCODE_AUTH_CONTENT ?? "{}") as Record<string, unknown>
    return tokenFromAuthValue(data[GITHUB_AUTH_KEY])
  } catch {
    return undefined
  }
}

async function directFetch<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    method: "GET",
    headers: { ...GITHUB_HEADERS, Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    const body = await response.text()
    throw new GithubRequestError(response.status, body.slice(0, 300), retryAfter(response), rateLimitReset(response))
  }
  return (await response.json()) as T
}

async function connectorFetch<T>(path: string): Promise<T> {
  const response = await connectors.proxy("github", path, {
    method: "GET",
    headers: { ...GITHUB_HEADERS },
  })
  if (!response.ok) {
    const body = await response.text()
    throw new GithubRequestError(response.status, body.slice(0, 300), retryAfter(response), rateLimitReset(response))
  }
  return (await response.json()) as T
}

type HeaderReader = { headers: { get(name: string): string | null } }

function retryAfter(response: HeaderReader) {
  const value = Number(response.headers.get("retry-after") ?? "1")
  return Number.isNaN(value) ? 1 : value
}

// GitHub signals an exhausted quota with 403 + x-ratelimit-remaining: 0.
// Surfacing the reset time beats leaking the raw API body into toasts.
function rateLimitReset(response: HeaderReader & { status: number }) {
  if (response.status !== 403) return undefined
  if (response.headers.get("x-ratelimit-remaining") !== "0") return undefined
  const reset = Number(response.headers.get("x-ratelimit-reset") ?? "")
  return Number.isNaN(reset) ? undefined : reset
}

function rateLimitMessage(reset?: number) {
  if (!reset) return "GitHub API rate limit exceeded. Try again in a few minutes."
  const at = new Date(reset * 1000).toISOString().slice(11, 16)
  return `GitHub API rate limit exceeded. Try again after ${at} UTC.`
}

function toProviderError(error: unknown) {
  if (error instanceof RemoteGitProviderError) return error
  if (error instanceof GithubRequestError) {
    if (error.rateLimitReset !== undefined)
      return new RemoteGitProviderError("github", error.status, rateLimitMessage(error.rateLimitReset))
    return new RemoteGitProviderError("github", error.status, error.message || "GitHub request failed")
  }
  return new RemoteGitProviderError("github", undefined, error instanceof Error ? error.message : String(error))
}

// Stored personal token first (works anywhere), Replit connector as
// fallback (works where the integration is connected). Never throws
// anything but RemoteGitProviderError, never includes the token.
async function githubJson<T>(path: string, token?: string, attempt = 0): Promise<T> {
  try {
    return token ? await directFetch<T>(path, token) : await connectorFetch<T>(path)
  } catch (error) {
    if (error instanceof GithubRequestError && error.status === 429 && attempt < 2) {
      await sleep(Math.max(1000, (error.retryAfter ?? 1) * 1000))
      return githubJson<T>(path, token, attempt + 1)
    }
    throw toProviderError(error)
  }
}

function encodePath(value: string) {
  return encodeURIComponent(value)
}

function pageResult<T>(items: readonly T[], input: PageInput, total?: number) {
  return {
    items,
    page: input.page,
    perPage: input.perPage,
    hasNext: total === undefined ? items.length === input.perPage : input.page * input.perPage < total,
  } satisfies PageResult<T>
}

const storedToken = Effect.fn("RemoteGit.storedToken")(function* () {
  const auth = yield* Auth.Service
  const value = yield* auth.get(GITHUB_AUTH_KEY).pipe(Effect.catch(() => Effect.succeed(undefined)))
  return tokenFromAuthValue(value)
})

function request<T>(path: string) {
  return Effect.flatMap(storedToken(), (token) =>
    Effect.tryPromise({
      try: () => githubJson<T>(path, token),
      catch: toProviderError,
    }),
  )
}

function toIdentity(data: GithubUser): Identity {
  return {
    id: data.id,
    login: data.login,
    name: data.name,
    avatarUrl: data.avatar_url,
    url: data.html_url,
  }
}

const service: Interface = {
  identity: Effect.fn("RemoteGit.identity")(function* () {
    return toIdentity(yield* request<GithubUser>("/user"))
  }),
  listRepositories: Effect.fn("RemoteGit.listRepositories")(function* (input) {
    const query = input.query?.trim()
    const params = new URLSearchParams({
      per_page: String(input.perPage),
      page: String(input.page),
    })
    const data = yield* request<GithubRepository[] | GithubSearchResponse>(
      query
        ? `/search/repositories?q=${encodeURIComponent(query)}&sort=updated&order=desc&${params}`
        : `/user/repos?sort=pushed&direction=desc&${params}`,
    )
    const items = Array.isArray(data) ? data : data.items
    const total = Array.isArray(data) ? undefined : data.total_count
    return pageResult(
      items.map(
        (item) =>
          ({
            id: item.id,
            provider: "github",
            owner: item.owner.login,
            name: item.name,
            fullName: item.full_name,
            description: item.description,
            url: item.html_url,
            private: item.private,
            defaultBranch: item.default_branch,
            updatedAt: item.updated_at,
          }) satisfies Repository,
      ),
      input,
      total,
    )
  }),
  listBranches: Effect.fn("RemoteGit.listBranches")(function* (input) {
    const params = new URLSearchParams({
      per_page: String(input.perPage),
      page: String(input.page),
    })
    const data = yield* request<GithubBranch[]>(
      `/repos/${encodePath(input.owner)}/${encodePath(input.repository)}/branches?${params}`,
    )
    return pageResult(
      data.map((item) => ({ name: item.name, protected: item.protected }) satisfies Branch),
      input,
    )
  }),
  listPipelines: Effect.fn("RemoteGit.listPipelines")(function* (input) {
    const params = new URLSearchParams({
      per_page: String(input.perPage),
      page: String(input.page),
    })
    if (input.branch) params.set("branch", input.branch)
    const data = yield* request<GithubWorkflowRunsResponse>(
      `/repos/${encodePath(input.owner)}/${encodePath(input.repository)}/actions/runs?${params}`,
    )
    return pageResult(
      data.workflow_runs.map(
        (item) =>
          ({
            id: item.id,
            name: item.name ?? "GitHub Actions",
            status: item.status,
            conclusion: item.conclusion,
            url: item.html_url,
            updatedAt: item.updated_at,
          }) satisfies Pipeline,
      ),
      input,
      data.total_count,
    )
  }),
  status: Effect.fn("RemoteGit.status")(function* () {
    const token = yield* storedToken()
    const probe = yield* Effect.exit(request<GithubUser>("/user"))
    if (probe._tag === "Success")
      return { state: "connected", login: probe.value.login, source: token ? "token" : "connector" } as const
    return { state: "disconnected" } as const
  }),
  connect: Effect.fn("RemoteGit.connect")(function* (input) {
    const token = input.token.trim()
    if (!token) return yield* Effect.fail(new RemoteGitProviderError("github", undefined, "GitHub token is required"))
    const user = yield* Effect.tryPromise({
      try: () => directFetch<GithubUser>("/user", token),
      catch: (error) => {
        if (error instanceof GithubRequestError && error.rateLimitReset !== undefined)
          return new RemoteGitProviderError("github", error.status, rateLimitMessage(error.rateLimitReset))
        if (error instanceof GithubRequestError && (error.status === 401 || error.status === 403))
          return new RemoteGitProviderError(
            "github",
            error.status,
            "GitHub rejected this token. Create a token with the repo scope and try again.",
          )
        return toProviderError(error)
      },
    })
    const auth = yield* Auth.Service
    yield* auth.set(GITHUB_AUTH_KEY, { type: "api", key: token }).pipe(
      Effect.mapError(
        (error) => new RemoteGitProviderError("github", undefined, `Could not save the GitHub token: ${error.message}`),
      ),
    )
    return toIdentity(user)
  }),
  disconnect: Effect.fn("RemoteGit.disconnect")(function* () {
    const auth = yield* Auth.Service
    yield* auth.remove(GITHUB_AUTH_KEY).pipe(
      Effect.mapError(
        (error) => new RemoteGitProviderError("github", undefined, `Could not remove the GitHub token: ${error.message}`),
      ),
    )
  }),
}

const layer = Layer.effect(
  Service,
  Effect.map(Auth.Service, () => Service.of(service)),
)

export const node = LayerNode.make({ service: Service, layer, deps: [Auth.node] })