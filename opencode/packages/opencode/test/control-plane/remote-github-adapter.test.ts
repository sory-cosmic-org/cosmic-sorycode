import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, stat } from "node:fs/promises"
import { execFile } from "node:child_process"
import { tmpdir } from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { createRemoteGithubAdapter, RemoteGithubAdapter } from "../../src/control-plane/adapters/remote-github"
import type { WorkspaceInfo } from "../../src/control-plane/types"

const execFileAsync = promisify(execFile)

const info = {
  id: "workspace_test",
  type: "remote-github",
  name: "pending",
  branch: null,
  directory: null,
  extra: {
    provider: "github",
    owner: "sory-cosmic",
    repository: "sory-code",
    branch: "main",
  },
  projectID: "project_test",
} as WorkspaceInfo

describe("remote-github workspace adapter", () => {
  test("configures an isolated directory and preserves the remote selection", async () => {
    const configured = await RemoteGithubAdapter.configure(info, {
      instance: {
        directory: "/workspace/project",
        worktree: "/workspace/project",
        project: {} as never,
      },
    })

    expect(configured.name).toBe("sory-cosmic-sory-code")
    expect(configured.branch).toBe("main")
    expect(configured.directory).toBe(path.join("/workspace/project", ".opencode", "remote-workspaces", info.id))
    expect(configured.extra).toEqual(info.extra)
    expect(RemoteGithubAdapter.target(configured)).toEqual({
      type: "local",
      directory: configured.directory!,
    })
  })

  test("rejects malformed remote configuration before cloning", async () => {
    await expect(
      RemoteGithubAdapter.configure(
        {
          ...info,
          extra: { provider: "gitlab", owner: "owner", repository: "repo", branch: "main" },
        },
        {
          instance: {
            directory: "/workspace/project",
            worktree: "/workspace/project",
            project: {} as never,
          },
        },
      ),
    ).rejects.toThrow()
  })

  test("downloads a snapshot, initializes the selected branch, and records the remote", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "remote-github-test-"))

    try {
      const adapter = createRemoteGithubAdapter({
        downloadSnapshot: async () => [
          { path: "README.md", content: Buffer.from("Sory Code\n"), executable: false },
          { path: "bin/run.sh", content: Buffer.from("#!/bin/sh\n"), executable: true },
        ],
      })
      const configured = await adapter.configure(info, {
        instance: {
          directory: root,
          worktree: root,
          project: {} as never,
        },
      })

      await adapter.create(configured, {})

      expect(await readFile(path.join(configured.directory!, "README.md"), "utf8")).toBe("Sory Code\n")
      expect((await stat(path.join(configured.directory!, "bin", "run.sh"))).mode & 0o111).not.toBe(0)
      expect(
        (await execFileAsync("git", ["-C", configured.directory!, "branch", "--show-current"])).stdout.trim(),
      ).toBe("main")
      expect(
        (await execFileAsync("git", ["-C", configured.directory!, "config", "--get", "remote.origin.url"])).stdout.trim(),
      ).toBe("https://github.com/sory-cosmic/sory-code.git")
      expect((await execFileAsync("git", ["-C", configured.directory!, "status", "--porcelain"])).stdout.trim()).toBe("")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("removes a partial workspace when the snapshot download fails", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "remote-github-failure-test-"))

    try {
      const adapter = createRemoteGithubAdapter({
        async downloadSnapshot() {
          throw new Error("download exploded")
        },
      })
      const configured = await adapter.configure(info, {
        instance: {
          directory: root,
          worktree: root,
          project: {} as never,
        },
      })

      await expect(adapter.create(configured, {})).rejects.toThrow("download exploded")
      await expect(stat(configured.directory!)).rejects.toMatchObject({ code: "ENOENT" })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("rejects paths outside the isolated workspace and cleans up", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "remote-github-path-test-"))

    try {
      const adapter = createRemoteGithubAdapter({
        async downloadSnapshot() {
          return [{ path: "../outside.txt", content: Buffer.from("unsafe"), executable: false }]
        },
      })
      const configured = await adapter.configure(info, {
        instance: {
          directory: root,
          worktree: root,
          project: {} as never,
        },
      })

      await expect(adapter.create(configured, {})).rejects.toThrow("Unsafe repository path")
      await expect(stat(configured.directory!)).rejects.toMatchObject({ code: "ENOENT" })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})