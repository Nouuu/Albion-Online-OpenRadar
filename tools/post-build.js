import fs from 'fs';
import path from 'path';

const DIST_DIR = 'dist';

console.log('\n📦 Post-build: Checking build output...\n');

// Check if build was created
if (!fs.existsSync(DIST_DIR)) {
    console.error('✗ dist/ folder not found!');
    console.error('  Build may have failed.');
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
    }
};

const builtPlatforms = [];
for (const [key, exe] of Object.entries(executables)) {
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

// Helper function to get version from package.json
function getVersion() {
    try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        return packageJson.version || '2.0.0';
    } catch {
        return '2.0.0';
    }
}

const version = getVersion();

// Create README file for dist (platform-aware)
const createReadme = (platform) => {
    const exeName = platform === 'win64' ? 'OpenRadar.exe' : 'OpenRadar-linux';

    if (platform === 'win64') {
        return `# OpenRadar v${version} - Albion Online Radar (Windows)

## About

OpenRadar is a native Go application (~95 MB) with all assets embedded.
No external dependencies besides Npcap are required.

## Installation

1. **Install Npcap** (REQUIRED - version 1.84 or newer)
   Download: https://npcap.com/
   Direct link (v1.84): https://npcap.com/dist/npcap-1.84.exe

2. **Launch ${exeName}**
   Double-click on ${exeName}

3. **Select your network adapter**
   Choose the adapter you use to connect to the Internet
   (DO NOT choose 127.0.0.1 or localhost)

4. **Access the radar**
   Open http://localhost:5001 in your browser

## Command-line Options

  ${exeName} -version     Show version information
  ${exeName} -ip X.X.X.X  Skip adapter selection prompt
  ${exeName} -dev         Development mode (read files from disk)

## Prerequisites

- Windows 10/11 (64-bit)
- Npcap 1.84 or newer installed

## Support

GitHub: https://github.com/Nouuu/Albion-Online-OpenRadar

## Technical Details

- Native Go backend (v2.0)
- Single binary with embedded assets
- Server on port 5001 (HTTP + WebSocket on /ws)
- Captures UDP traffic on port 5056

Built for: ${platform}
`;
    }

    if (platform === 'linux-x64') {
        return `# OpenRadar v${version} - Albion Online Radar (Linux)

## About

OpenRadar is a native Go application (~95 MB) with all assets embedded.
No external dependencies besides libpcap are required.

## Installation

1. **Install dependencies** (REQUIRED)

   Ubuntu/Debian:
     sudo apt-get install libpcap0.8 libcap2-bin

   Fedora/RHEL:
     sudo dnf install libpcap libcap

   Arch Linux:
     sudo pacman -S libpcap libcap

2. **Make executable**
   chmod +x ${exeName}

3. **Grant capture permissions** (choose ONE option)

   Option A - Run as root (simple):
     sudo ./${exeName}

   Option B - Grant capabilities (recommended, run as normal user):
     # Grant network capture capabilities
     sudo setcap cap_net_raw,cap_net_admin=eip ./${exeName}

     # Verify capabilities were applied (optional)
     getcap ./${exeName}

     # Run as normal user
     ./${exeName}

   Note: Capabilities are removed if the file is modified or moved.
   Re-run setcap after updates.

4. **Select your network adapter**
   Choose the adapter you use to connect to the Internet
   (DO NOT choose 127.0.0.1 or localhost)

5. **Access the radar**
   Open http://localhost:5001 in your browser

## Command-line Options

  ./${exeName} -version     Show version information
  ./${exeName} -ip X.X.X.X  Skip adapter selection prompt
  ./${exeName} -dev         Development mode (read files from disk)

## Prerequisites

- Linux (Ubuntu 18.04+, Debian 10+, Fedora 32+, Arch, etc.)
- libpcap installed
- libcap installed (for setcap command)
- Network capture permissions (root or setcap)

## Troubleshooting

If you get "permission denied" or "no suitable device found":
  sudo setcap cap_net_raw,cap_net_admin=eip ./${exeName}

If setcap is not found, install libcap:
  Ubuntu/Debian: sudo apt-get install libcap2-bin
  Fedora/RHEL:   sudo dnf install libcap
  Arch Linux:    sudo pacman -S libcap

If setcap doesn't work, run as root:
  sudo ./${exeName}

## Support

GitHub: https://github.com/Nouuu/Albion-Online-OpenRadar

## Technical Details

- Native Go backend (v2.0)
- Single binary with embedded assets
- Server on port 5001 (HTTP + WebSocket on /ws)
- Captures UDP traffic on port 5056

Built for: ${platform}
`;
    }

    // Fallback (should not happen with Windows/Linux only)
    return '';
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

console.log('\n✓ Post-build completed!\n');
console.log('Files in dist/:');
for (const platform of builtPlatforms) {
    console.log(`  - ${executables[platform].actualName}`);
}
console.log('  - README files\n');
console.log(`Note: Go v2.0 - Single binary with all assets embedded (~95 MB)\n`);