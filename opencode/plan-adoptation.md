SORY CODE — ADAPTATION DIRECTE D’OPENCODE

Tu travailles directement dans le dépôt officiel OpenCode déjà cloné dans ce workspace.

IMPORTANT :
- Sory Code est une adaptation directe d’OpenCode.
- Ne crée PAS une nouvelle application.
- Ne recrée PAS le Chat/Session.
- Ne recrée PAS l’Agent.
- Ne recrée PAS le Terminal.
- Ne remplace PAS l’architecture OpenCode.
- Réutilise les fonctionnalités existantes.
- Ne supprime aucune fonctionnalité existante.
- Ne crée aucun bouton fictif.
- Toute fonctionnalité affichée doit être réellement fonctionnelle.
- Inspecte d’abord le code avant de modifier quoi que ce soit.
- Fais des modifications progressives.
- Teste après chaque étape importante.
- Évite toute refactorisation massive inutile.

==================================================
1. ENVIRONNEMENT PAR PROJET
==================================================

L’environnement d’exécution est choisi PROJET PAR PROJET.

Chaque projet possède UN environnement d’exécution associé.

Tout ce qui concerne ce projet doit utiliser cet environnement :

- fichiers
- filesystem
- terminal
- commandes
- dépendances
- installations
- processus
- builds
- tests
- caches
- serveurs
- Preview
- Git
- workspace

Ne jamais mélanger les environnements.

Exemple :

Projet A → PC Local
Projet B → GitHub Codespaces
Projet C → Sandbox

Lorsque l’utilisateur revient sur un projet, son environnement doit être retrouvé automatiquement.

Il ne doit pas avoir à choisir à nouveau.

==================================================
2. DESKTOP — 3 ENVIRONNEMENTS
==================================================

Sur Desktop, l’utilisateur doit pouvoir choisir un seul environnement pour chaque projet :

1. PC LOCAL
2. GITHUB CODESPACES
3. SANDBOX

------------------------------------------
PC LOCAL
------------------------------------------

Le projet fonctionne sur le PC de l’utilisateur.

Réutilise le fonctionnement local actuel d’OpenCode.

Tout doit fonctionner localement :

- fichiers
- terminal existant
- dépendances
- processus
- builds
- tests
- Git
- Preview

Ne casse surtout pas le comportement local actuel.

------------------------------------------
GITHUB CODESPACES
------------------------------------------

Le projet fonctionne dans un GitHub Codespace.

Permettre, lorsque les API et permissions disponibles le permettent :

- sélectionner un repository
- sélectionner une branche
- créer un Codespace
- démarrer un Codespace
- arrêter un Codespace
- retrouver un Codespace existant
- reprendre un workspace existant
- exécuter des commandes
- lire des fichiers
- modifier des fichiers
- installer des dépendances
- lancer des processus
- effectuer des builds
- effectuer des tests
- utiliser Git
- obtenir le Preview

Le Codespace doit être associé au projet.

Ne crée pas inutilement un nouveau Codespace à chaque ouverture.

Les credentials GitHub doivent rester sécurisés.

Ne jamais mettre les tokens :
- dans le frontend
- dans les URLs
- dans les logs
- dans les fichiers du projet

Réutilise les intégrations GitHub déjà présentes dans le dépôt.

------------------------------------------
SANDBOX
------------------------------------------

Ajouter un environnement Sandbox cloud.

Créer une abstraction permettant de brancher un véritable fournisseur Sandbox.

Prévoir notamment la possibilité d’utiliser :

- E2B
- Vercel Sandbox

Ne couple pas toute l’application directement à un seul fournisseur.

Le Sandbox doit pouvoir :

- créer un environnement isolé
- charger le projet
- accéder aux fichiers
- exécuter des commandes
- installer des dépendances
- démarrer des processus
- arrêter des processus
- récupérer stdout
- récupérer stderr
- récupérer le code de sortie
- lancer des builds
- lancer des tests
- démarrer un serveur de développement
- fournir une URL/proxy Preview
- conserver l’environnement pendant sa durée de vie
- arrêter/détruire proprement le workspace

