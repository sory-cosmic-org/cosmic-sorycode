import { describe, expect, test } from "bun:test"
import path from "node:path"
import { RemoteGithubAdapter } from "../../src/control-plane/adapters/remote-github"
import type { WorkspaceInfo } from "../../src/control-plane/types"

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
})