# 🤖 Guide pour les Agents IA - ZQRadar

> **Version:** 1.0  
> **Dernière mise à jour:** 2025-11-05  
> **Public:** Agents IA (Claude, GPT, etc.)

---

## 🎯 Objectif de ce Document

Ce guide vous aide à travailler efficacement sur le projet ZQRadar en utilisant les outils MCP disponibles et en respectant les conventions du projet.

---

## 📦 Projet: Albion-Online-ZQRadar

### Vue d'ensemble
- **Type:** Application Node.js (CommonJS) - Radar temps réel pour Albion Online
- **Stack:** Node.js, Express, EJS, WebSocket, Cap (capture réseau)
- **Langages:** JavaScript (CommonJS), Python (outils), HTML/CSS
- **OS cible:** Windows (Npcap requis)

### Points d'entrée importants
- **`app.js`** - Serveur principal (Express + WebSocket + Capture réseau)
- **`scripts/`** - Classes, handlers, utilitaires (cœur métier)
- **`server-scripts/`** - Scripts serveur (sélection adaptateur réseau)
- **`views/`** - Templates EJS
- **`build/`** - Scripts de build et packaging
- **`tools/`** - Scripts Python utilitaires (git-ignoré mais important)

---

## 🛠️ Serveurs MCP Disponibles

Vous avez accès à plusieurs serveurs MCP. **UTILISEZ-LES !**

### 1. **Serena** (Analyse de Code Symbolique)
**Usage prioritaire pour le code JavaScript/TypeScript**

```javascript
// ✅ BON - Analyse symbolique
mcp_serena_get_symbols_overview({ relative_path: "scripts/classes/Player.js" })
mcp_serena_find_symbol({ name_path: "Player/constructor", include_body: true })
mcp_serena_find_referencing_symbols({ name_path: "Player", relative_path: "scripts/classes/Player.js" })

// ❌ MAUVAIS - Lire tout le fichier
read_file({ filePath: "...", startLine: 0, endLine: 500 })
```

**Workflows Serena:**
1. **Exploration** → `get_symbols_overview` (aperçu)
2. **Recherche** → `find_symbol` avec `substring_matching: true`
3. **Lecture ciblée** → `find_symbol` avec `include_body: true` et `depth: 1`
4. **Édition** → `replace_symbol_body`, `insert_after_symbol`, `insert_before_symbol`
5. **Recherche de pattern** → `search_for_pattern` (regex dans le code)

**⚠️ IMPORTANT:** Ne lisez JAMAIS un fichier entier si Serena peut le faire symboliquement !

---

### 2. **Knowledge Graph (AIM)** - Mémoire Persistante
**Stockez les connaissances importantes du projet**

```javascript
// Créer des entités
aim_create_entities({
  context: "zqradar-dev",
  entities: [{
    name: "PacketParser",
    entityType: "module",
    observations: [
      "Parse les paquets réseau Albion Online",
      "Utilise la lib 'cap' pour capturer",
      "Opérations 21 = harvestable, 24 = joueurs"
    ]
  }]
})

// Rechercher dans le graph
aim_search_nodes({ context: "zqradar-dev", query: "PacketParser" })

// Lire tout le graph
aim_read_graph({ context: "zqradar-dev" })
```

**Contextes suggérés:**
- `zqradar-dev` - Architecture et modules
- `zqradar-config` - Configuration et settings
- `zqradar-bugs` - Bugs connus et workarounds

---

### 3. **Memory Bank** - Documentation Structurée
**Alternative pour documentation par projet**

```javascript
// Lister les projets
mcp_memory-bank_list_projects()

// Créer/mettre à jour une note
mcp_memory-bank_memory_bank_write({
  projectName: "ZQRadar",
  fileName: "packet-structure.md",
  content: "# Structure des paquets..."
})

// Lire une note
mcp_memory-bank_memory_bank_read({
  projectName: "ZQRadar",
  fileName: "packet-structure.md"
})
```

---