Ne simule aucune fonctionnalité.

Si le provider n’est pas encore configuré, créer proprement l’abstraction et retourner un état d’erreur réel plutôt qu’une fausse fonctionnalité.

==================================================
3. ANDROID / TÉLÉPHONE — 2 ENVIRONNEMENTS
==================================================

Sur Android, NE PAS proposer le PC Local.

L’utilisateur doit uniquement pouvoir choisir :

1. GitHub Codespaces
2. Sandbox

Donc :

DESKTOP :
- PC Local
- GitHub Codespaces
- Sandbox

ANDROID :
- GitHub Codespaces
- Sandbox

Un projet cloud doit pouvoir être ouvert depuis Desktop et Android.

Exemple :

Projet B
→ GitHub Codespaces

Desktop
→ ouvre Projet B
→ utilise le même Codespace

Android
→ ouvre Projet B
→ utilise le même Codespace

==================================================
4. WORKSPACE PROVIDER
==================================================

Créer une abstraction propre pour les environnements.

Architecture conceptuelle :

WorkspaceProvider
├── LocalProvider
├── GitHubCodespacesProvider
└── SandboxProvider

Le reste d’OpenCode ne doit pas contenir des conditions spécifiques GitHub/Sandbox partout.

Centraliser cette logique dans les providers.

L’Agent doit utiliser des opérations génériques adaptées aux abstractions existantes d’OpenCode, par exemple :

- execute(command)
- readFile(path)
- writeFile(path)
- listFiles(path)
- installDependencies()
- startProcess()
- stopProcess()
- getProcessStatus()
- getPreviewUrl()
- gitStatus()
- gitBranch()
- gitCommit()
- gitPush()

IMPORTANT :

Avant de créer ces interfaces, inspecte les abstractions déjà existantes dans OpenCode.

Si OpenCode possède déjà un système équivalent, réutilise-le plutôt que de créer un doublon.

==================================================
5. TERMINAL EXISTANT
==================================================

IMPORTANT :

LE TERMINAL EXISTE DÉJÀ DANS OPENCODE.

NE CRÉE PAS UN NOUVEAU TERMINAL.

NE RECRÉE PAS Acode Terminal.

NE REMPLACE PAS LE TERMINAL EXISTANT.

Réutilise le terminal actuel.

Il doit simplement exécuter les commandes dans l’environnement associé au projet.

Exemple :

Projet Local
→ Terminal OpenCode
→ PC Local

Projet GitHub
→ Terminal OpenCode
→ GitHub Codespace

Projet Sandbox
→ Terminal OpenCode
→ Sandbox

Le terminal doit afficher les vraies informations :

- stdout
- stderr
- exit code
- état du processus

Les commandes doivent être réellement exécutées.

==================================================
6. FILESYSTEM
==================================================

Le filesystem doit correspondre au workspace du projet.

Projet Local :
→ filesystem PC

Projet GitHub :
→ filesystem Codespace

Projet Sandbox :
→ filesystem Sandbox

L’Agent doit travailler sur les vrais fichiers du workspace.

Ne crée pas une copie fictive uniquement pour l’interface.

==================================================
7. PROBLÈME CRITIQUE : ANDROID
==================================================

Il existe actuellement un problème important sur téléphone.

L’interface semble fonctionner principalement comme une interface Desktop.

Sur Android, certains boutons et certaines fonctions importantes ne sont pas visibles.

IL FAUT CORRIGER CE PROBLÈME.

L’interface Android doit être réellement responsive et adaptée au tactile.

NE PAS simplement réduire l’interface Desktop.

==================================================
8. TOUS LES BOUTONS DOIVENT ÊTRE ACCESSIBLES SUR TÉLÉPHONE
==================================================

C’est une exigence obligatoire.

Sur Android, l’utilisateur doit pouvoir accéder aux fonctionnalités importantes déjà présentes dans OpenCode.

