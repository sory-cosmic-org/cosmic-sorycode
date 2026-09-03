import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260903101812_workspace_status",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`ALTER TABLE \`workspace\` ADD \`status\` text DEFAULT 'running' NOT NULL;`)
    })
  },
} satisfies DatabaseMigration.Migration
