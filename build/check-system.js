#!/usr/bin/env node
/**
 * check-system.js
 * Vérifie que toutes les dépendances système sont installées
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REQUIRED_NODE_VERSION = '18.18.2';
const REQUIRED_NPCAP_VERSION = '1.79';

let hasErrors = false;

console.log('\n🔍 Vérification des dépendances système...\n');

// Vérifier Node.js version
try {
    const nodeVersion = process.version.substring(1); // Enlever le 'v'
    console.log(`✓ Node.js: ${process.version}`);

    if (nodeVersion !== REQUIRED_NODE_VERSION) {
        console.warn(`⚠️  Version recommandée: v${REQUIRED_NODE_VERSION}`);
    }
} catch (error) {
    console.error('✗ Node.js non trouvé !');
    hasErrors = true;
}

// Vérifier npm
try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    console.log(`✓ npm: v${npmVersion}`);
} catch (error) {
    console.error('✗ npm non trouvé !');
    hasErrors = true;
}

// Vérifier les modules natifs
console.log('\n📦 Vérification des modules natifs...\n');

const nativeModules = [
    {
        name: 'cap',
        path: path.join(__dirname, '../node_modules/cap/build/Release/cap.node'),
        description: 'Module de capture réseau (essentiel)'
    },
    {
        name: 'node-sass',
        path: path.join(__dirname, '../node_modules/node-sass/vendor'),
        description: 'Compilation SASS'
    }
];

nativeModules.forEach(mod => {
    if (fs.existsSync(mod.path)) {
        console.log(`✓ ${mod.name}: Module natif compilé`);
    } else {
        console.error(`✗ ${mod.name}: Module natif manquant !`);
        console.error(`  → Exécutez: npm rebuild ${mod.name}`);
        hasErrors = true;
    }
});

// Vérifier Npcap sur Windows
if (process.platform === 'win32') {
    console.log('\n🔌 Vérification de Npcap (Windows)...\n');

    try {
        // Vérifier dans le registre Windows (compatible WSL avec reg.exe)
        const regCommand = process.env.WINDIR
            ? 'reg.exe query "HKLM\\SOFTWARE\\Npcap"'
            : 'reg query "HKLM\\SOFTWARE\\Npcap"';

        const regOutput = execSync(regCommand, { encoding: 'utf8', stdio: 'pipe' });
        console.log(`✓ Npcap installé`);

        // Essayer d'extraire la version si disponible
        const versionMatch = regOutput.match(/Version\s+REG_SZ\s+([\d.]+)/);
        if (versionMatch) {
            console.log(`  Version détectée: ${versionMatch[1]}`);
        }
        console.log(`  Note: Version ${REQUIRED_NPCAP_VERSION}+ recommandée`);
    } catch (error) {
        // Vérifier aussi WinPcap comme fallback
        try {
            const regCommand = process.env.WINDIR
                ? 'reg.exe query "HKLM\\SOFTWARE\\WinPcap"'
                : 'reg query "HKLM\\SOFTWARE\\WinPcap"';
            execSync(regCommand, { encoding: 'utf8', stdio: 'pipe' });
            console.log(`⚠️  WinPcap détecté (ancien)`);
            console.log(`  → Recommandé: Installer Npcap ${REQUIRED_NPCAP_VERSION}+ à la place`);
        } catch {
            console.warn('⚠️  Npcap non détecté dans le registre');
            console.warn(`  Note: Si Npcap est installé, ce warning peut être ignoré`);
            console.warn(`  → Vérifiez manuellement ou téléchargez: https://npcap.com/dist/npcap-${REQUIRED_NPCAP_VERSION}.exe`);
            // Ne pas marquer comme erreur fatale si l'utilisateur dit qu'il l'a
        }
    }
} else {
    console.log('\n⚠️  Plateforme: ' + process.platform);
    console.log('   Note: Npcap est requis uniquement sur Windows');
}

// Vérifier les outils de build
console.log('\n🛠️  Vérification des outils de build...\n');

// Python (requis pour node-gyp)
try {
    const pythonVersion = execSync('python --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
    console.log(`✓ Python: ${pythonVersion}`);
} catch (error) {
    console.warn('⚠️  Python non trouvé (requis pour compiler les modules natifs)');
    console.warn('  → Recommandé: Python 3.10.2');
}

// Vérifier pkg pour le build
const pkgInstalled = fs.existsSync(path.join(__dirname, '../node_modules/pkg'));
if (pkgInstalled) {
    console.log(`✓ pkg: Installé (outil de packaging)`);
} else {
    console.log(`⚠️  pkg: Non installé (sera installé si nécessaire)`);
}

// Résumé
console.log('\n' + '='.repeat(50));
if (hasErrors) {
    console.log('✗ Certaines dépendances manquent !');
    console.log('\nActions recommandées:');
    console.log('  1. Vérifiez Node.js v18.18.2');
    console.log('  2. Installez Npcap 1.79 (Windows)');
    console.log('  3. Exécutez: npm install');
    console.log('  4. Exécutez: npm rebuild cap node-sass');
    console.log('='.repeat(50) + '\n');
    process.exit(1);
} else {
    console.log('✓ Toutes les dépendances essentielles sont OK !');
    console.log('='.repeat(50) + '\n');
    process.exit(0);
}