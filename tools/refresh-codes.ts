import fs from 'fs';
import {downloadFile, DownloadStatus} from './common';

const UPSTREAM_BASE = 'https://raw.githubusercontent.com/Triky313/AlbionOnline-StatisticsAnalysis/master/src/StatisticsAnalysisTool/Network';

interface Target {
    upstream: string;
    output: string;
    exportName: string;
}

const targets: Target[] = [
    {upstream: 'EventCodes.cs', output: 'web/scripts/utils/EventCodes.js', exportName: 'EventCodes'},
    {upstream: 'OperationCodes.cs', output: 'web/scripts/utils/OperationCodes.js', exportName: 'OperationCodes'},
];

interface Entry {
    name: string;
    value: number;
}

function parseEnum(source: string): Entry[] {
    const lines = source.split('\n');
    const entries: Entry[] = [];
    let value = -1;
    let inEnum = false;
    for (const raw of lines) {
        const line = raw.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
        if (!inEnum) {
            if (line === '{') {
                inEnum = true;
            }
            continue;
        }
        if (line === '}') {
            break;
        }
        if (!line) {
            continue;
        }
        const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(?:=\s*(\d+))?\s*,?\s*$/);
        if (!m) {
            continue;
        }
        if (m[2] !== undefined) {
            value = Number(m[2]);
        } else {
            value += 1;
        }
        entries.push({name: m[1], value});
    }
    return entries;
}

function renderJS(exportName: string, entries: Entry[]): string {
    let out = `export const ${exportName} =\n{\n`;
    for (const e of entries) {
        out += `\t${e.name} : ${e.value},\n`;
    }
    out += '};\n';
    return out;
}

async function refreshTarget(target: Target): Promise<void> {
    const url = `${UPSTREAM_BASE}/${target.upstream}`;
    const result = await downloadFile(url);
    if (result.status !== DownloadStatus.SUCCESS || !result.buffer) {
        throw new Error(`Failed to download ${target.upstream}: ${result.status} ${result.message ?? ''}`);
    }
    const entries = parseEnum(result.buffer.toString('utf8'));
    if (entries.length === 0) {
        throw new Error(`No entries parsed from ${target.upstream}`);
    }
    fs.writeFileSync(target.output, renderJS(target.exportName, entries), 'utf8');
    console.log(`Wrote ${entries.length} entries to ${target.output}`);
}

async function main(): Promise<void> {
    for (const t of targets) {
        await refreshTarget(t);
    }
    console.log('JS files refreshed. Run `go generate ./internal/photon/...` to rebuild the Go mirrors.');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
