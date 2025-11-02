# GitHub Actions Workflows

This directory contains automated CI/CD pipelines for ZQRadar.

## 📋 Workflows

### 1. CI - Tests & Lint (`ci.yml`)
**Trigger**: Pull Requests to `main` or `develop`, Push to `develop`

**What it does**:
- Runs on: Ubuntu, Windows, macOS
- Checks Node.js version compatibility
- Installs dependencies
- Runs linting (if available)
- Runs tests (if available)
- Verifies build works (Linux only for speed)

**Use case**: Ensure code quality before merging PRs

---

### 2. Build - Multi-platform (`build.yml`)
**Trigger**: Push to `main`, Manual dispatch

**What it does**:
- Builds for Windows, Linux, macOS
- Optimizes images (602 MB → 180 MB, 70% compression)
- Creates ZIP archives (~212-215 MB each)
- Uploads artifacts (30 days retention)
- Displays build summary

**Artifacts**:
- `ZQRadar-Windows` - Windows ZIP
- `ZQRadar-Linux` - Linux ZIP
- `ZQRadar-macOS` - macOS ZIP

**Use case**: Test complete build process

---

### 3. Release (`release.yml`)
**Trigger**: Git tags `v*.*.*`, Manual dispatch

**What it does**:
- Complete build for all platforms
- Optimizes images automatically
- Creates GitHub Release
- Uploads all ZIP archives
- Generates release notes with:
  - Download links
  - Installation instructions
  - Features highlights
  - Requirements

**Example**:
```bash
# Create a release
git tag v1.0.0
git push origin v1.0.0
```

Or use manual dispatch with version input.

**Use case**: Automated release publishing

---

## 🔧 Manual Trigger

All workflows can be triggered manually from GitHub Actions tab:
1. Go to **Actions** tab
2. Select workflow
3. Click **Run workflow**
4. Fill inputs (if any)
5. Click **Run workflow**

---

## 📦 Build Process

All workflows use the same optimized build process:

```yaml
1. Install dependencies (npm ci)
2. Rebuild native modules (cap, node-sass)
3. Install build tools (pkg, archiver, sharp)
4. Build executables (npm run build:all)
5. Post-build:
   - Copy assets
   - Optimize images (sharp, 95% quality)
   - Create archives
```

**Result**:
- Windows: ~212 MB
- Linux: ~215 MB
- macOS: ~215 MB

---

## 🎯 Requirements

### Secrets
No secrets required for basic workflows.

### Permissions
- `contents: write` - For creating releases (release.yml)
- `packages: write` - For uploading artifacts

---

## 📝 Notes

### Image Optimization
- Integrated in post-build.js
- Quality: 95% (near-lossless)
- Compression: 70% (602 MB → 180 MB)
- Time: ~2-3 minutes

### Native Modules
- `cap.node` may fail on non-Windows runners
- `node-sass` may fail on some platforms
- Both use `continue-on-error: true`

### Archive Formats
- ZIP only (simplified from ZIP + TAR.GZ)
- Compatible with all platforms
- Optimized compression level 9

---

## 🚀 Quick Start

### For Pull Requests
1. Create PR → CI runs automatically
2. Check CI results before merge

### For Releases
1. Update version in package.json
2. Create git tag: `git tag v1.0.0`
3. Push tag: `git push origin v1.0.0`
4. Release workflow runs automatically
5. Check GitHub Releases page

---

**Last update**: 2025-11-02

