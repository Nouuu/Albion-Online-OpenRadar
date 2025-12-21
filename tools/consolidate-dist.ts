import fs from "fs";
import path from "path";
import crypto from "crypto";

const DIST_DIR = "dist";
const DIST_BUILD_DIR = "dist-build";

// Final artifacts we want to keep
const KEEP_FILES = [
    "OpenRadar-windows-amd64.exe",
    "OpenRadar-linux-amd64",
    "README-windows.txt",
    "README-linux.txt",
    "checksums-sha256.txt",
];

console.log("\n Consolidating artifacts into dist/...\n");

/**
 * Recursively find a file in a directory
 */
function findFile(dir: string, filename: string): string | null {
    if (!fs.existsSync(dir)) return null;

    const entries = fs.readdirSync(dir, {withFileTypes: true});

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isFile() && entry.name === filename) {
            return fullPath;
        }

        if (entry.isDirectory()) {
            const found = findFile(fullPath, filename);
            if (found) return found;
        }
    }

    return null;
}

/**
 * Recursively remove a directory
 */
function removeDir(dir: string): void {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, {withFileTypes: true});

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            removeDir(fullPath);
        } else {
            fs.unlinkSync(fullPath);
        }
    }

    fs.rmdirSync(dir);
}

/**
 * Calculate SHA256 hash of a file
 */
function calculateSha256(filePath: string): string {
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(content).digest("hex");
}

// Step 1: Copy files from dist-build to dist
if (fs.existsSync(DIST_BUILD_DIR)) {
    const filesToCopy = [
        "OpenRadar-linux-amd64",
        "README-windows.txt",
        "README-linux.txt",
    ];

    for (const file of filesToCopy) {
        const srcPath = path.join(DIST_BUILD_DIR, file);
        const destPath = path.join(DIST_DIR, file);

        if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
        }
    }
    console.log("   Copied Linux binary and READMEs from dist-build/");
}

// Step 2: Find Windows binary (in subdirectory created by goreleaser)
const winBinary = findFile(DIST_DIR, "OpenRadar-windows-amd64.exe");
if (winBinary) {
    const destPath = path.join(DIST_DIR, "OpenRadar-windows-amd64.exe");
    if (winBinary !== destPath) {
        fs.copyFileSync(winBinary, destPath);
        const subDir = path.dirname(winBinary).split(path.sep).pop();
        console.log(`   Copied Windows binary from ${subDir}/`);
    }
}

// Step 3: Remove all subdirectories in dist
const distEntries = fs.readdirSync(DIST_DIR, {withFileTypes: true});
let removedDirs = 0;

for (const entry of distEntries) {
    if (entry.isDirectory()) {
        removeDir(path.join(DIST_DIR, entry.name));
        removedDirs++;
    }
}

if (removedDirs > 0) {
    console.log("   Removed intermediate subdirectories");
}

// Step 4: Remove files that aren't our final artifacts
const distFiles = fs.readdirSync(DIST_DIR);
let removedFiles = 0;

for (const file of distFiles) {
    if (!KEEP_FILES.includes(file)) {
        fs.unlinkSync(path.join(DIST_DIR, file));
        removedFiles++;
    }
}

if (removedFiles > 0) {
    console.log(`   Removed ${removedFiles} intermediate file(s)`);
}

// Step 5: Clean up dist-build directory
if (fs.existsSync(DIST_BUILD_DIR)) {
    removeDir(DIST_BUILD_DIR);
    console.log("   Removed dist-build/");
}

// Step 6: Regenerate checksums for final binaries only
console.log("   Regenerating checksums...");

const checksumFile = path.join(DIST_DIR, "checksums-sha256.txt");
const binaries = ["OpenRadar-windows-amd64.exe", "OpenRadar-linux-amd64"];
const checksumLines: string[] = [];

for (const binary of binaries) {
    const binaryPath = path.join(DIST_DIR, binary);
    if (fs.existsSync(binaryPath)) {
        const hash = calculateSha256(binaryPath);
        checksumLines.push(`${hash}  ${binary}`);
        console.log(`     ${binary} = ${hash.substring(0, 16)}...`);
    }
}

// Write checksums file (Unix line endings, no BOM)
fs.writeFileSync(checksumFile, checksumLines.join("\n") + "\n", "utf8");
console.log(
    `   Generated checksums-sha256.txt with ${checksumLines.length} entries`
);

// Print final artifacts
console.log("\n Final artifacts in dist/:");
const finalFiles = fs.readdirSync(DIST_DIR);
for (const file of finalFiles) {
    console.log(`   - ${file}`);
}
console.log("");