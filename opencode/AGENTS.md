# Guide d’utilisation du dépôt OpenCode

Ce dossier est la racine du projet OpenCode. Toutes les commandes ci-dessous
doivent être exécutées depuis ce dossier, sauf indication contraire.

## Travailler depuis Replit

### Ouvrir et modifier le projet

1. Ouvrir le workspace Replit qui contient le dossier `opencode`.
2. Ouvrir le Shell ou l’éditeur de fichiers.
3. Se placer dans le dépôt :

```bash
cd opencode
```

Modifier uniquement les fichiers nécessaires dans `opencode/`. Les changements
faits dans l’éditeur sont enregistrés directement dans le projet Replit.

## État d’avancement Sory Code

Cette section sert de point de reprise lorsque le quota ou une interruption
oblige à arrêter le travail. Elle décrit uniquement l’état de l’adaptation
Sory Code en cours.

### Ce qui a été fait

- Le dépôt OpenCode officiel est utilisé directement, sans créer de projet ou
  de chat parallèle.
- Le plan d’adaptation est enregistré dans `PLAN-SORY-CODE.md`.
- Le workflow Replit `Start OpenCode` a été configuré pour lancer le serveur
  depuis le dossier `opencode` sur `0.0.0.0:5000`.
- Python 3.11 a été ajouté à l’environnement Replit, car une dépendance native
  `tree-sitter-powershell` en a besoin pour `node-gyp`.
- Les liens de dépendances Bun du monorepo ont été reconstruits avec
  `bun install --force --filter opencode --offline`.
- L’intégration GitHub Replit est connectée. Les credentials doivent rester
  gérés par Replit et ne doivent jamais être copiés dans le frontend ou les
  logs.
- Une première API serveur Git distant a été ajoutée pour préparer la sélection
  d’identité, de dépôts, de branches et de pipelines GitHub :
  - `packages/opencode/src/git/remote.ts`
  - `packages/opencode/src/server/routes/instance/httpapi/groups/git.ts`
  - `packages/opencode/src/server/routes/instance/httpapi/handlers/git.ts`
- Les routes Git ont été enregistrées dans `api.ts` et `server.ts`.
- `@replit/connectors-sdk` a été ajouté aux dépendances de
  `packages/opencode`. La version réellement disponible dans le registre est
  `0.4.3`; la fiche d’intégration affichait une version non publiée
  `21.1.1`.
- Les routes serveur validées sont :
  - `GET /git/identity`
  - `GET /git/repositories`
  - `GET /git/repositories/:owner/:repository/branches`
  - `GET /git/repositories/:owner/:repository/pipelines`
- L’API GitHub a été vérifiée avec la connexion Replit active : l’identité
  GitHub, le dépôt `sory-cosmic/sory-code`, sa branche `main` et l’absence
  actuelle de pipeline sont retournés correctement.
- Les requêtes `provider=gitlab` sont rejetées explicitement en `502` tant que
  l’intégration GitLab n’est pas connectée ; elles ne sont pas routées vers
  GitHub par défaut.
- Le type d’adapter `remote-github` est maintenant intégré au cycle natif
  `Workspace.create` :
  - téléchargement de l’archive via `ReplitConnectors.proxy` côté serveur ;
  - extraction dans `.opencode/remote-workspaces/<workspace-id>` ;
  - initialisation Git locale sur la branche sélectionnée ;
  - ajout d’un remote HTTPS sans jamais copier de credential dans l’URL.
- La soumission d’une nouvelle session appelle cet adapter lorsqu’un dépôt
  distant est sélectionné, puis cible le dossier cloné avec le SDK OpenCode
  existant. Le chemin local `main`/`create` conserve son comportement
  précédent.
- L’adapter GitHub est couvert par
  `packages/opencode/test/control-plane/remote-github-adapter.test.ts` :
  configuration d’un workspace isolé, conservation du dépôt/branche, cible
  locale et rejet d’une configuration GitLab.
- L’interface de nouvelle session réutilise maintenant le chat existant avec
  une sélection GitHub dépôt → branche :
  - `packages/app/src/components/dialog-select-remote-repository.tsx`
  - `packages/app/src/utils/remote-git.ts`
  - `packages/app/src/pages/new-session/new-session-view.tsx`
  - `packages/app/src/pages/new-session/new-session-workspace-controller.ts`

