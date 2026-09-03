import { WorkspaceTable } from "@opencode-ai/core/control-plane/workspace.sql"
import { WorkspaceV2 } from "@opencode-ai/core/workspace"
import { eq } from "drizzle-orm"
import { Effect } from "effect"
import { Schema } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { makeRuntime } from "@/effect/run-service"
import {
  forwardedPortUrl,
  requestWithToken,
  toCodespace,
  type Codespace,
  type CodespaceCreateInput,
  type GithubCodespaceResponse,
} from "@/git/codespaces"
import { RemoteGitProviderError } from "@/git/remote"
import { tokenFromEnv } from "@/git/remote"
import { getAsync as getSecretAsync, SERVER_PASSWORD_KEY } from "../workspace-secret"
import type { WorkspaceAdapter } from "../types"

const CodespacesConfigSchema = Schema.Struct({
  provider: Schema.Literal("github"),
  owner: Schema.String,
  repository: Schema.String,
  branch: Schema.String,
  machine: Schema.optional(Schema.String),
  devcontainerPath: Schema.optional(Schema.String),
  // Bound codespace name, persisted by create(). Never invent one.
  codespace: Schema.optional(Schema.String),
  // OpenCode server port inside the codespace (forwarded).
  serverPort: Schema.optional(Schema.Number),
})
type CodespacesConfig = Schema.Schema.Type<typeof CodespacesConfigSchema>
const decodeCodespacesConfig = Schema.decodeUnknownSync(CodespacesConfigSchema)

export const DEFAULT_SERVER_PORT = 4096
const POLL_INTERVAL_MS = 10_000
const POLL_TIMEOUT_MS = 10 * 60_000

function requireInstanceDirectory(context: Parameters<NonNullable<WorkspaceAdapter["configure"]>>[1]) {
  if (!context?.instance?.worktree) throw new Error("GitHub Codespaces workspace requires an instance context")
  return context.instance.worktree
}

// Plain client over requestWithToken so tests can inject a fake without
// network, auth, or database. Production calls use the stored GitHub token.
export type CodespacesClient = {
  readonly listForRepository: (input: { owner: string; repository: string }) => Promise<readonly Codespace[]>
  readonly get: (name: string) => Promise<Codespace>
  readonly create: (input: CodespaceCreateInput) => Promise<Codespace>
  readonly start: (name: string) => Promise<Codespace>
  readonly remove: (name: string) => Promise<void>
}

export type CodespacesSecrets = {
  readonly getServerPassword: (workspaceID: WorkspaceV2.ID) => Promise<string | undefined>
}

function liveClient(token: string): CodespacesClient {
  return {
    listForRepository: async (input) =>
      (
        (await requestWithToken<{ codespaces: GithubCodespaceResponse[] }>(
          token,
          "GET",
          `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repository)}/codespaces`,
        )).codespaces
      ).map(toCodespace),
    get: async (name) =>
      toCodespace(
        await requestWithToken<GithubCodespaceResponse>(token, "GET", `/user/codespaces/${encodeURIComponent(name)}`),
      ),
    create: async (input) =>
      toCodespace(
        await requestWithToken<GithubCodespaceResponse>(
          token,
          "POST",
          `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repository)}/codespaces`,
          {
            ref: input.branch,
            ...(input.machine ? { machine: input.machine } : {}),
            ...(input.devcontainerPath ? { devcontainer_path: input.devcontainerPath } : {}),
          },
        ),
      ),
    start: async (name) =>
      toCodespace(
        await requestWithToken<GithubCodespaceResponse>(token, "POST", `/user/codespaces/${encodeURIComponent(name)}/start`),
      ),
    remove: async (name) => {
      await requestWithToken<unknown>(token, "DELETE", `/user/codespaces/${encodeURIComponent(name)}`)
    },
  }
}

const { runPromise: runDatabase } = makeRuntime(Database.Service, AppNodeBuilder.build(Database.node))

async function persistBinding(workspaceID: WorkspaceV2.ID, extra: unknown, codespaceName: string) {
  const merged = { ...(typeof extra === "object" && extra !== null ? extra : {}), codespace: codespaceName }
  await runDatabase((database) =>
    database.db
      .update(WorkspaceTable)
      .set({ extra: merged, codespace_name: codespaceName })
      .where(eq(WorkspaceTable.id, workspaceID))
      .run()
      .pipe(Effect.orDie),
  )
  return merged
}

function reusable(codespace: Codespace, branch: string) {
  if (codespace.branch !== branch) return false
  // A stopped codespace is adopted then started; failed/deleted ones are
  // left alone and replaced by a fresh create.
  return (
    codespace.runtime === "running" ||
    codespace.runtime === "starting" ||
    codespace.runtime === "provisioning" ||
    codespace.runtime === "stopped"
  )
}

