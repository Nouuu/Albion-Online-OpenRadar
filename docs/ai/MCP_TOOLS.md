# 🛠 MCP Tools Reference - OpenRadar

This document summarizes the main MCP tools you can use while working on the OpenRadar project.

---

## 1. Serena-like Code Tools (Symbolic Analysis)

**Why:** Intelligent code analysis, symbolic reading/editing (classes, methods, functions).  
**When:** Any time you work with JavaScript/TypeScript code.

### 1.1 Symbol Overview of a File

```javascript
mcp_serena_get_symbols_overview({
  relative_path: "scripts/classes/Player.js",
  max_answer_chars: -1
});
```

**Result:** `{ symbols: [{ name, kind, location, children }] }`

Use this instead of reading the entire file:

- ✅ Quick overview of structure (classes, methods).  
- ✅ Helps decide where to focus.  
- ❌ Avoid `read_file` on the whole file when this is enough.

### 1.2 Find Symbols

```javascript
mcp_serena_find_symbol({
  name_path_pattern: "Player/parseData",
  relative_path: "scripts/classes/Player.js",
  depth: 1,          // 1 = include child methods of the class
  include_body: false, // false = overview only
  max_answer_chars: -1,
  substring_matching: true
});
```

**Typical usages:**
- `Player` → the class `Player`.
- `Player/parseData` → the `parseData` method of `Player`.

**Options:**
- `depth: 0` → just the symbol.  
- `depth: 1` → symbol + its children (for classes).  
- `include_body: true` → returns full source of the symbol.

### 1.3 Read a Method Body

```javascript
mcp_serena_find_symbol({
  name_path_pattern: "Player/parseData",
  relative_path: "scripts/classes/Player.js",
  include_body: true,
  depth: 0,
  max_answer_chars: -1
});
```

Use this to read a method **instead of** raw `read_file`.

### 1.4 Find References

```javascript
mcp_serena_find_referencing_symbols({
  name_path: "Player",
  relative_path: "scripts/classes/Player.js",
  include_kinds: [],
  exclude_kinds: [],
  max_answer_chars: -1
});
```

**What it does:**
- Shows where `Player` is used in the code (call sites, imports, etc.).

### 1.5 Pattern Search

```javascript
mcp_serena_search_for_pattern({
  relative_path: "scripts/",
  substring_pattern: "window.logger?.debug",
  paths_include_glob: "scripts/**/*.js",
  paths_exclude_glob: "",
  context_lines_before: 1,
  context_lines_after: 2,
  restrict_search_to_code_files: true,
  max_answer_chars: -1
});
```

**Result:** `[{ location, snippet, symbol_info }]`

Use this instead of scanning files manually when looking for a pattern.

### 1.6 Editing Code

#### A. Replace a Method Body

```javascript
mcp_serena_replace_symbol_body({
  relative_path: "scripts/classes/Player.js",
  name_path: "Player/parseData",
  body: `
    parseData(data) {
      // New implementation
      // ...
    }
  `
});
```

#### B. Insert After a Symbol

```javascript
// Add a new method after the Player class
mcp_serena_insert_after_symbol({
  relative_path: "scripts/classes/Player.js",
  name_path: "Player",  // after the Player class
  body: `
    class PlayerStats {
      // ...
    }
  `
});
```

#### C. Insert Before a Symbol

```javascript
mcp_serena_insert_before_symbol({
  relative_path: "scripts/classes/Player.js",
  name_path: "Player/parseData",  // before parseData
  body: `
    // Helper for parseData
  `
});
```

Use these editing tools for structural changes instead of manual line offsets.

---

## 2. Knowledge Graph (AIM)

**Why:** Persistent memory and knowledge graph.  
**When:** To store long-term information about modules, bugs, features, architecture, etc.

### 2.1 Create Entities

```javascript
aim_create_entities({
  context: "openradar-dev",
  entities: [
    {
      name: "PacketParser",
      entityType: "module",
      observations: [
        "Parses Albion Online network packets",
        "Uses 'cap' to capture",
        "Operations 21 = harvestable, 24 = players"
      ]
    }
  ]
});
```

### 2.2 Search the Graph

```javascript
aim_search_nodes({
  context: "openradar-dev",
  query: "PacketParser"
});

// Or read the full graph
aim_read_graph({ context: "openradar-dev" });
```

### 2.3 Add / Delete Observations & Relations

```javascript
// Add observations
aim_add_observations({
  context: "openradar-dev",
  observations: [
    {
      entityName: "PacketParser",
      contents: ["Runtime Npcap check", "Works with pkg builds"]
    }
  ]
});

// Delete observations
aim_delete_observations({
  context: "openradar-dev",
  deletions: [
    {
      entityName: "PacketParser",
      observations: ["Obsolete info"]
    }
  ]
});

// Delete relations
aim_delete_relations({
  context: "openradar-dev",
  relations: [
    {
      from: "ModuleA",
      to: "ModuleB",
      relationType: "old_relation"
    }
  ]
});
```