### Vérifications déjà réussies

- Le Preview Replit a affiché l’interface OpenCode existante.
- Le serveur a démarré correctement après reconstruction des dépendances.
- Le workflow doit être redémarré après toute modification serveur.
- `bun run typecheck` passe dans `packages/opencode`.
- `bun run --cwd packages/app typecheck` passe.
- Les tests HTTP ciblés `httpapi-global.test.ts` et
  `httpapi-control-plane.test.ts` passent.
- La suite ciblée serveur combinant l’adapter et les routes passe :
  `7 pass, 0 fail`.
- Le test frontend de soumission et celui du contrôleur ne démarrent pas dans
  l’environnement Bun actuel à cause de l’erreur de module
  `solid-js/web/dist/server.js` (`Export named 'use' not found`). Ce problème
  intervient avant les assertions ; il reste à traiter séparément dans la
  configuration de test SolidJS.

### Reprise exacte du travail

1. Ajouter les tests spécifiques de l’adapter `remote-github`, avec un
   téléchargement GitHub simulé et des vérifications de chemin/remote.
2. Vérifier le parcours complet de création avec un dépôt de test, puis
   améliorer le nettoyage des workspaces distants abandonnés.
3. Relier les opérations Git distantes (fetch, commit, push), les pipelines et
   les logs CI/CD à l’interface existante.
4. Ajouter GitLab avec le même contrat lorsque le connecteur GitLab sera
   connecté.
5. Vérifier les parcours mobile/Android sans créer une seconde application.

Ne pas commencer le workspace distant, GitLab ou Android avant que cette
première tranche GitHub soit typée et vérifiée.

### Installer les dépendances

À la première utilisation, ou après une mise à jour du dépôt :

```bash
bun install
```

Si les dépendances ont été copiées ou déplacées et qu’un module manque,
reconstruire les liens Bun :

```bash
bun install --force --filter '@opencode-ai/app' --offline
```

### Lancer l’interface web dans Replit

Le workflow Replit `Start OpenCode` doit lancer :

```bash
bun run --cwd packages/opencode --conditions=browser src/index.ts web \
  --hostname 0.0.0.0 --port 5000 --print-logs
```

Après le lancement, utiliser le bouton **Preview** de Replit. Pour accéder à
l’interface depuis un téléphone, ouvrir l’URL de Preview Replit, et non
`localhost:5000` : `localhost` depuis le téléphone désigne le téléphone
lui-même.

Après une modification du serveur ou du code chargé au démarrage, redémarrer
le workflow `Start OpenCode`. Vérifier les logs si le Preview affiche une
erreur ou une page vide.

### Vérifier et enregistrer les changements

```bash
git status
git diff
git switch -c nom-court-de-branche
git add .
git commit -m "type(scope): description courte"
```

Le dépôt utilise la branche `dev` comme branche par défaut. Ne pas supprimer
ou remplacer les configurations du workspace Replit sans vérifier leur impact
sur le workflow et le Preview.

## Travailler depuis un PC avec VS Code

### Préparer le dépôt

Installer Git et Bun, puis cloner le dépôt dans un terminal local :

```bash
git clone https://github.com/anomalyco/opencode.git
cd opencode
git switch dev
bun install
code .
```

Si le dépôt est déjà présent :

```bash
cd chemin/vers/opencode
git switch dev
git pull --ff-only origin dev
bun install
code .
```

### Lancer l’interface web en local

Pour lancer l’interface complète OpenCode :

```bash
bun run --cwd packages/opencode --conditions=browser src/index.ts web \
  --hostname 127.0.0.1 --port 4096
```

Ouvrir ensuite `http://localhost:4096` dans le navigateur du PC. Cette
adresse est correcte sur la machine locale ; elle ne doit pas être utilisée
depuis un autre appareil.

Pour développer uniquement l’interface Vite avec rechargement automatique :

```bash
bun run dev:web
```

L’interface Vite écoute par défaut sur le port `3000`. Le serveur OpenCode
complet (`web`) reste recommandé pour vérifier le comportement réel de
l’application.