### 4. **Git** - Opérations Git
**Analysez l'historique, créez des branches, commitez**

```javascript
// Status
mcp_git_git_status({ repo_path: "C:\\Projets\\Albion-Online-ZQRadar" })

// Diff
mcp_git_git_diff_unstaged({ repo_path: "..." })

// Log avec filtres temporels
mcp_git_git_log({ 
  repo_path: "...",
  max_count: 20,
  start_timestamp: "2024-11-01"
})

// Créer une branche
mcp_git_git_create_branch({
  repo_path: "...",
  branch_name: "feature/new-packet-parser"
})
```

---

### 5. **Augments** - Documentation des Frameworks
**Accédez à la doc des frameworks utilisés**

```javascript
// Chercher un framework
mcp_augments_search_frameworks({ query: "express" })

// Obtenir la doc
mcp_augments_get_framework_docs({ framework: "express", section: "routing" })

// Contexte multi-frameworks
mcp_augments_get_framework_context({
  frameworks: ["express", "websocket"],
  task_description: "Create real-time event streaming with Express and WebSocket"
})
```

---

### 6. **Sequential Thinking** - Résolution Complexe
**Pour les problèmes complexes nécessitant une réflexion approfondie**

```javascript
mcp_sequential-th_sequentialthinking({
  thought: "Analyse de l'architecture des handlers de paquets...",
  thoughtNumber: 1,
  totalThoughts: 5,
  nextThoughtNeeded: true
})
```

---

## 📁 Organisation des Fichiers

### ❌ Ne JAMAIS créer
Fichiers temporaires gitignorés:
- `WORKING_*.md`
- `*_FIX.md`, `*_ANALYSIS.md`, `*_CLEANUP.md`
- `*_SESSION.md`, `*_FINAL.md`
- `diff_*.txt`, `TYPEIDS_SUSPECTS.json`

### ✅ Utiliser à la place
- **Notes temporaires** → `write_memory` (Serena) ou `aim_create_entities`
- **Documentation** → `docs/` avec structure appropriée
- **TODOs** → `docs/project/TODO.md`
- **Bugs** → GitHub Issues

---

## 🎨 Conventions de Code

