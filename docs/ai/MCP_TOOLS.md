# 🛠️ Référence des Outils MCP - ZQRadar

> **Guide technique** pour comprendre et utiliser efficacement tous les serveurs MCP disponibles.

---

## 📑 Table des Matières

1. [Serena (Code Symbolique)](#1-serena-code-symbolique)
2. [Knowledge Graph (AIM)](#2-knowledge-graph-aim)
3. [Git](#3-git)
4. [Augments (Frameworks)](#4-augments-frameworks)
5. [Sequential Thinking](#5-sequential-thinking)
6. [JetBrains IDE](#6-jetbrains-ide)

---

## 1. Serena (Code Symbolique)

**Pourquoi:** Analyse de code intelligent, lecture/édition symbolique  
**Quand:** Dès que vous travaillez avec du code JavaScript/TypeScript

### Configuration Initiale

```javascript
// TOUJOURS faire en premier
mcp_serena_activate_project({project: "C:\\Projets\\Albion-Online-ZQRadar"})

// Vérifier les memories disponibles
mcp_serena_list_memories()

// Lire les memories pertinentes
mcp_serena_read_memory({memory_file_name: "project_summary"})
mcp_serena_read_memory({memory_file_name: "style_and_conventions"})
```

### Exploration de Code

#### A. Aperçu d'un fichier

```javascript
// Obtenir la liste des symboles top-level (classes, fonctions, etc.)
mcp_serena_get_symbols_overview({
    relative_path: "scripts/classes/Player.js"
})

// Résultat: { symbols: [{ name, kind, location, children }] }
```

#### B. Recherche de symboles

```javascript
// Recherche exacte
mcp_serena_find_symbol({
    name_path: "Player",  // Nom de classe
    relative_path: "scripts/classes",  // Restreindre à un dossier
    include_body: false,  // false = aperçu seulement
    depth: 1  // 1 = inclure les méthodes de la classe
})

// Recherche par substring
mcp_serena_find_symbol({
    name_path: "parse",  // Trouve parseData, parsePacket, etc.
    substring_matching: true,
    include_body: false
})

// Lecture complète d'une méthode
mcp_serena_find_symbol({
    name_path: "Player/parseData",  // Notation: Classe/Méthode
    include_body: true  // Inclure le code complet
})
```

**Notation name_path:**

- `Player` → Classe Player (top-level)
- `Player/constructor` → Constructeur de Player
- `Player/parseData` → Méthode parseData de Player
- `/Player` → Absolu (seulement top-level Player)
- `parseData` → N'importe quel parseData (classe ou fonction)

#### C. Recherche de références

```javascript
// Trouver tous les endroits où Player est utilisé
mcp_serena_find_referencing_symbols({
    name_path: "Player",
    relative_path: "scripts/classes/Player.js",
    include_kinds: [5, 6, 12],  // 5=class, 6=method, 12=function
})

// Résultat: [{ location, snippet, symbol_info }]
```

#### D. Recherche par pattern (regex)

```javascript
// Chercher un pattern dans tout le projet
mcp_serena_search_for_pattern({
    substring_pattern: "eventEmitter\\.emit\\(['\"].*['\"]",
    paths_include_glob: "scripts/**/*.js",  // Seulement scripts/
    context_lines_before: 2,
    context_lines_after: 2
})

// Chercher dans un seul fichier
mcp_serena_search_for_pattern({
    substring_pattern: "console\\.log",
    relative_path: "app.js"  // Un seul fichier
})
```

### Édition de Code

#### A. Remplacer un symbole complet

```javascript
mcp_serena_replace_symbol_body({
    name_path: "Player/parseData",
    relative_path: "scripts/classes/Player.js",
    body: `parseData(buffer) {
    // Nouvelle implémentation
    const data = buffer.readInt32LE(0);
    return { id: data };
  }`
})
```

#### B. Insérer après un symbole

```javascript
// Ajouter une nouvelle méthode à la fin d'une classe
mcp_serena_insert_after_symbol({
    name_path: "Player",  // Après la classe Player
    relative_path: "scripts/classes/Player.js",
    body: `
  // Nouvelle méthode
  getHealth() {
    return this.health;
  }
`
})
```

#### C. Insérer avant un symbole

```javascript
// Ajouter un import en haut du fichier
mcp_serena_insert_before_symbol({
    name_path: "/Player",  // Absolu = premier symbole
    relative_path: "scripts/classes/Player.js",
    body: `const { EventEmitter } = require('events');\n`
})
```

#### D. Renommer un symbole

```javascript
mcp_serena_rename_symbol({
    name_path: "parseData",
    relative_path: "scripts/classes/Player.js",
    new_name: "parsePlayerData"
})
// Renomme dans tout le projet (refactoring)
```

### Memories Serena

```javascript
// Écrire une note temporaire
mcp_serena_write_memory({
    memory_file_name: "packet-analysis-2025-11-05",
    content: "# Analyse des paquets\n\nOpération 21 = harvestable..."
})

// Lire une note
mcp_serena_read_memory({
    memory_file_name: "packet-analysis-2025-11-05"
})

// Lister toutes les notes
mcp_serena_list_memories()

// Supprimer une note obsolète
mcp_serena_delete_memory({
    memory_file_name: "packet-analysis-2025-11-05"
})
```

### Fichiers et Répertoires

```javascript
// Lister un répertoire
mcp_serena_list_dir({
    relative_path: "scripts/classes",
    recursive: false
})

// Recherche de fichiers par nom
mcp_serena_find_file({
    file_mask: "Player*.js",
    relative_path: "scripts"
})
```

---

## 2. Knowledge Graph (AIM)

**Pourquoi:** Mémoire persistante, graph de connaissances  
**Quand:** Stocker des infos importantes sur l'architecture, les modules, les bugs

### Concepts

- **Entity (Entité):** Un nœud (module, classe, bug, feature, etc.)
- **Relation:** Un lien entre deux entités (utilise, hérite, appelle, etc.)
- **Observation:** Une note sur une entité
- **Context:** Un "namespace" pour organiser (zqradar-dev, zqradar-bugs, etc.)

### Gestion des Contextes

```javascript
// Lister tous les contextes disponibles
mcp_knowledge - gra_aim_list_databases()

// Résultat: { project: [...], global: [...] }
```

### Créer des Entités

```javascript
aim_create_entities({
    context: "zqradar-dev",
    location: "project",  // ou "global"
    entities: [
        {
            name: "PacketParser",
            entityType: "module",
            observations: [
                "Parse les paquets réseau Albion Online",
                "Fichier: scripts/handlers/PacketHandler.js",
                "Opération 21 = harvestable (ressources)",
                "Opération 24 = players (joueurs)"
            ]
        },
        {
            name: "HarvestableHandler",
            entityType: "class",
            observations: [
                "Gère les événements harvestable",
                "Émet un event 'harvestable' via WebSocket",
                "Extrait: tier, enchantment, position"
            ]
        }
    ]
})
```

### Créer des Relations

```javascript
aim_create_relations({
    context: "zqradar-dev",
    relations: [
        {
            from: "PacketParser",
            to: "HarvestableHandler",
            relationType: "utilise"
        },
        {
            from: "HarvestableHandler",
            to: "WebSocketServer",
            relationType: "émet vers"
        }
    ]
})
```

### Ajouter des Observations

```javascript
aim_add_observations({
    context: "zqradar-dev",
    observations: [
        {
            entityName: "PacketParser",
            contents: [
                "Bug: parfois rate les paquets en burst",
                "Fix: ajouter un buffer circulaire"
            ]
        }
    ]
})
```

### Recherche dans le Graph

```javascript
// Recherche par texte
aim_search_nodes({
    context: "zqradar-dev",
    query: "harvestable"
})

// Ouvrir des nœuds spécifiques
aim_open_nodes({
    context: "zqradar-dev",
    names: ["PacketParser", "HarvestableHandler"]
})

// Lire tout le graph
aim_read_graph({
    context: "zqradar-dev"
})
```

### Suppression

```javascript
// Supprimer des entités
aim_delete_entities({
    context: "zqradar-dev",
    entityNames: ["OldModule"]
})

// Supprimer des observations
aim_delete_observations({
    context: "zqradar-dev",
    deletions: [
        {
            entityName: "PacketParser",
            observations: ["Info obsolète"]
        }
    ]
})

// Supprimer des relations
aim_delete_relations({
    context: "zqradar-dev",
    relations: [
        {
            from: "ModuleA",
            to: "ModuleB",
            relationType: "old_relation"
        }
    ]
})
```

---

## 3. Memory Bank

**Pourquoi:** Documentation structurée par projet  
**Quand:** Alternative à Serena memories, plus orientée "notes permanentes"

### Gestion

```javascript
// Lister les projets
mcp_memory - bank_list_projects()

// Lister les fichiers d'un projet
mcp_memory - bank_list_project_files({
    projectName: "ZQRadar"
})
```

### Lecture/Écriture

```javascript
// Créer une note
mcp_memory - bank_memory_bank_write({
    projectName: "ZQRadar",
    fileName: "packet-structure.md",
    content: `# Structure des Paquets Albion

## Opération 21 - Harvestable
- Offset 0: Type ID (4 bytes)
- Offset 4: Position X (float)
...
`
})

// Lire une note
mcp_memory - bank_memory_bank_read({
    projectName: "ZQRadar",
    fileName: "packet-structure.md"
})

// Mettre à jour une note existante
mcp_memory - bank_memory_bank_update({
    projectName: "ZQRadar",
    fileName: "packet-structure.md",
    content: "# Contenu mis à jour..."
})
```

---

## 4. Git

**Pourquoi:** Gestion de version, historique, branches  
**Quand:** Commits, analyse de l'historique, création de branches

### Status et Diff

```javascript
const repoPath = "C:\\Projets\\Albion-Online-ZQRadar";

// Status
mcp_git_git_status({repo_path: repoPath})

// Diff non stagé
mcp_git_git_diff_unstaged({
    repo_path: repoPath,
    context_lines: 5
})

// Diff stagé
mcp_git_git_diff_staged({repo_path: repoPath})

// Diff entre branches
mcp_git_git_diff({
    repo_path: repoPath,
    target: "main..feature/new-parser"
})
```

### Log et Historique

```javascript
// Derniers commits
mcp_git_git_log({
    repo_path: repoPath,
    max_count: 20
})

// Log avec filtre temporel
mcp_git_git_log({
    repo_path: repoPath,
    max_count: 50,
    start_timestamp: "2024-11-01",  // ISO ou relative: "1 week ago"
    end_timestamp: "2024-11-05"
})

// Afficher un commit
mcp_git_git_show({
    repo_path: repoPath,
    revision: "abc123"  // SHA du commit
})
```

### Branches

```javascript
// Lister les branches locales
mcp_git_git_branch({
    repo_path: repoPath,
    branch_type: "local"
})

// Lister les branches remote
mcp_git_git_branch({
    repo_path: repoPath,
    branch_type: "remote"
})

// Toutes les branches
mcp_git_git_branch({
    repo_path: repoPath,
    branch_type: "all"
})

// Créer une branche
mcp_git_git_create_branch({
    repo_path: repoPath,
    branch_name: "feature/packet-refactor",
    base_branch: "main"  // Optionnel
})

// Checkout
mcp_git_git_checkout({
    repo_path: repoPath,
    branch_name: "feature/packet-refactor"
})
```

### Staging et Commit

```javascript
// Ajouter des fichiers
mcp_git_git_add({
    repo_path: repoPath,
    files: ["app.js", "scripts/classes/Player.js"]
})

// Commit
mcp_git_git_commit({
    repo_path: repoPath,
    message: "feat: amélioration du parsing des paquets harvestable"
})

// Reset (unstage tout)
mcp_git_git_reset({repo_path: repoPath})
```

---

## 4. Augments (Frameworks)

**Pourquoi:** Documentation officielle des frameworks  
**Quand:** Besoin de référence Express, WebSocket, etc.

### Recherche de Frameworks

```javascript
// Lister par catégorie
mcp_augments_list_available_frameworks({
    category: "backend"  // web, mobile, ai-ml, design, tools
})

// Chercher un framework
mcp_augments_search_frameworks({
    query: "express"
})

// Info détaillée
mcp_augments_get_framework_info({
    framework: "express"
})
```

### Documentation

```javascript
// Doc complète
mcp_augments_get_framework_docs({
    framework: "express",
    section: "routing",  // Optionnel
    use_cache: true
})

// Exemples de code
mcp_augments_get_framework_examples({
    framework: "express",
    pattern: "middleware"
})

// Recherche dans la doc
mcp_augments_search_documentation({
    framework: "express",
    query: "error handling",
    limit: 10
})
```

### Contexte Multi-Framework

```javascript
// Obtenir un contexte combiné
mcp_augments_get_framework_context({
    frameworks: ["express", "websocket", "ejs"],
    task_description: "Create a real-time web dashboard with Express, WebSocket and EJS templates"
})
```

### Analyse de Compatibilité

```javascript
mcp_augments_analyze_code_compatibility({
    code: `
    app.get('/api/players', (req, res) => {
      res.json({ players: [] });
    });
  `,
    frameworks: ["express"]
})
```

---

## 5. Sequential Thinking

**Pourquoi:** Résolution de problèmes complexes étape par étape  
**Quand:** Problème qui nécessite une réflexion approfondie

```javascript
mcp_sequential - th_sequentialthinking({
    thought: "Étape 1: Analyser la structure des paquets...",
    thoughtNumber: 1,
    totalThoughts: 5,
    nextThoughtNeeded: true,
    isRevision: false
})

// Puis étape 2, 3, etc.
mcp_sequential - th_sequentialthinking({
    thought: "Étape 2: Identifier les offsets des champs...",
    thoughtNumber: 2,
    totalThoughts: 5,
    nextThoughtNeeded: true
})

// Révision d'une étape précédente
mcp_sequential - th_sequentialthinking({
    thought: "Révision de l'étape 1: le format est Little Endian, pas Big Endian",
    thoughtNumber: 3,
    totalThoughts: 5,
    nextThoughtNeeded: true,
    isRevision: true,
    revisesThought: 1
})
```

---

## 6. JetBrains IDE

**Pourquoi:** Intégration IDE (si applicable)  
**Quand:** Fonctionnalités IDE avancées

### Fichiers

```javascript
// Ouvrir dans l'éditeur
mcp_jetbrains_open_file_in_editor({
    filePath: "scripts/classes/Player.js"
})

// Reformater
mcp_jetbrains_reformat_file({
    path: "scripts/classes/Player.js"
})

// Problèmes (linting)
mcp_jetbrains_get_file_problems({
    filePath: "scripts/classes/Player.js",
    errorsOnly: false
})
```

### Recherche

```javascript
// Recherche par texte
mcp_jetbrains_search_in_files_by_text({
    searchText: "eventEmitter.emit",
    fileMask: "*.js"
})

// Recherche par regex
mcp_jetbrains_search_in_files_by_regex({
    regexPattern: "emit\\(['\"]\\w+['\"]",
    fileMask: "*.js"
})
```

### Refactoring

```javascript
// Renommer (refactoring intelligent)
mcp_jetbrains_rename_refactoring({
    pathInProject: "scripts/classes/Player.js",
    symbolName: "parseData",
    newName: "parsePlayerData"
})

// Remplacer texte
mcp_jetbrains_replace_text_in_file({
    pathInProject: "app.js",
    oldText: "console.log('Debug:',",
    newText: "logger.debug(",
    replaceAll: true,
    caseSensitive: true
})
```

---

## 📊 Tableau de Décision Rapide

| Je veux...                              | Outil à utiliser                             |
|-----------------------------------------|----------------------------------------------|
| Voir les classes/fonctions d'un fichier | `mcp_serena_get_symbols_overview`            |
| Trouver où un symbole est utilisé       | `mcp_serena_find_referencing_symbols`        |
| Remplacer une méthode complète          | `mcp_serena_replace_symbol_body`             |
| Ajouter une méthode à une classe        | `mcp_serena_insert_after_symbol`             |
| Chercher un pattern regex               | `mcp_serena_search_for_pattern`              |
| Stocker une info d'architecture         | `aim_create_entities` (context: zqradar-dev) |
| Créer une note permanente               | `mcp_memory-bank_memory_bank_write`          |
| Voir l'historique git                   | `mcp_git_git_log`                            |
| Créer une branche                       | `mcp_git_git_create_branch`                  |
| Doc d'un framework                      | `mcp_augments_get_framework_docs`            |
| Problème complexe                       | `mcp_sequential-th_sequentialthinking`       |

---

## ⚡ Combos Efficaces

### Combo 1: Explorer un module inconnu

```javascript
// 1. Aperçu
mcp_serena_get_symbols_overview({relative_path: "scripts/handlers/PacketHandler.js"})

// 2. Lire les classes principales
mcp_serena_find_symbol({name_path: "PacketHandler", include_body: true, depth: 1})

// 3. Voir les usages
mcp_serena_find_referencing_symbols({name_path: "PacketHandler", relative_path: "..."})

// 4. Stocker dans le knowledge graph
aim_create_entities({context: "zqradar-dev", entities: [...]})
```

### Combo 2: Refactoring complet

```javascript
// 1. Chercher toutes les occurrences
mcp_serena_find_referencing_symbols({name_path: "oldMethod", ...})

// 2. Créer un plan
aim_create_entities({
    context: "zqradar-dev",
    entities: [{
        name: "RefactoringOldMethod",
        entityType: "task",
        observations: ["Remplacer oldMethod par newMethod", "Fichiers: app.js, Player.js"]
    }]
})

// 3. Renommer
mcp_serena_rename_symbol({name_path: "oldMethod", new_name: "newMethod", ...})

// 4. Commit
mcp_git_git_add({files: [...]})
mcp_git_git_commit({message: "refactor: rename oldMethod to newMethod"})
```

### Combo 3: Debug d'un bug

```javascript
// 1. Chercher dans l'historique
mcp_git_git_log({start_timestamp: "1 week ago", max_count: 30})

// 2. Lire le code suspect
mcp_serena_find_symbol({name_path: "buggyMethod", include_body: true})

// 3. Chercher le pattern d'erreur
mcp_serena_search_for_pattern({substring_pattern: "throw new Error", ...})

// 4. Documenter le bug
aim_create_entities({
    context: "zqradar-bugs",
    entities: [{
        name: "BugParseHarvestable",
        entityType: "bug",
        observations: ["Crash quand tier > 8", "Fix: ajouter validation"]
    }]
})

// 5. Fixer
mcp_serena_replace_symbol_body({...})
```

---

*Référence complète - Gardez ce document sous la main !*

