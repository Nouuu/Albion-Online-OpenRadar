#!/usr/bin/env node
/**
 * check-system.js
 * Checks that all system dependencies are installed for development
 */

import { execSync } from "child_process";
import fs from 'fs';

const REQUIRED_GO_VERSION = '1.25';
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

let hasErrors = false;
let hasWarnings = false;

console.log('\n🔍 Checking system dependencies for OpenRadar development...\n');

// Check Go version
console.log('📦 Go Runtime:\n');
try {
    const goVersionOutput = execSync('go version', { encoding: 'utf8' }).trim();
    const versionMatch = goVersionOutput.match(/go(\d+\.\d+(\.\d+)?)/);
    if (versionMatch) {
        const goVersion = versionMatch[1];
        console.log(`  ✓ Go: ${goVersion}`);
        if (compareVersions(goVersion, REQUIRED_GO_VERSION) < 0) {
            console.warn(`  ⚠️  Recommended version: ${REQUIRED_GO_VERSION}+`);
            hasWarnings = true;
        }
    } else {
        console.log(`  ✓ Go: ${goVersionOutput}`);
    }
} catch {
    console.error('  ✗ Go not found!');
    console.error('    → Install Go: https://go.dev/dl/');
    hasErrors = true;
}

// Check Node.js (only needed for tooling scripts)
console.log('\n📦 Build Tools (optional):\n');
try {
    const nodeVersion = process.version;
    console.log(`  ✓ Node.js: ${nodeVersion} (for build scripts)`);
} catch {
    console.warn('  ⚠️  Node.js not found (only needed for build scripts)');
}

// Check npm
try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    console.log(`  ✓ npm: v${npmVersion}`);
} catch {
    console.warn('  ⚠️  npm not found (only needed for build scripts)');
}

// Check Make
try {
    execSync('make --version', { encoding: 'utf8', stdio: 'pipe' });
    console.log('  ✓ Make: installed');
} catch {
    console.warn('  ⚠️  Make not found (optional, use go commands directly)');
}

// Check Air (hot-reload tool)
try {
    execSync('air -v', { encoding: 'utf8', stdio: 'pipe' });
    console.log('  ✓ Air: installed (hot-reload)');
} catch {
    console.log('  ℹ️  Air not installed (install with: go install github.com/air-verse/air@latest)');
}

// Check Docker (for cross-compilation)
try {
    const dockerVersion = execSync('docker --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
    console.log(`  ✓ Docker: ${dockerVersion.replace('Docker version ', '').split(',')[0]}`);
} catch {
    console.log('  ℹ️  Docker not found (needed for Linux cross-compilation on Windows)');
}

// Platform-specific checks
if (process.platform === 'win32') {
    console.log('\n🔌 Windows Dependencies:\n');

    // Check Npcap
    const registryPaths = [
        'HKLM\\SOFTWARE\\Npcap',
        'HKLM\\SOFTWARE\\WOW6432Node\\Npcap'
    ];

    let npcapFound = false;
    for (const regPath of registryPaths) {
        try {
            const regOutput = execSync(`reg query "${regPath}"`, { encoding: 'utf8', stdio: 'pipe' });
            npcapFound = true;

            const versionMatch = regOutput.match(/Version\s+REG_SZ\s+([\d.]+)/);
            if (versionMatch) {
                const detected = versionMatch[1];
                console.log(`  ✓ Npcap: ${detected}`);
                if (compareVersions(detected, REQUIRED_NPCAP_VERSION) < 0) {
                    console.error(`    ✗ Minimum required: ${REQUIRED_NPCAP_VERSION}`);
                    console.error(`    → Update: https://npcap.com/`);
                    hasErrors = true;
                }
            } else {
                console.log('  ✓ Npcap: installed (version unknown)');
            }
            break;
        } catch {
            continue;
        }
    }

    if (!npcapFound) {
        console.error('  ✗ Npcap not found!');
        console.error(`    → Download: https://npcap.com/dist/npcap-${REQUIRED_NPCAP_VERSION}.exe`);
        hasErrors = true;
    }
} else if (process.platform === 'linux') {
    console.log('\n🔌 Linux Dependencies:\n');

    // Check libpcap
    try {
        execSync('ldconfig -p | grep libpcap', { encoding: 'utf8', stdio: 'pipe' });
        console.log('  ✓ libpcap: installed');
    } catch {
        console.error('  ✗ libpcap not found!');
        console.error('    → Ubuntu/Debian: sudo apt-get install libpcap-dev');
        console.error('    → Fedora/RHEL:   sudo dnf install libpcap-devel');
        console.error('    → Arch Linux:    sudo pacman -S libpcap');
        hasErrors = true;
    }

    // Check setcap (for running without root)
    try {
        execSync('which setcap', { encoding: 'utf8', stdio: 'pipe' });
        console.log('  ✓ setcap: installed');
    } catch {
        console.warn('  ⚠️  setcap not found (needed to run without root)');
        console.warn('    → Ubuntu/Debian: sudo apt-get install libcap2-bin');
        console.warn('    → Fedora/RHEL:   sudo dnf install libcap');
        console.warn('    → Arch Linux:    sudo pacman -S libcap');
    }

    // Check capabilities note
    console.log('\n📋 To run without root, grant capabilities:');
    console.log('    sudo setcap cap_net_raw,cap_net_admin=eip ./OpenRadar-linux');
}

// Check project structure
console.log('\n📁 Project Structure:\n');

const requiredPaths = [
    { path: 'cmd/radar/main.go', desc: 'Go entry point' },
    { path: 'internal/capture/pcap.go', desc: 'Packet capture' },
    { path: 'internal/photon', desc: 'Protocol parser' },
    { path: 'internal/server', desc: 'HTTP/WS servers' },
    { path: 'web/public/index.html', desc: 'Frontend' },
    { path: 'go.mod', desc: 'Go modules' },
    { path: 'Makefile', desc: 'Build system' }
];

for (const { path: p, desc } of requiredPaths) {
    if (fs.existsSync(p)) {
        console.log(`  ✓ ${p}`);
    } else {
        console.warn(`  ⚠️  Missing: ${p} (${desc})`);
        hasWarnings = true;
    }
}

// Summary
console.log('\n' + '='.repeat(60));
if (hasErrors) {
    console.log('✗ Some required dependencies are missing!');
    console.log('\nRequired actions:');
    console.log('  1. Install Go 1.23+ from https://go.dev/dl/');
    if (process.platform === 'win32') {
        console.log(`  2. Install Npcap ${REQUIRED_NPCAP_VERSION}+ from https://npcap.com/`);
    } else if (process.platform === 'linux') {
        console.log('  2. Install libpcap-dev');
    }
    console.log('='.repeat(60) + '\n');
    process.exit(1);
} else if (hasWarnings) {
    console.log('⚠️  Some optional dependencies are missing (non-blocking)');
    console.log('='.repeat(60) + '\n');
    process.exit(0);
} else {
    console.log('✓ All dependencies are OK!');
    console.log('\nQuick start:');
    console.log('  make dev          # Start development server with hot-reload');
    console.log('  make build-win    # Build Windows executable');
    console.log('  make build-linux  # Build Linux executable (requires Docker)');
    console.log('='.repeat(60) + '\n');
    process.exit(0);
}