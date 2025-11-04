#!/usr/bin/env node
/**
 * post-build.js
 * Script executed after pkg build to copy necessary assets
 * Cross-platform support for Windows, Linux, macOS
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

// Detect which executables were created
const executables = {
    win: {
        paths: [
            path.join(DIST_DIR, 'ZQRadar.exe'),
            path.join(DIST_DIR, 'albion-zqradar-win.exe')
        ],
        name: 'ZQRadar.exe',
        platform: 'win64'
    },
    linux: {
        paths: [
            path.join(DIST_DIR, 'ZQRadar-linux'),
            path.join(DIST_DIR, 'albion-zqradar-linux')
        ],
        name: 'ZQRadar-linux',
        platform: 'linux-x64'
    },
    macos: {
        paths: [
            path.join(DIST_DIR, 'ZQRadar-macos'),
            path.join(DIST_DIR, 'albion-zqradar-macos')
        ],
        name: 'ZQRadar-macos',
        platform: 'macos-x64'
    }
};

const builtPlatforms = [];
for (const [key, exe] of Object.entries(executables)) {
    // Try both possible paths
    let foundPath = null;
    for (const tryPath of exe.paths) {
        if (fs.existsSync(tryPath)) {
            foundPath = tryPath;
            break;
        }
    }

    if (foundPath) {
        exe.path = foundPath;
        exe.actualName = path.basename(foundPath);
        const stats = fs.statSync(foundPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`✓ ${exe.actualName} created (${sizeMB} MB)`);
        builtPlatforms.push(key);
    }
}

if (builtPlatforms.length === 0) {
    console.error('✗ No executable found in dist/');
    process.exit(1);
}

// Create README file for dist (platform-aware)
const createReadme = (platform) => {
    const exeName = platform === 'win64' ? 'ZQRadar.exe' :
                    platform === 'linux-x64' ? 'ZQRadar-linux' : 'ZQRadar-macos';

    const installInstructions = platform === 'win64' ?
`1. **Install Npcap** (REQUIRED - version 1.84 or newer)
   Download: https://npcap.com/
   Direct link (v1.84): https://npcap.com/dist/npcap-1.84.exe

2. **Launch ${exeName}**
   Double-click on ${exeName}` :
`1. **Install libpcap** (REQUIRED)
   - Ubuntu/Debian: sudo apt-get install libpcap-dev
   - macOS: brew install libpcap (usually pre-installed)

2. **Make executable**
   chmod +x ${exeName}

3. **Launch ${exeName}**
   ./${exeName}`;

    return `# ZQRadar - Albion Online Radar

## Installation

${installInstructions}

3. **Select your network adapter**
   Choose the adapter you use to connect to the Internet
   (DO NOT choose 127.0.0.1 or localhost)

4. **Access the radar**
   Open http://localhost:5001 in your browser

## Prerequisites

- ${platform === 'win64' ? 'Windows 10/11' : platform === 'linux-x64' ? 'Linux (Ubuntu 18.04+, Debian 10+, etc.)' : 'macOS 10.15+'}
- ${platform === 'win64' ? 'Npcap 1.84 or newer' : 'libpcap'} installed
- Internet connection to play Albion Online

## Support

Discord: https://discord.gg/XAWjmzeaD3
GitHub: https://github.com/Zeldruck/Albion-Online-ZQRadar

## Note

This build includes all necessary assets (views, scripts, images, sounds).
Native modules (cap.node) are integrated into the executable.

## Platform

Built for: ${platform}
Node.js: v18.18.2
`;
};

// Create README for each built platform
for (const platform of builtPlatforms) {
    const platformName = executables[platform].platform;
    const readmePath = path.join(DIST_DIR, `README-${platform}.txt`);
    fs.writeFileSync(readmePath, createReadme(platformName), 'utf8');
    console.log(`✓ README-${platform}.txt created`);
}

// Create generic README for Windows (backward compatibility)
if (builtPlatforms.includes('win')) {
    fs.writeFileSync(path.join(DIST_DIR, 'README.txt'), createReadme('win64'), 'utf8');
    console.log('✓ README.txt created (Windows)');
}

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

// Check if images are already optimized
const optimizationMarker = path.join(DIST_DIR, 'images', '.optimized');
const imagesAlreadyOptimized = fs.existsSync(optimizationMarker);

for (const asset of assetsToCopy) {
    const srcPath = path.join(__dirname, '..', asset);
    const destPath = path.join(DIST_DIR, asset);

    // Skip images if they already exist AND are optimized
    if (asset === 'images' && imagesAlreadyOptimized) {
        console.log(`✓ ${asset}/ already exists (keeping optimized version)`);
        continue;
    }

    try {
        copyRecursiveSync(srcPath, destPath);
        console.log(`✓ ${asset}/ copied`);
    } catch (err) {
        console.error(`✗ Error copying ${asset}/:`, err.message);
    }
}

console.log('\n✓ Assets copied!\n');
console.log('Files in dist/:');
console.log('  - Executables');
console.log('  - README files');
console.log('  - views/');
console.log('  - scripts/');
console.log('  - images/ (602 MB - will be optimized)');
console.log('  - sounds/');
console.log('  - config/');

// Optimize images before creating archives
const optimizationMarkerPath = path.join(DIST_DIR, 'images', '.optimized');

if (fs.existsSync(optimizationMarkerPath)) {
    console.log('\n🖼️  Images already optimized (skipping)...\n');
    console.log('   ✓ Optimization marker found: dist/images/.optimized');
    console.log('   💡 To re-optimize, delete dist/images/ folder or run: npm run clean\n');
} else {
    console.log('\n🖼️  Optimizing images (this may take 2-3 minutes)...\n');
    console.log('   Quality: 95% (near-lossless, imperceptible loss)');
    console.log('   Expected: 602 MB → ~180 MB (70% compression)\n');

    try {
        const { execSync } = require('child_process');
        execSync('node build/optimize-images.js', { stdio: 'inherit' });

        // Create optimization marker
        fs.writeFileSync(optimizationMarkerPath, new Date().toISOString(), 'utf8');
        console.log('\n✓ Image optimization completed!\n');
        console.log(`   ✓ Marker created: ${optimizationMarkerPath}`);
        console.log('   💡 Next builds will skip optimization (much faster!)\n');
    } catch (err) {
        console.warn('\n⚠️  Image optimization failed (continuing with unoptimized images)');
        console.warn('   Archives will be larger (~630 MB instead of ~250 MB)\n');
    }
}

console.log('✓ Post-build completed!\n');
console.log('Note: This approach makes the exe lighter and facilitates updates\n');

// Create compressed archives (multiple formats per platform)
console.log('\n📦 Creating compressed archives...\n');

const archiver = require('archiver');
const version = getVersion();

// Helper function to get version from package.json
function getVersion() {
    try {
        const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
        return packageJson.version || '1.0.0';
    } catch (err) {
        return '1.0.0';
    }
}

// Create archive for a specific platform
const createArchive = (platform, format) => {
    return new Promise((resolve, reject) => {
        const exe = executables[platform];
        const archiveName = `ZQRadar-${version}-${exe.platform}.${format.ext}`;
        const archivePath = path.join(DIST_DIR, archiveName);
        const output = fs.createWriteStream(archivePath);

        let archive;
        if (format.type === 'zip') {
            archive = archiver('zip', { zlib: { level: format.level } });
        } else if (format.type === 'tar') {
            archive = archiver('tar', {
                gzip: format.gzip,
                gzipOptions: { level: format.level }
            });
        }

        output.on('close', function() {
            const sizeMB = (archive.pointer() / (1024 * 1024)).toFixed(2);
            console.log(`✓ ${archiveName} (${sizeMB} MB)`);
            resolve();
        });

        archive.on('error', function(err) {
            console.error(`✗ ${archiveName} creation failed:`, err.message);
            reject(err);
        });

        archive.pipe(output);

        // Add platform-specific executable
        archive.file(exe.path, { name: exe.name });

        // Add README
        const readmeName = platform === 'win' ? 'README.txt' : `README-${platform}.txt`;
        if (fs.existsSync(path.join(DIST_DIR, readmeName))) {
            archive.file(path.join(DIST_DIR, readmeName), { name: 'README.txt' });
        }

        // Add shared assets
        archive.directory(path.join(DIST_DIR, 'views'), 'views');
        archive.directory(path.join(DIST_DIR, 'scripts'), 'scripts');
        archive.directory(path.join(DIST_DIR, 'images'), 'images');
        archive.directory(path.join(DIST_DIR, 'sounds'), 'sounds');
        if (fs.existsSync(path.join(DIST_DIR, 'config'))) {
            archive.directory(path.join(DIST_DIR, 'config'), 'config');
        }

        archive.finalize();
    });
};

// Archive formats (ZIP only for all platforms)
const getFormats = (platform) => {
    return [
        { ext: 'zip', type: 'zip', level: 9 }
    ];
};

// Create all archives sequentially
(async () => {
    try {
        for (const platform of builtPlatforms) {
            const formats = getFormats(platform);
            for (const format of formats) {
                await createArchive(platform, format);
            }
        }
        console.log(`\n✅ All release packages ready for distribution!\n`);
        console.log('💡 Tip: Run "npm run optimize:images" to reduce archive size by 20-40%\n');
    } catch (err) {
        console.error('✗ Archive creation failed:', err.message);
        process.exit(1);
    }
})();
