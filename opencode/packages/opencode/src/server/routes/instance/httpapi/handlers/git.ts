import { RemoteGitProviderError, Service as RemoteGit } from "@/git/remote"
import { Service as Codespaces } from "@/git/codespaces"
import { WorkspaceV2 } from "@opencode-ai/core/workspace"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { RootHttpApi } from "../api"
import { ApiRemoteGitError } from "../groups/git"
import { SERVER_PASSWORD_KEY, Service as WorkspaceSecret } from "@/control-plane/workspace-secret"

const defaultPage = 1
const defaultPerPage = 30

export const gitHandlers = HttpApiBuilder.group(RootHttpApi, "git", (handlers) =>
  Effect.gen(function* () {
    const remoteGit = yield* RemoteGit
    const codespaces = yield* Codespaces
    const secrets = yield* WorkspaceSecret

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

    const status = Effect.fn("GitHttpApi.status")(function* () {
      return yield* remoteGit.status()
    })

    const connect = Effect.fn("GitHttpApi.connect")(function* (ctx: { payload: { token: string } }) {
      return yield* remoteGit.connect(ctx.payload).pipe(Effect.mapError(toApiError))
    })

    const disconnect = Effect.fn("GitHttpApi.disconnect")(function* () {
      yield* remoteGit.disconnect().pipe(Effect.mapError(toApiError))
      return true
    })

    const listCodespaces = Effect.fn("GitHttpApi.listCodespaces")(function* (ctx: { query: { repositoryID?: number } }) {
      return [...(yield* codespaces.list({ repositoryID: ctx.query.repositoryID }).pipe(Effect.mapError(toApiError)))]
    })

    const listRepositoryCodespaces = Effect.fn("GitHttpApi.listRepositoryCodespaces")(function* (ctx: {
      params: { owner: string; repository: string }
    }) {
      return [
        ...(yield* codespaces
          .listForRepository({ owner: ctx.params.owner, repository: ctx.params.repository })
          .pipe(Effect.mapError(toApiError))),
      ]
    })

    const getCodespace = Effect.fn("GitHttpApi.getCodespace")(function* (ctx: { params: { name: string } }) {
      return yield* codespaces.get(ctx.params.name).pipe(Effect.mapError(toApiError))
    })

    const createCodespace = Effect.fn("GitHttpApi.createCodespace")(function* (ctx: {
      params: { owner: string; repository: string }
      payload: { branch: string; machine?: string; devcontainerPath?: string; displayName?: string }
    }) {
      return yield* codespaces
        .create({
          owner: ctx.params.owner,
          repository: ctx.params.repository,
          branch: ctx.payload.branch,
          machine: ctx.payload.machine,
          devcontainerPath: ctx.payload.devcontainerPath,
          displayName: ctx.payload.displayName,
        })
        .pipe(Effect.mapError(toApiError))
    })

    const startCodespace = Effect.fn("GitHttpApi.startCodespace")(function* (ctx: { params: { name: string } }) {
      return yield* codespaces.start(ctx.params.name).pipe(Effect.mapError(toApiError))
    })

    const stopCodespace = Effect.fn("GitHttpApi.stopCodespace")(function* (ctx: { params: { name: string } }) {
      return yield* codespaces.stop(ctx.params.name).pipe(Effect.mapError(toApiError))
    })

    const deleteCodespace = Effect.fn("GitHttpApi.deleteCodespace")(function* (ctx: { params: { name: string } }) {
      yield* codespaces.remove(ctx.params.name).pipe(Effect.mapError(toApiError))
      return true
    })

    const listCodespaceMachines = Effect.fn("GitHttpApi.listCodespaceMachines")(function* (ctx: {
      params: { owner: string; repository: string }
    }) {
      return [
        ...(yield* codespaces
          .listMachines({ owner: ctx.params.owner, repository: ctx.params.repository })
          .pipe(Effect.mapError(toApiError))),
      ]
    })

    const listDevcontainerConfigs = Effect.fn("GitHttpApi.listDevcontainerConfigs")(function* (ctx: {
      params: { owner: string; repository: string }
    }) {
      return [
        ...(yield* codespaces
          .listDevcontainers({ owner: ctx.params.owner, repository: ctx.params.repository })
          .pipe(Effect.mapError(toApiError))),
      ]
    })

    const getTokenScopes = Effect.fn("GitHttpApi.getTokenScopes")(function* () {
      return [...(yield* codespaces.tokenScopes().pipe(Effect.mapError(toApiError)))]
    })

    const setServerPassword = Effect.fn("GitHttpApi.setServerPassword")(function* (ctx: {
      params: { id: string }
      payload: { workspaceID: string; password: string }
    }) {
      const workspaceID = WorkspaceV2.ID.make(ctx.params.id)
      yield* secrets.set(workspaceID, SERVER_PASSWORD_KEY, ctx.payload.password).pipe(
        Effect.mapError(
          (error) =>
            new ApiRemoteGitError({
              name: "RemoteGitError",
              data: { provider: "github", message: "Could not store the server password." },
            }),
        ),
      )
      return true
    })

    const getServerPasswordStatus = Effect.fn("GitHttpApi.getServerPasswordStatus")(function* (ctx: {
      params: { id: string }
    }) {
      const workspaceID = WorkspaceV2.ID.make(ctx.params.id)
      return {
        set: yield* secrets.has(workspaceID, SERVER_PASSWORD_KEY).pipe(
          Effect.mapError(
            () =>
              new ApiRemoteGitError({
                name: "RemoteGitError",
                data: { provider: "github", message: "Could not read the server password status." },
              }),
          ),
        ),
      }
    })

    return handlers
      .handle("identity", identity)
      .handle("listRepositories", listRepositories)
      .handle("listBranches", listBranches)
      .handle("listPipelines", listPipelines)
      .handle("status", status)
      .handle("connect", connect)
      .handle("disconnect", disconnect)
      .handle("listCodespaces", listCodespaces)
      .handle("listRepositoryCodespaces", listRepositoryCodespaces)
      .handle("getCodespace", getCodespace)
      .handle("createCodespace", createCodespace)
      .handle("startCodespace", startCodespace)
      .handle("stopCodespace", stopCodespace)
      .handle("deleteCodespace", deleteCodespace)
      .handle("listCodespaceMachines", listCodespaceMachines)
      .handle("listDevcontainerConfigs", listDevcontainerConfigs)
      .handle("getTokenScopes", getTokenScopes)
      .handle("setServerPassword", setServerPassword)
      .handle("getServerPasswordStatus", getServerPasswordStatus)
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