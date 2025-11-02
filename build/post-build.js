#!/usr/bin/env node
/**
 * post-build.js
 * Script executed after pkg build to copy necessary assets
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '../dist');

console.log('\n📦 Post-build: Checking assets...\n');

// Check if build was created
if (!fs.existsSync(DIST_DIR)) {
    console.error('✗ dist/ folder not found!');
    console.error('  pkg build may have failed.');
    process.exit(1);
}

// Check if executable exists
const exePath = path.join(DIST_DIR, 'ZQRadar.exe');
if (fs.existsSync(exePath)) {
    const stats = fs.statSync(exePath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`✓ ZQRadar.exe created (${sizeMB} MB)`);
} else {
    console.error('✗ ZQRadar.exe not found in dist/');
    process.exit(1);
}

// Create README file for dist
const readmeContent = `# ZQRadar - Albion Online Radar

## Installation

1. **Install Npcap 1.79** (REQUIRED)
   Download: https://npcap.com/dist/npcap-1.79.exe

2. **Launch ZQRadar.exe**
   Double-click on ZQRadar.exe

3. **Select your network adapter**
   Choose the adapter you use to connect to the Internet
   (DO NOT choose 127.0.0.1)

4. **Access the radar**
   Open http://localhost:5001 in your browser

## Prerequisites

- Windows 10/11
- Npcap 1.79 installed
- Internet connection to play Albion Online

## Support

Discord: https://discord.gg/XAWjmzeaD3
GitHub: https://github.com/Zeldruck/Albion-Online-ZQRadar

## Note

This build includes all necessary assets (views, scripts, images, sounds).
Native modules (cap.node) are integrated into the executable.
`;

fs.writeFileSync(path.join(DIST_DIR, 'README.txt'), readmeContent, 'utf8');
console.log('✓ README.txt created in dist/');

// Copy all assets next to the exe
// This approach makes the executable lighter and facilitates updates
const assetsToCopy = ['views', 'scripts', 'images', 'sounds', 'config'];

function copyRecursiveSync(src, dest) {
    if (!fs.existsSync(src)) {
        console.warn(`⚠ Source folder not found: ${src}`);
        return;
    }

    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyRecursiveSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log('\n📁 Copying assets next to executable...\n');

for (const asset of assetsToCopy) {
    const srcPath = path.join(__dirname, '..', asset);
    const destPath = path.join(DIST_DIR, asset);

    try {
        copyRecursiveSync(srcPath, destPath);
        console.log(`✓ ${asset}/ copied`);
    } catch (err) {
        console.error(`✗ Error copying ${asset}/:`, err.message);
    }
}

console.log('\n✓ Post-build completed!\n');
console.log('Files in dist/:');
console.log('  - ZQRadar.exe (lightweight - native modules only)');
console.log('  - README.txt');
console.log('  - views/');
console.log('  - scripts/');
console.log('  - images/');
console.log('  - sounds/');
console.log('  - config/');
console.log('\nNote: This approach makes the exe lighter and facilitates updates\n');

// Create compressed archive
console.log('\n📦 Creating compressed archive...\n');

const archiver = require('archiver');
const archiveName = `ZQRadar-${getVersion()}-win64.zip`;
const archivePath = path.join(DIST_DIR, archiveName);
const output = fs.createWriteStream(archivePath);
const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
});

output.on('close', function() {
    const sizeMB = (archive.pointer() / (1024 * 1024)).toFixed(2);
    console.log(`✓ Archive created: ${archiveName} (${sizeMB} MB)`);
    console.log(`\n✅ Release package ready for distribution!\n`);
});

archive.on('error', function(err) {
    console.error('✗ Archive creation failed:', err.message);
    process.exit(1);
});

archive.pipe(output);

// Add all files from dist except the archive itself
archive.file(path.join(DIST_DIR, 'ZQRadar.exe'), { name: 'ZQRadar.exe' });
archive.file(path.join(DIST_DIR, 'README.txt'), { name: 'README.txt' });
archive.directory(path.join(DIST_DIR, 'views'), 'views');
archive.directory(path.join(DIST_DIR, 'scripts'), 'scripts');
archive.directory(path.join(DIST_DIR, 'images'), 'images');
archive.directory(path.join(DIST_DIR, 'sounds'), 'sounds');
if (fs.existsSync(path.join(DIST_DIR, 'config'))) {
    archive.directory(path.join(DIST_DIR, 'config'), 'config');
}

archive.finalize();

// Helper function to get version from package.json
function getVersion() {
    try {
        const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
        return packageJson.version || '1.0.0';
    } catch (err) {
        return '1.0.0';
    }
}
