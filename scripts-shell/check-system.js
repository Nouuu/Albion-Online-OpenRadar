#!/usr/bin/env node
/**
 * check-system.js
 * Checks that all system dependencies are installed
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

// Execute strict checks only if we're in packaged executable (pkg)
const isPackaged = !!process.pkg;
const strictMode = isPackaged; // strictMode = true only in final executable

let hasErrors = false;

console.log('\n🔍 Checking system dependencies...\n');
if (!strictMode) {
    console.log('⚠️  Development mode detected — strict checks (Npcap >= ' + REQUIRED_NPCAP_VERSION + ') are disabled.');
    console.log('   These checks will only run in the packaged executable.\n');
}

// Check Node.js version
try {
    const nodeVersion = process.version.substring(1); // Remove the 'v'
    console.log(`✓ Node.js: ${process.version}`);

    if (nodeVersion !== REQUIRED_NODE_VERSION) {
        console.warn(`⚠️  Recommended version: v${REQUIRED_NODE_VERSION}`);
    }
} catch (error) {
    console.error('✗ Node.js not found!');
    hasErrors = true;
}

// Check npm
try {
    const npmVersion = execSync('npm --version', {encoding: 'utf8'}).trim();
    console.log(`✓ npm: v${npmVersion}`);
} catch (error) {
    console.error('✗ npm not found!');
    hasErrors = true;
}

// Check native modules
console.log('\n📦 Checking native modules...\n');

const nativeModules = [
    {
        name: 'cap',
        path: path.join(__dirname, '../node_modules/cap/build/Release/cap.node'),
        description: 'Network capture module (essential)'
    },
    {
        name: 'node-sass',
        path: path.join(__dirname, '../node_modules/node-sass/vendor'),
        description: 'SASS compilation'
    }
];

nativeModules.forEach(mod => {
    if (fs.existsSync(mod.path)) {
        console.log(`✓ ${mod.name}: Native module compiled`);
    } else {
        const msg = `✗ ${mod.name}: Native module missing!`;
        if (strictMode) {
            console.error(msg);
            console.error(`  → Run: npm rebuild ${mod.name}`);
            hasErrors = true;
        } else {
            console.warn(msg);
            console.warn(`  → In dev: run if needed 'npm rebuild ${mod.name}'`);
        }
    }
});

// Check Npcap on Windows
if (process.platform === 'win32') {
    if (!strictMode) {
        console.log('\n🔌 Npcap check: skipped in development mode (strict check enabled in exe).\n');
    } else {
        console.log('\n🔌 Checking Npcap (Windows)...\n');

        // Try multiple registry locations (native 64-bit and WOW6432Node for 32-bit apps on 64-bit Windows)
        const registryPaths = [
            'HKLM\\SOFTWARE\\Npcap',
            'HKLM\\SOFTWARE\\WOW6432Node\\Npcap'
        ];

        let npcapFound = false;
        for (const regPath of registryPaths) {
            try {
                const regCommand = process.env.WINDIR
                    ? `reg.exe query "${regPath}"`
                    : `reg query "${regPath}"`;

                const regOutput = execSync(regCommand, {encoding: 'utf8', stdio: 'pipe'});
                console.log(`✓ Npcap installed (from ${regPath})`);
                npcapFound = true;

                // Try to extract version if available
                const versionMatch = regOutput.match(/Version\s+REG_SZ\s+([\d.]+)/);
                if (versionMatch) {
                    const detected = versionMatch[1];
                    console.log(`  Detected version: ${detected}`);
                    const cmp = compareVersions(detected, REQUIRED_NPCAP_VERSION);
                    if (cmp < 0) {
                        console.error(`✗ Npcap version ${detected} detected — minimum required version: ${REQUIRED_NPCAP_VERSION}`);
                        console.error(`  → Update Npcap: https://npcap.com/`);
                        hasErrors = true;
                    } else {
                        console.log(`  Note: Version ${REQUIRED_NPCAP_VERSION}+ recommended — OK`);
                    }
                    break; // Version found, no need to check other registry paths
                } else {
                    console.log('  Npcap detected but unable to read version from registry');
                    console.log(`  → Assuming Npcap >= ${REQUIRED_NPCAP_VERSION} is installed`);
                    // Registry key exists, so assume it's OK
                    break;
                }
            } catch (error) {
                // Registry path not found, try next one
                continue;
            }
        }

        if (!npcapFound) {
            // Also check WinPcap as fallback
            try {
                const regCommand = process.env.WINDIR
                    ? 'reg.exe query "HKLM\\SOFTWARE\\WinPcap"'
                    : 'reg query "HKLM\\SOFTWARE\\WinPcap"';
                execSync(regCommand, {encoding: 'utf8', stdio: 'pipe'});
                console.log(`⚠️  WinPcap detected (legacy)`);
                console.log(`  → Recommended: Install Npcap ${REQUIRED_NPCAP_VERSION}+ instead`);
                hasErrors = true;
            } catch {
                console.warn('⚠️  Npcap not detected in registry');
                console.warn(`  Note: If Npcap is installed, this warning can be ignored`);
                console.warn(`  → Manually verify or download: https://npcap.com/dist/npcap-${REQUIRED_NPCAP_VERSION}.exe`);
                // Mark as error in strict CI
                hasErrors = true;
            }
        }
    }
} else {
    console.log('\n⚠️  Platform: ' + process.platform);
    console.log('   Note: Npcap is only required on Windows');
}

// Check build tools
console.log('\n🛠️  Checking build tools...\n');

// Python (required for node-gyp)
try {
    const pythonVersion = execSync('python --version', {encoding: 'utf8', stdio: 'pipe'}).trim();
    console.log(`✓ Python: ${pythonVersion}`);
} catch (error) {
    console.warn('⚠️  Python not found (required to compile native modules)');
    console.warn('  → Recommended: Python 3.10.2');
}

// Check pkg for build
const pkgInstalled = fs.existsSync(path.join(__dirname, '../node_modules/pkg'));
if (pkgInstalled) {
    console.log(`✓ pkg: Installed (packaging tool)`);
} else {
    console.log(`⚠️  pkg: Not installed (will be installed if needed)`);
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
    if (!strictMode) {
        console.log('⚠️  Some dependencies are missing, but you\'re in development mode — script won\'t block here.');
        console.log('Recommended actions:');
        console.log('  1. Check Node.js v18.18.2');
        console.log(`  2. Install Npcap ${REQUIRED_NPCAP_VERSION} (Windows) if you plan to run the executable)`);
        console.log('  3. Run: npm install');
        console.log('  4. Run: npm rebuild cap node-sass');
        console.log('='.repeat(50) + '\n');
        process.exit(0);
    }

    console.log('✗ Some dependencies are missing!');
    console.log('\nRecommended actions:');
    console.log('  1. Check Node.js v18.18.2');
    console.log(`  2. Install Npcap ${REQUIRED_NPCAP_VERSION} (Windows)`);
    console.log('  3. Run: npm install');
    console.log('  4. Run: npm rebuild cap node-sass');
    console.log('='.repeat(50) + '\n');
    process.exit(1);
} else {
    console.log('✓ All essential dependencies are OK!');
    console.log('='.repeat(50) + '\n');
    process.exit(0);
}
