// Runtime checks used inside the packaged executable
// This module is lightweight and only checks runtime requirements (Npcap presence/version on Windows).
const { execSync } = require('child_process');

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
  try {
    const regCommand = process.env.WINDIR ? 'reg.exe query "HKLM\\SOFTWARE\\Npcap"' : 'reg query "HKLM\\SOFTWARE\\Npcap"';
    const regOutput = execSync(regCommand, { encoding: 'utf8', stdio: 'pipe' });
    const versionMatch = regOutput.match(/Version\s+REG_SZ\s+([\d.]+)/);
    if (versionMatch) {
      const detected = versionMatch[1];
      console.log(`Detected Npcap version: ${detected}`);
      if (compareVersions(detected, REQUIRED_NPCAP_VERSION) < 0) {
        console.error(`Npcap version ${detected} detected — minimum required: ${REQUIRED_NPCAP_VERSION}`);
        return false;
      }
      return true;
    }
    console.error('Npcap found but could not read version from registry.');
    return false;
  } catch (err) {
    // try WinPcap fallback detection
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

module.exports = { runRuntimeChecks };

