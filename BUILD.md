# 🛠️ Build Guide - ZQRadar

Guide pour builder ZQRadar en exécutable Windows (.exe).

## Prérequis

- Node.js v18.18.2
- Python 3.10.2 + Visual Studio Build Tools (pour modules natifs cap.node et node-sass)
- Npcap 1.84 or newer
- GNU Make (optionnel : WSL, Git Bash, ou `choco install make`)

## Quick Start

### Avec Makefile (recommandé si vous avez make)

```bash
make install      # Installer les dépendances
make check        # Vérifier le système
make build        # Builder ZQRadar.exe
make release      # Build + créer ZIP de release
```

### Sans Make (Windows CMD/PowerShell)

```bash
build.bat install   # Installer les dépendances
build.bat check     # Vérifier le système
build.bat build     # Builder ZQRadar.exe
build.bat release   # Build + créer ZIP de release
```

### Avec npm directement

```bash
npm install
npm run check
npm run build:win
npm run release
```

## Commandes Makefile

| Commande          | Description                                                   |
|-------------------|---------------------------------------------------------------|
| `make help`       | Afficher l'aide avec toutes les commandes                     |
| `make install`    | Installer toutes les dépendances npm + rebuild modules natifs |
| `make check`      | Vérifier Node.js, npm, Npcap, modules natifs compilés         |
| `make start`      | Lancer ZQRadar en mode développement (node app.js)            |
| `make dev`        | Lancer avec auto-reload (nodemon)                             |
| `make build`      | Builder l'exécutable Windows (dist/ZQRadar.exe)               |
| `make build-all`  | Builder pour Windows ET Linux                                 |
| `make clean`      | Supprimer dist/, build/temp/, *.log                           |
| `make clean-all`  | clean + supprimer node_modules                                |
| `make rebuild`    | clean + install + build (rebuild complet)                     |
| `make package`    | Créer le ZIP de release (ZQRadar-YYYYMMDD.zip)                |
| `make release`    | rebuild + package (release complète)                          |
| `make test-build` | Vérifier que le .exe a été créé                               |
| `make info`       | Afficher les infos du projet                                  |

## Commandes npm

| Commande                 | Description                       |
|--------------------------|-----------------------------------|
| `npm start`              | Lancer ZQRadar (node app.js)      |
| `npm run dev`            | Mode développement avec nodemon   |
| `npm run check`          | Vérifier les dépendances système  |
| `npm run build:win`      | Builder pour Windows x64          |
| `npm run build:all`      | Builder Windows + Linux           |
| `npm run clean`          | Nettoyer dist/ et logs            |
| `npm run clean:all`      | Nettoyer + supprimer node_modules |
| `npm run rebuild:native` | Rebuild cap et node-sass          |
| `npm run package`        | Créer le ZIP de release           |
| `npm run release`        | build:win + package               |

## Résultat du Build

Le build crée dans `dist/` :

- **ZQRadar.exe** : Exécutable Windows standalone (contient Node.js + code + assets + modules natifs)
- **README.txt** : Instructions d'installation pour l'utilisateur final
- **ZQRadar-YYYYMMDD.zip** : Archive de release (créée par `make package` ou `make release`)

Le `.exe` est **totalement autonome** et contient :

- Node.js v18 runtime
- Tout le code source
- Assets (views/, scripts/, images/, sounds/)
- Modules natifs (cap.node, node-sass)

## Configuration pkg

La config dans `package.json` spécifie :

- **Cible** : node18-win-x64
- **Assets inclus** : views/, scripts/, images/, sounds/, modules natifs
- **Compression** : GZip
- **Point d'entrée** : app.js

## Troubleshooting

**Erreur "Cannot find module 'cap'"**

```bash
npm rebuild cap node-sass
```

**node-gyp échoue**

- Vérifier Python 3.10.2 installé
- Vérifier Visual Studio Build Tools installés

```bash
npm config set python "C:\Python310\python.exe"
npm config set msvs_version 2022
```

**Le .exe ne démarre pas**

- Installer Npcap 1.84 ou plus récent (OBLIGATOIRE)
- Lancer en tant qu'administrateur (requis pour capture réseau)
- Vérifier l'antivirus (peut bloquer)