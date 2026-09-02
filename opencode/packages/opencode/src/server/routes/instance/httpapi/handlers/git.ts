import { RemoteGitProviderError, Service as RemoteGit } from "@/git/remote"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { RootHttpApi } from "../api"
import { ApiRemoteGitError } from "../groups/git"

const defaultPage = 1
const defaultPerPage = 30

export const gitHandlers = HttpApiBuilder.group(RootHttpApi, "git", (handlers) =>
  Effect.gen(function* () {
    const remoteGit = yield* RemoteGit

    const identity = Effect.fn("GitHttpApi.identity")(function* () {
      return yield* remoteGit.identity().pipe(Effect.mapError(toApiError))
    })

    const listRepositories = Effect.fn("GitHttpApi.listRepositories")(function* (ctx) {
      if (ctx.query.provider === "gitlab") return yield* unsupportedProvider()
      return yield* remoteGit
        .listRepositories({
          query: ctx.query.query,
          page: ctx.query.page ?? defaultPage,
          perPage: ctx.query.perPage ?? defaultPerPage,
        })
        .pipe(Effect.mapError(toApiError))
    })

    const listBranches = Effect.fn("GitHttpApi.listBranches")(function* (ctx) {
      if (ctx.query.provider === "gitlab") return yield* unsupportedProvider()
      return yield* remoteGit
        .listBranches({
          owner: ctx.params.owner,
          repository: ctx.params.repository,
          page: ctx.query.page ?? defaultPage,
          perPage: ctx.query.perPage ?? defaultPerPage,
        })
        .pipe(Effect.mapError(toApiError))
    })

    const listPipelines = Effect.fn("GitHttpApi.listPipelines")(function* (ctx) {
      if (ctx.query.provider === "gitlab") return yield* unsupportedProvider()
      return yield* remoteGit
        .listPipelines({
          owner: ctx.params.owner,
          repository: ctx.params.repository,
          branch: ctx.query.branch,
          page: ctx.query.page ?? defaultPage,
          perPage: ctx.query.perPage ?? defaultPerPage,
        })
        .pipe(Effect.mapError(toApiError))
    })

    return handlers
      .handle("identity", identity)
      .handle("listRepositories", listRepositories)
      .handle("listBranches", listBranches)
      .handle("listPipelines", listPipelines)
  }),
)

function toApiError(error: RemoteGitProviderError) {
  return new ApiRemoteGitError({
    name: "RemoteGitError",
    data: {
      provider: error.provider,
      message: error.message,
      ...(error.status === undefined ? {} : { status: error.status }),
    },
  })
}

function unsupportedProvider() {
  return Effect.fail(
    new ApiRemoteGitError({
      name: "RemoteGitError",
      data: {
        provider: "gitlab",
        message: "GitLab support is not connected yet",
      },
    }),
  )
}