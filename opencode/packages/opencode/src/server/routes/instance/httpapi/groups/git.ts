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
    )
    .annotateMerge(OpenApi.annotations({ title: "git", description: "Remote Git provider routes." })),
)