### Modifier et tester avec VS Code

- Ouvrir les fichiers dans l’explorateur VS Code et enregistrer normalement.
- Utiliser le terminal intégré pour les commandes Bun et Git.
- Créer une branche avant une modification importante :

```bash
git switch -c nom-court-de-branche
```

- Vérifier les types depuis le package concerné, jamais avec `tsc` directement :

```bash
cd packages/opencode
bun run typecheck
```

- Exécuter les tests depuis le package concerné, pas depuis la racine :

```bash
cd packages/opencode
bun test
```

### Synchroniser Replit et le PC

Les deux environnements doivent travailler sur le même dépôt Git. Après un
commit local, envoyer une branche vers le dépôt distant :

```bash
git push -u origin nom-court-de-branche
```

Dans Replit, récupérer cette branche avant de modifier les fichiers :

```bash
cd opencode
git fetch origin
git switch nom-court-de-branche
git pull --ff-only
bun install
```

Avant de passer de Replit au PC, enregistrer et commit les changements. Avant
de travailler sur Replit après un travail local, faire d’abord `git pull
--ff-only` pour éviter d’écraser des modifications. Ne pas modifier le même
fichier dans les deux environnements sans synchroniser les commits.

## Commandes rapides

| Besoin | Replit | PC local |
| --- | --- | --- |
| Racine du dépôt | `cd opencode` | `cd chemin/vers/opencode` |
| Installer | `bun install` | `bun install` |
| Interface complète | `web --hostname 0.0.0.0 --port 5000` | `web --hostname 127.0.0.1 --port 4096` |
| Voir l’interface | Bouton **Preview** | `http://localhost:4096` |
| Frontend Vite | `bun run dev:web` si nécessaire | `bun run dev:web` |

- To regenerate the legacy JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- After changing the public Protocol or Server `HttpApi`, run `bun run generate` from `packages/client`. Do not edit `src/generated` or `src/generated-effect` directly.
- Keep runtime dependencies directed from Schema to Core and Protocol, then from Core and Protocol to Server. Client runtime code may depend on Schema and Protocol but never Core or Server; `sdk-next` composes Client, Core, and Server.
- The default branch in this repo is `dev`.
- Local `main` ref may not exist; use `dev` or `origin/dev` for diffs.

## Branch Names

Use a short branch name of at most three words, separated by hyphens. Do not use slashes or type prefixes such as `feat/` or `fix/`.

Examples: `session-recovery`, `fix-scroll-state`, `regenerate-sdk`.

## Commits and PR Titles

Use conventional commit-style messages and PR titles: `type(scope): summary`.

Valid types are `feat`, `fix`, `docs`, `chore`, `refactor`, and `test`. Scopes are optional; use the affected package or area when helpful, e.g. `core`, `opencode`, `tui`, `app`, `desktop`, `sdk`, or `plugin`.

Examples: `fix(tui): simplify thinking toggle styling`, `docs: update contributing guide`, `chore(sdk): regenerate types`.

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Do not extract single-use helpers preemptively. Inline the logic at the call site unless the helper is reused, hides a genuinely complex boundary, or has a clear independent name that improves the caller.
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream
- In `src/config`, follow the existing self-export pattern at the top of the file (for example `export * as ConfigAgent from "./agent"`) when adding a new config module.
- In Effect generators, bind services to named variables before calling methods. Do not use nested service yields such as `yield* (yield* Foo.Service).bar()`.

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad
const journalPath = path.join(dir, "journal.json")
const journal = await Bun.file(journalPath).json()
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a
obj.b

// Bad
const { a, b } = obj
```

### Imports

- Never alias imports. Do not use `import { foo as bar } from "..."` or renamed imports like `resolve as pathResolve`.
- Never use star imports. Do not use `import * as Foo from "..."` or `import type * as Foo from "..."`.
- If a namespace-style value is needed, import the module's own exported namespace by name, for example `import { Project } from "@opencode-ai/core/project"`, then reference `Project.ID`.
- Prefer dynamic imports for heavy modules that are only needed in selected code paths, especially in startup-sensitive entrypoints. Destructure dynamic import bindings near the top of the narrowest scope that needs them so they read like normal imports. Avoid inline chains such as `await import("./module").then((mod) => mod.value())` or `(await import("./module")).value()`. Keep branch-specific imports inside the branch that needs them to preserve lazy loading.

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2

// Bad
let foo
if (condition) foo = 1
else foo = 2
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1
  return 2
}

// Bad
function foo() {
  if (condition) return 1
  else return 2
}
```

