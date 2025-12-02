// Runtime checks used inside the packaged executable
// This module is lightweight and only checks runtime requirements (Npcap presence/version on Windows).
import { execSync } from 'child_process';

const REQUIRED_NPCAP_VERSION = '1.84';

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

function checkNpcapWindows() {
  // Try multiple registry locations (native 64-bit and WOW6432Node for 32-bit apps on 64-bit Windows)
  const registryPaths = [
    'HKLM\\SOFTWARE\\Npcap',
    'HKLM\\SOFTWARE\\WOW6432Node\\Npcap'
  ];

  for (const regPath of registryPaths) {
    try {
      const regCommand = process.env.WINDIR ? `reg.exe query "${regPath}"` : `reg query "${regPath}"`;
      const regOutput = execSync(regCommand, { encoding: 'utf8', stdio: 'pipe' });
      const versionMatch = regOutput.match(/Version\s+REG_SZ\s+([\d.]+)/);
      if (versionMatch) {
        const detected = versionMatch[1];
        console.log(`Detected Npcap version: ${detected} (from ${regPath})`);
        if (compareVersions(detected, REQUIRED_NPCAP_VERSION) < 0) {
          console.error(`Npcap version ${detected} detected — minimum required: ${REQUIRED_NPCAP_VERSION}`);
          return false;
        }
        return true;
      }
      // If registry key exists but no version, try to extract from driver version
      const driverMatch = regOutput.match(/DriverVer\s*=\s*[\d/]+,([\d.]+)/i);
      if (driverMatch) {
        // Extract major.minor from driver version (e.g., 14.42.10.379 -> 1.84)
        // Npcap uses version scheme where driver 14.x = Npcap 1.8x
        const driverVer = driverMatch[1];
        const parts = driverVer.split('.');
        if (parts.length >= 2) {
          const majorMinor = `${parseInt(parts[0]) - 13}.${parts[1]}`;
          console.log(`Detected Npcap from driver version: ${majorMinor} (driver ${driverVer})`);
          if (compareVersions(majorMinor, REQUIRED_NPCAP_VERSION) < 0) {
            console.error(`Npcap version ${majorMinor} detected — minimum required: ${REQUIRED_NPCAP_VERSION}`);
            return false;
          }
          return true;
        }
      }
      // Registry key found but couldn't extract version - check if files exist
      console.log(`Npcap found in registry (${regPath}) but could not read version.`);
      // If we got here, Npcap exists, so allow it (better than false negative)
      return true;
    } catch (err) {
      // Registry path not found, try next one
        console.warn(`Npcap not found in registry path: ${regPath} : ${err.message}`);
      continue;
    }
  }

  // No Npcap found, try WinPcap fallback detection
  try {
    const regCommand = process.env.WINDIR ? 'reg.exe query "HKLM\\SOFTWARE\\WinPcap"' : 'reg query "HKLM\\SOFTWARE\\WinPcap"';
    execSync(regCommand, { encoding: 'utf8', stdio: 'pipe' });
    console.error('WinPcap detected (legacy). Please install Npcap >= ' + REQUIRED_NPCAP_VERSION + '.');
    return false;
  } catch {
    console.error(`Npcap not detected. Please install Npcap >= ${REQUIRED_NPCAP_VERSION} from https://npcap.com/`);
    return false;
  }
}

function runRuntimeChecks() {
  const isPackaged = !!process.pkg;
  if (!isPackaged) {
    // In development, skip strict runtime checks
    console.log('Runtime check: development mode — skipping strict runtime checks.');
    return true;
  }

  // Only perform Windows Npcap check at runtime (packaged executable)
  if (process.platform === 'win32') {
    const ok = checkNpcapWindows();
    if (!ok) {
      console.error('\nERROR: Npcap >= ' + REQUIRED_NPCAP_VERSION + ' is required.');
    }
    return ok;
  }

  // For non-Windows platforms, nothing to check here
  return true;
}

export { runRuntimeChecks };

