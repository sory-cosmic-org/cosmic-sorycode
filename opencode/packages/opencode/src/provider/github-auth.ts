import { Context, Effect, Layer, Schema, Option } from "effect"
import { Auth } from "@/auth"
import { GitHubOAuth } from "./github-schemas"

export class GitHubAuthError extends Schema.TaggedErrorClass<GitHubAuthError>()("GitHubAuthError", {
  message: Schema.String,
  code: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Defect()),
}) {}

export interface OAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export interface Interface {
  readonly storeToken: (
    accountId: string,
    oauth: GitHubOAuth,
  ) => Effect.Effect<void, GitHubAuthError>
  readonly getToken: (accountId: string) => Effect.Effect<Option.Option<GitHubOAuth>, GitHubAuthError>
  readonly removeToken: (accountId: string) => Effect.Effect<void, GitHubAuthError>
  readonly getAuthUrl: (state: string, config: OAuthConfig) => Effect.Effect<string, GitHubAuthError>
  readonly exchangeCodeForToken: (
    code: string,
    config: OAuthConfig,
  ) => Effect.Effect<GitHubOAuth, GitHubAuthError>
  readonly refreshToken: (
    oauth: GitHubOAuth,
    config: OAuthConfig,
  ) => Effect.Effect<GitHubOAuth, GitHubAuthError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/GitHubAuth") {}

const mapError = (message: string, code?: string) => (cause: unknown) =>
  new GitHubAuthError({ message, code, cause: cause instanceof Error ? cause : undefined })

const GITHUB_OAUTH_URL = "https://github.com/login/oauth"
const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const auth = yield* Auth.Service

    const storeToken = Effect.fn("GitHubAuth.storeToken")(function* (
      accountId: string,
      oauth: GitHubOAuth,
    ) {
      const key = `github/${accountId}`
      yield* auth.set(key, oauth).pipe(
        Effect.mapError(mapError("Failed to store GitHub token", "STORE_TOKEN_FAILED")),
      )
    })

    const getToken = Effect.fn("GitHubAuth.getToken")(function* (accountId: string) {
      const key = `github/${accountId}`
      const result = yield* auth.get(key).pipe(
        Effect.mapError(mapError("Failed to retrieve GitHub token", "GET_TOKEN_FAILED")),
      )
      if (result && result instanceof GitHubOAuth) {
        return Option.some(result)
      }
      return Option.none()
    })

    const removeToken = Effect.fn("GitHubAuth.removeToken")(function* (accountId: string) {
      const key = `github/${accountId}`
      yield* auth.remove(key).pipe(
        Effect.mapError(mapError("Failed to remove GitHub token", "REMOVE_TOKEN_FAILED")),
      )
    })

    const getAuthUrl = Effect.fn("GitHubAuth.getAuthUrl")((state: string, config: OAuthConfig) =>
      Effect.sync(() => {
        const url = new URL(GITHUB_AUTHORIZE_URL)
        url.searchParams.set("client_id", config.clientId)
        url.searchParams.set("redirect_uri", config.redirectUri)
        url.searchParams.set("scope", "repo,user,read:user")
        url.searchParams.set("state", state)
        url.searchParams.set("allow_signup", "true")
        return url.toString()
      }),
    )

    const exchangeCodeForToken = Effect.fn("GitHubAuth.exchangeCodeForToken")(function* (
      code: string,
      config: OAuthConfig,
    ) {
      try {
        const response = yield* Effect.promise(() =>
          fetch(GITHUB_TOKEN_URL, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              client_id: config.clientId,
              client_secret: config.clientSecret,
              code,
              redirect_uri: config.redirectUri,
            }),
          }),
        )

        if (!response.ok) {
          return yield* Effect.fail(
            mapError(`GitHub OAuth failed: ${response.statusText}`, "OAUTH_FAILED"),
          )
        }

        const data = yield* Effect.promise(() => response.json())

        if (data.error) {
          return yield* Effect.fail(mapError(`GitHub error: ${data.error_description}`, data.error))
        }

        return new GitHubOAuth({
          type: "github-oauth",
          accessToken: data.access_token,
          refreshToken: data.refresh_token ?? undefined,
          refreshTokenExpiresAt: data.refresh_token_expires_in
            ? Date.now() + data.refresh_token_expires_in * 1000
            : undefined,
          expires: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
        })
      } catch (error) {
        return yield* Effect.fail(
          mapError("Failed to exchange code for token", "EXCHANGE_FAILED")(error),
        )
      }
    })

    const refreshToken = Effect.fn("GitHubAuth.refreshToken")(function* (
      oauth: GitHubOAuth,
      config: OAuthConfig,
    ) {
      if (!oauth.refreshToken) {
        return yield* Effect.fail(
          mapError("No refresh token available", "NO_REFRESH_TOKEN"),
        )
      }

      try {
        const response = yield* Effect.promise(() =>
          fetch(GITHUB_TOKEN_URL, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              client_id: config.clientId,
              client_secret: config.clientSecret,
              grant_type: "refresh_token",
              refresh_token: oauth.refreshToken,
            }),
          }),
        )

        if (!response.ok) {
          return yield* Effect.fail(
            mapError(`GitHub refresh failed: ${response.statusText}`, "REFRESH_FAILED"),
          )
        }

        const data = yield* Effect.promise(() => response.json())

        if (data.error) {
          return yield* Effect.fail(mapError(`GitHub error: ${data.error_description}`, data.error))
        }

        return new GitHubOAuth({
          type: "github-oauth",
          accessToken: data.access_token,
          refreshToken: data.refresh_token ?? oauth.refreshToken,
          refreshTokenExpiresAt: data.refresh_token_expires_in
            ? Date.now() + data.refresh_token_expires_in * 1000
            : oauth.refreshTokenExpiresAt,
          expires: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
        })
      } catch (error) {
        return yield* Effect.fail(mapError("Failed to refresh token", "REFRESH_FAILED")(error))
      }
    })

    return Service.of({
      storeToken,
      getToken,
      removeToken,
      getAuthUrl,
      exchangeCodeForToken,
      refreshToken,
    })
  }),
)

export const node = Layer.provide(layer, Auth.node)

export * as GitHubAuth from "."
