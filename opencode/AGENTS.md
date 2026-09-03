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
- Python 3.11 a été ajouté à l’environnement Replit, car une dépendance native
  `tree-sitter-powershell` en a besoin pour `node-gyp`.
- Les liens de dépendances Bun du monorepo ont été reconstruits avec
  `bun install --force --filter opencode --offline`.
- Les credentials GitHub/GitLab doivent rester gérés par une intégration Replit
  connectée au moment de l’exécution et ne doivent jamais être copiés dans le
  frontend ou les logs.
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
  - téléchargement d’un snapshot de fichiers via `ReplitConnectors.proxy` côté serveur ;
  - écriture dans `.opencode/remote-workspaces/<workspace-id>` ;
  - initialisation Git locale sur la branche sélectionnée ;
  - ajout d’un remote HTTPS sans jamais copier de credential dans l’URL.
- Une création distante incomplète supprime maintenant le dossier partiel et la
  ligne de workspace persistée ; l’adapter supprime aussi les fichiers si le
  téléchargement, l’écriture ou Git échoue.
- La soumission d’une nouvelle session appelle cet adapter lorsqu’un dépôt
  distant est sélectionné, puis cible le dossier cloné avec le SDK OpenCode
  existant. Le chemin local `main`/`create` conserve son comportement
  précédent.
- L’adapter GitHub est couvert par
  `packages/opencode/test/control-plane/remote-github-adapter.test.ts` :
  configuration d’un workspace isolé, création réelle avec snapshot simulé,
  branche, remote, commit initial, nettoyage d’erreur et rejet de chemins
  dangereux.
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
- Les tests workspace et adapter passent après la reconstruction des
  dépendances. `bun run typecheck` est actuellement tué par la limite mémoire
  de l’environnement (`tsgo` reçoit `SIGKILL`, et `tsc` termine en OOM) avant
  d’émettre un diagnostic.
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

1. Relier les opérations Git distantes (fetch, commit, push), les pipelines et
   les logs CI/CD à l’interface existante.
2. Ajouter GitLab avec le même contrat lorsque le connecteur GitLab sera
   connecté.
3. Vérifier les parcours mobile/Android sans créer une seconde application.

Le workspace distant GitHub est maintenant vérifié par des tests ciblés ; ne pas
commencer GitLab ou Android avant d’avoir traité la limite de typecheck et la
prochaine tranche Git/CI.

### Synthèse complète de l’état actuel

#### Déjà réalisé

- Le dépôt OpenCode officiel est adapté directement en Sory Code, sans
  deuxième application, deuxième chat ou nouvel Agent.
- Une couche serveur Git distant existe pour GitHub :
  identité, dépôts, branches et pipelines.
- Le frontend permet de sélectionner un dépôt GitHub puis une branche depuis le
  parcours existant de nouvelle session.
- Le control plane possède un adapter `remote-github`.
- Le dépôt sélectionné est téléchargé côté serveur sous forme de snapshot de
  fichiers, puis écrit dans un workspace isolé :
  `.opencode/remote-workspaces/<workspace-id>`.
- Git est initialisé sur la branche choisie, avec un remote `origin` sans
  credential dans l’URL et un commit initial.
- La session OpenCode existante est ouverte sur ce workspace. Le chat, les
  tools, le terminal, l’éditeur et les sessions restent ceux d’OpenCode.
- Les créations incomplètes sont nettoyées : dossier partiel et ligne persistée
  en base sont supprimés si le téléchargement, l’écriture ou Git échoue.
- Les chemins dangereux qui sortent du workspace sont refusés.
- Les tests ciblés couvrent la configuration, la création, la branche, le
  remote, le commit initial et les nettoyages d’erreur.

#### Ce qui manque

- Rétablir un typecheck complet exploitable. `tsgo` est actuellement tué par
  `SIGKILL` et `tsc` dépasse la mémoire disponible avant d’émettre un
  diagnostic.
- Ajouter les opérations Git utilisateur dans le workspace : `fetch`,
  changement/création de branche, `commit` et `push`.
- Ajouter les Pull Requests GitHub et les Merge Requests GitLab avec des
  permissions explicites et auditables.
- Relier les opérations Git à l’interface de session existante.
- Afficher les pipelines CI/CD, leurs états et leurs logs dans l’interface.
- Lire et exploiter les workflows `.github/workflows` et `.gitlab-ci.yml`.
- Connecter GitLab uniquement lorsqu’une intégration GitLab réelle sera
  disponible.
