import { Schema } from "effect"
import { AccountID } from "@/account/schema"

// GitHub OAuth Credentials
export class GitHubOAuth extends Schema.Class<GitHubOAuth>("GitHubOAuth")({
  type: Schema.Literal("github-oauth"),
  accessToken: Schema.String,
  refreshToken: Schema.optional(Schema.String),
  refreshTokenExpiresAt: Schema.optional(Schema.Number),
  accountId: Schema.optional(Schema.String),
  login: Schema.optional(Schema.String),
  userId: Schema.optional(Schema.Number),
  expires: Schema.optional(Schema.Number),
}) {}

// GitHub Repository Information
export class GitHubRepository extends Schema.Class<GitHubRepository>("GitHubRepository")({
  id: Schema.Number,
  name: Schema.String,
  fullName: Schema.String,
  description: Schema.optional(Schema.String),
  url: Schema.String,
  htmlUrl: Schema.String,
  isPrivate: Schema.Boolean,
  owner: Schema.Struct({
    login: Schema.String,
    id: Schema.Number,
    type: Schema.String,
  }),
}) {}

// GitHub Branch Information
export class GitHubBranch extends Schema.Class<GitHubBranch>("GitHubBranch")({
  name: Schema.String,
  commit: Schema.Struct({
    sha: Schema.String,
    url: Schema.String,
  }),
  isProtected: Schema.Boolean,
}) {}

// GitHub User Information
export class GitHubUser extends Schema.Class<GitHubUser>("GitHubUser")({
  id: Schema.Number,
  login: Schema.String,
  name: Schema.optional(Schema.String),
  email: Schema.optional(Schema.String),
  avatarUrl: Schema.optional(Schema.String),
}) {}
