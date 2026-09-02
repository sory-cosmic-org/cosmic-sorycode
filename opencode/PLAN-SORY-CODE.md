# Plan de transformation OpenCode en Sory Code

## 1. But du projet

Adapter le dépôt officiel OpenCode existant pour créer Sory Code, sans créer
une deuxième application, un deuxième chat, un nouvel Agent ou une nouvelle
architecture parallèle.

Le chat, les sessions, les tools, le terminal, l'éditeur, Git, les providers,
le streaming et le serveur OpenCode restent les composants centraux.

Le changement principal est de permettre à l'utilisateur mobile de sélectionner
un dépôt GitHub ou GitLab, une branche, puis de travailler dans un workspace
distant isolé exécuté côté serveur.

## 2. État observé avant modification

- Le dépôt actif est le monorepo OpenCode officiel.
- `packages/app` contient l'interface web Solid/Vite existante.
- `packages/opencode` contient le serveur, les sessions, l'Agent, les tools,
  le terminal, les providers et la logique projet.
- `packages/core`, `packages/protocol`, `packages/client` et `packages/server`
  portent les couches partagées et les contrats API.
- La gestion actuelle des projets, répertoires et worktrees existe déjà dans
  `packages/opencode/src/project`, `src/worktree` et `src/control-plane`.
- L'interface possède déjà des sélecteurs de projet/workspace, un explorateur
  de fichiers, un terminal, les sessions, les diffs et les vues de contrôle.
- Le dépôt contient une intégration GitLab liée à l'authentification et des
  utilitaires de dépôt distant, mais le parcours Sory Code de sélection puis
  clonage d'un dépôt GitHub/GitLab reste à concevoir et à compléter.
- Aucun package Expo/React Native autonome, `app.json`, configuration Metro ou
  application Android Expo n'a été trouvé dans le monorepo actuel.
- `packages/desktop` est une application Electron avec des ressources Android
  et iOS, mais ce n'est pas une application Expo/React Native.
- Le dépôt utilise actuellement la branche `main` dans ce workspace, alors que
  les consignes du dépôt indiquent que `dev` est la branche par défaut. Ce point
  devra être vérifié avant toute synchronisation Git.

## 3. Principes non négociables

1. Modifier directement ce dépôt OpenCode.
2. Ne pas créer une application parallèle qui imite OpenCode.
3. Réutiliser le chat, les sessions, l'Agent, les tools, l'éditeur et le serveur
   existants.
4. Garder le téléphone comme interface et exécuter les commandes lourdes dans
   le workspace distant.
5. Isoler les workspaces par projet et par utilisateur/session selon le modèle
   déjà fourni par le control plane.
6. Ne jamais exposer de token GitHub/GitLab au client mobile ou dans les logs.
7. Utiliser des contrats typés partagés entre serveur et interface.
8. Livrer chaque étape avec des tests ciblés et une vérification de démarrage.

## 4. Architecture cible

```text
Application mobile / interface adaptée
          |
          v
API OpenCode existante
          |
          +--> GitProvider
          |      +--> GitHub
          |      +--> GitLab
          |
          +--> RemoteWorkspaceManager
          |      +--> création d'un workspace isolé
          |      +--> clonage dépôt + branche
          |      +--> cycle de vie et nettoyage
          |      +--> état build/test/CI
          |
          +--> Instance OpenCode par workspace
                 +--> fichiers
                 +--> terminal
                 +--> Agent
                 +--> tools
                 +--> sessions/chat
                 +--> Git/diff
```

## 5. Étapes d'implémentation

### Phase 0 — Baseline et contrats

- Vérifier la branche, l'état Git, les scripts Bun et le mode de lancement
  Replit/local.
- Identifier les routes API et les schémas déjà disponibles pour projets,
  workspaces, sessions, fichiers, terminal et Git.
- Définir les schémas partagés pour :
  - fournisseur Git ;
  - dépôt ;
  - branche ;
  - workspace distant ;
  - statut de clonage ;
  - statut de build/test/CI ;
  - erreurs d'autorisation et de synchronisation.