- Ajouter l’expiration, les statuts persistants, les limites de ressources et le
  nettoyage périodique des workspaces abandonnés.
- Corriger les tests frontend SolidJS qui ne démarrent pas actuellement à
  cause de `solid-js/web/dist/server.js` et de l’export `use`.
- Vérifier le parcours complet dépôt → branche → workspace → session → chat →
  fichier → terminal → diff.
- Vérifier le support mobile/Android. Aucune application Expo/React Native
  identifiable n’est actuellement présente dans le dépôt.

#### Position actuelle

Le projet est à la fin de la première tranche fonctionnelle GitHub :

```text
sélection du dépôt
  → sélection de la branche
  → workspace isolé
  → snapshot des fichiers
  → initialisation Git
  → session OpenCode existante
```

Ce n’est pas encore une version Sory Code complète prête pour la production.
La prochaine implémentation recommandée est le cycle :

```text
status → commit → push
```

dans le workspace distant, en réutilisant les services Git et les panneaux
existants d’OpenCode. Les pipelines CI/CD et GitLab viendront ensuite.

### Journal de reprise par étapes

#### Étape 1 — Préparer le cycle Git du workspace

**Objectif avant implémentation :** permettre au serveur OpenCode de lire l’état
du dépôt, créer un commit et pousser la branche courante depuis le workspace
distant, sans exposer de credential.

**Périmètre prévu :**

- réutiliser le service Git/VCS existant ;
- ajouter uniquement les contrats serveur nécessaires ;
- conserver les contrôles de workspace et de permissions ;
- ajouter des tests pour dépôt propre, modifications, absence de remote et
  erreur de push ;
- ne pas encore ajouter Pull Request, pipeline ou GitLab.

**Critères de fin :**

- les opérations s’exécutent dans le workspace sélectionné, jamais dans le
  dépôt parent ;
- les credentials restent gérés par Git/connecteur côté serveur ;
- les erreurs sont retournées explicitement ;
- les tests ciblés passent ;
- le résultat et la prochaine étape sont ajoutés ici avant de poursuivre.

#### Étape 1A — Contrats et opérations Git serveur

**Objectif avant implémentation :** ajouter `commit` et `push` au service VCS et
à l’API d’instance en réutilisant `Git.run` et l’autorisation HTTP existante.

**Périmètre prévu :**

- valider le message de commit côté API ;
- refuser un projet non Git ou un workspace sans remote ;
- ne jamais transmettre de credential dans l’URL ni dans les logs ;
- retourner des erreurs explicites pour absence de changements et échec Git ;
- tester les opérations sur un dépôt temporaire et un remote local contrôlé ;
- ne pas ajouter encore Pull Request, pipeline ou GitLab.

**Critères de fin :**

- `commit` ne touche que le répertoire de l’instance courante ;
- `push` utilise le remote Git configuré par le workspace ;
- l’API expose des schémas typés pour succès et erreurs ;
- les tests du service VCS et de l’API passent ;
- cette section est mise à jour avant de commencer l’intégration frontend.

#### Étape 1A.1 — Validation du cycle Git serveur

**Objectif avant implémentation :** prouver le comportement de `commit` et
`push` sur des dépôts temporaires, sans réseau réel ni credential.

**Périmètre prévu :**

- créer un commit sur des fichiers ajoutés ou modifiés ;
- refuser un commit quand le dépôt est propre ;
- pousser vers un remote bare local ;
- refuser un push sans remote ;
- vérifier que le hash et la branche retournés sont propres et exploitables ;
- vérifier les routes HTTP correspondantes.

**Critères de fin :**

- les tests n’utilisent aucun secret ou service externe ;
- le remote utilisé par défaut est `origin` lorsqu’il existe ;
- les erreurs métier restent explicites et sans sortie Git sensible ;
- cette section est marquée terminée avant de documenter l’intégration frontend.

**Résultat :** terminée côté service VCS. Les tests couvrent commit, dépôt
propre, push vers un remote bare local, remote `origin` et absence de remote.
La validation HTTP est également terminée : les endpoints commit et push
répondent avec leurs contrats de succès et d’erreur.

#### Étape 1A.2 — Régénération des clients API

**Objectif avant implémentation :** mettre à jour les clients TypeScript après
l’ajout des routes publiques `vcs/commit` et `vcs/push`, sans éditer les sorties
générées à la main. La génération concerne le client générique et le SDK V2
utilisé par l’application.