Vérifier notamment :

- Explorateur
- Fichiers
- Ouvrir fichier
- Modifier fichier
- Éditeur
- Terminal
- Git
- Diff
- Run
- Preview
- Paramètres
- toutes les autres actions existantes importantes

Le problème actuel est que certains boutons visibles ou utilisables sur PC ne sont pas visibles sur téléphone.

Corriger cela.

NE PAS simplement cacher les boutons avec CSS.

Si plusieurs boutons ne peuvent pas tenir sur un petit écran, les rendre accessibles avec :

- bottom navigation
- drawer
- sheet
- tabs
- toolbar responsive
- menu “...”
- menu “Plus”

selon les composants déjà disponibles dans OpenCode.

==================================================
9. EXPLORATEUR DE FICHIERS MOBILE
==================================================

Le bouton Explorateur doit être clairement visible et accessible sur Android.

Actuellement, l’explorateur ne sort pas correctement sur téléphone.

Corriger cela.

L’utilisateur doit pouvoir :

- ouvrir l’explorateur
- voir les dossiers
- voir les fichiers
- naviguer
- revenir en arrière
- ouvrir un fichier
- sélectionner un fichier
- afficher le fichier dans l’éditeur
- modifier le fichier
- sauvegarder le fichier

L’explorateur doit utiliser le filesystem réel du workspace.

==================================================
10. ÉDITION DES FICHIERS SUR MOBILE
==================================================

Sur Android, vérifier que l’utilisateur peut réellement :

- ouvrir un fichier
- afficher son contenu
- modifier son contenu
- sauvegarder
- revenir au projet
- voir le diff si disponible

Les boutons “Modifier”, “Ouvrir”, “Éditer”, etc. doivent être visibles ou accessibles.

Ils ne doivent pas disparaître uniquement parce que l’écran est petit.

==================================================
11. NAVIGATION MOBILE
==================================================

Créer une expérience réellement adaptée au téléphone.

Le téléphone est tactile.

L’interface doit fonctionner avec :

- écran étroit
- portrait
- paysage
- clavier Android
- gestes tactiles
- scrolling
- menus
- sheets
- panneaux

Ne pas faire une simple version miniature du Desktop.

Une navigation possible serait :

Chat | Fichiers | Terminal | Preview | Plus

Mais utilise d’abord les composants existants d’OpenCode.

==================================================
12. AUCUNE FONCTIONNALITÉ NE DOIT DISPARAÎTRE
==================================================

Si un bouton ne peut pas être affiché directement sur Android :

NE PAS supprimer sa fonctionnalité.

Le déplacer dans :

- menu
- drawer
- sheet
- menu Plus
- toolbar secondaire

Il doit toujours être accessible.

==================================================
13. PREVIEW
==================================================

Le Preview doit utiliser le même environnement que le projet.

Projet Local :

commande
→ serveur PC
→ Preview

Projet GitHub :

commande
→ serveur Codespace
→ port forwarding/proxy
→ Preview Sory Code

Projet Sandbox :

commande
→ serveur Sandbox
→ proxy sécurisé
→ Preview Sory Code

Sur Android, ne pas télécharger inutilement :

- node_modules
- target
- build
- caches
- gros fichiers générés

Le Preview doit être servi depuis l’environnement distant.

==================================================
14. GIT
==================================================

Les opérations Git doivent utiliser l’environnement du projet.

Réutiliser le système Git existant.

Rendre accessibles si déjà supportés ou les intégrer proprement :

- status
- branch
- switch
- fetch
- diff
- commit
- push

Les opérations dangereuses doivent demander confirmation :

- force push
- suppression massive
- opérations destructives
- manipulation de secrets

==================================================
15. PERSISTANCE DU WORKSPACE
==================================================

Le projet doit mémoriser son environnement.

Exemple :

Projet SoryOS
provider = github-codespaces
repository = sory-cosmic/sory-code
branch = dev
workspace = ...

