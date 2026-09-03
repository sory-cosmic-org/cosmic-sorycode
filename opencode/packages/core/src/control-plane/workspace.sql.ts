import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core"
import { ProjectTable } from "../project/sql"
import { ProjectV2 } from "../project"
import { WorkspaceV2 } from "../workspace"

export const WorkspaceTable = sqliteTable("workspace", {
  id: text().$type<WorkspaceV2.ID>().primaryKey(),
  type: text().notNull(),
  name: text().notNull().default(""),
  branch: text(),
  directory: text(),
  extra: text({ mode: "json" }),
  project_id: text()
    .$type<ProjectV2.ID>()
    .notNull()
    .references(() => ProjectTable.id, { onDelete: "cascade" }),
  status: text().notNull().default("running"),
  // Bound GitHub Codespace name (e.g. "sory-code-a1b2c3"). Non-secret and
  // safe to surface; the remote server password lives in WorkspaceSecretTable.
  codespace_name: text(),
  time_used: integer()
    .notNull()
    .$default(() => Date.now()),
})

// Server-side only secrets per workspace (remote server passwords, future
// provider tokens). Never exposed through Workspace.Info or the frontend.
export const WorkspaceSecretTable = sqliteTable(
  "workspace_secret",
  {
    workspace_id: text()
      .$type<WorkspaceV2.ID>()
      .notNull()
      .references(() => WorkspaceTable.id, { onDelete: "cascade" }),
    key: text().notNull(),
    value: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.workspace_id, table.key] })],
)
