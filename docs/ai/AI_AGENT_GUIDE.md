# 🤖 AI Agent Guide - OpenRadar

> **Version:** 2.0  
> **Last update:** 2025-12-01  
> **Audience:** AI agents (Claude, GPT, etc.)

---

## 🎯 Purpose of this Document

This guide helps AI agents work efficiently on the OpenRadar project using the available MCP tools
while respecting the project conventions.

### ⚡ TL;DR (Quick Summary)

- **Read code** → use MCP code tools (JetBrains / Serena-like APIs)
- **Do NOT** → read entire files blindly when symbolic tools are available
- **JS style** → CommonJS, 2 spaces, single quotes
- **Debug vs Info** → DEBUG is filtered by settings, INFO/WARN/ERROR are always logged
- **In doubt?** → check `MCP_TOOLS.md` in this folder

---

## 📦 Project: Albion-Online-OpenRadar

### Overview

- **Type:** Node.js application (CommonJS) – real-time radar for Albion Online
- **Stack:** Node.js, Express, EJS, WebSocket, Cap (network capture)
- **Languages:** JavaScript (CommonJS), Python (tools), HTML/CSS
- **Target OS:** Windows (Npcap required)

### Key Entry Points

- **`app.js`** – Main server (Express + WebSocket + packet capture)
- **`scripts/`** – Classes, handlers, utilities (core logic)
- **`server-scripts/`** – Server-side scripts (network adapter selection, logging)
- **`views/`** – EJS templates
- **`scripts-shell/`** – Build & packaging scripts
- **`work/`** – Python scripts and dev data (versioned, except huge dumps)

---

## 🧰 MCP Tools – How to Use Them

Below is a condensed reference of the most useful MCP tools for this repo. See `MCP_TOOLS.md` for full details.

### 1. Code Analysis (Symbolic)

Use the JetBrains / code-oriented MCP tools instead of raw file reads whenever possible.

Examples (pseudocode-style calls):

```javascript
// Get symbol overview for a file
mcp_serena_get_symbols_overview({
  relative_path: "scripts/classes/Player.js"
});

// Find a specific symbol with its body
mcp_serena_find_symbol({
  name_path: "Player/constructor",
  include_body: true,
  depth: 1
});

// Find references to a class or method
mcp_serena_find_referencing_symbols({
  name_path: "Player",
  relative_path: "scripts/classes/Player.js"
});
```

**Good patterns:**

1. Use `get_symbols_overview` to explore a file.
2. Use `find_symbol` (with `substring_matching`) to target a class/method.
3. Only then read bodies or replace with `replace_symbol_body` or `insert_after_symbol`.

**Important:** avoid `read_file` on full files if symbolic tools can give you what you need.

---

### 2. Git Operations

Use Git MCP tools for history, branches and commits instead of shelling out manually.

```javascript
const repoPath = "C:\\Projets\\Albion-Online-ZQRadar";

// Status
mcp_git_git_status({ repo_path: repoPath });

// Unstaged diff
mcp_git_git_diff_unstaged({
  repo_path: repoPath,
  context_lines: 5
});

// Last commits
mcp_git_git_log({
  repo_path: repoPath,
  max_count: 20
});

// Create a branch
mcp_git_git_create_branch({
  repo_path: repoPath,
  branch_name: "feature/new-packet-parser",
  base_branch: "main"
});

// Checkout branch
mcp_git_git_checkout({
  repo_path: repoPath,
  branch_name: "feature/new-packet-parser"
});
```

Staging and commit:

```javascript
mcp_git_git_add({
  repo_path: repoPath,
  files: ["app.js", "scripts/classes/Player.js"]
});

mcp_git_git_commit({
  repo_path: repoPath,
  message: "feat: improve harvestable packet parsing"
});

mcp_git_git_reset({ repo_path: repoPath }); // unstage everything
```

---

### 3. Framework Docs (Augments)

Use Augments to fetch official documentation for frameworks.

```javascript
// List frameworks by category
mcp_augments_list_available_frameworks({
  category: "backend"
});

// Search for a framework
mcp_augments_search_frameworks({
  query: "express"
});

// Detailed docs
mcp_augments_get_framework_docs({
  framework: "express",
  section: "routing",
  use_cache: true
});

// Combined context for multiple frameworks
mcp_augments_get_framework_context({
  frameworks: ["express", "websocket", "ejs"],
  task_description: "Create a real-time web dashboard with Express, WebSocket and EJS templates"
});
```

---

### 4. JetBrains IDE Integration

Useful for file operations, searches and refactors directly inside the IDE.

```javascript
// Open a file in the editor
mcp_jetbrains_open_file_in_editor({
  filePath: "scripts/classes/Player.js"
});

// Reformat a file
mcp_jetbrains_reformat_file({
  path: "scripts/classes/Player.js"
});

// Get problems (linting, inspections)
mcp_jetbrains_get_file_problems({
  filePath: "scripts/classes/Player.js",
  errorsOnly: false
});
```

Search & replace:

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

// Rename symbol (IDE-level refactor)
mcp_jetbrains_rename_refactoring({
  pathInProject: "scripts/classes/Player.js",
  symbolName: "parseData",
  newName: "parsePlayerData"
});

