import { ReplitConnectors } from "@replit/connectors-sdk"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Context, Effect, Layer } from "effect"

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
}

export class Service extends Context.Service<Service, Interface>()("@opencode/RemoteGit") {}

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
  ) {
    super(message)
  }
}

const connectors = new ReplitConnectors()

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

function request<T>(path: string) {
  return Effect.tryPromise({
    try: async () => {
      const response = await connectors.proxy("github", path, {
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      })
      if (!response.ok) {
        const body = await response.text()
        throw new GithubRequestError(response.status, body.slice(0, 300))
      }
      return (await response.json()) as T
    },
    catch: (error) => {
      if (error instanceof GithubRequestError)
        return new RemoteGitProviderError("github", error.status, error.message || "GitHub request failed")
      return new RemoteGitProviderError("github", undefined, error instanceof Error ? error.message : String(error))
    },
  })
}

const service: Interface = {
  identity: Effect.fn("RemoteGit.identity")(function* () {
    const data = yield* request<GithubUser>("/user")
    return {
      id: data.id,
      login: data.login,
      name: data.name,
      avatarUrl: data.avatar_url,
      url: data.html_url,
    } satisfies Identity
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
}

const layer = Layer.succeed(Service, Service.of(service))

export const node = LayerNode.make({ service: Service, layer, deps: [] })