- Documenter les décisions qui concernent l'isolation, la persistance et le
  nettoyage.

Zones principales :

- `packages/opencode/src/control-plane`
- `packages/opencode/src/project`
- `packages/opencode/src/worktree`
- `packages/opencode/src/server/routes`
- `packages/schema`
- `packages/protocol`
- `packages/client`

### Phase 1 — Providers GitHub et GitLab

- Créer une abstraction `GitProvider` côté serveur.
- Implémenter les opérations GitHub :
  - connexion/authentification ;
  - liste des dépôts accessibles ;
  - recherche ;
  - branches ;
  - informations du dépôt.
- Implémenter les opérations GitLab avec le même contrat.
- Ajouter la pagination, la recherche bornée et la gestion d'erreurs.
- Préparer les flux OAuth via les mécanismes d'intégration/authentification
  appropriés, sans stocker les secrets dans le frontend.
- Ajouter les routes et schémas nécessaires dans le protocole public.

Zones principales à confirmer pendant l'implémentation :

- `packages/opencode/src/account`
- `packages/opencode/src/auth`
- `packages/opencode/src/util/repository.ts`
- `packages/opencode/src/server/routes`
- `packages/schema`
- `packages/protocol`
- `packages/client/src`

### Phase 2 — Remote Workspace

- Étendre le control plane existant au lieu de créer un second système de
  workspace.
- Ajouter un gestionnaire de workspace distant avec :
  - identifiant stable ;
  - répertoire isolé ;
  - projet/dépôt/branche associés ;
  - statut `creating`, `ready`, `error`, `stopped` ;
  - expiration et nettoyage ;
  - limites de ressources ;
  - journal d'opérations.
- Cloner le dépôt sélectionné dans le workspace distant.
- Vérifier la branche demandée avant de démarrer l'instance.
- Connecter l'instance OpenCode à ce répertoire afin que l'Agent utilise les
  tools, le terminal, le LSP et l'éditeur existants dans le bon contexte.
- Garantir que les chemins fournis par le client ne permettent pas de sortir
  des limites du workspace.

Zones principales :

- `packages/opencode/src/control-plane/workspace.ts`
- `packages/opencode/src/control-plane/workspace-adapter-runtime.ts`
- `packages/opencode/src/control-plane/workspace-context.ts`
- `packages/opencode/src/project/project.ts`
- `packages/opencode/src/project/instance-context.ts`
- `packages/opencode/src/worktree/index.ts`
- `packages/opencode/src/server/shared/workspace-routing.ts`
- stockage/schema du control plane dans `packages/core`

### Phase 3 — Parcours interface dépôt → workspace → session

- Ajouter au parcours existant un écran ou dialogue de sélection :
  1. fournisseur GitHub/GitLab ;
  2. dépôt ;
  3. branche ;
  4. création du workspace ;
  5. ouverture du projet.
- Réutiliser les composants de projet, workspace, session et prompt existants.
- Ne pas remplacer le chat.
- Afficher autour du chat :
  - projet et branche ;
  - état du workspace ;
  - fichiers ;
  - diff ;
  - terminal ;
  - logs ;
  - tests/build ;
  - état CI/CD.
- Adapter les vues aux petits écrans avec des panneaux/drawers existants avant
  d'introduire de nouveaux composants.

Zones principales :

- `packages/app/src/pages/home`
- `packages/app/src/pages/new-session`
- `packages/app/src/pages/session`
- `packages/app/src/components`
- `packages/app/src/context`
- `packages/session-ui`
- `packages/ui`

### Phase 4 — Git, CI/CD et pièces jointes

- Exposer les opérations Git nécessaires :
  - branche ;
  - commit ;
  - push ;
  - diff ;
  - Pull Request ;
  - Merge Request.
- Lire les fichiers `.github/workflows/*.yml` et `.gitlab-ci.yml` depuis le
  workspace distant.