Quand l’utilisateur revient :

Projet SoryOS
→ GitHub Codespaces
→ workspace existant

Ne pas recréer inutilement le workspace.

==================================================
16. ÉTATS DU WORKSPACE
==================================================

Prévoir des états réels :

- creating
- starting
- running
- stopped
- error
- destroyed

L’interface doit afficher l’état réel.

Ne jamais afficher “Running” si le workspace n’est pas réellement actif.

==================================================
17. CI/CD — PRÉPARATION
==================================================

L’architecture doit rester compatible avec :

.github/workflows/*.yml

.gitlab-ci.yml

À terme, Sory Code devra pouvoir :

- détecter les workflows
- afficher les pipelines
- afficher les statuts
- récupérer les logs
- permettre à l’Agent de diagnostiquer les erreurs

Ne crée aucune fausse CI/CD.

==================================================
18. GITHUB / GITLAB
==================================================

GitHub est prioritaire actuellement.

GitLab doit rester compatible avec l’architecture future.

Ne crée pas une intégration GitLab fictive si elle n’est pas réellement disponible.

Prévoir une architecture pouvant évoluer vers :

GitProvider
├── GitHub
└── GitLab

==================================================
19. SÉCURITÉ
==================================================

Ne jamais exposer :

- GitHub tokens
- GitLab tokens
- Sandbox API keys
- secrets

dans :

- frontend
- URLs
- logs
- fichiers du projet

Les credentials doivent rester du côté sécurisé approprié.

==================================================
20. TYPES DE PROJETS
==================================================

Le système doit pouvoir gérer les projets supportés par OpenCode, notamment :

- JavaScript
- TypeScript
- Node.js
- Bun
- Python
- Rust
- Go
- C
- C++
- Java
- React
- Next.js
- Vite
- etc.

Le provider doit fournir l’environnement approprié.

==================================================
21. PERFORMANCE
==================================================

Pour les environnements cloud :

Android ne doit pas compiler inutilement les gros projets.

Les éléments lourds doivent rester dans le workspace distant :

- node_modules
- target
- build
- caches
- dépendances
- processus
- artefacts

Le téléphone doit principalement être le client/interface.

==================================================
22. MÉTHODE DE TRAVAIL OBLIGATOIRE
==================================================

NE MODIFIE PAS TOUT LE DÉPÔT D’UN SEUL COUP.

ÉTAPE 1 — INSPECTION

Inspecte réellement :

- architecture du projet
- Workspace
- Session
- Agent
- Tools
- terminal
- filesystem
- explorateur
- éditeur
- Git
- Preview
- serveur
- routes API
- UI responsive
- interface mobile
- intégration GitHub

Ne suppose pas les noms des fichiers.

ÉTAPE 2 — ANALYSE MOBILE

Identifie précisément pourquoi :

- l’explorateur n’apparaît pas sur Android
- les boutons de fichiers ne sont pas visibles
- les boutons Modifier/Ouvrir ne sont pas visibles
- les autres actions importantes disparaissent

Corrige la cause réelle plutôt que de mettre uniquement des hacks CSS.

ÉTAPE 3 — PROVIDER

Identifier le meilleur endroit pour intégrer WorkspaceProvider.

ÉTAPE 4 — LOCAL

Connecter le provider Local au système existant sans modifier le comportement actuel.

ÉTAPE 5 — GITHUB CODESPACES

Ajouter le provider GitHub Codespaces en réutilisant les intégrations existantes.

ÉTAPE 6 — SANDBOX

Ajouter le provider Sandbox.

ÉTAPE 7 — PROJET

Associer un provider à chaque projet.

ÉTAPE 8 — TERMINAL

Connecter le terminal OpenCode existant au provider.

NE PAS créer de nouveau terminal.

ÉTAPE 9 — FILESYSTEM

Connecter fichiers/explorateur/éditeur au workspace.

ÉTAPE 10 — GIT

Connecter Git au workspace.

ÉTAPE 11 — PREVIEW

Connecter Preview au workspace.

ÉTAPE 12 — ANDROID

Corriger complètement l’interface mobile.

Priorité :

1. Explorateur visible
2. Fichiers visibles
3. Ouvrir fichier
4. Modifier fichier
5. Éditeur accessible
6. Terminal accessible
7. Git accessible
8. Diff accessible
9. Run accessible
10. Preview accessible
11. autres fonctionnalités accessibles via menus

ÉTAPE 13 — TESTS

Ajouter/corriger les tests nécessaires.

Tester :

- Local
- GitHub Codespaces
- Sandbox
- sélection de provider
- persistance du provider
- terminal
- filesystem
- explorateur
- éditeur
- Git
- Preview
- responsive Desktop
- responsive Android

ÉTAPE 14 — RÉGRESSIONS

Corriger immédiatement toute régression.

==================================================
23. RÈGLE ABSOLUE
==================================================

Sory Code reste OpenCode.

Nous ne créons PAS :

- un clone de Bolt
- un clone de Replit
- un clone d’Acode
- un nouveau Chat
- un nouvel Agent
- un nouveau Terminal
- un nouvel IDE indépendant

Nous adaptons OpenCode.

Architecture finale :

Sory Code
│
├── OpenCode Chat / Sessions
├── OpenCode Agent
├── OpenCode Tools
├── OpenCode Terminal EXISTANT
├── OpenCode Files
├── OpenCode Git
├── OpenCode Server
├── OpenCode Preview
│
└── WorkspaceProvider
    ├── Local
    ├── GitHub Codespaces
    └── Sandbox

DESKTOP :
- PC Local
- GitHub Codespaces
- Sandbox

ANDROID :
- GitHub Codespaces
- Sandbox

==================================================
24. PRIORITÉS ABSOLUES
==================================================

Priorité 1 :
NE PAS CASSER OPENCODE.

Priorité 2 :
Conserver toutes les fonctionnalités existantes.

Priorité 3 :
Associer un seul environnement à chaque projet.

Priorité 4 :
Faire fonctionner réellement cet environnement pour :

- fichiers
- terminal
- commandes
- dépendances
- processus
- builds
- tests
- Git
- Preview

Priorité 5 :
Corriger complètement l’interface Android.

Priorité 6 :
Faire apparaître et rendre accessibles les boutons importants sur téléphone.

Priorité 7 :
Ne jamais créer de fonctionnalité simulée.

==================================================
25. AVANT DE CODER
==================================================

NE COMMENCE PAS IMMÉDIATEMENT À MODIFIER LE CODE.

Commence par inspecter le dépôt.

Retourne d’abord :

1. architecture actuelle pertinente
2. fichiers concernés
3. fonctionnement actuel du Workspace
4. fonctionnement actuel du terminal
5. fonctionnement actuel de l’explorateur
6. fonctionnement actuel de l’éditeur
7. fonctionnement actuel du Preview
8. pourquoi les boutons ne sont pas visibles sur Android
9. système responsive actuel
10. intégrations GitHub déjà présentes
11. routes API déjà disponibles
12. meilleur point d’intégration de WorkspaceProvider
13. plan d’implémentation minimal et progressif

Ensuite seulement, commence l’implémentation.

Après chaque étape importante :

- lancer les tests pertinents
- vérifier TypeScript
- vérifier les régressions
- corriger les erreurs

À la fin, fournir :

Fichiers modifiés :
...

Fonctionnalités ajoutées :
...

Problèmes Android corrigés :
...

Tests exécutés :
...

Résultats :
...

Problèmes restants :
...

PRINCIPE DIRECTEUR :

Adapter OpenCode progressivement sans casser son architecture, avec un environnement unique par projet, trois choix sur Desktop (Local / GitHub Codespaces / Sandbox), deux choix sur Android (GitHub Codespaces / Sandbox), et une interface mobile où toutes les fonctionnalités importantes restent réellement accessibles.