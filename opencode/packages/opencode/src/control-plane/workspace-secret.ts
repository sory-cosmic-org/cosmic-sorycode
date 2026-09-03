import { WorkspaceSecretTable } from "@opencode-ai/core/control-plane/workspace.sql"
import { WorkspaceV2 } from "@opencode-ai/core/workspace"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { and, eq } from "drizzle-orm"
import { Context, Effect, Layer } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { makeRuntime } from "@/effect/run-service"

// Server-side only secrets, one row per (workspace, key). Values never flow
// into Workspace.Info or the frontend; they only leave the server inside
// proxied Authorization headers toward remote targets.
export const SERVER_PASSWORD_KEY = "server_password"

export interface Interface {
  readonly get: (workspaceID: WorkspaceV2.ID, key: string) => Effect.Effect<string | undefined, never, Database.Service>
  readonly has: (workspaceID: WorkspaceV2.ID, key: string) => Effect.Effect<boolean, never, Database.Service>
  readonly set: (workspaceID: WorkspaceV2.ID, key: string, value: string) => Effect.Effect<void, never, Database.Service>
  readonly remove: (workspaceID: WorkspaceV2.ID, key: string) => Effect.Effect<void, never, Database.Service>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/WorkspaceSecret") {}

const service: Interface = {
  get: Effect.fn("WorkspaceSecret.get")(function* (workspaceID, key) {
    const { db } = yield* Database.Service
    const row = yield* db
      .select()
      .from(WorkspaceSecretTable)
      .where(and(eq(WorkspaceSecretTable.workspace_id, workspaceID), eq(WorkspaceSecretTable.key, key)))
      .get()
    return row?.value
  }),
  has: Effect.fn("WorkspaceSecret.has")(function* (workspaceID, key) {
    return (yield* service.get(workspaceID, key)) !== undefined
  }),
  set: Effect.fn("WorkspaceSecret.set")(function* (workspaceID, key, value) {
    const { db } = yield* Database.Service
    yield* db
      .delete(WorkspaceSecretTable)
      .where(and(eq(WorkspaceSecretTable.workspace_id, workspaceID), eq(WorkspaceSecretTable.key, key)))
      .run()
    yield* db.insert(WorkspaceSecretTable).values({ workspace_id: workspaceID, key, value }).run()
  }),
  remove: Effect.fn("WorkspaceSecret.remove")(function* (workspaceID, key) {
    const { db } = yield* Database.Service
    yield* db
      .delete(WorkspaceSecretTable)
      .where(and(eq(WorkspaceSecretTable.workspace_id, workspaceID), eq(WorkspaceSecretTable.key, key)))
      .run()
  }),
}

const layer = Layer.effect(
  Service,
  Effect.map(Database.Service, () => Service.of(service)),
)

export const node = LayerNode.make({ service: Service, layer, deps: [Database.node] })

// Plain async access for non-Effect call sites (workspace adapters). Shares
// the process database through a memoized runtime; never logs values.
const { runPromise } = makeRuntime(Database.Service, AppNodeBuilder.build(Database.node))

export async function getAsync(workspaceID: WorkspaceV2.ID, key: string) {
  return runPromise((database) =>
    database.db
      .select()
      .from(WorkspaceSecretTable)
      .where(and(eq(WorkspaceSecretTable.workspace_id, workspaceID), eq(WorkspaceSecretTable.key, key)))
      .get()
      .pipe(Effect.orDie),
  ).then((row) => row?.value)
}

export async function setAsync(workspaceID: WorkspaceV2.ID, key: string, value: string) {
  return runPromise((database) =>
    Effect.gen(function* () {
      yield* database.db
        .delete(WorkspaceSecretTable)
        .where(and(eq(WorkspaceSecretTable.workspace_id, workspaceID), eq(WorkspaceSecretTable.key, key)))
        .run()
      yield* database.db.insert(WorkspaceSecretTable).values({ workspace_id: workspaceID, key, value }).run()
    }).pipe(Effect.orDie),
  )
}
