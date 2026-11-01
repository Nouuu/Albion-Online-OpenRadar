// synthetic: local HTTP contract between the map download tool and its Chrome extension.
import http from 'node:http';
import {afterEach, beforeEach, describe, expect, Mock, test, vi} from 'vitest';
import {MapDownloadServer, MapUpload, pickLandingTile, startMapDownloadServer} from './map-download-server';

const ORIGIN = 'https://cdn.albiononline2d.com';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface Reply {
    status: number;
    headers: http.IncomingHttpHeaders;
    body: Buffer;
}

let server: MapDownloadServer;
let onMap: Mock<(upload: MapUpload) => Promise<void>>;
let onList: Mock<() => void>;

function send(method: string, path: string, headers: Record<string, string> = {}, body?: Buffer): Promise<Reply> {
    return new Promise((resolve, reject) => {
        const req = http.request({host: '127.0.0.1', port: server.port, method, path, headers: {Origin: ORIGIN, ...headers}}, res => {
            const chunks: Buffer[] = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve({status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks)}));
        });
        req.on('error', reject);
        req.end(body);
    });
}

async function list(): Promise<string[]> {
    return JSON.parse((await send('GET', '/list')).body.toString());
}

beforeEach(async () => {
    onMap = vi.fn(async (_upload: MapUpload) => {});
    onList = vi.fn(() => {});
    server = await startMapDownloadServer({origin: ORIGIN, names: ['a.png', 'b.png'], onMap, onList});
});

afterEach(async () => {
    await server.close();
});

describe('startMapDownloadServer', () => {
    test('lists pending names with the CDN CORS header', async () => {
        const reply = await send('GET', '/list');
        expect(reply.status).toBe(200);
        expect(JSON.parse(reply.body.toString())).toEqual(['a.png', 'b.png']);
        expect(reply.headers['access-control-allow-origin']).toBe(ORIGIN);
    });

    test('accepts a PNG tile and drops it from the list', async () => {
        const reply = await send('POST', '/map/a.png', {'X-Status': '200'}, PNG);
        expect(reply.status).toBe(204);
        expect(onMap).toHaveBeenCalledOnce();
        expect(onMap.mock.calls[0][0]).toMatchObject({name: 'a.png', status: 200});
        expect(onMap.mock.calls[0][0].body.equals(PNG)).toBe(true);
        expect(await list()).toEqual(['b.png']);
    });

    test('passes a 404 to onMap and drops the name', async () => {
        const reply = await send('POST', '/map/a.png', {'X-Status': '404'});
        expect(reply.status).toBe(204);
        expect(onMap.mock.calls[0][0]).toMatchObject({name: 'a.png', status: 404});
        expect(await list()).toEqual(['b.png']);
    });

    test('keeps a 403 name pending', async () => {
        const reply = await send('POST', '/map/a.png', {'X-Status': '403'});
        expect(reply.status).toBe(204);
        expect(onMap.mock.calls[0][0]).toMatchObject({name: 'a.png', status: 403});
        expect(await list()).toEqual(['a.png', 'b.png']);
    });

    test('decodes an encoded name', async () => {
        await server.close();
        server = await startMapDownloadServer({origin: ORIGIN, names: ['PSG-0050_PGU.png'], onMap});
        const reply = await send('POST', `/map/${encodeURIComponent('PSG-0050_PGU.png')}`, {'X-Status': '404'});
        expect(reply.status).toBe(204);
        expect(onMap.mock.calls[0][0].name).toBe('PSG-0050_PGU.png');
    });

    test('refuses a foreign origin', async () => {
        const reply = await send('POST', '/map/a.png', {'X-Status': '200', Origin: 'https://evil.example'}, PNG);
        expect(reply.status).toBe(403);
        expect(onMap).not.toHaveBeenCalled();
        expect(await list()).toEqual(['a.png', 'b.png']);
    });

    test('refuses a request without origin', async () => {
        const reply = await new Promise<number>((resolve, reject) => {
            http.request({host: '127.0.0.1', port: server.port, method: 'GET', path: '/list'}, res => {
                res.resume();
                resolve(res.statusCode ?? 0);
            }).on('error', reject).end();
        });
        expect(reply).toBe(403);
    });

    test('refuses an unknown name', async () => {
        const reply = await send('POST', '/map/zzz.png', {'X-Status': '200'}, PNG);
        expect(reply.status).toBe(404);
        expect(onMap).not.toHaveBeenCalled();
    });

    test('refuses a malformed name', async () => {
        const reply = await send('POST', '/map/%E0%A4%A', {'X-Status': '404'});
        expect(reply.status).toBe(400);
        expect(onMap).not.toHaveBeenCalled();
    });

    test('refuses a 200 body that is not a PNG', async () => {
        const reply = await send('POST', '/map/a.png', {'X-Status': '200'}, Buffer.from('<html>'));
        expect(reply.status).toBe(400);
        expect(onMap).not.toHaveBeenCalled();
        expect(await list()).toEqual(['a.png', 'b.png']);
    });

    test('answers the preflight', async () => {
        const reply = await send('OPTIONS', '/map/a.png');
        expect(reply.status).toBe(204);
        expect(reply.headers['access-control-allow-origin']).toBe(ORIGIN);
        expect(reply.headers['access-control-allow-methods']).toBe('GET, POST');
        expect(reply.headers['access-control-allow-headers']).toBe('Content-Type, X-Status');
        expect(reply.headers['access-control-allow-private-network']).toBe('true');
    });

    test('handles uploads one at a time', async () => {
        const order: string[] = [];
        onMap.mockImplementation(async ({name}) => {
            order.push(`start ${name}`);
            await new Promise(r => setTimeout(r, 30));
            order.push(`end ${name}`);
        });
        await Promise.all([
            send('POST', '/map/a.png', {'X-Status': '404'}),
            send('POST', '/map/b.png', {'X-Status': '404'}),
        ]);
        expect(order).toEqual(['start a.png', 'end a.png', 'start b.png', 'end b.png']);
    });

    test('resolves done on POST /done', async () => {
        const reply = await send('POST', '/done');
        expect(reply.status).toBe(204);
        await expect(server.done).resolves.toBeUndefined();
    });

    test('calls onList on GET /list', async () => {
        await list();
        expect(onList).toHaveBeenCalledOnce();
    });

    test('answers 404 on an unknown path', async () => {
        expect((await send('GET', '/nope')).status).toBe(404);
    });
});

describe('pickLandingTile', () => {
    test('lands on the first tile already downloaded', () => {
        expect(pickLandingTile(['a.png', 'b.png', 'c.png'], ['a.png', 'c.png'])).toBe('b.png');
    });

    test('falls back to the first pending tile when every tile is pending', () => {
        expect(pickLandingTile(['a.png', 'b.png'], ['a.png', 'b.png'])).toBe('a.png');
    });
});
