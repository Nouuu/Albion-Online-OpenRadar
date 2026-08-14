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

A single Go binary with every asset embedded. Npcap is the only thing you
install separately. The radar reads Albion's network traffic and draws what it
finds in your browser. It never touches the game client.

## Installation

1. Install Npcap 1.87 or newer (REQUIRED)
   https://npcap.com/#download
   Keep the default options.

2. Launch ${exeName}
   A terminal window opens with a live dashboard. Leave it running.

3. Read the URLs it prints
   http://localhost:5001                  from this PC
   http://<your-lan-ip>:5001  (LAN)       from a phone or a second PC

4. Open one of them in a browser.

5. Launch Albion.

Capture interfaces are picked automatically on first run. To change them, open
the radar in a browser and go to Settings -> Network.

## Using ExitLag

ExitLag's default redirection method (WFP) hides Albion's traffic from Npcap,
so the radar sees nothing. In ExitLag open
Settings -> Advanced -> Packet redirection method and pick NDIS (Legacy).

## Command-line Options

  ${exeName} -version     Show version information
  ${exeName} -ip X.X.X.X  Capture on the interface with this IP, this run only
  ${exeName} -dev         Development mode (read files from disk)

## Nothing is detected

- Confirm Npcap is installed, then restart the radar.
- Check Settings -> Network. At least one interface must be ticked and active.
- If you use ExitLag, a VPN or a proxy, see the ExitLag section above.
- Detection often breaks the day Albion ships a patch. Check the releases page
  for a newer build before opening an issue.

## Players do not appear on the radar

That is expected. Albion encrypts live player positions, so the radar cannot
place other players on the map. It detects them, and lists them with their
guild, alliance and gear on the Players page. Threat alerts work from that.

## Prerequisites

- Windows 10/11 (64-bit)
- Npcap 1.87 or newer

## Verification

This binary was built from open source code via GitHub Actions CI/CD.
Verify the integrity using the checksums file:

  certutil -hashfile ${exeName} SHA256

Compare with checksums-sha256.txt from the release.

## Support

GitHub: https://github.com/Nouuu/Albion-Online-OpenRadar

## Technical Details

- Single binary, assets embedded
- Server on port 5001 (HTTP + WebSocket on /ws)
- Captures UDP traffic on port 5056

Built for: win64
`;
}

function createLinuxReadme(exeName: string): string {
    return `# OpenRadar v${VERSION} - Albion Online Radar (Linux)

## About

A single Go binary with every asset embedded. libpcap is the only thing you
install separately. The radar reads Albion's network traffic and draws what it
finds in your browser. It never touches the game client.

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

4. **Read the URLs it prints**
   http://localhost:5001                  from this machine
   http://<your-lan-ip>:5001  (LAN)       from a phone or a second machine

5. **Open one of them in a browser, then launch Albion.**

Capture interfaces are picked automatically on first run. To change them, open
the radar in a browser and go to Settings -> Network.

## Command-line Options

  ./${exeName} -version     Show version information
  ./${exeName} -ip X.X.X.X  Capture on the interface with this IP, this run only
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

If nothing is detected at all:
  - Check Settings -> Network. At least one interface must be ticked and active.
  - Detection often breaks the day Albion ships a patch. Check the releases page
    for a newer build before opening an issue.

## Players do not appear on the radar

That is expected. Albion encrypts live player positions, so the radar cannot
place other players on the map. It detects them, and lists them with their
guild, alliance and gear on the Players page. Threat alerts work from that.

## Verification

This binary was built from open source code via GitHub Actions CI/CD.
Verify the integrity using the checksums file:

  sha256sum ${exeName}

Compare with checksums-sha256.txt from the release.

## Support

GitHub: https://github.com/Nouuu/Albion-Online-OpenRadar

## Technical Details

- Single binary, assets embedded
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