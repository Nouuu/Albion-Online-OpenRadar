#!/usr/bin/env node
/**
 * create-release.js
 * Crée un package ZIP de release avec tous les fichiers nécessaires
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const DIST_DIR = path.join(__dirname, '../dist');
const RELEASE_NAME = `ZQRadar-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
const RELEASE_DIR = path.join(DIST_DIR, RELEASE_NAME);

console.log('\n📦 Création du package de release...\n');

// Vérifier que l'exécutable existe
const exePath = path.join(DIST_DIR, 'ZQRadar.exe');
if (!fs.existsSync(exePath)) {
    console.error('✗ ZQRadar.exe non trouvé !');
    console.error('  Exécutez "npm run build:win" d\'abord.');
    process.exit(1);
}

// Créer le dossier de release
if (!fs.existsSync(RELEASE_DIR)) {
    fs.mkdirSync(RELEASE_DIR, { recursive: true });
}

// Copier les fichiers essentiels
console.log('📁 Copie des fichiers...\n');

const filesToCopy = [
    { src: exePath, dest: 'ZQRadar.exe' },
    { src: path.join(__dirname, '../README.md'), dest: 'README.md' },
    { src: path.join(__dirname, '../zqradar.ico'), dest: 'zqradar.ico', optional: true }
];

filesToCopy.forEach(file => {
    const destPath = path.join(RELEASE_DIR, file.dest);

    if (fs.existsSync(file.src)) {
        fs.copyFileSync(file.src, destPath);
        console.log(`✓ ${file.dest}`);
    } else if (!file.optional) {
        console.error(`✗ ${file.src} non trouvé !`);
        process.exit(1);
    }
});

// Créer un fichier INSTALL.txt avec les instructions
const installInstructions = `╔════════════════════════════════════════════════════════════╗
║                    ZQRadar - Installation                  ║
╚════════════════════════════════════════════════════════════╝

📋 ÉTAPES D'INSTALLATION :

1. Installer Npcap 1.84 (OBLIGATOIRE)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Téléchargez depuis : https://npcap.com/
   Lien direct (optionnel) : https://npcap.com/dist/npcap-1.84.exe

   ⚠️  IMPORTANT : Sans Npcap (version 1.84+), ZQRadar ne pourra pas capturer
       les paquets réseau et ne fonctionnera pas !

2. Lancer ZQRadar
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Double-cliquez sur ZQRadar.exe

3. Sélectionner l'adaptateur réseau
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Choisissez l'adaptateur réseau que vous utilisez pour vous
   connecter à Internet.

   ⚠️  NE PAS sélectionner 127.0.0.1 (localhost)

4. Accéder au radar
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Ouvrez votre navigateur et allez à :

   👉 http://localhost:5001

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 PRÉREQUIS :

   • Windows 10 ou 11
   • Npcap 1.84 ou plus récent installé
   • Albion Online en cours d'exécution

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🆘 SUPPORT :

   Discord  : https://discord.gg/XAWjmzeaD3
   GitHub   : https://github.com/Zeldruck/Albion-Online-ZQRadar
   Issues   : https://github.com/Zeldruck/Albion-Online-ZQRadar/issues

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 NOTES TECHNIQUES :

   • Tous les assets (views, scripts, images, sons) sont intégrés
     dans ZQRadar.exe - aucun autre fichier n'est nécessaire !

   • Les modules natifs (cap.node pour la capture réseau) sont
     également intégrés dans l'exécutable

   • Le fichier ip.txt sera créé automatiquement lors de la
     première exécution pour sauvegarder votre choix d'adaptateur

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Version : ${RELEASE_NAME}
Build   : ${new Date().toISOString()}

`;

fs.writeFileSync(path.join(RELEASE_DIR, 'INSTALL.txt'), installInstructions, 'utf8');
console.log('✓ INSTALL.txt\n');

// Créer l'archive ZIP
console.log('🗜️  Création de l\'archive ZIP...\n');

const zipPath = path.join(DIST_DIR, `${RELEASE_NAME}.zip`);
const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', {
    zlib: { level: 9 } // Compression maximale
});

output.on('close', () => {
    const sizeMB = (archive.pointer() / (1024 * 1024)).toFixed(2);
    console.log(`\n✓ Archive créée: ${RELEASE_NAME}.zip (${sizeMB} MB)`);
    console.log(`\n📍 Emplacement: ${zipPath}`);

    // Nettoyer le dossier temporaire
    fs.rmSync(RELEASE_DIR, { recursive: true, force: true });

    console.log('\n✅ Package de release créé avec succès !\n');
    console.log('Contenu du package:');
    console.log('  • ZQRadar.exe');
    console.log('  • README.md');
    console.log('  • INSTALL.txt');
    console.log('  • zqradar.ico (si disponible)\n');
});

archive.on('error', (err) => {
    console.error('\n✗ Erreur lors de la création de l\'archive !');
    console.error(err);
    process.exit(1);
});

archive.pipe(output);
archive.directory(RELEASE_DIR, false);
archive.finalize();