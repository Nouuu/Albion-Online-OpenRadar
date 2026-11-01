import http from 'node:http';
import {AddressInfo} from 'node:net';

export interface MapUpload {
    name: string;
    status: number;
    body: Buffer;
}

export interface MapDownloadServer {
    port: number;
    done: Promise<void>;
    pending(): string[];
    close(): Promise<void>;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

export function pickLandingTile(mapFiles: string[], pending: string[]): string {
    return mapFiles.find(file => !pending.includes(file)) ?? pending[0];
}

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
}

export async function startMapDownloadServer(opts: {
    origin: string;
    names: string[];
    onMap: (upload: MapUpload) => Promise<void>;
    onList?: () => void;
    onIdle?: () => void;
    idleMs?: number;
}): Promise<MapDownloadServer> {
    const pending = [...opts.names];
    let queue = Promise.resolve();
    let finish!: () => void;
    const done = new Promise<void>(resolve => finish = resolve);
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const armIdle = () => {
        clearTimeout(idleTimer);
        if (opts.onIdle && opts.idleMs) idleTimer = setTimeout(opts.onIdle, opts.idleMs);
    };

    const reply = (res: http.ServerResponse, status: number) => {
        res.statusCode = status;
        res.end();
    };

    const handleUpload = async (name: string, status: number, body: Buffer, res: http.ServerResponse) => {
        if (!pending.includes(name)) return reply(res, 404);
        if (status === 200 && !body.subarray(0, 4).equals(PNG_SIGNATURE)) return reply(res, 400);
        await opts.onMap({name, status, body});
        if (status !== 403) pending.splice(pending.indexOf(name), 1);
        reply(res, 204);
    };

    const handle = async (req: http.IncomingMessage, res: http.ServerResponse) => {
        armIdle();
        res.setHeader('Access-Control-Allow-Origin', opts.origin);
        if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Status');
            res.setHeader('Access-Control-Allow-Private-Network', 'true');
            return reply(res, 204);
        }
        if (req.headers.origin !== opts.origin) return reply(res, 403);

        const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
        if (req.method === 'GET' && path === '/list') {
            opts.onList?.();
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify(pending));
        }
        if (req.method === 'POST' && path === '/done') {
            finish();
            return reply(res, 204);
        }
        if (req.method === 'POST' && path.startsWith('/map/')) {
            const body = await readBody(req);
            let name: string;
            try {
                name = decodeURIComponent(path.slice('/map/'.length));
            } catch {
                return reply(res, 400);
            }
            const status = Number(req.headers['x-status']);
            queue = queue.then(() => handleUpload(name, status, body, res)).catch(() => reply(res, 500));
            return;
        }
        reply(res, 404);
    };

    const server = http.createServer((req, res) => {
        handle(req, res).catch(() => {
            if (!res.headersSent) reply(res, 500);
        });
    });

    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    armIdle();

    return {
        port: (server.address() as AddressInfo).port,
        done,
        pending: () => [...pending],
        close: () => new Promise(resolve => {
            clearTimeout(idleTimer);
            server.closeAllConnections();
            server.close(() => resolve());
        }),
    };
}