export type CodespacesAdapterOptions = {
  client?: CodespacesClient
  secrets?: CodespacesSecrets
  persist?: (workspaceID: WorkspaceV2.ID, extra: unknown, codespaceName: string) => Promise<unknown>
  serverPort?: number
  pollIntervalMs?: number
}

export function createCodespacesAdapter(options: CodespacesAdapterOptions = {}): WorkspaceAdapter {
  return {
    name: "GitHub Codespaces",
    description: "Work directly in a GitHub Codespace; files stay in the remote environment",
    async configure(info, context) {
      requireInstanceDirectory(context)
      const config = decodeCodespacesConfig(info.extra)
      return {
        ...info,
        name: `${config.owner}-${config.repository}`,
        branch: config.branch,
        directory: null,
      }
    },
    async create(info, env) {
      const config = decodeCodespacesConfig(info.extra)
      // A connected personal token (Auth store, forwarded through the
      // workspace environment) authenticates the official API directly.
      // Injected clients (tests) carry their own auth.
      const envToken = tokenFromEnv({ ...process.env, OPENCODE_AUTH_CONTENT: env?.OPENCODE_AUTH_CONTENT })
      if (!envToken && !options.client)
        throw new RemoteGitProviderError("github", undefined, "GitHub is not connected. Connect GitHub before creating a codespace.")
      const client = options.client ?? liveClient(envToken as string)
      const secrets = options.secrets ?? { getServerPassword: (id) => getSecretAsync(id, SERVER_PASSWORD_KEY) }
      const persist = options.persist ?? persistBinding

      const existing = await client.listForRepository({ owner: config.owner, repository: config.repository })
      const adopted = existing.find((item) => reusable(item, config.branch))
      let codespace = adopted
      let createdHere = false
      try {
        if (!codespace) {
          codespace = await client.create({
            owner: config.owner,
            repository: config.repository,
            branch: config.branch,
            ...(config.machine ? { machine: config.machine } : {}),
            ...(config.devcontainerPath ? { devcontainerPath: config.devcontainerPath } : {}),
          })
          createdHere = true
        }
        if (codespace.runtime === "stopped") codespace = await client.start(codespace.name)
        const deadline = Date.now() + POLL_TIMEOUT_MS
        const interval = options.pollIntervalMs ?? POLL_INTERVAL_MS
        while (codespace.runtime !== "running") {
          if (codespace.runtime === "failed" || codespace.runtime === "deleted")
            throw new RemoteGitProviderError("github", undefined, `GitHub codespace ${codespace.name} is ${codespace.runtime}. Check the codespace on github.com.`)
          if (Date.now() > deadline)
            throw new RemoteGitProviderError(
              "github",
              undefined,
              `GitHub codespace ${codespace.name} is still ${codespace.runtime} after 10 minutes. It keeps provisioning on GitHub; retry to resume waiting.`,
            )
          await new Promise((resolve) => setTimeout(resolve, interval))
          codespace = await client.get(codespace.name)
        }
        await persist(info.id, info.extra, codespace.name)
        const password = await secrets.getServerPassword(info.id)
        if (!password)
          throw new RemoteGitProviderError(
            "github",
            undefined,
            "Set the remote server password before using this workspace (same value as the SORY_CODE_SERVER_PASSWORD codespace secret).",
          )
      } catch (error) {
        // Never leave an unusable codespace billing behind when we created it
        // here; a reused codespace is left untouched for its owner.
        if (createdHere && codespace) {
          await client.remove(codespace.name).catch(() => {})
        }
        throw error
      }
    },
    async remove(_info) {
      // Deleting a codespace is an explicit user action through the API, not
      // a side effect of removing the workspace row (secrets cascade).
    },
    async target(info) {
      const config = decodeCodespacesConfig(info.extra)
      if (!config.codespace) throw new Error("GitHub Codespace is not bound yet. Create the workspace first.")
      const secrets = options.secrets ?? { getServerPassword: (id) => getSecretAsync(id, SERVER_PASSWORD_KEY) }
      const password = await secrets.getServerPassword(info.id)
      if (!password) throw new Error("Remote server password is not set for this workspace.")
      // Basic credentials for the OpenCode server inside the codespace.
      // Username matches the server default ("opencode", see server/auth);
      // the password is the per-workspace server secret, never logged.
      const authorization = `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}`
      return {
        type: "remote",
        url: forwardedPortUrl(config.codespace, config.serverPort ?? options.serverPort ?? DEFAULT_SERVER_PORT),
        headers: { Authorization: authorization },
      }
    },
  }
}

export const CodespacesAdapter = createCodespacesAdapter()