- Ajouter la récupération des résultats de pipeline et leur affichage dans le
  contexte projet.
- Permettre à l'Agent d'utiliser les erreurs CI pour corriger le code via le
  chat et les tools existants.
- Garder les pièces jointes séparées du workspace projet :
  - images ;
  - caméra ;
  - captures ;
  - vidéos ;
  - fichiers.
- Relier les pièces jointes au prompt/session sans les copier dans le dépôt
  distant par défaut.

### Phase 5 — Support Android réel

- Vérifier d'abord si une application Expo/React Native a été ajoutée au dépôt
  entre-temps.
- Si elle existe, l'intégrer sans créer de deuxième application.
- Si elle n'existe toujours pas, documenter clairement la limite et proposer
  l'option minimale compatible avec l'architecture OpenCode, après validation
  des contraintes Expo/Replit.
- Vérifier précisément :
  - `package.json` ;
  - workspaces ;
  - version Expo/React Native ;
  - `app.json` ou `app.config` ;
  - Metro ;
  - scripts ;
  - dépendances ;
  - méthode de lancement Android.
- Distinguer l'URL de preview web Replit du fonctionnement d'une application
  native Android.

### Phase 6 — Validation et livraison

- Ajouter les tests unitaires des contrats et des règles de sécurité.
- Tester les providers avec des réponses contrôlées sans exposer de secrets.
- Tester le clonage, la branche, l'isolation, la reprise d'erreur et le
  nettoyage d'un workspace.
- Tester le parcours complet interface :
  dépôt → branche → workspace → session → chat → fichier/terminal/diff.
- Vérifier les cas d'échec :
  - dépôt inaccessible ;
  - branche absente ;
  - clonage interrompu ;
  - workspace expiré ;
  - pipeline en échec ;
  - permission insuffisante.
- Lancer les vérifications depuis les packages concernés, conformément à
  `AGENTS.md`, jamais les tests depuis la racine.
- Configurer un workflow Replit `Start OpenCode` avec l'hôte `0.0.0.0` et le
  port `5000`, puis vérifier le Preview et les logs.
- Vérifier le lancement local sur `127.0.0.1:4096`.

## 6. Critères d'acceptation

- L'utilisateur peut connecter GitHub ou GitLab sans exposer ses credentials.
- Il peut rechercher et sélectionner un dépôt ainsi qu'une branche.
- Le dépôt est cloné dans un workspace distant isolé.
- Une session OpenCode s'ouvre sur ce workspace.
- Le chat existant pilote le même Agent OpenCode.
- L'Agent peut lire, modifier, rechercher, exécuter, compiler et tester dans
  le workspace sélectionné.
- L'utilisateur peut voir fichiers, diff, terminal, logs, tests et état CI.
- Les opérations Git sont réalisées dans le workspace distant.
- L'interface reste utilisable sur mobile sans supprimer les composants utiles
  d'OpenCode.
- Le lancement Replit et le lancement local sont documentés et vérifiés.

## 7. Risques et décisions à traiter avant les phases sensibles

- Le dépôt actuel ne contient pas de client Expo/React Native identifiable.
- L'authentification GitHub/GitLab nécessite de choisir les intégrations et
  permissions disponibles dans l'environnement.
- Un workspace distant réellement isolé peut nécessiter un adaptateur
  d'exécution dédié ; il ne faut pas simuler cette isolation avec un simple
  chemin client.
- Les actions push/PR/MR doivent être explicitement autorisées et auditables.
- Les workspaces et leurs secrets doivent être supprimés selon une politique
  d'expiration claire.
- Les changements de configuration Replit doivent rester compatibles avec le
  dépôt et ne pas remplacer les conventions OpenCode.

## 8. Ordre de travail prévu

1. Baseline et contrats.
2. Providers GitHub/GitLab.
3. Remote Workspace et clonage.
4. Parcours interface et ouverture de session.
5. Git/CI/CD/pièces jointes.
6. Diagnostic et intégration Android/Expo.
7. Tests, workflow Replit, lancement local et documentation.
