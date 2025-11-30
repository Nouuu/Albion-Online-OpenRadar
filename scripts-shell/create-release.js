#!/usr/bin/env node
/**
 * create-release.js
 * Creates a release ZIP package with all necessary files
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const DIST_DIR = path.join(__dirname, '../dist');
const RELEASE_NAME = `ZQRadar-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
const RELEASE_DIR = path.join(DIST_DIR, RELEASE_NAME);

console.log('\n📦 Creating release package...\n');

// Check that executable exists
const exePath = path.join(DIST_DIR, 'ZQRadar.exe');
if (!fs.existsSync(exePath)) {
    console.error('✗ ZQRadar.exe not found!');
    console.error('  Run "npm run build:win" first.');
    process.exit(1);
}

// Create release folder
if (!fs.existsSync(RELEASE_DIR)) {
    fs.mkdirSync(RELEASE_DIR, { recursive: true });
}

// Copy essential files
console.log('📁 Copying files...\n');

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
        console.error(`✗ ${file.src} not found!`);
        process.exit(1);
    }
});

// Create INSTALL.txt file with instructions
const installInstructions = `╔════════════════════════════════════════════════════════════╗
║                    ZQRadar - Installation                  ║
╚════════════════════════════════════════════════════════════╝

📋 INSTALLATION STEPS:

1. Install Npcap 1.84 (REQUIRED)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Download from: https://npcap.com/
   Direct link (optional): https://npcap.com/dist/npcap-1.84.exe

   ⚠️  IMPORTANT: Without Npcap (version 1.84+), ZQRadar will not be able
       to capture network packets and will not work!

2. Launch ZQRadar
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Double-click on ZQRadar.exe

3. Select network adapter
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Choose the network adapter you use to connect to the Internet.

   ⚠️  DO NOT select 127.0.0.1 (localhost)

4. Access the radar
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Open your browser and go to:

   👉 http://localhost:5001

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 PREREQUISITES:

   • Windows 10 or 11
   • Npcap 1.84 or newer installed
   • Albion Online running

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🆘 SUPPORT:

   Discord  : https://discord.gg/XAWjmzeaD3
   GitHub   : https://github.com/Zeldruck/Albion-Online-ZQRadar
   Issues   : https://github.com/Zeldruck/Albion-Online-ZQRadar/issues

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 TECHNICAL NOTES:

   • All assets (views, scripts, images, sounds) are integrated
     into ZQRadar.exe - no other files needed!

   • Native modules (cap.node for network capture) are
     also integrated in the executable

   • The ip.txt file will be created automatically on
     first run to save your adapter choice

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Version : ${RELEASE_NAME}
Build   : ${new Date().toISOString()}

`;

fs.writeFileSync(path.join(RELEASE_DIR, 'INSTALL.txt'), installInstructions, 'utf8');
console.log('✓ INSTALL.txt\n');

// Create ZIP archive
console.log('🗜️  Creating ZIP archive...\n');

const zipPath = path.join(DIST_DIR, `${RELEASE_NAME}.zip`);
const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
});

output.on('close', () => {
    const sizeMB = (archive.pointer() / (1024 * 1024)).toFixed(2);
    console.log(`\n✓ Archive created: ${RELEASE_NAME}.zip (${sizeMB} MB)`);
    console.log(`\n📍 Location: ${zipPath}`);

    // Clean temporary folder
    fs.rmSync(RELEASE_DIR, { recursive: true, force: true });

    console.log('\n✅ Release package created successfully!\n');
    console.log('Package contents:');
    console.log('  • ZQRadar.exe');
    console.log('  • README.md');
    console.log('  • INSTALL.txt');
    console.log('  • zqradar.ico (if available)\n');
});

archive.on('error', (err) => {
    console.error('\n✗ Error creating archive!');
    console.error(err);
    process.exit(1);
});

archive.pipe(output);
archive.directory(RELEASE_DIR, false);
archive.finalize();