### JavaScript/Node.js
- **Style:** CommonJS (pas d'ESM)
- **Indentation:** 2 espaces (pas de tabs)
- **Quotes:** Simple quotes `'...'`
- **Semicolons:** Oui
- **Naming:**
  - Classes: `PascalCase`
  - Fonctions/variables: `camelCase`
  - Constantes: `UPPER_SNAKE_CASE`
  - Fichiers: `kebab-case.js` ou `PascalCase.js` (classes)

### Logging
- Utiliser le système de logging centralisé
- Niveaux: `debug`, `info`, `warn`, `error`
- Fichier de config: `config/settings.json`

### Commentaires
```javascript
// ✅ BON - Commentaires explicatifs
/**
 * Parse un paquet de type harvestable (opération 21)
 * @param {Buffer} data - Données du paquet
 * @returns {Object} Objet harvestable parsé
 */
function parseHarvestable(data) {
  // ...
}

// ❌ MAUVAIS - Commentaires évidents
// Cette fonction parse les harvestables
function parseHarvestable(data) {
  // ...
}
```

---

## 🔄 Workflows Courants

### 1. Analyse d'un Bug
```
1. Lire les memories Serena: read_memory("project_summary")
2. Chercher le symbole: find_symbol({ name_path: "...", substring_matching: true })
3. Analyser les références: find_referencing_symbols(...)
4. Vérifier le git log: git_log({ start_timestamp: "..." })
5. Créer une entrée knowledge graph: aim_create_entities(...)
6. Éditer le code: replace_symbol_body(...)
7. Documenter dans TODO.md
```

### 2. Ajout d'une Feature
```
1. Activer le projet: activate_project("C:\\Projets\\Albion-Online-ZQRadar")
2. Lire l'architecture: read_memory("project_summary")
3. Explorer la structure: get_symbols_overview(...)
4. Créer une branche: git_create_branch(...)
5. Implémenter: insert_after_symbol(...) ou replace_symbol_body(...)
6. Documenter: memory_bank_write(...)
7. Commit: git_add(...) puis git_commit(...)
```

### 3. Refactoring
```
1. Chercher tous les usages: find_referencing_symbols(...)
2. Créer un plan: aim_create_entities({ entityType: "refactoring-plan", ... })
3. Renommer si besoin: rename_symbol(...)
4. Remplacer les implémentations: replace_symbol_body(...)
5. Vérifier les erreurs: get_file_problems(...)
```

---

## 📊 Priorités d'Utilisation des Outils

### Pour lire du code
1. **🥇 `mcp_serena_get_symbols_overview`** - Aperçu rapide
2. **🥈 `mcp_serena_find_symbol`** - Lecture ciblée
3. **🥉 `mcp_serena_search_for_pattern`** - Recherche par regex
4. **❌ `read_file`** - EN DERNIER RECOURS UNIQUEMENT

### Pour éditer du code
1. **🥇 `mcp_serena_replace_symbol_body`** - Remplacement de symbole complet
2. **🥈 `mcp_serena_insert_after_symbol` / `insert_before_symbol`** - Insertion
3. **🥉 `replace_string_in_file`** - Remplacement simple
4. **❌ `insert_edit_into_file`** - Si les autres ont échoué

### Pour se souvenir de quelque chose
1. **🥇 `mcp_knowledge-gra_aim_create_entities`** - Graph de connaissances
2. **🥈 `mcp_serena_write_memory`** - Notes Serena

---

## ⚠️ Erreurs Fréquentes à Éviter

### ❌ Ne PAS faire
```javascript
// Lire des fichiers entiers inutilement
read_file({ filePath: "scripts/classes/Player.js", startLine: 0, endLine: 999 })

// Oublier d'activer le projet Serena
find_symbol({ ... }) // Error: No active project

// Créer des fichiers MD temporaires
create_file({ filePath: "WORKING_NOTES.md", ... })

// Ignorer les outils MCP
// "Je vais lire le fichier manuellement..."
```

### ✅ Faire à la place
```javascript
// Analyse symbolique
activate_project("C:\\Projets\\Albion-Online-ZQRadar")
get_symbols_overview({ relative_path: "scripts/classes/Player.js" })
find_symbol({ name_path: "Player/parseData", include_body: true })

// Stocker dans le knowledge graph
aim_create_entities({ 
  context: "zqradar-dev",
  entities: [{ name: "...", observations: [...] }]
})
```

---

## 🧠 Checklist Avant Chaque Action

- [ ] Ai-je activé le projet Serena ? (`activate_project`)
- [ ] Ai-je lu les memories pertinentes ? (`read_memory`)
- [ ] Puis-je utiliser Serena au lieu de `read_file` ?
- [ ] Ai-je besoin de stocker cette info dans le knowledge graph ?
- [ ] Suis-je en train de créer un fichier MD temporaire ? (❌ NON)
- [ ] Ai-je vérifié les erreurs après mes éditions ? (`get_file_problems`)

---

## 📚 Documentation Complémentaire

- **[MCP_TOOLS.md](./MCP_TOOLS.md)** - Référence complète des outils MCP
- **[WORKFLOWS.md](./WORKFLOWS.md)** - Workflows détaillés avec exemples
- **[../dev/ARCHITECTURE.md](../dev/ARCHITECTURE.md)** - Architecture du projet
- **[../technical/LOGGING.md](../technical/LOGGING.md)** - Système de logging

---

## 🆘 En Cas de Doute

1. **Lire cette doc** (vous y êtes !)
2. **Lire les memories Serena**: `list_memories()` puis `read_memory(...)`
3. **Chercher dans le knowledge graph**: `aim_search_nodes({ query: "..." })`
4. **Demander à l'utilisateur** plutôt que deviner

---

*"Un agent efficace utilise les bons outils au bon moment."*

