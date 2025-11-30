import fs from "fs";
import path from "path";
import https from "https";
import sharp from "sharp";

export enum DownloadStatus {
    SUCCESS = 'success',
    NOT_FOUND = 'not-found',
    EXISTS = 'exists',
    FAIL = 'fail',
    OPTIMIZED = 'optimized',
    ERROR = 'error'
}

export interface DownloadResult {
    status: DownloadStatus;
    size?: string;
    message?: string;
    buffer?: Buffer<ArrayBuffer | ArrayBufferLike>;
}

function humanFileSize(size: number): string {
    const i = size === 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
    return (size / Math.pow(1024, i)).toFixed(2) + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i];
}

export async function downloadFile(url: string, outputPath: string): Promise<DownloadResult> {

    if (!fs.existsSync(path.dirname(outputPath))) {
        fs.mkdirSync(path.dirname(outputPath), {recursive: true});
    }

    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50)); // Throttle requests
    return new Promise((resolve) => {
        console.log(`📥 Downloading: ${url}`);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                return downloadFile(response.headers.location!, outputPath)
                    .then(res => resolve(res))
                    .catch(err => resolve(err));
            }

            if (response.statusCode === 404) {
                resolve({status: DownloadStatus.NOT_FOUND, message: 'File not found (404)'});
                return;
            }

            if (response.statusCode !== 200) {
                resolve({
                    status: DownloadStatus.NOT_FOUND,
                    message: `HTTP ${response.statusCode} - ${response.statusMessage}`
                });
                return;
            }

            const chunks: Buffer[] = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => {
                const buffer = Buffer.concat(chunks);
                resolve({
                    status: DownloadStatus.SUCCESS,
                    size: humanFileSize(buffer.length),
                    buffer: buffer,
                    message: 'Downloaded successfully',
                });
            });


        }).on('error', (err) => {
            resolve({status: DownloadStatus.ERROR, message: err.message});
        })
    });
}

export function handleReplacing(outputPath: string, replaceExisting: boolean): DownloadResult {
    if (!replaceExisting && fs.existsSync(outputPath)) {
        return {status: DownloadStatus.EXISTS, message: `File already exists: ${outputPath}`};
    }
    return {status: DownloadStatus.SUCCESS, message: `File can be written: ${outputPath}`};
}

export function handleFileBuffer(buffer: Buffer<ArrayBuffer | ArrayBufferLike>, outputPath: string): DownloadResult {
    fs.writeFileSync(outputPath, buffer);
    return {status: DownloadStatus.SUCCESS, message: `File written successfully: ${outputPath}`};
}

export async function processBufferWithSharp(buffer: Buffer<ArrayBuffer | ArrayBufferLike>, outputPath: string, onlyUpgrade: boolean, optimize: boolean, MAX_IMAGE_SIZE: number, IMAGE_QUALITY: number): Promise<DownloadResult> {
    if (onlyUpgrade && fs.existsSync(outputPath)) {
        try {
            const existingMetadata = await sharp(fs.readFileSync(outputPath)).metadata();
            const newMetadata = await sharp(buffer).metadata();
            if (newMetadata.width && existingMetadata.width && newMetadata.height && existingMetadata.height
                && newMetadata.width <= existingMetadata.width &&
                newMetadata.height <= existingMetadata.height) {
                return {
                    status: DownloadStatus.EXISTS,
                    message: `Existing file is equal or better quality for: ${outputPath}`
                };
            }
        } catch (err) {
            console.log(`⚠️ Could not read existing file metadata, proceeding with download: ${err}`);
        }
    }
    if (!optimize) {
        return {status: DownloadStatus.SUCCESS, buffer: buffer, message: `No optimization applied for: ${outputPath}`, size: humanFileSize(buffer.length)};
    }
    try {
        buffer = await sharp(buffer)
            .resize(MAX_IMAGE_SIZE, MAX_IMAGE_SIZE, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .png({
                quality: IMAGE_QUALITY,
                compressionLevel: 9
            })
            .toBuffer();
    } catch (error) {
        return {status: DownloadStatus.FAIL, message: `Image processing error: ${error}`};
    }
    return {status: DownloadStatus.OPTIMIZED, buffer: buffer, message: `Image optimized for: ${outputPath}`, size: humanFileSize(buffer.length)};
}

export function printSummary(context: {
    startTime: number,
    completed: number,
    downloaded?: number,
    replaced?: number,
    skipped?: number,
    optimized?: number,
    failed?: number,
    optimizeFail?: number,
    outputDir: string
}) {
    const elapsed = ((Date.now() - context.startTime) / 1000).toFixed(2);
    console.log('📊 Summary:');
    console.log(`   🕒 Time taken: ${elapsed} seconds`);
    console.log(`   ✅ Completed: ${context.completed}`);
    if (context.downloaded !== undefined) {
        console.log(`   📥 Downloaded: ${context.downloaded}`);
    }
    if (context.optimized !== undefined) {
        console.log(`   🖼️ Optimized: ${context.optimized}`);
    }
    if (context.replaced !== undefined) {
        console.log(`   ♻️ Replaced: ${context.replaced}`);
    }
    if (context.skipped !== undefined) {
        console.log(`   ⏭️ Skipped: ${context.skipped}`);
    }
    if (context.failed !== undefined) {
        console.log(`   ❌ Failed: ${context.failed}`);
    }
    if (context.optimizeFail !== undefined) {
        console.log(`   ⚠️ Optimization Failures: ${context.optimizeFail}`);
    }
    console.log(`   🗺️ Location: ${context.outputDir}`);
}