// Replace text in a file
mcp_jetbrains_replace_text_in_file({
  pathInProject: "app.js",
  oldText: "console.log('Debug:',",
  newText: "logger.debug(",
  replaceAll: true,
  caseSensitive: true
});
```

---

## 🎨 Code Conventions

### JavaScript/Node.js

- **Module system:** CommonJS (no ESM)
- **Indentation:** 2 spaces, no tabs
- **Quotes:** Single quotes `'...'`
- **Semicolons:** Yes
- **Naming:**
  - Classes: `PascalCase`
  - Functions/variables: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Files: `kebab-case.js` or `PascalCase.js` for class files

### Logging

**Centralized logging system v2.2** (LoggerClient + LoggerServer)

#### Levels and Filtering Rules

- **`DEBUG`** – verbose logs → **FILTERED** by settings (`debugEnemies`, `debugFishing`, etc.)
- **`INFO`** – important actions → **ALWAYS LOGGED** (no filtering)
- **`WARN`** – anomalies → **ALWAYS LOGGED**
- **`ERROR`** – critical errors → **ALWAYS LOGGED**

#### Correct Usage

```javascript
// ✅ DEBUG – controlled by settings
if (this.settings.debugEnemies && window.logger) {
  window.logger.debug('MOB', 'DetailedEvent', { params });
}

// ✅ INFO/WARN/ERROR – always logged
if (window.logger) {
  window.logger.info('MOB', 'LoadComplete', { count });
  window.logger.warn('MOB', 'UnexpectedData', { details });
  window.logger.error('MOB', 'LoadFailed', error);
}

// ❌ WRONG – INFO must NOT be filtered by debug settings
if (this.settings.debugMode && window.logger) {
  window.logger.info(...); // Incorrect
}
```

See `docs/technical/LOGGING.md` for the full logging specification.

### Comments

```javascript
// ✅ GOOD – explanatory comments
/**
 * Parse a harvestable packet (operation 21)
 * @param {Buffer} data - Packet data
 * @returns {Object} Parsed harvestable object
 */
function parseHarvestable(data) {
  // ...
}

// ❌ BAD – obvious comments
// This function parses harvestables
function parseHarvestable(data) {
  // ...
}
```

---

## 🔁 Typical Workflows

### 1. Investigating a Bug

1. Inspect Git history with `mcp_git_git_log`.
2. Use code tools to locate the symbol: `mcp_serena_find_symbol`.
3. Find all references: `mcp_serena_find_referencing_symbols`.
4. Search for error patterns: `mcp_serena_search_for_pattern`.
5. Edit code using `replace_symbol_body` or JetBrains refactor tools.
6. Update `docs/project/TODO.md` or open a GitHub issue.

### 2. Adding a Feature

1. Explore the architecture (`docs/dev/DEV_GUIDE.md`).
2. Use `get_symbols_overview` on the main module.
3. Create a feature branch with Git MCP.
4. Implement with `insert_after_symbol` / `replace_symbol_body` or standard edits.
5. Update docs under `docs/`.
6. Commit with a clear message.

### 3. Refactoring

1. List usages with `find_referencing_symbols`.
2. Plan the refactor (optional internal notes/docs).
3. Rename via IDE refactor (`mcp_jetbrains_rename_refactoring`).
4. Run quick checks (lint/tests if available).

---

## 📌 Quick Tool Decision Table

| I want to…                           | Tool to use                             |
|--------------------------------------|-----------------------------------------|
| See classes/functions in a file      | `mcp_serena_get_symbols_overview`       |
| Find where a symbol is used          | `mcp_serena_find_referencing_symbols`   |
| Replace a whole method implementation| `mcp_serena_replace_symbol_body`        |
| Add a method to a class              | `mcp_serena_insert_after_symbol`        |
| Search for a regex pattern           | `mcp_serena_search_for_pattern`         |
| See Git history                      | `mcp_git_git_log`                       |
| Create a branch                      | `mcp_git_git_create_branch`             |
| Get framework documentation          | `mcp_augments_get_framework_docs`       |

---

## ✅ Checklist Before Each Action

- [ ] Am I following the code style (CommonJS, 2 spaces, single quotes)?
- [ ] Can I use symbolic tools instead of raw file reads?
- [ ] Am I avoiding temporary Markdown files at the repo root?
- [ ] Did I update or consult the relevant docs in `docs/`?
- [ ] Should this change be reflected in `TODO.md` or as a GitHub issue?

---

## 📚 Related Documentation

- **[`MCP_TOOLS.md`](./MCP_TOOLS.md)** – Full MCP tools reference
- **[`DEV_GUIDE.md`](../dev/DEV_GUIDE.md)** – Project development guide
- **[`LOGGING.md`](../technical/LOGGING.md)** – Logging system v2.2

---

## 🧠 When in Doubt

1. **Re-read this guide.**
2. Check `MCP_TOOLS.md` for the right tool.
3. Prefer symbolic/code-aware tools over raw text reads.
4. If a decision impacts behavior, make sure it is documented in `docs/`.

---

*"An effective agent uses the right tools at the right time."*
