import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { Schema } from "effect"
import { downloadRepositoryArchive } from "@/git/remote"
import type { WorkspaceAdapter } from "../types"

const execFileAsync = promisify(execFile)

const RemoteConfig = Schema.Struct({
  provider: Schema.Literal("github"),
  owner: Schema.String,
  repository: Schema.String,
  branch: Schema.String,
})
const decodeRemoteConfig = Schema.decodeUnknownSync(RemoteConfig)

function requireInstanceDirectory(context: Parameters<NonNullable<WorkspaceAdapter["configure"]>>[1]) {
  if (!context?.instance?.worktree) throw new Error("GitHub workspace requires an instance context")
  return context.instance.worktree
}

export const RemoteGithubAdapter: WorkspaceAdapter = {
  name: "GitHub repository",
  description: "Clone a GitHub repository into an isolated workspace",
  async configure(info, context) {
    const config = decodeRemoteConfig(info.extra)
    const directory = join(requireInstanceDirectory(context), ".opencode", "remote-workspaces", info.id)
    return {
      ...info,
      name: `${config.owner}-${config.repository}`,
      branch: config.branch,
      directory,
    }
  },
  async create(info) {
    const config = decodeRemoteConfig(info.extra)
    if (!info.directory) throw new Error("GitHub workspace directory was not configured")

    const archiveDirectory = await mkdtemp(join(tmpdir(), "opencode-github-"))
    const archivePath = join(archiveDirectory, "repository.tar.gz")
    try {
      await mkdir(info.directory, { recursive: true })
      await rm(info.directory, { recursive: true, force: true })
      await mkdir(info.directory, { recursive: true })
      await writeFile(archivePath, await downloadRepositoryArchive(config))
      await execFileAsync("tar", ["-xzf", archivePath, "-C", info.directory, "--strip-components=1"])
      await execFileAsync("git", ["-C", info.directory, "init", "-b", config.branch])
      await execFileAsync("git", [
        "-C",
        info.directory,
        "remote",
        "add",
        "origin",
        `https://github.com/${config.owner}/${config.repository}.git`,
      ])
      await execFileAsync("git", ["-C", info.directory, "config", "user.name", "Sory Code"])
      await execFileAsync("git", ["-C", info.directory, "config", "user.email", "sory-code@localhost"])
      await execFileAsync("git", ["-C", info.directory, "add", "-A"])
      await execFileAsync("git", ["-C", info.directory, "commit", "-m", "Initial remote workspace snapshot"])
    } finally {
      await rm(archiveDirectory, { recursive: true, force: true })
    }
  },
  async remove(info) {
    if (info.directory) await rm(info.directory, { recursive: true, force: true })
  },
  target(info) {
    if (!info.directory) throw new Error("GitHub workspace directory was not configured")
    return { type: "local", directory: info.directory }
  },
}