---

## 3. Git

**Why:** Version control, history, branches.  
**When:** Commits, history analysis, branch management.

### 3.1 Status and Diff

```javascript
const repoPath = "C:\\Projets\\Albion-Online-ZQRadar";

// Status
mcp_git_git_status({ repo_path: repoPath });

// Unstaged diff
mcp_git_git_diff_unstaged({
  repo_path: repoPath,
  context_lines: 5
});

// Staged diff
mcp_git_git_diff_staged({ repo_path: repoPath });

// Diff between branches
mcp_git_git_diff({
  repo_path: repoPath,
  target: "main..feature/new-parser"
});
```

### 3.2 Log and History

```javascript
// Latest commits
mcp_git_git_log({
  repo_path: repoPath,
  max_count: 20
});

// Log with time filter
mcp_git_git_log({
  repo_path: repoPath,
  max_count: 50,
  start_timestamp: "2024-11-01",  // ISO or relative: "1 week ago"
  end_timestamp: "2024-11-05"
});

// Show a commit
mcp_git_git_show({
  repo_path: repoPath,
  revision: "abc123"  // commit SHA
});
```

### 3.3 Branches

```javascript
// List local branches
mcp_git_git_branch({
  repo_path: repoPath,
  branch_type: "local"
});

// List remote branches
mcp_git_git_branch({
  repo_path: repoPath,
  branch_type: "remote"
});

// All branches
mcp_git_git_branch({
  repo_path: repoPath,
  branch_type: "all"
});

// Create a branch
mcp_git_git_create_branch({
  repo_path: repoPath,
  branch_name: "feature/packet-refactor",
  base_branch: "main"  // optional
});

// Checkout
mcp_git_git_checkout({
  repo_path: repoPath,
  branch_name: "feature/packet-refactor"
});
```

### 3.4 Staging and Commit

```javascript
// Add files
mcp_git_git_add({
  repo_path: repoPath,
  files: ["app.js", "scripts/classes/Player.js"]
});

// Commit
mcp_git_git_commit({
  repo_path: repoPath,
  message: "feat: improve harvestable packet parsing"
});

// Reset (unstage all)
mcp_git_git_reset({ repo_path: repoPath });
```

---

## 4. Augments (Frameworks)

**Why:** Official framework documentation (Express, WebSocket, etc.).  
**When:** You need references for server/framework usage.

### 4.1 Framework Search

```javascript
// List by category
mcp_augments_list_available_frameworks({
  category: "backend"  // web, mobile, ai-ml, design, tools
});

// Search a framework
mcp_augments_search_frameworks({
  query: "express"
});

// Detailed info
mcp_augments_get_framework_info({
  framework: "express"
});
```

### 4.2 Documentation

```javascript
// Full docs
mcp_augments_get_framework_docs({
  framework: "express",
  section: "routing",  // optional
  use_cache: true
});

// Code examples
mcp_augments_get_framework_examples({
  framework: "express",
  pattern: "middleware"
});

// Search in docs
mcp_augments_search_documentation({
  framework: "express",
  query: "error handling",
  limit: 10
});
```

### 4.3 Multi-Framework Context

```javascript
// Get combined context
mcp_augments_get_framework_context({
  frameworks: ["express", "websocket", "ejs"],
  task_description: "Create a real-time web dashboard with Express, WebSocket and EJS templates"
});
```

### 4.4 Compatibility Analysis

```javascript
mcp_augments_analyze_code_compatibility({
  code: `
    app.get('/api/players', (req, res) => {
      res.json({ players: [] });
    });
  `,
  frameworks: ["express"]
});
```

---

## 5. Sequential Thinking

**Why:** Step-by-step reasoning for complex problems.  
**When:** A problem needs deep multi-step analysis.

```javascript
mcp_sequential-th_sequentialthinking({
  thought: "Step 1: Analyze packet structure...",
  thoughtNumber: 1,
  totalThoughts: 5,
  nextThoughtNeeded: true,
  isRevision: false
});

// Then step 2, 3, etc.
mcp_sequential-th_sequentialthinking({
  thought: "Step 2: Identify field offsets...",
  thoughtNumber: 2,
  totalThoughts: 5,
  nextThoughtNeeded: true
});

// Revision of a previous step
mcp_sequential-th_sequentialthinking({
  thought: "Revision of step 1: format is Little Endian, not Big Endian",
  thoughtNumber: 3,
  totalThoughts: 5,
  nextThoughtNeeded: true,
  isRevision: true,
  revisesThought: 1
});
```

---

## 6. JetBrains IDE

**Why:** IDE integration (if you use a JetBrains IDE).  
**When:** Advanced IDE features: navigation, refactor, search, run configs.

