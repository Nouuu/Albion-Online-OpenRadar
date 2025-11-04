#!/usr/bin/env node
/**
 * check-system.js
 * Vérifie que toutes les dépendances système sont installées
 */

const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const REQUIRED_NODE_VERSION = '18.18.2';
const REQUIRED_NPCAP_VERSION = '1.84';

// Helper: compare semantic versions (returns -1 if a<b, 0 if equal, 1 if a>b)
function compareVersions(a, b) {
    const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
    const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na > nb) return 1;
        if (na < nb) return -1;
    }
    return 0;
}

// Exécuter les contrôles stricts seulement si on est dans l'exécutable packagé (pkg)
const isPackaged = !!process.pkg;
const strictMode = isPackaged; // strictMode = true uniquement dans l'exécutable final

let hasErrors = false;

console.log('\n🔍 Vérification des dépendances système...\n');
if (!strictMode) {
    console.log('⚠️  Mode développement détecté — les contrôles stricts (Npcap >= ' + REQUIRED_NPCAP_VERSION + ') sont désactivés.');
    console.log('   Ces vérifications s\'exécuteront uniquement dans l\'exécutable packagé.\n');
}

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
    const npmVersion = execSync('npm --version', {encoding: 'utf8'}).trim();
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
        const msg = `✗ ${mod.name}: Module natif manquant !`;
        if (strictMode) {
            console.error(msg);
            console.error(`  → Exécutez: npm rebuild ${mod.name}`);
            hasErrors = true;
        } else {
            console.warn(msg);
            console.warn(`  → En dev: exécutez si besoin 'npm rebuild ${mod.name}'`);
        }
    }
});

// Vérifier Npcap sur Windows
if (process.platform === 'win32') {
    if (!strictMode) {
        console.log('\n🔌 Vérification Npcap: sautée en mode développement (vérification stricte activée dans l\'exe).\n');
    } else {
        console.log('\n🔌 Vérification de Npcap (Windows)...\n');

        try {
            // Vérifier dans le registre Windows (compatible WSL avec reg.exe)
            const regCommand = process.env.WINDIR
                ? 'reg.exe query "HKLM\\SOFTWARE\\Npcap"'
                : 'reg query "HKLM\\SOFTWARE\\Npcap"';

            const regOutput = execSync(regCommand, {encoding: 'utf8', stdio: 'pipe'});
            console.log(`✓ Npcap installé`);

            // Essayer d'extraire la version si disponible
            const versionMatch = regOutput.match(/Version\s+REG_SZ\s+([\d.]+)/);
            if (versionMatch) {
                const detected = versionMatch[1];
                console.log(`  Version détectée: ${detected}`);
                const cmp = compareVersions(detected, REQUIRED_NPCAP_VERSION);
                if (cmp < 0) {
                    console.error(`✗ Npcap version ${detected} détectée — version minimale requise: ${REQUIRED_NPCAP_VERSION}`);
                    console.error(`  → Mettez à jour Npcap: https://npcap.com/`);
                    hasErrors = true;
                } else {
                    console.log(`  Note: Version ${REQUIRED_NPCAP_VERSION}+ recommandée — OK`);
                }
            } else {
                console.warn('⚠️  Npcap détecté mais impossible de lire la version depuis le registre');
                console.warn(`  → Vérifiez manuellement que Npcap >= ${REQUIRED_NPCAP_VERSION} est installé: https://npcap.com/`);
                // En CI / exécutable strict, considérer cela comme une erreur
                hasErrors = true;
            }
        } catch (error) {
            // Vérifier aussi WinPcap comme fallback
            try {
                const regCommand = process.env.WINDIR
                    ? 'reg.exe query "HKLM\\SOFTWARE\\WinPcap"'
                    : 'reg query "HKLM\\SOFTWARE\\WinPcap"';
                execSync(regCommand, {encoding: 'utf8', stdio: 'pipe'});
                console.log(`⚠️  WinPcap détecté (ancien)`);
                console.log(`  → Recommandé: Installer Npcap ${REQUIRED_NPCAP_VERSION}+ à la place`);
                hasErrors = true;
            } catch {
                console.warn('⚠️  Npcap non détecté dans le registre');
                console.warn(`  Note: Si Npcap est installé, ce warning peut être ignoré`);
                console.warn(`  → Vérifiez manuellement ou téléchargez: https://npcap.com/dist/npcap-${REQUIRED_NPCAP_VERSION}.exe`);
                // Marquer comme erreur en CI strict
                hasErrors = true;
            }
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
    const pythonVersion = execSync('python --version', {encoding: 'utf8', stdio: 'pipe'}).trim();
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
    if (!strictMode) {
        console.log('⚠️  Certaines dépendances manquent, mais vous êtes en mode développement — le script ne bloque pas ici.');
        console.log('Actions recommandées:');
        console.log('  1. Vérifiez Node.js v18.18.2');
        console.log(`  2. Installez Npcap ${REQUIRED_NPCAP_VERSION} (Windows) si vous prévoyez d\'exécuter l\'exécutable)`);
        console.log('  3. Exécutez: npm install');
        console.log('  4. Exécutez: npm rebuild cap node-sass');
        console.log('='.repeat(50) + '\n');
        process.exit(0);
    }

    console.log('✗ Certaines dépendances manquent !');
    console.log('\nActions recommandées:');
    console.log('  1. Vérifiez Node.js v18.18.2');
    console.log(`  2. Installez Npcap ${REQUIRED_NPCAP_VERSION} (Windows)`);
    console.log('  3. Exécutez: npm install');
    console.log('  4. Exécutez: npm rebuild cap node-sass');
    console.log('='.repeat(50) + '\n');
    process.exit(1);
} else {
    console.log('✓ Toutes les dépendances essentielles sont OK !');
    console.log('='.repeat(50) + '\n');
    process.exit(0);
}
