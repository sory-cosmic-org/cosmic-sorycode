import { mkdir, rm, writeFile, chmod } from "node:fs/promises"
import { dirname, join, resolve, sep } from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { Schema } from "effect"
import { downloadRepositorySnapshot } from "@/git/remote"
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

    await rm(info.directory, { recursive: true, force: true })
    await mkdir(info.directory, { recursive: true })
    for (const file of await downloadRepositorySnapshot(config)) {
      const target = resolve(info.directory, file.path)
      if (target !== resolve(info.directory) && !target.startsWith(`${resolve(info.directory)}${sep}`)) {
        throw new Error(`Unsafe repository path: ${file.path}`)
      }
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, file.content)
      if (file.executable) await chmod(target, 0o755)
    }
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
  },
  async remove(info) {
    if (info.directory) await rm(info.directory, { recursive: true, force: true })
  },
  target(info) {
    if (!info.directory) throw new Error("GitHub workspace directory was not configured")
    return { type: "local", directory: info.directory }
  },
}