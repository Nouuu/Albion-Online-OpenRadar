import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import {promisify} from 'util';

const gzip = promisify(zlib.gzip);

// Get target directory and options from command line args
const args = process.argv.slice(2);
const deleteOriginals = args.includes('--delete-originals');
const targetDir = args.find(arg => !arg.startsWith('--')) || 'web/public/ao-bin-dumps';
const MIN_SIZE_FOR_COMPRESSION = 100 * 1024; // 100 KB - only compress files larger than this

console.log('\n🗜️  Game Data Compression Script\n');
console.log('📁 Target directory:', targetDir);
if (deleteOriginals) console.log('🗑️  Delete originals: ENABLED');
console.log('');

/**
 * Compress a single file to .gz
 * @param {string} filePath - Path to the file to compress
 * @returns {Promise<{original: number, compressed: number, ratio: string}>}
 */
async function compressFile(filePath) {
    const outputPath = `${filePath}.gz`;

    // Check if .gz already exists and is newer than source
    if (fs.existsSync(outputPath)) {
        const sourceStats = fs.statSync(filePath);
        const gzStats = fs.statSync(outputPath);

        if (gzStats.mtime >= sourceStats.mtime) {
            return null; // Skip, already compressed and up to date
        }
    }

    const content = fs.readFileSync(filePath);
    const compressed = await gzip(content, {level: zlib.constants.Z_BEST_COMPRESSION});

    fs.writeFileSync(outputPath, compressed);

    const originalSize = content.length;
    const compressedSize = compressed.length;
    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

    return {
        original: originalSize,
        compressed: compressedSize,
        ratio: `${ratio}%`
    };
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Main compression function
 */
async function compressGameData() {
    if (!fs.existsSync(targetDir)) {
        console.error(`✗ Directory not found: ${targetDir}`);
        process.exit(1);
    }

    const files = fs.readdirSync(targetDir);
    const toCompress = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        const filePath = path.join(targetDir, file);
        const stats = fs.statSync(filePath);

        // Only compress .json and .xml files larger than MIN_SIZE
        return (ext === '.json' || ext === '.xml') &&
            stats.isFile() &&
            stats.size >= MIN_SIZE_FOR_COMPRESSION;
    });

    if (toCompress.length === 0) {
        console.log('ℹ️  No files to compress (all up to date or too small)');
        return;
    }

    console.log(`Found ${toCompress.length} file(s) to compress:\n`);

    let totalOriginal = 0;
    let totalCompressed = 0;
    let compressedCount = 0;
    let skippedCount = 0;

    for (const file of toCompress) {
        const filePath = path.join(targetDir, file);
        const stats = fs.statSync(filePath);

        process.stdout.write(`  Compressing ${file} (${formatSize(stats.size)})... `);

        try {
            const result = await compressFile(filePath);

            if (result === null) {
                console.log('⏭️  (already up to date)');
                skippedCount++;
                // Still delete original if option is set
                if (deleteOriginals && fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } else {
                console.log(`✓ ${formatSize(result.compressed)} (saved ${result.ratio})`);
                totalOriginal += result.original;
                totalCompressed += result.compressed;
                compressedCount++;
                // Delete original after successful compression
                if (deleteOriginals) {
                    fs.unlinkSync(filePath);
                }
            }
        } catch (error) {
            console.log(`✗ Failed: ${error.message}`);
        }
    }

    console.log('\n' + '='.repeat(60));

    if (compressedCount > 0) {
        const totalRatio = ((1 - totalCompressed / totalOriginal) * 100).toFixed(1);
        console.log(`✅ Compressed ${compressedCount} file(s)`);
        console.log(`   Original:   ${formatSize(totalOriginal)}`);
        console.log(`   Compressed: ${formatSize(totalCompressed)}`);
        console.log(`   Saved:      ${formatSize(totalOriginal - totalCompressed)} (${totalRatio}%)`);
    }

    if (skippedCount > 0) {
        console.log(`⏭️  Skipped ${skippedCount} file(s) (already up to date)`);
    }

    console.log('\n🗜️  Compression complete!\n');
}

// Run the compression
compressGameData().catch(error => {
    console.error('✗ Compression failed:', error);
    process.exit(1);
});