**Périmètre prévu :**

- installer uniquement les dépendances Bun manquantes de `packages/client` et
  `packages/sdk/js` ;
- lancer `bun run generate` depuis `packages/client` ;
- lancer le pipeline officiel `bun run build` depuis `packages/sdk/js` ;
- vérifier que les types et méthodes client correspondent aux routes serveur ;
- ne pas modifier les contrats générés manuellement.

**Critères de fin :**

- la génération officielle termine sans erreur ;
- les changements générés sont limités aux nouveaux endpoints VCS ;
- les tests de contrat client restent cohérents ;
- le résultat est documenté avant l’intégration frontend.

**Résultat :** terminée. Les dépendances de `packages/client` ont été
reconstruites, `bun run generate` réussit et le test d’identité des contrats
client passe. Aucun fichier généré n’a été édité manuellement.

La génération V2 a ensuite nécessité les dépendances du package serveur :
`bun dev generate` ne démarre pas tant que le preload `@opentui/solid/preload`
n’est pas lié. La reconstruction ciblée a d’abord rencontré `node-gyp` absent
du PATH pendant l’installation native de `tree-sitter-powershell`; les liens Bun
ont finalement été reconstruits avec les scripts d’installation désactivés,
puis le pipeline officiel V2 a réussi. Les sorties générées contiennent les
contrats `vcs/commit` et `vcs/push`.

#### Étape 1B — Actions Git dans l’interface existante

**Objectif avant implémentation :** permettre à l’utilisateur de créer un
commit et de pousser la branche courante depuis les composants de session
existants, après consultation du statut Git.

**Périmètre prévu :**

- réutiliser le client SDK généré et les helpers d’API existants ;
- placer les actions dans le contexte Git/diff déjà visible, sans nouveau chat
  ni nouvelle application ;
- demander un message de commit avant l’action ;
- afficher les états chargement, succès, dépôt propre et erreur ;
- rafraîchir le statut et le diff après un commit ou un push ;
- conserver tous les textes visibles dans l’i18n ;
- ne pas encore ajouter Pull/Merge Request, pipeline ou GitLab.

**Critères de fin :**

- les actions utilisent l’identifiant du workspace courant ;
- le client envoie le vrai contrat généré ;
- le résultat de chaque mutation est visible sans rechargement manuel ;
- les erreurs serveur sont affichées sans credential ni sortie Git sensible ;
- le build et le typecheck frontend passent ; les tests serveur VCS/HTTP ciblés
  passent également ;
- cette section est mise à jour avant la prochaine étape Git/CI.

**Résultat :** terminée. Le panneau Review Git expose Commit et Push pour le
workspace courant. Commit ouvre un dialogue de message, les mutations utilisent
le SDK V2 généré, les boutons affichent leur état de chargement, les toasts
confirment les succès ou affichent les erreurs, et le diff est invalidé après
mutation. Le dépôt propre reste visible via l’état existant « No uncommitted
changes yet » et désactive Commit. Les textes ajoutés passent par l’i18n.

#### Étape 1C — Fetch et changement de branche

**Objectif avant implémentation :** permettre `fetch` du remote et
changement/création de branche dans le workspace distant, sans exposer de
credential et sans toucher à l’arbre de travail pour `fetch`.

**Périmètre prévu :**

- réutiliser `Git.run` et l’autorisation HTTP existante ;
- `fetch` vers `origin` (ou premier remote), sans modifier le working tree ;
- `branch` avec validation stricte du nom côté serveur (`..`, espaces et
  caractères refusés par Git rejetés avant tout appel shell) ;
- création via `checkout -b`, switch via `checkout`, jamais `-B`/`-f` ;
- mise à jour du cache de branche et publication `BranchUpdated` après switch ;
- régénérer les clients officiels, sans édition manuelle de `generated` ;
- exposer Fetch + Branch dans le panneau Review existant avec dialogue,
  toasts et i18n ;
- ne pas encore ajouter Pull Request, pipeline ou GitLab.

**Critères de fin :**

- les opérations s’exécutent dans le workspace sélectionné, jamais dans le
  dépôt parent ;
- les erreurs sont explicites et sans sortie Git sensible ;
- les tests VCS ciblés, les tests HTTP instance et l’app typecheck passent ;
- cette section est mise à jour avant la prochaine étape Git/CI.

