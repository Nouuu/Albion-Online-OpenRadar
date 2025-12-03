# 🛠️ Build Guide - OpenRadar

Guide to build OpenRadar as Windows executable (.exe).

## Prerequisites

- Node.js v24.11.1
- Python 3.10.2 + Visual Studio Build Tools (for native modules cap.node)
- Npcap 1.84 or newer
- GNU Make (optional: WSL, Git Bash, or `choco install make`)

## Quick Start

### ✅ Méthode Recommandée (npm scripts)

```bash
npm install           # Install dependencies
npm run check         # Check system
npm run build:win     # Build Windows exe
npm run release       # Build + create release ZIP
```

**Advantages:** Works everywhere, no need for Make or batch scripts.

### Makefile (Unix/Linux/macOS/Windows with Make)

**Note:** The `build.bat` and `Makefile` scripts are in the `build/` folder.  
The `build-helper.bat` wrapper calls them from the root.

## Makefile Commands

| Command           | Description                                                    |
|-------------------|----------------------------------------------------------------|
| `make help`       | Display help with all commands                                 |
| `make install`    | Install all npm dependencies + rebuild native modules          |
| `make check`      | Check Node.js, npm, Npcap, compiled native modules             |
| `make start`      | Run OpenRadar in development mode (node app.js)                |
| `make dev`        | Run with auto-reload (nodemon)                                 |
| `make build`      | Build Windows executable (dist/OpenRadar.exe)                  |
| `make build-all`  | Build for Windows AND Linux                                    |
| `make clean`      | Remove dist/, build/temp/, *.log                               |
| `make clean-all`  | clean + remove node_modules                                    |
| `make rebuild`    | clean + install + build (complete rebuild)                     |
| `make package`    | Create release ZIP (OpenRadar-YYYYMMDD.zip)                    |
| `make release`    | rebuild + package (complete release)                           |
| `make test-build` | Verify that .exe was created                                   |
| `make info`       | Display project information                                    |

## npm Commands

| Command                  | Description                   |
|--------------------------|-------------------------------|
| `npm start`              | Run OpenRadar (node app.js)   |
| `npm run dev`            | Development mode with nodemon |
| `npm run check`          | Check system dependencies     |
| `npm run build:win`      | Build for Windows x64         |
| `npm run build:all`      | Build Windows + Linux         |
| `npm run clean`          | Clean dist/ and logs          |
| `npm run clean:all`      | Clean + remove node_modules   |
| `npm run rebuild:native` | Rebuild cap                   |
| `npm run package`        | Create release ZIP            |
| `npm run release`        | build:win + package           |

## Build Output

The build creates in `dist/`:

- **OpenRadar.exe**: Standalone Windows executable (contains Node.js + code + assets + native modules)
- **README.txt**: Installation instructions for end user
- **OpenRadar-YYYYMMDD.zip**: Release archive (created by `make package` or `make release`)

The `.exe` is **completely standalone** and contains:

- Node.js v18 runtime
- All source code
- Assets (views/, scripts/, images/, sounds/)
- Native modules (cap.node)

## pkg Configuration

Config in `package.json` specifies:

- **Target**: node18-win-x64
- **Included assets**: views/, scripts/, images/, sounds/, native modules
- **Compression**: GZip
- **Entry point**: app.js

## Troubleshooting

**Error "Cannot find module 'cap'"**

```bash
npm rebuild cap
```

**node-gyp fails**

- Verify Python 3.10.2 is installed
- Verify Visual Studio Build Tools are installed

```bash
npm config set python "C:\Python310\python.exe"
npm config set msvs_version 2022
```

**The .exe doesn't start**

- Install Npcap 1.84 or newer (REQUIRED)
- Run as administrator (required for network capture)
- Check antivirus (may block)

