import fs from "fs";
import path from "path";

// Parse CLI arguments
const args = process.argv.slice(2);

function getArg(name: string): string | null {
    const arg = args.find((a) => a.startsWith(`--${name}=`));
    return arg ? arg.split("=")[1] : null;
}

const OUTPUT_DIR = getArg("output-dir") || "dist";
const VERSION = getArg("version") || getVersionFromPackage();

function getVersionFromPackage(): string {
    try {
        const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
        return packageJson.version || "dev";
    } catch {
        return "dev";
    }
}

console.log(`\n Generating README files in ${OUTPUT_DIR}/\n`);
console.log(` Version: ${VERSION}`);

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, {recursive: true});
}

// Platform configurations
interface PlatformConfig {
    exeName: string;
    platform: string;
    readmeFileName: string;
}

const platforms: Record<string, PlatformConfig> = {
    windows: {
        exeName: "OpenRadar-windows-amd64.exe",
        platform: "win64",
        readmeFileName: "README-windows.txt",
    },
    linux: {
        exeName: "OpenRadar-linux-amd64",
        platform: "linux-x64",
        readmeFileName: "README-linux.txt",
    },
};

function createWindowsReadme(exeName: string): string {
    return `# OpenRadar v${VERSION} - Albion Online Radar (Windows)

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

## Verification

This binary was built from open source code via GitHub Actions CI/CD.
Verify the integrity using the checksums file:

  certutil -hashfile ${exeName} SHA256

Compare with checksums-sha256.txt from the release.

## Support

GitHub: https://github.com/Nouuu/Albion-Online-OpenRadar

## Technical Details

- Native Go backend (v2.0)
- Single binary with embedded assets
- Server on port 5001 (HTTP + WebSocket on /ws)
- Captures UDP traffic on port 5056

Built for: win64
`;
}

function createLinuxReadme(exeName: string): string {
    return `# OpenRadar v${VERSION} - Albion Online Radar (Linux)

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

## Verification

This binary was built from open source code via GitHub Actions CI/CD.
Verify the integrity using the checksums file:

  sha256sum ${exeName}

Compare with checksums-sha256.txt from the release.

## Support

GitHub: https://github.com/Nouuu/Albion-Online-OpenRadar

## Technical Details

- Native Go backend (v2.0)
- Single binary with embedded assets
- Server on port 5001 (HTTP + WebSocket on /ws)
- Captures UDP traffic on port 5056

Built for: linux-x64
`;
}

// Generate README for each platform
for (const [key, config] of Object.entries(platforms)) {
    const readmePath = path.join(OUTPUT_DIR, config.readmeFileName);
    const content =
        key === "windows"
            ? createWindowsReadme(config.exeName)
            : createLinuxReadme(config.exeName);

    fs.writeFileSync(readmePath, content, "utf8");
    console.log(` ${config.readmeFileName} created`);
}

console.log("\n README generation completed!\n");