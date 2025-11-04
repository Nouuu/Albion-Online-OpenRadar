# 📚 DOCUMENTATION ORGANIZATION

⚠️ **STRICT RULES**:
1. **DO NOT create new documentation files!**
   - Use only the 4 existing files
   - No temporary files (WORKING_*, *_FIX.md, etc.)
   - New info goes to DEV_NOTES.md or TODO.md

2. **DO NOT create multiple work files!**
   - No WORKING_DOCUMENT_*.md
   - No *_ANALYSIS.md
   - One single source of truth per subject

3. **NO hardcoded TypeID exceptions!**
   - No static mappings in code
   - Use only MobsInfo.js (database)
   - localStorage learning system is the only acceptable exception

This project contains 4 documentation files:

---

## 📄 Main Files

### 🎯 [README.md](README.md)
**For**: End users  
**Content**: Usage guide, installation, features

### 📋 [TODO.md](TODO.md)
**For**: Developers  
**Content**: Task list, progress status, next steps (concise)

### 📝 [DEV_NOTES.md](DEV_NOTES.md)
**For**: Developers  
**Content**: Complete technical documentation, architecture, known bugs, changelog, **build system**

### 💬 [CLAUDE.md](CLAUDE.md)
**For**: AI Context  
**Content**: Development notes with Claude AI (history)

### 🛠️ [tools/](tools/)
**For**: Developers  
**Content**: TypeID analysis scripts, log verification, diagnostic tools

---

## 🔍 Where to Find What?

| I'm looking for...               | Document            |
|----------------------------------|---------------------|
| How to use the radar             | README.md           |
| Project progress                 | TODO.md             |
| **Current priorities**           | **TODO.md**         |
| **TypeID collection guide**      | **TODO.md**         |
| **Current project state**        | **TODO.md**         |
| Technical details                | DEV_NOTES.md        |
| Code architecture                | DEV_NOTES.md        |
| Known bugs                       | DEV_NOTES.md        |
| TypeID mappings                  | DEV_NOTES.md        |
| Reflections & Solutions          | DEV_NOTES.md        |
| Why auto-learning failed         | DEV_NOTES.md        |
| **Build system**                 | **DEV_NOTES.md**    |
| **Cross-platform builds**        | **DEV_NOTES.md**    |
| **TypeID Analysis / Logs**       | **tools/**          |
| Verification scripts             | tools/              |
| Changelog                        | DEV_NOTES.md        |
| AI development history           | CLAUDE.md           |

---

## 🎯 CURRENT PRIORITIES

### ✅ COMPLETED
- ✅ MobsInfo_Enriched.js merged (235 TypeIDs)
- ✅ Field corrections applied (6 TypeID)
- ✅ No duplicates, clean code
- ✅ Build system optimized (53 MB exe)
- ✅ Multi-format archives (ZIP, TAR.GZ)
- ✅ Cross-platform builds (Windows, Linux, macOS)
- ✅ Lossless image optimization (dist/ only, preserves sources)
- ✅ All-in-one build command (automated workflow)
- ✅ Complete build scripts (Makefile, build.bat)
- ✅ GitHub Actions CI/CD pipelines (tests, build, release)

### 🚀 BUILD SYSTEM COMMANDS

**Windows (CMD - Recommended):**
```cmd
.\build.bat all-in-one    # 🌟 Complete automated build (preserves optimized images)
.\build.bat build:all     # Build all platforms
.\build.bat clean         # Clean but preserve optimized images ⚡
.\build.bat clean:all     # Force full clean (re-optimize next time)
.\build.bat optimize      # Optimize images in dist/ (manual step)
```

**Unix/Linux/macOS/WSL/Git Bash:**
```bash
make all-in-one          # 🌟 Complete automated build (preserves optimized images)
make build-all           # Build all platforms
make clean               # Clean but preserve optimized images ⚡
make clean-all           # Force full clean (re-optimize next time)
make optimize-images     # Optimize images in dist/ (manual step)
```

**Optimization Note**: 
- **Smart caching**: Images optimized once, preserved across builds ⚡
- **Marker system**: `dist/images/.optimized` tracks optimization state
- **Fast rebuilds**: `all-in-one` and `clean` preserve optimized images
- **First build**: Optimizes images automatically (2-3 min)
- **Subsequent builds**: Skips optimization (already done) - 50% faster!
- `all-in-one` automatically optimizes images on first build only
- **Integrated workflow**: Copy assets → Optimize images (95% quality) → Create archives
- **Near-lossless** compression using sharp (imperceptible loss)
- **Fast**: 2-3 minutes for 6693 files (parallel processing)
- **Result**: Archives ~70% smaller (602 MB → 180 MB images)
  - Windows: ~212 MB (vs ~630 MB before)
  - Linux/macOS: ~215 MB (vs ~635 MB before)
- **ZIP only**: Simplified to one format per platform
- Force re-optimization: `build.bat clean:all` or `make clean-all`

---

## 🤖 GITHUB ACTIONS CI/CD

### Automated Workflows

**CI - Tests & Lint** (`ci.yml`)
- Triggers: Pull Requests, Push to develop
- Platforms: Ubuntu, Windows, macOS
- Actions: Lint, Tests, Build check

**Build - Multi-platform** (`build.yml`)
- Triggers: Push to main, Manual
- Platforms: All (Windows, Linux, macOS)
- Actions: Full build with optimization, Upload artifacts

**Release** (`release.yml`)
- Triggers: Git tags `v*.*.*`, Manual
- Actions: Build, Optimize, Create GitHub Release
- Uploads: 3 ZIP archives (~212-215 MB each)

### Quick Start

**Create a release:**
```bash
git tag v1.0.0
git push origin v1.0.0
```

**Manual trigger:**
1. Go to Actions tab
2. Select workflow
3. Click "Run workflow"

> 📖 **Full details in [.github/README.md](.github/README.md)**

### 🔴 Short term (P1)
1. **Long field session** for validation
2. Analyze Fiber/Hide detection stability
3. Collect missing enchanted TypeIDs
4. Test executables on Linux/macOS

### 🟠 Medium term (P2)
- Create release with optimized images
- Decide if EventNormalizer needed
- Improve enchanted resources detection

### 🟡 Long term (P3)
- Metrics & monitoring
- CI/CD automation

> 📖 **Full details in [TODO.md](TODO.md)**

---

## 📦 Recommended Structure

```
Documentation/
├── README.md           ← User guide
├── TODO.md             ← Tasks (short)
├── DEV_NOTES.md        ← Dev documentation (detailed + build)
└── CLAUDE.md           ← AI Context

Code/
├── scripts/
├── views/
└── tests/
```

---

**Last update**: 2025-11-03 (visual fixes + functional stats)