**Résultat :** terminée côté serveur et interface. `Vcs.fetch` et
`Vcs.switchBranch` ajoutés avec schémas typés (`FetchResult`,
`BranchInput`, `BranchResult`), routes `POST /vcs/fetch` et
`POST /vcs/branch`, erreurs `VcsOperationError` étendues (`fetch`,
`branch`). Vérifié en direct sur serveur temporaire : fetch vers remote
local, création/switch de branche, rejet `../bad` en `400` sans fuite.
Clients V2 régénérés (`sdk.gen.ts`, `types.gen.ts` limités aux nouveaux
endpoints). Le panneau Review expose Fetch et Branch (dialogue nom +
case « Create new branch »), rafraîchit le diff après mutation. Tests :
`vcs.test.ts` 20 pass, HTTP instance/control-plane/global 15 pass, app
typecheck OK, unit app 723 pass / 1 fail (parité i18n déjà en échec avant
cette étape, dette de 1B : clés anglaises sans traductions).

#### Étape 2 — Statut lifecycle persisté des workspaces (plan-adoption §15-16)

**Objectif avant implémentation :** donner aux workspaces un état réel
persisté (`creating` → `running` / `error`), au lieu du seul statut de
connexion éphémère en mémoire. Première brique de la persistance
provider-par-projet : sans état durable, aucun retour automatique sur
l’environnement du projet n’est possible.

**Périmètre prévu :**

- ajouter la colonne `status` à la table `workspace` via le pipeline
  officiel (`bun run migration --name ...` depuis `packages/core`), sans
  migration écrite à la main ;
- `creating` à l’insertion, `running` après `adapter.create` réussi ;
- échec de création : comportement existant conservé (dossier partiel et
  ligne supprimés, couvert par les tests) ;
- `error` uniquement pour un workspace existant dont la cible ne se résout
  plus (remote injoignable, dossier local disparu) ;
- réconciliation au démarrage : une ligne restée `creating` après un crash
  repasse à `running`/`error` selon la cible réelle ;
- jamais d’état simulé : pas de `stopped` tant qu’aucun mécanisme d’arrêt
  n’existe, `destroyed` = ligne supprimée par `remove` ;
- exposer le statut dans `Workspace.Info` (`list`/`get`/`create`) ;
- régénérer le SDK V2 officiel, sans édition manuelle ;
- ne pas encore toucher l’UI (affichage statut + drawer mobile = prochaine
  unité) ni ajouter de provider.

**Critères de fin :**

- `bun run migration --check` ne signale aucun changement restant ;
- les tests workspace ciblent les transitions (`create` → `running`,
  dossier manquant → `error`) ;
- les tests existants mis à jour restent verts ;
- cette section est mise à jour avant l’unité suivante.

**Résultat :** terminée côté serveur. Migration
`20260903101812_workspace_status` générée officiellement (`status text
DEFAULT 'running' NOT NULL`, existants conservés en `running`),
`schema.gen.ts`/`migration.gen.ts`/`schema.json` régénérés, `--check`
propre. `Workspace.create` insère `creating` puis retourne `running`,
`startSync` persiste `error` si la cible échoue et réconcilie les lignes
abandonnées. `Workspace.Info` expose `status`, SDK V2 régénéré (diff
d’une ligne). Tests : `workspace.test.ts` 37 pass (helpers + attentes
mis à jour, 1 nouveau test `error`), `remote-github-adapter` 5 pass,
HTTP workspace/control-plane 10 pass, `core typecheck` OK. Prochaine
unité : affichage du statut + drawer Fichiers mobile, puis pointeur
provider-par-projet et `LocalProvider` aligné sur `worktree`.

#### Étape 3 — Drawer Fichiers mobile (plan-adoption §8-10)

**Objectif avant implémentation :** rendre l’explorateur réellement
accessible sous 768px, où le panneau latéral desktop est structurellement
exclu (`desktopFileTreeOpen`, `hidden md:flex`, onglet fichiers réservé
`isDesktop()`), sans toucher au desktop ni dupliquer l’arbre.

**Périmètre prévu :**

- bouton Fichiers mobile uniquement (`md:hidden`) dans l’en-tête de
  session, à côté du terminal ; desktop inchangé ;
- `Drawer` existant (`@corvu/drawer`, même pattern que `help-button`) avec
  le `FileTree` existant sur le vrai filesystem du workspace ;
- sélection = ouverture d’onglet réelle (`tabs().open` + `file.load` +
  `setActive`), fermeture du drawer après choix, état vide géré ;
