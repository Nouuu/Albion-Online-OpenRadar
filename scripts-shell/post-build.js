import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

const DIST_DIR = 'dist';
const ES_BUILD_FILE = 'app.cjs';
const assetsToCopy = ['images', 'sounds', 'views', 'scripts', 'server-scripts', 'public'];


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
            path.join(DIST_DIR, 'OpenRadar.exe'),
            path.join(DIST_DIR, 'albion-openradar-win.exe')
        ],
        name: 'OpenRadar.exe',
        platform: 'win64'
    },
    linux: {
        paths: [
            path.join(DIST_DIR, 'OpenRadar-linux'),
            path.join(DIST_DIR, 'albion-openradar-linux')
        ],
        name: 'OpenRadar-linux',
        platform: 'linux-x64'
    },
    macos: {
        paths: [
            path.join(DIST_DIR, 'OpenRadar-macos'),
            path.join(DIST_DIR, 'albion-openradar-macos')
        ],
        name: 'OpenRadar-macos',
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
    const exeName = platform === 'win64' ? 'OpenRadar.exe' :
                    platform === 'linux-x64' ? 'OpenRadar-linux' : 'OpenRadar-macos';

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

    return `# OpenRadar - Albion Online Radar

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

GitHub: https://github.com/Nouuu/Albion-Online-ZQRadar

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
    const srcPath = path.join(asset);
    const destPath = path.join(DIST_DIR, asset);

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
for (const asset of assetsToCopy) {
    console.log(`  - ${asset}/`);
}

console.log('✓ Post-build completed!\n');
console.log('Note: This approach makes the exe lighter and facilitates updates\n');

// Create compressed archives (multiple formats per platform)
console.log('\n📦 Creating compressed archives...\n');

const version = getVersion();

// Helper function to get version from package.json
function getVersion() {
    try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        return packageJson.version || '1.0.0';
    } catch (err) {
        console.warn('⚠ Could not read version from package.json:', err.message);
        return '1.0.0';
    }
}

// Create archive for a specific platform
const createArchive = (platform, format) => {
    return new Promise((resolve, reject) => {
        const exe = executables[platform];
        const archiveName = `OpenRadar-${version}-${exe.platform}.${format.ext}`;
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
        for (const asset of assetsToCopy) {
            const assetPath = path.join(DIST_DIR, asset);
            if (fs.existsSync(assetPath)) {
                archive.directory(assetPath, asset);
            }
        }
        archive.finalize().then(() => resolve()).catch(err => reject(err));
    });
};

// Archive formats (ZIP only for all platforms)
const getFormats = () => {
    return [
        { ext: 'zip', type: 'zip', level: 9 }
    ];
};

// Create all archives sequentially
(async () => {
    try {
        for (const platform of builtPlatforms) {
            for (const format of getFormats()) {
                await createArchive(platform, format);
            }
        }
        console.log(`\n✅ All release packages ready for distribution!\n`);
        process.exit(0);
    } catch (err) {
        console.error('✗ Archive creation failed:', err.message);
        process.exit(1);
    }
})().finally(() => {
    console.log('📦 Post-build archiving process finished.');
    console.log('Moving app.cjs to dist/ folder.');
    fs.renameSync(ES_BUILD_FILE, path.join(DIST_DIR, ES_BUILD_FILE));
});
