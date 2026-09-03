import { describe, expect, test } from "bun:test"
import type { WorkspaceV2 } from "@opencode-ai/core/workspace"
import { RemoteGitProviderError } from "../../src/git/remote"
import type { Codespace } from "../../src/git/codespaces"
import {
  createCodespacesAdapter,
  DEFAULT_SERVER_PORT,
  type CodespacesClient,
} from "../../src/control-plane/adapters/codespaces"
import type { WorkspaceInfo } from "../../src/control-plane/types"

const info = {
  id: "workspace_test",
  type: "github-codespaces",
  name: "pending",
  branch: null,
  directory: null,
  extra: {
    provider: "github",
    owner: "sory-cosmic",
    repository: "sory-code",
    branch: "dev",
  },
  projectID: "project_test",
} as WorkspaceInfo

const context = {
  instance: {
    directory: "/workspace/project",
    worktree: "/workspace/project",
    project: {} as never,
  },
}

function running(name = "sory-code-abc123"): Codespace {
  return {
    name,
    displayName: null,
    state: "Available",
    runtime: "running",
    repository: "sory-cosmic/sory-code",
    branch: "dev",
    machine: "standardLinux32gb",
    webUrl: "https://github.com/codespaces/x",
    lastUsedAt: "2026-09-03T12:00:00Z",
  }
}

function fakeClient(overrides: Partial<CodespacesClient> = {}): CodespacesClient & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    listForRepository: async () => [],
    get: async (name) => running(name),
    create: async () => ({ ...running(), state: "Provisioning", runtime: "provisioning" }),
    start: async (name) => running(name),
    remove: async (name) => {
      calls.push(`remove:${name}`)
    },
    ...overrides,
  }
}

const secrets = { getServerPassword: async () => "pw-12345678" }
const persist = async () => {}

describe("github-codespaces workspace adapter", () => {
  test("configures a remote workspace without a local directory", async () => {
    const adapter = createCodespacesAdapter({ pollIntervalMs: 5, client: fakeClient(), secrets, persist })
    const configured = await adapter.configure(info, context)

    expect(configured.name).toBe("sory-cosmic-sory-code")
    expect(configured.branch).toBe("dev")
    expect(configured.directory).toBeNull()
    expect(configured.extra).toEqual(info.extra)
  })

  test("rejects malformed configuration before any api call", async () => {
    const client = fakeClient()
    const adapter = createCodespacesAdapter({ pollIntervalMs: 5, client, secrets, persist })

    await expect(
      adapter.configure({ ...info, extra: { provider: "gitlab" } }, context),
    ).rejects.toThrow()
    expect(client.calls).toEqual([])
  })

  test("reuses a running codespace on the same branch without creating", async () => {
    let created = 0
    const client = fakeClient({
      listForRepository: async () => [running()],
      create: async () => {
        created += 1
        return running("new")
      },
    })
    let bound: unknown
    const adapter = createCodespacesAdapter({
      client,
      secrets,
      persist: async (_id, _extra, name) => {
        bound = name
      },
    })

    await adapter.create({ ...info }, {})
    expect(created).toBe(0)
    expect(bound).toBe("sory-code-abc123")
  })

  test("starts a stopped codespace instead of creating a new one", async () => {
    let started: string[] = []
    const client = fakeClient({
      listForRepository: async () => [{ ...running(), state: "Shutdown", runtime: "stopped" }],
      start: async (name) => {
        started.push(name)
        return running(name)
      },
    })
    const adapter = createCodespacesAdapter({ pollIntervalMs: 5, client, secrets, persist })

    await adapter.create({ ...info }, {})
    expect(started).toEqual(["sory-code-abc123"])
  })

  test("creates and waits until the codespace is running", async () => {
    let polls = 0
    const client = fakeClient({
      get: async (name) => {
        polls += 1
        return polls < 2 ? { ...running(name), state: "Provisioning", runtime: "provisioning" } : running(name)
      },
    })
    const adapter = createCodespacesAdapter({ pollIntervalMs: 5, client, secrets, persist })

    await adapter.create({ ...info }, {})
    expect(polls).toBeGreaterThanOrEqual(1)
  })

  test("fails without a token when no client is injected", async () => {
    const adapter = createCodespacesAdapter({ secrets, persist })
    await expect(adapter.create({ ...info }, {})).rejects.toBeInstanceOf(RemoteGitProviderError)
  })

  test("deletes a codespace it created when provisioning fails", async () => {
    const client = fakeClient({
      get: async (name) => ({ ...running(name), state: "Failed", runtime: "failed" }),
    })
    const adapter = createCodespacesAdapter({ pollIntervalMs: 5, client, secrets, persist })

    await expect(adapter.create({ ...info }, {})).rejects.toThrow("failed")
    expect(client.calls).toContain("remove:sory-code-abc123")
  })

  test("leaves a reused codespace alone when waiting fails", async () => {
    const client = fakeClient({
      listForRepository: async () => [{ ...running(), state: "Starting", runtime: "starting" }],
      get: async (name) => ({ ...running(name), state: "Failed", runtime: "failed" }),
    })
    const adapter = createCodespacesAdapter({ pollIntervalMs: 5, client, secrets, persist })

    await expect(adapter.create({ ...info }, {})).rejects.toThrow("failed")
    expect(client.calls).toEqual([])
  })

  test("resolves a remote target with basic auth from the stored password", async () => {
    const adapter = createCodespacesAdapter({ pollIntervalMs: 5, client: fakeClient(), secrets, persist })
    const target = await adapter.target({
      ...info,
      extra: { ...(info.extra as object), codespace: "sory-code-abc123" },
    })

    expect(target.type).toBe("remote")
    if (target.type !== "remote") throw new Error("expected remote target")
    expect(target.url).toBe(`https://sory-code-abc123-${DEFAULT_SERVER_PORT}.app.github.dev`)
    expect(target.headers).toEqual({ Authorization: `Basic ${Buffer.from("opencode:pw-12345678").toString("base64")}` })
  })

  test("refuses a target without binding or password", async () => {
    const adapter = createCodespacesAdapter({ pollIntervalMs: 5, client: fakeClient(), secrets, persist })
    await expect(adapter.target({ ...info })).rejects.toThrow("not bound")
    const bound = { ...info, extra: { ...(info.extra as object), codespace: "sory-code-abc123" } }
    const noPassword = createCodespacesAdapter({
      client: fakeClient(),
      secrets: { getServerPassword: async (_id: WorkspaceV2.ID) => undefined },
      persist,
    })
    await expect(noPassword.target(bound)).rejects.toThrow("password")
  })

  test("remove never deletes the codespace", async () => {
    const client = fakeClient()
    const adapter = createCodespacesAdapter({ pollIntervalMs: 5, client, secrets, persist })
    await adapter.remove({ ...info })
    expect(client.calls).toEqual([])
  })
})
