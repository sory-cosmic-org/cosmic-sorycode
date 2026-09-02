import type { ServerSDK } from "@/context/server-sdk"

export type RemoteGitRepository = {
  id: number
  provider: "github" | "gitlab"
  owner: string
  name: string
  fullName: string
  description: string | null
  url: string
  private: boolean
  defaultBranch: string
  updatedAt: string | null
}

export type RemoteGitBranch = {
  name: string
  protected: boolean
}

type PageResult<T> = {
  items: T[]
  page: number
  perPage: number
  hasNext: boolean
}

function endpoint(server: ServerSDK, path: string, params: Record<string, string | undefined>) {
  const url = new URL(path, server.url.endsWith("/") ? server.url : `${server.url}/`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, value)
  }
  return url
}

async function request<T>(server: ServerSDK, path: string, params: Record<string, string | undefined>) {
  const response = await fetch(endpoint(server, path, params), {
    headers: { Accept: "application/json" },
  })
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(body || `Remote Git request failed (${response.status})`)
  }
  return (await response.json()) as T
}

export function listRemoteRepositories(server: ServerSDK, query: string) {
  return request<PageResult<RemoteGitRepository>>(server, "/git/repositories", {
    provider: "github",
    query: query.trim() || undefined,
    page: "1",
    perPage: "50",
  })
}

export function listRemoteBranches(server: ServerSDK, repository: RemoteGitRepository) {
  return request<PageResult<RemoteGitBranch>>(
    server,
    `/git/repositories/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/branches`,
    { provider: repository.provider, page: "1", perPage: "100" },
  )
}