- côté RTL : `side` miroir comme `help-button`, CSS logique uniquement,
  chemins déjà isolés par `FileTree` ;
- textes via i18n (`session.files.title`) ; pas de raccourci desktop sur
  le bouton mobile (l’action drawer n’est pas `fileTree.toggle`) ;
- pas de badge statut workspace : aucune liste de workspaces
  expérimentaux n’existe dans l’UI, ce sera l’unité « manager workspace ».

**Critères de fin :**

- aucun changement visuel ou comportemental sur desktop ;
- `app typecheck` OK, suite unit sans nouvelle défaillance ;
- cette section est mise à jour avant l’unité suivante.

**Résultat :** terminée côté code, vérifiée servie en local sur serveur
temporaire (plus de proxy prod : le bundle contient le drawer). Fichiers :
nouveau `pages/session/mobile-files-drawer.tsx`, prop optionnelle
`SessionHeader({ onOpenFiles })`, câblage dans `session.tsx`,
1 clé i18n. Pour voir le bouton en Preview : `OPENCODE_CHANNEL=dev
bun run build` dans `packages/app`, génération de
`packages/opencode/opencode-web-ui.gen.ts` (952 fichiers, non commité,
résolu via un `paths` ajouté au `tsconfig` de `packages/opencode`),
puis redémarrer `Start OpenCode`. Tests : app typecheck OK, unit
723 pass / 1 fail (parité i18n pré-existante). Prochaine unité :
pointeur provider-par-projet + `LocalProvider` aligné sur `worktree`,
puis badge statut dans le futur manager workspace.

#### Étape 4 — Connexion GitHub par token personnel (plan-adoption §18-19)

**Objectif avant implémentation :** permettre « Connect GitHub » depuis
le dialogue dépôt, sans Replit, sans OAuth App, sans token au frontend.
Le connecteur Replit reste un repli là où il est connecté.

**Périmètre prévu :**

- token saisi une fois dans l’UI, validé via `GET /user`, stocké dans
  `Auth` serveur (`auth.json`, clé `github`, type `api`) ; jamais
  retourné, loggé ou exposé ;
- transport GitHub : token stocké d’abord (`Bearer`), connecteur Replit
  sinon, erreur explicite sinon ; snapshot et appels API suivent la même
  règle (adapter lit le token via `OPENCODE_AUTH_CONTENT`) ;
- routes `GET /git/status` (toujours 200 : `connected/login/source` ou
  `disconnected`), `POST /git/connect` (`Identity`, 401 mappé en message
  clair), `POST /git/disconnect` ;
- UI : panneau Connect (lien `github.com/settings/tokens`, champ
  password, erreur lisible, Retry via rechargement) visible quand la
  liste échoue sans connexion ; bandeau « Connected as » + Disconnect ;
- textes ajoutés via i18n (`remoteGit.*`) ; dispositifs existants
  (listes, snapshot, nettoyage) inchangés ;
- régénérer SDK V2 officiel + rebuild app + régénérer l’UI embarquée
  locale pour le Preview ;
- pas encore de Device Flow (amélioration possible sans réécriture).

**Critères de fin :**

- aucun appel réseau réel dans les tests (fetch confiné, Auth mémoire) ;
- vérification HTTP en direct sur serveur temporaire (statut, refus
  vide, 401 mappé) ;
- suite ciblée verte des deux côtés, typecheck app OK ;
- cette section est mise à jour avant l’unité suivante.

**Résultat :** terminée côté code. `git/remote.ts` : `tokenFromEnv`,
`directFetch`/`connectorFetch`, `githubJson(token)`, service
`status/connect/disconnect` adossé à `Auth` (`deps: [Auth.node]`).
Adapter `remote-github` transmet le token d’env au snapshot. UI :
panneau Connect + bandeau connecté dans `DialogSelectRemoteRepository`.
Tests : `remote-auth.test.ts` 9 pass (validation, stockage, Bearer,
statuts, disconnect), adapter+git 14 pass, HTTP global/control-plane
5 pass, app unit 723 pass / 1 fail (parité i18n pré-existante). SDK V2
régénéré (endpoints git uniquement en plus). App rebuildée + UI
embarquée régénérée (952 fichiers, non commitée). Reste à l’utilisateur :
redémarrer `Start OpenCode`, créer un token `repo` sur github.com, le
coller dans le dialogue.

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
