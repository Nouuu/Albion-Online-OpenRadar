#!/usr/bin/env node
/**
 * post-build.js
 * Script exécuté après le build pkg pour copier les assets nécessaires
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '../dist');

console.log('\n📦 Post-build: Vérification des assets...\n');

// Vérifier que le build a été créé
if (!fs.existsSync(DIST_DIR)) {
    console.error('✗ Dossier dist/ non trouvé !');
    console.error('  Le build pkg a peut-être échoué.');
    process.exit(1);
}

// Vérifier que l'exécutable existe
const exePath = path.join(DIST_DIR, 'ZQRadar.exe');
if (fs.existsSync(exePath)) {
    const stats = fs.statSync(exePath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`✓ ZQRadar.exe créé (${sizeMB} MB)`);
} else {
    console.error('✗ ZQRadar.exe non trouvé dans dist/');
    process.exit(1);
}

// Créer un fichier README pour le dist
const readmeContent = `# ZQRadar - Albion Online Radar

## Installation

1. **Installez Npcap 1.79** (REQUIS)
   Téléchargez: https://npcap.com/dist/npcap-1.79.exe

2. **Lancez ZQRadar.exe**
   Double-cliquez sur ZQRadar.exe

3. **Sélectionnez votre adaptateur réseau**
   Choisissez l'adaptateur que vous utilisez pour vous connecter à Internet
   (NE PAS choisir 127.0.0.1)

4. **Accédez au radar**
   Ouvrez http://localhost:5001 dans votre navigateur

## Prérequis

- Windows 10/11
- Npcap 1.79 installé
- Connexion Internet pour jouer à Albion Online

## Support

Discord: https://discord.gg/XAWjmzeaD3
GitHub: https://github.com/Zeldruck/Albion-Online-ZQRadar

## Note

Ce build inclut tous les assets nécessaires (views, scripts, images, sons).
Les modules natifs (cap.node) sont intégrés dans l'exécutable.
`;

fs.writeFileSync(path.join(DIST_DIR, 'README.txt'), readmeContent, 'utf8');
console.log('✓ README.txt créé dans dist/');

console.log('\n✓ Post-build terminé !\n');
console.log('Fichiers dans dist/:');
console.log('  - ZQRadar.exe');
console.log('  - README.txt');
console.log('\nNote: Les assets (views, scripts, images) sont intégrés dans le .exe\n');