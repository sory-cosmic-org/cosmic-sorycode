import { Octokit } from "@octokit/rest"
import { Context, Effect, Layer, Schema } from "effect"
import { GitHubOAuth, GitHubRepository, GitHubBranch, GitHubUser } from "./github-schemas"

export class GitHubClientError extends Schema.TaggedErrorClass<GitHubClientError>()("GitHubClientError", {
  message: Schema.String,
  code: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Defect()),
}) {}

export interface Interface {
  readonly getUser: (token: string) => Effect.Effect<GitHubUser, GitHubClientError>
  readonly listRepositories: (
    token: string,
    options?: { per_page?: number; page?: number },
  ) => Effect.Effect<GitHubRepository[], GitHubClientError>
  readonly searchRepositories: (
    token: string,
    query: string,
    options?: { per_page?: number; page?: number },
  ) => Effect.Effect<GitHubRepository[], GitHubClientError>
  readonly listBranches: (
    token: string,
    owner: string,
    repo: string,
    options?: { per_page?: number; page?: number },
  ) => Effect.Effect<GitHubBranch[], GitHubClientError>
  readonly getBranch: (
    token: string,
    owner: string,
    repo: string,
    branch: string,
  ) => Effect.Effect<GitHubBranch, GitHubClientError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/GitHubClient") {}

const mapError = (message: string, code?: string) => (cause: unknown) =>
  new GitHubClientError({ message, code, cause: cause instanceof Error ? cause : undefined })

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const getUser = Effect.fn("GitHubClient.getUser")(function* (token: string) {
      try {
        const octokit = new Octokit({ auth: token })
        const response = yield* Effect.promise(() => octokit.rest.users.getAuthenticated())
        return new GitHubUser({
          id: response.data.id,
          login: response.data.login,
          name: response.data.name ?? undefined,
          email: response.data.email ?? undefined,
          avatarUrl: response.data.avatar_url ?? undefined,
        })
      } catch (error) {
        return yield* Effect.fail(mapError("Failed to get GitHub user", "GET_USER_FAILED")(error))
      }
    })

    const listRepositories = Effect.fn("GitHubClient.listRepositories")(function* (
      token: string,
      options?: { per_page?: number; page?: number },
    ) {
      try {
        const octokit = new Octokit({ auth: token })
        const response = yield* Effect.promise(() =>
          octokit.rest.repos.listForAuthenticatedUser({
            per_page: options?.per_page ?? 30,
            page: options?.page ?? 1,
            type: "all",
            sort: "updated",
            direction: "desc",
          }),
        )
        return response.data.map(
          (repo) =>
            new GitHubRepository({
              id: repo.id,
              name: repo.name,
              fullName: repo.full_name,
              description: repo.description ?? undefined,
              url: repo.url,
              htmlUrl: repo.html_url,
              isPrivate: repo.private,
              owner: {
                login: repo.owner.login,
                id: repo.owner.id,
                type: repo.owner.type,
              },
            }),
        )
      } catch (error) {
        return yield* Effect.fail(
          mapError("Failed to list GitHub repositories", "LIST_REPOS_FAILED")(error),
        )
      }
    })

    const searchRepositories = Effect.fn("GitHubClient.searchRepositories")(function* (
      token: string,
      query: string,
      options?: { per_page?: number; page?: number },
    ) {
      try {
        const octokit = new Octokit({ auth: token })
        const response = yield* Effect.promise(() =>
          octokit.rest.search.repos({
            q: `${query} user:${yield* getUser(token).pipe(Effect.map((u) => u.login))}`,
            per_page: options?.per_page ?? 30,
            page: options?.page ?? 1,
            sort: "updated",
            order: "desc",
          }),
        )
        return response.data.items.map(
          (repo) =>
            new GitHubRepository({
              id: repo.id,
              name: repo.name,
              fullName: repo.full_name,
              description: repo.description ?? undefined,
              url: repo.url,
              htmlUrl: repo.html_url,
              isPrivate: repo.private,
              owner: {
                login: repo.owner.login,
                id: repo.owner.id,
                type: repo.owner.type,
              },
            }),
        )
      } catch (error) {
        return yield* Effect.fail(
          mapError("Failed to search GitHub repositories", "SEARCH_REPOS_FAILED")(error),
        )
      }
    })

    const listBranches = Effect.fn("GitHubClient.listBranches")(function* (
      token: string,
      owner: string,
      repo: string,
      options?: { per_page?: number; page?: number },
    ) {
      try {
        const octokit = new Octokit({ auth: token })
        const response = yield* Effect.promise(() =>
          octokit.rest.repos.listBranches({
            owner,
            repo,
            per_page: options?.per_page ?? 30,
            page: options?.page ?? 1,
          }),
        )
        return response.data.map(
          (branch) =>
            new GitHubBranch({
              name: branch.name,
              commit: {
                sha: branch.commit.sha,
                url: branch.commit.url,
              },
              isProtected: branch.protected,
            }),
        )
      } catch (error) {
        return yield* Effect.fail(
          mapError("Failed to list branches", "LIST_BRANCHES_FAILED")(error),
        )
      }
    })

    const getBranch = Effect.fn("GitHubClient.getBranch")(function* (
      token: string,
      owner: string,
      repo: string,
      branch: string,
    ) {
      try {
        const octokit = new Octokit({ auth: token })
        const response = yield* Effect.promise(() =>
          octokit.rest.repos.getBranch({
            owner,
            repo,
            branch,
          }),
        )
        return new GitHubBranch({
          name: response.data.name,
          commit: {
            sha: response.data.commit.sha,
            url: response.data.commit.url,
          },
          isProtected: response.data.protected,
        })
      } catch (error) {
        return yield* Effect.fail(mapError("Failed to get branch", "GET_BRANCH_FAILED")(error))
      }
    })

    return Service.of({
      getUser,
      listRepositories,
      searchRepositories,
      listBranches,
      getBranch,
    })
  }),
)

export const node = Layer.succeed(Service, Service.of({} as Interface))
export * as GitHubClient from "."
