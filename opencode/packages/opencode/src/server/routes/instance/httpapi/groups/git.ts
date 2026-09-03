import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { described } from "./metadata"

const root = "/git"

export const GitProvider = Schema.Literals(["github", "gitlab"])
export const GitPageQuery = Schema.Struct({
  provider: Schema.optional(GitProvider),
  page: Schema.optional(Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1))),
  perPage: Schema.optional(
    Schema.NumberFromString.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 100 })),
  ),
})

export const Repository = Schema.Struct({
  id: Schema.Number,
  provider: GitProvider,
  owner: Schema.String,
  name: Schema.String,
  fullName: Schema.String,
  description: Schema.NullOr(Schema.String),
  url: Schema.String,
  private: Schema.Boolean,
  defaultBranch: Schema.String,
  updatedAt: Schema.NullOr(Schema.String),
})

export const Identity = Schema.Struct({
  id: Schema.Number,
  login: Schema.String,
  name: Schema.NullOr(Schema.String),
  avatarUrl: Schema.NullOr(Schema.String),
  url: Schema.String,
})

export const Branch = Schema.Struct({
  name: Schema.String,
  protected: Schema.Boolean,
})

export const Pipeline = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  status: Schema.String,
  conclusion: Schema.NullOr(Schema.String),
  url: Schema.NullOr(Schema.String),
  updatedAt: Schema.NullOr(Schema.String),
})

const PageResult = <T extends Schema.Schema<unknown>>(item: T) =>
  Schema.Struct({
    items: Schema.Array(item),
    page: Schema.Int,
    perPage: Schema.Int,
    hasNext: Schema.Boolean,
  })

export const GitConnectInput = Schema.Struct({
  token: Schema.String.check(Schema.isPattern(/\S/)),
})

export const Codespace = Schema.Struct({
  name: Schema.String,
  displayName: Schema.NullOr(Schema.String),
  state: Schema.String,
  runtime: Schema.Literals([
    "running",
    "stopped",
    "starting",
    "stopping",
    "provisioning",
    "failed",
    "deleted",
    "unknown",
  ]),
  repository: Schema.String,
  branch: Schema.String,
  machine: Schema.NullOr(Schema.String),
  webUrl: Schema.String,
  lastUsedAt: Schema.String,
})

export const CodespaceMachine = Schema.Struct({
  name: Schema.String,
  displayName: Schema.String,
  cpus: Schema.Number,
  memoryInBytes: Schema.Number,
  storageInBytes: Schema.Number,
  prebuildAvailability: Schema.NullOr(Schema.String),
})

export const DevcontainerConfig = Schema.Struct({
  path: Schema.String,
  name: Schema.NullOr(Schema.String),
  displayName: Schema.NullOr(Schema.String),
})

export const CodespaceCreateInput = Schema.Struct({
  branch: Schema.String.check(Schema.isPattern(/\S/)),
  machine: Schema.optional(Schema.String),
  devcontainerPath: Schema.optional(Schema.String),
  displayName: Schema.optional(Schema.String),
})

export const ServerPasswordInput = Schema.Struct({
  workspaceID: Schema.String,
  password: Schema.String.check(Schema.isMinLength(8)),
})

export const ServerPasswordStatus = Schema.Struct({
  set: Schema.Boolean,
})

export const GitConnectionStatus = Schema.Struct({
  state: Schema.Literals(["connected", "disconnected"]),
  login: Schema.optional(Schema.String),
  source: Schema.optional(Schema.Literals(["token", "connector"])),
})

export class ApiRemoteGitError extends Schema.ErrorClass<ApiRemoteGitError>("RemoteGitError")(
  {
    name: Schema.Literal("RemoteGitError"),
    data: Schema.Struct({
      provider: GitProvider,
      message: Schema.String,
      status: Schema.optional(Schema.Int),
    }),
  },
  { httpApiStatus: 502 },
) {}

