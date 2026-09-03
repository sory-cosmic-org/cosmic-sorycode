import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260903133643_workspace_codespace_binding",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`workspace_secret\` (
          \`workspace_id\` text NOT NULL,
          \`key\` text NOT NULL,
          \`value\` text NOT NULL,
          CONSTRAINT \`workspace_secret_pk\` PRIMARY KEY(\`workspace_id\`, \`key\`),
          CONSTRAINT \`fk_workspace_secret_workspace_id_workspace_id_fk\` FOREIGN KEY (\`workspace_id\`) REFERENCES \`workspace\`(\`id\`) ON DELETE CASCADE
        );
      `)
      yield* tx.run(`ALTER TABLE \`workspace\` ADD \`codespace_name\` text;`)
    })
  },
} satisfies DatabaseMigration.Migration
