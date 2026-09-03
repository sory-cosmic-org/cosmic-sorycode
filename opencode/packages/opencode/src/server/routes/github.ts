import { Context, Effect, Layer, Schema, HttpApp, HttpRouter } from "effect/unstable/http"
import { GitHubClient } from "./github-client"
import { GitHubAuth } from "./github-auth"
import { GitHubConfig } from "./github-config"
import { ulid } from "ulid"

export interface GitHubRoutes {
  readonly router: HttpRouter.HttpRouter
}

export class Service extends Context.Service<Service, GitHubRoutes>()("@opencode/GitHubRoutes") {}

const createRoutes = () => {
  return HttpRouter.empty
    .pipe(
      // POST /api/github/auth/start - Initiate GitHub OAuth
      HttpRouter.post(
        "/github/auth/start",
        Effect.gen(function* () {
          const config = yield* GitHubConfig
          if (!config.clientId.isSome() || !config.clientSecret.isSome()) {
            return new Response(
              JSON.stringify({
                error: "GitHub OAuth not configured",
              }),
              { status: 503, headers: { "Content-Type": "application/json" } },
            )
          }

          const state = ulid()
          const githubAuth = yield* GitHubAuth.Service
          const authUrl = yield* githubAuth.getAuthUrl(state, {
            clientId: config.clientId.value,
            clientSecret: config.clientSecret.value,
            redirectUri: config.redirectUri,
          })

          return new Response(
            JSON.stringify({
              state,
              url: authUrl,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )
        }),
      ),
    )
    .pipe(
      // GET /api/github/auth/callback - Handle OAuth callback
      HttpRouter.get(
        "/github/auth/callback",
        Effect.gen(function* () {
          const request = yield* HttpApp.request
          const url = new URL(request.url)
          const code = url.searchParams.get("code")
          const state = url.searchParams.get("state")
          const error = url.searchParams.get("error")

          if (error) {
            return new Response(
              JSON.stringify({
                error: error,
                error_description: url.searchParams.get("error_description"),
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            )
          }

          if (!code) {
            return new Response(
              JSON.stringify({
                error: "Missing authorization code",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            )
          }

          const config = yield* GitHubConfig
          const githubAuth = yield* GitHubAuth.Service

          const oauth = yield* githubAuth.exchangeCodeForToken(code, {
            clientId: config.clientId.value!,
            clientSecret: config.clientSecret.value!,
            redirectUri: config.redirectUri,
          })

          return new Response(
            JSON.stringify({
              access_token: oauth.accessToken,
              state,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          )
        }),
      ),
    )
    .pipe(
      // GET /api/github/user - Get authenticated GitHub user
      HttpRouter.get(
        "/github/user",
        Effect.gen(function* () {
          const request = yield* HttpApp.request
          const token = request.headers.get("authorization")?.replace("Bearer ", "")

          if (!token) {
            return new Response(
              JSON.stringify({
                error: "Missing GitHub token",
              }),
              { status: 401, headers: { "Content-Type": "application/json" } },
            )
          }

          const githubClient = yield* GitHubClient.Service
          const user = yield* githubClient.getUser(token)

          return new Response(JSON.stringify(user), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        }),
      ),
    )
    .pipe(
      // GET /api/github/repositories - List GitHub repositories
      HttpRouter.get(
        "/github/repositories",
        Effect.gen(function* () {
          const request = yield* HttpApp.request
          const token = request.headers.get("authorization")?.replace("Bearer ", "")

          if (!token) {
            return new Response(
              JSON.stringify({
                error: "Missing GitHub token",
              }),
              { status: 401, headers: { "Content-Type": "application/json" } },
            )
          }

          const url = new URL(request.url)
          const page = parseInt(url.searchParams.get("page") ?? "1", 10)
          const perPage = Math.min(parseInt(url.searchParams.get("per_page") ?? "30", 10), 100)

          const githubClient = yield* GitHubClient.Service
          const repos = yield* githubClient.listRepositories(token, { page, per_page: perPage })

          return new Response(JSON.stringify(repos), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        }),
      ),
    )
    .pipe(
      // GET /api/github/repositories/:owner/:repo/branches - List branches
      HttpRouter.get(
        "/github/repositories/:owner/:repo/branches",
        Effect.gen(function* () {
          const request = yield* HttpApp.request
          const token = request.headers.get("authorization")?.replace("Bearer ", "")

          if (!token) {
            return new Response(
              JSON.stringify({
                error: "Missing GitHub token",
              }),
              { status: 401, headers: { "Content-Type": "application/json" } },
            )
          }

          const url = new URL(request.url)
          const owner = url.pathname.split("/")[4]
          const repo = url.pathname.split("/")[5]
          const page = parseInt(url.searchParams.get("page") ?? "1", 10)
          const perPage = Math.min(parseInt(url.searchParams.get("per_page") ?? "30", 10), 100)

          const githubClient = yield* GitHubClient.Service
          const branches = yield* githubClient.listBranches(token, owner, repo, {
            page,
            per_page: perPage,
          })

          return new Response(JSON.stringify(branches), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        }),
      ),
    )
}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const router = createRoutes()
    return { router } as GitHubRoutes
  }),
)

export const node = Layer.mergeAll(layer, GitHubClient.node, GitHubAuth.node, GitHubConfig.layer)

export * as GitHubRoutes from "."