### Complex Logic

When a function has several validation branches or supporting details, make the main function read as the happy path and move supporting details into small helpers below it.

```ts
// Good
export function loadThing(input: unknown) {
  const config = requireConfig(input)
  const metadata = readMetadata(input)
  return createThing({ config, metadata })
}

function requireConfig(input: unknown) {
  ...
}
```

- Keep helpers close to the code they support, below the main export when that improves readability.
- Do not over-abstract simple expressions into many single-use helpers; extract only when it names a real concept like `requireConfig` or `readMetadata`.
- Do not return `Effect` from helpers unless they actually perform effectful work. Synchronous parsing, validation, and option building should stay synchronous.
- Prefer Effect schema helpers such as `Schema.UnknownFromJsonString` and `Schema.decodeUnknownOption` over manual `JSON.parse` wrapped in `Effect.try` when parsing untrusted JSON strings.
- Add comments for non-obvious constraints and surprising behavior, not for obvious assignments or control flow.

### Schema Definitions (Drizzle)

Use snake_case for field names so column names don't need to be redefined as strings.

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})

// Bad
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
})
```

## Testing

- Avoid mocks as much as possible, you shouldn't be using globalThis.\* at all unless it's the only option.
- Test actual implementation, do not duplicate logic into tests
- Tests cannot run from repo root (guard: `do-not-run-tests-from-root`); run from package dirs like `packages/opencode`.

## Type Checking

- Always run `bun typecheck` from package directories (e.g., `packages/opencode`), never `tsc` directly.

## V2 Session Core

- Keep durable prompt admission separate from model execution. `SessionV2.prompt(...)` admits one durable `session_input` row before scheduling advisory `SessionExecution.wake(sessionID)` unless `resume: false` requests admit-only behavior. The serialized runner promotes admitted inputs into visible user messages at safe boundaries.
- Reusing a Session ID adopts the existing Session. Reusing a prompt message ID reconciles an exact retry only when Session, prompt, and delivery mode match; conflicting reuse fails. Historical projected prompts lazily synthesize promoted inbox records during exact retry.
- Keep `SessionExecution` process-global and Session-ID based. Its local implementation owns the process-local Session coordinator and discovers placement through `SessionStore` plus `LocationServiceMap.get(session.location)` only when a drain starts; no layer should take a Session ID. V2 interruption targets the active process-local ownership chain for that Session; idle or missing interruption is a no-op.
- Keep `SessionRunner`, model resolution, tool registry, permissions, and filesystem Location-scoped. Omitted `Location.workspaceID` means implicit-local placement; explicit workspace identity remains reserved for future placement semantics.
- Preserve one explicit `llm.stream(request)` call per provider turn and reload projected history before durable continuation. Do not bridge through legacy `SessionPrompt.loop(...)` or delegate orchestration to an in-memory tool loop.
- Keep local Session drains process-local until clustering is implemented. `SessionRunCoordinator` joins explicit same-Session resumes, coalesces prompt wakeups, and allows different Sessions to run concurrently. Advisory wakes drain eligible durable inbox rows only; post-crash continuation recovery requires a separate explicit design before it may retry provider work. A drain has no durable identity or transcript boundary.
- Keep delivery vocabulary explicit. Prompts steer by default and promote at the next safe provider-turn boundary while the current drain requires continuation. An explicit `queue` input remains pending until the Session would otherwise become idle; promote one queued input at that boundary, then reevaluate continuation before promoting another. Promoting any new user input resets the selected agent's provider-turn allowance; a batch of steers resets it once.
- Keep EventV2 replay owner claims separate from clustered Session execution ownership.
- Keep the System Context algebra, registry, and built-ins in `src/system-context`; keep Context Source producers with their observed domains, and keep Session History selection plus Context Epoch persistence Session-owned.