export const GitApi = HttpApi.make("git").add(
  HttpApiGroup.make("git")
    .add(
      HttpApiEndpoint.get("identity", `${root}/identity`, {
        success: described(Identity, "Connected GitHub identity"),
        error: ApiRemoteGitError,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "git.identity.get",
          summary: "Get connected Git identity",
          description: "Get the GitHub identity associated with the connected Replit integration.",
        }),
      ),
      HttpApiEndpoint.get("listRepositories", `${root}/repositories`, {
        query: Schema.Struct({
          ...GitPageQuery.fields,
          query: Schema.optional(Schema.String),
        }),
        success: described(PageResult(Repository), "Remote repositories"),
        error: ApiRemoteGitError,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "git.repositories.list",
          summary: "List remote repositories",
          description: "List or search repositories available through a connected Git provider.",
        }),
      ),
      HttpApiEndpoint.get("listBranches", `${root}/repositories/:owner/:repository/branches`, {
        params: {
          owner: Schema.String,
          repository: Schema.String,
        },
        query: GitPageQuery,
        success: described(PageResult(Branch), "Repository branches"),
        error: ApiRemoteGitError,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "git.branches.list",
          summary: "List repository branches",
          description: "List branches for a remote repository.",
        }),
      ),
      HttpApiEndpoint.get("listPipelines", `${root}/repositories/:owner/:repository/pipelines`, {
        params: {
          owner: Schema.String,
          repository: Schema.String,
        },
        query: Schema.Struct({
          ...GitPageQuery.fields,
          branch: Schema.optional(Schema.String),
        }),
        success: described(PageResult(Pipeline), "Repository CI pipelines"),
        error: ApiRemoteGitError,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "git.pipelines.list",
          summary: "List repository pipelines",
          description: "List recent CI workflow runs for a remote repository.",
        }),
      ),
      HttpApiEndpoint.get("status", `${root}/status`, {
        success: described(GitConnectionStatus, "Git provider connection status"),
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "git.status.get",
          summary: "Get Git connection status",
          description:
            "Check whether GitHub API calls can be made with a stored personal token or the server integration.",
        }),
      ),
      HttpApiEndpoint.post("connect", `${root}/connect`, {
        payload: GitConnectInput,
        success: described(Identity, "Connected GitHub identity"),
        error: ApiRemoteGitError,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "git.connect",
          summary: "Connect GitHub with a token",
          description:
            "Validate a GitHub personal token (repo scope) and store it server-side. The token itself is never returned.",
        }),
      ),
      HttpApiEndpoint.post("disconnect", `${root}/disconnect`, {
        success: described(Schema.Boolean, "GitHub token removed"),
        error: ApiRemoteGitError,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "git.disconnect",
          summary: "Disconnect GitHub",
          description: "Remove the stored GitHub personal token from the server.",
        }),
      ),
      HttpApiEndpoint.get("listCodespaces", `${root}/codespaces`, {
        query: Schema.Struct({
          repositoryID: Schema.optional(Schema.NumberFromString),
        }),
        success: described(Schema.Array(Codespace), "GitHub Codespaces"),
        error: ApiRemoteGitError,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "git.codespaces.list",
          summary: "List GitHub Codespaces",
          description: "List the authenticated user's codespaces, optionally filtered by repository.",
        }),
      ),
      HttpApiEndpoint.get("listRepositoryCodespaces", `${root}/repositories/:owner/:repository/codespaces`, {
        params: {
          owner: Schema.String,
          repository: Schema.String,
        },
        success: described(Schema.Array(Codespace), "Repository codespaces"),
        error: ApiRemoteGitError,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "git.codespaces.list-by-repository",
          summary: "List codespaces for a repository",
          description: "List the authenticated user's codespaces for one repository.",
        }),
      ),
      HttpApiEndpoint.get("getCodespace", `${root}/codespaces/:name`, {
        params: {
          name: Schema.String,
        },
        success: described(Codespace, "GitHub Codespace"),
        error: ApiRemoteGitError,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "git.codespaces.get",
          summary: "Get a codespace",
          description: "Get the real state of one codespace by name.",
        }),
      ),
      HttpApiEndpoint.post("createCodespace", `${root}/repositories/:owner/:repository/codespaces`, {
        params: {
          owner: Schema.String,
          repository: Schema.String,
        },
        payload: CodespaceCreateInput,
        success: described(Codespace, "Created Codespace"),
        error: ApiRemoteGitError,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "git.codespaces.create",
          summary: "Create a codespace",
          description: "Create a real GitHub Codespace for a repository branch. Creation continues on GitHub; poll get for the state.",
        }),
      ),
      HttpApiEndpoint.post("startCodespace", `${root}/codespaces/:name/start`, {
        params: {
          name: Schema.String,
        },
        success: described(Codespace, "Starting Codespace"),
        error: ApiRemoteGitError,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "git.codespaces.start",
          summary: "Start a codespace",
          description: "Start a stopped codespace.",
        }),
      ),
      HttpApiEndpoint.post("stopCodespace", `${root}/codespaces/:name/stop`, {
        params: {
          name: Schema.String,
        },
        success: described(Codespace, "Stopping Codespace"),
        error: ApiRemoteGitError,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "git.codespaces.stop",
          summary: "Stop a codespace",
          description: "Stop a running codespace without deleting it.",
        }),
      ),
      HttpApiEndpoint.delete("deleteCodespace", `${root}/codespaces/:name`, {
        params: {
          name: Schema.String,
        },
        success: described(Schema.Boolean, "Codespace deleted"),
        error: ApiRemoteGitError,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "git.codespaces.delete",
          summary: "Delete a codespace",
          description: "Explicitly delete a codespace. This cannot be undone.",
        }),
      ),
      HttpApiEndpoint.get("listCodespaceMachines", `${root}/repositories/:owner/:repository/codespaces/machines`, {
        params: {
          owner: Schema.String,
          repository: Schema.String,
        },
        success: described(Schema.Array(CodespaceMachine), "Available machines"),
        error: ApiRemoteGitError,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "git.codespaces.machines.list",
          summary: "List available machines",
          description: "List machine types available for new codespaces in a repository.",
        }),
      ),
      HttpApiEndpoint.get("listDevcontainerConfigs", `${root}/repositories/:owner/:repository/codespaces/devcontainers`, {
        params: {
          owner: Schema.String,
          repository: Schema.String,
        },
        success: described(Schema.Array(DevcontainerConfig), "Devcontainer configurations"),
        error: ApiRemoteGitError,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "git.codespaces.devcontainers.list",
          summary: "List devcontainer configurations",
          description: "List devcontainer.json configurations available for new codespaces.",
        }),
      ),
      HttpApiEndpoint.get("getTokenScopes", `${root}/token-scopes`, {
        success: described(Schema.Array(Schema.String), "Token scopes"),
        error: ApiRemoteGitError,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "git.token-scopes.get",
          summary: "Get stored token scopes",
          description: "List classic PAT scopes of the stored GitHub token, to warn when the codespace scope is missing.",
        }),
      ),
      HttpApiEndpoint.post("setServerPassword", `${root}/workspaces/:id/server-password`, {
        params: {
          id: Schema.String,
        },
        payload: ServerPasswordInput,
        success: described(Schema.Boolean, "Server password stored"),
        error: ApiRemoteGitError,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "git.workspace.server-password.set",
          summary: "Set a workspace remote server password",
          description:
            "Store the remote OpenCode server password for a workspace. Same value as the SORY_CODE_SERVER_PASSWORD codespace secret. Never returned.",
        }),
      ),
      HttpApiEndpoint.get("getServerPasswordStatus", `${root}/workspaces/:id/server-password`, {
        params: {
          id: Schema.String,
        },
        success: described(ServerPasswordStatus, "Server password presence"),
        error: ApiRemoteGitError,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "git.workspace.server-password.get",
          summary: "Check a workspace server password",
          description: "Check whether a remote server password is stored, without ever returning it.",
        }),
      ),
    )
    .annotateMerge(OpenApi.annotations({ title: "git", description: "Remote Git provider routes." })),
)