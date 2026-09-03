import { Context, Effect, Layer, Schema, Config as EffectConfig } from "effect"
import { ConfigService } from "@/effect/config-service"

export class GitHubConfig extends ConfigService.Service<GitHubConfig>()(
  "@opencode/GitHubConfig",
  {
    clientId: EffectConfig.string("GITHUB_OAUTH_CLIENT_ID").pipe(EffectConfig.option),
    clientSecret: EffectConfig.string("GITHUB_OAUTH_CLIENT_SECRET").pipe(EffectConfig.option),
    redirectUri: EffectConfig.string("GITHUB_OAUTH_REDIRECT_URI").pipe(
      EffectConfig.withDefault("http://localhost:4096/api/github/callback"),
    ),
    enabled: EffectConfig.string("GITHUB_OAUTH_ENABLED")
      .pipe(EffectConfig.withDefault("false"))
      .pipe(EffectConfig.map((val) => val === "true")),
  },
) {}

export type Info = Context.Service.Shape<typeof GitHubConfig>

export function isConfigured(config: Info): boolean {
  return config.enabled && config.clientId.isSome() && config.clientSecret.isSome()
}

export const layer = Layer.succeed(GitHubConfig, new GitHubConfig({}))

export * as GitHubConfigService from "."