### 6.1 Files

```javascript
// Open in editor
mcp_jetbrains_open_file_in_editor({
  filePath: "scripts/classes/Player.js"
});

// Reformat
mcp_jetbrains_reformat_file({
  path: "scripts/classes/Player.js"
});

// Problems (linting)
mcp_jetbrains_get_file_problems({
  filePath: "scripts/classes/Player.js",
  errorsOnly: false
});
```

### 6.2 Search

```javascript
// Text search
mcp_jetbrains_search_in_files_by_text({
  searchText: "eventEmitter.emit",
  fileMask: "*.js"
});

// Regex search
mcp_jetbrains_search_in_files_by_regex({
  regexPattern: "emit\\(['\"]\\w+['\"]",
  fileMask: "*.js"
});
```

### 6.3 Refactoring

```javascript
// Rename (intelligent refactor)
mcp_jetbrains_rename_refactoring({
  pathInProject: "scripts/classes/Player.js",
  symbolName: "parseData",
  newName: "parsePlayerData"
});

// Replace text
mcp_jetbrains_replace_text_in_file({
  pathInProject: "app.js",
  oldText: "console.log('Debug:',",
  newText: "logger.debug(",
  replaceAll: true,
  caseSensitive: true
});
```

---

## 📊 Quick Decision Table

| I want to…                             | Tool to use                              |
|----------------------------------------|------------------------------------------|
| See classes/functions in a file        | `mcp_serena_get_symbols_overview`        |
| Find where a symbol is used            | `mcp_serena_find_referencing_symbols`    |
| Replace a complete method              | `mcp_serena_replace_symbol_body`         |
| Add a method to a class                | `mcp_serena_insert_after_symbol`         |
| Search for a regex pattern             | `mcp_serena_search_for_pattern`          |
| Store architecture information         | `aim_create_entities` (context: openradar-dev) |
| See Git history                        | `mcp_git_git_log`                        |
| Create a Git branch                    | `mcp_git_git_create_branch`              |
| Get framework documentation            | `mcp_augments_get_framework_docs`        |
| Work on a complex reasoning problem    | `mcp_sequential-th_sequentialthinking`   |

---

## ⚡ Effective Combos

### Combo 1: Explore an Unknown Module

```javascript
// 1. Overview
mcp_serena_get_symbols_overview({ relative_path: "scripts/handlers/PacketHandler.js" });

// 2. Read main classes
mcp_serena_find_symbol({
  name_path: "PacketHandler",
  include_body: true,
  depth: 1
});

// 3. See usages
mcp_serena_find_referencing_symbols({
  name_path: "PacketHandler",
  relative_path: "scripts/"
});

// 4. Store knowledge in graph
aim_create_entities({
  context: "openradar-dev",
  entities: [
    {
      name: "PacketHandler",
      entityType: "module",
      observations: ["Handles packet dispatch for events/requests"]
    }
  ]
});
```

### Combo 2: Full Refactor

```javascript
// 1. Find all usages
mcp_serena_find_referencing_symbols({
  name_path: "oldMethod",
  relative_path: "scripts/"
});

// 2. Plan (optional) – store as entity
aim_create_entities({
  context: "openradar-dev",
  entities: [
    {
      name: "RefactorOldMethod",
      entityType: "task",
      observations: ["Replace oldMethod with newMethod", "Files: app.js, Player.js"]
    }
  ]
});

// 3. Rename
mcp_serena_rename_symbol({
  name_path: "oldMethod",
  new_name: "newMethod",
  relative_path: "scripts/"
});

// 4. Commit
mcp_git_git_add({ repo_path: repoPath, files: ["scripts/"] });
mcp_git_git_commit({ repo_path: repoPath, message: "refactor: rename oldMethod to newMethod" });
```

### Combo 3: Debug a Bug

```javascript
// 1. Inspect history
mcp_git_git_log({
  repo_path: repoPath,
  start_timestamp: "1 week ago",
  max_count: 30
});

// 2. Read suspicious code
mcp_serena_find_symbol({
  name_path: "buggyMethod",
  include_body: true,
  relative_path: "scripts/"
});

// 3. Search for error patterns
mcp_serena_search_for_pattern({
  substring_pattern: "throw new Error",
  relative_path: "scripts/",
  max_answer_chars: -1
});

// 4. Store bug info in graph (optional)
aim_create_entities({
  context: "openradar-dev",
  entities: [
    {
      name: "BugParseHarvestable",
      entityType: "bug",
      observations: ["Crash when tier > 8", "Fix: add input validation"]
    }
  ]
});

// 5. Fix
mcp_serena_replace_symbol_body({
  relative_path: "scripts/...", // target file
  name_path: "buggyMethod",
  body: "function buggyMethod(/* fixed */) { /* ... */ }"
});
```

---

*Keep this document handy as a complete MCP tools reference for OpenRadar.*
