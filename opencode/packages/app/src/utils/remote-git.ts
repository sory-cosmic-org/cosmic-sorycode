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

export type RemoteGitIdentity = {
  id: number
  login: string
  name: string | null
  avatarUrl: string | null
  url: string
}

export type RemoteGitBranch = {
  name: string
  protected: boolean
}

export type RemoteGitConnectionStatus = {
  state: "connected" | "disconnected"
  login?: string
  source?: "token" | "connector"
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
    throw new Error(connectMessage(body) ?? `Remote Git request failed (${response.status})`)
  }
  return (await response.json()) as T
}

function connectMessage(body: string): string | undefined {
  try {
    const data = JSON.parse(body) as { data?: { message?: unknown } }
    if (typeof data.data?.message === "string" && data.data.message) return data.data.message
    return undefined
  } catch {
    return body || undefined
  }
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

export function gitConnectionStatus(server: ServerSDK) {
  return request<RemoteGitConnectionStatus>(server, "/git/status", {})
}

export async function gitConnect(server: ServerSDK, token: string) {
  const response = await fetch(endpoint(server, "/git/connect", {}), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  })
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(connectMessage(body) ?? `GitHub connect failed (${response.status})`)
  }
  return (await response.json()) as RemoteGitIdentity
}

export async function gitDisconnect(server: ServerSDK) {
  const response = await fetch(endpoint(server, "/git/disconnect", {}), { method: "POST" })
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(connectMessage(body) ?? `GitHub disconnect failed (${response.status})`)
  }
}

export type Codespace = {
  name: string
  displayName: string | null
  state: string
  runtime: string
  repository: string
  branch: string
  machine: string
  webUrl: string | null
  lastUsedAt: string | null
}

export function listCodespacesForRepository(
  server: ServerSDK,
  repository: RemoteGitRepository,
) {
  return request<Codespace[]>(
    server,
    `/git/repositories/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/codespaces`,
    {},
  )
}

export function listAllCodespaces(server: ServerSDK) {
  return request<Codespace[]>(server, "/git/codespaces", {})
}

export async function startCodespace(server: ServerSDK, name: string) {
  const response = await fetch(endpoint(server, `/git/codespaces/${encodeURIComponent(name)}/start`, {}), {
    method: "POST",
    headers: { Accept: "application/json" },
  })
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(connectMessage(body) ?? `Failed to start codespace (${response.status})`)
  }
  return (await response.json()) as Codespace
}

export async function stopCodespace(server: ServerSDK, name: string) {
  const response = await fetch(endpoint(server, `/git/codespaces/${encodeURIComponent(name)}/stop`, {}), {
    method: "POST",
    headers: { Accept: "application/json" },
  })
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(connectMessage(body) ?? `Failed to stop codespace (${response.status})`)
  }
  return (await response.json()) as Codespace
}

export async function deleteCodespace(server: ServerSDK, name: string) {
  const response = await fetch(endpoint(server, `/git/codespaces/${encodeURIComponent(name)}`, {}), {
    method: "DELETE",
    headers: { Accept: "application/json" },
  })
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(connectMessage(body) ?? `Failed to delete codespace (${response.status})`)
  }
}