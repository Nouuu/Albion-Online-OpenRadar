// 📊 Initialize Logger FIRST - before any other imports
// This ensures global.loggerServer is available when PhotonParser and Protocol16Deserializer load
import path from 'path';
import fs from 'fs';
import express from 'express';
import compression from 'compression';
import {WebSocketServer} from 'ws';
import LoggerServer from './server-scripts/LoggerServer.js';
import PhotonParser from './server-scripts/classes/PhotonPacketParser.js';
import {getAdapterIp} from './server-scripts/adapter-selector.js';
import {EventCodes} from './scripts/Utils/EventCodes.js';
import {runRuntimeChecks} from "./server-scripts/Utils/runtime-check.js";
import protocol16Deserializer from "./server-scripts/classes/Protocol16Deserializer.js";
import pkg from 'cap';
const {Cap, decoders} = pkg;

const port = 5001;
const wsPort = 5002;

const logger = new LoggerServer('./logs');
global.loggerServer = logger;
console.log('📊 [App] Logger initialized FIRST and exposed as global.loggerServer');

const {isPkg, ok} = runRuntimeChecks();
if (!ok && isPkg) {
    process.exit(1);
}
console.log('✅ Runtime check passed.');

const appDir = process.cwd();
console.log(`📦 Application running in ${isPkg ? 'packaged' : 'development'} mode.`);
console.log(`📂 App directory: ${appDir}`);

StartRadar(isPkg, appDir);

function StartRadar(isPkg, appDir) {
    protocol16Deserializer.initialize(appDir);

    startServer(appDir, port);
    const {wsServer, capInstance, bufferInstance} = startWebSocketServer(appDir, wsPort);
    const manager = new PhotonParser();

    capInstance.on('packet', function (nBytes) {
        const ret = decoders.Ethernet(bufferInstance);
        const ipRet = decoders.IPV4(bufferInstance, ret.offset);
        const udpRet = decoders.UDP(bufferInstance, ipRet.offset);
        const payload = bufferInstance.slice(udpRet.offset, nBytes);

        handlePayloadAsync(manager, payload).catch((error) => {
            console.error('Error handling payload:', error);
        });
    });

    handlePhotonEvents(wsServer, manager);
}

function startServer(appDir, port) {
    const app = express();
    const viewsPath = path.join(appDir, 'views');
    const imagesCacheDuration = 24 * 60 * 60 * 1000; // 24 hours
    const dataCacheDuration = 7 * 24 * 60 * 60 * 1000; // 7 days (game data changes rarely)

    app.set('views', viewsPath);
    app.set('view engine', 'ejs');
    app.use(express.static(viewsPath));

    app.get('/', (req, res) => {
        const viewName = 'main/drawing';
        res.render('layout', {mainContent: viewName});
    });

    app.get('/home', (req, res) => {
        const viewName = 'main/drawing';
        res.render('./layout', {mainContent: viewName});
    });

    app.get('/players', (req, res) => {
        const viewName = 'main/players';
        res.render('layout', {mainContent: viewName});
    });

    app.get('/resources', (req, res) => {
        const viewName = 'main/resources';
        res.render('layout', {mainContent: viewName});
    });

    app.get('/enemies', (req, res) => {
        const viewName = 'main/enemies';
        res.render('layout', {mainContent: viewName});
    });

    app.get('/chests', (req, res) => {
        const viewName = 'main/chests';
        res.render('layout', {mainContent: viewName});
    });

    app.get('/ignorelist', (req, res) => {
        const viewName = 'main/ignorelist';
        res.render('layout', {mainContent: viewName});
    });

    app.get('/settings', (req, res) => {
        const viewName = 'main/settings';
        res.render('layout', {mainContent: viewName});
    });

    app.get('/items', (req, res) => {
        const viewName = 'main/drawing-items';
        res.render('layout', {mainContent: viewName});
    });

    app.get('/map', (req, res) => {
        const viewName = 'main/map';
        res.render('layout', {mainContent: viewName});
    });

    app.get('/radar-overlay', (req, res) => {
        res.render('main/radar-overlay');
    });


    app.get('/api/settings/server-logs', (req, res) => {
        res.json({enabled: global.loggerServer.isEnabled()});
    });
    app.post('/api/settings/server-logs', express.json(), (req, res) => {
        const {enabled} = req.body;
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({error: 'Invalid value for enabled, must be boolean'});
        }
        global.loggerServer.setEnabled(enabled);
        res.json({
            success: true,
            enabled: global.loggerServer.isEnabled()
        });
    });

    app.use('/images', express.static(path.join(appDir, 'images'), {maxAge: imagesCacheDuration}));

    // Serve ao-bin-dumps with compression and long-term caching
    app.use('/ao-bin-dumps', (req, res, next) => {
        const acceptsGzip = req.headers['accept-encoding']?.includes('gzip');
        const dataDir = path.join(appDir, 'public', 'ao-bin-dumps');
        const requestedFile = path.join(dataDir, req.path);
        const gzFile = requestedFile + '.gz';

        // If .gz exists and client accepts gzip, serve it
        if (acceptsGzip && fs.existsSync(gzFile)) {
            res.setHeader('Content-Encoding', 'gzip');
            res.setHeader('Content-Type', req.path.endsWith('.json') ? 'application/json' : 'application/xml');
            res.setHeader('Cache-Control', `public, max-age=${Math.floor(dataCacheDuration / 1000)}, must-revalidate`);
            res.setHeader('Vary', 'Accept-Encoding');
            return res.sendFile(gzFile);
        }
        next();
    });

    // Fallback: serve original files with dynamic compression (dev mode)
    app.use('/ao-bin-dumps',
        compression({level: 6, threshold: 1024}),
        express.static(path.join(appDir, 'public', 'ao-bin-dumps'), {
            maxAge: dataCacheDuration,
            setHeaders: (res, filePath) => {
                const ext = path.extname(filePath).toLowerCase();
                if (ext === '.json' || ext === '.xml') {
                    res.setHeader('Cache-Control', `public, max-age=${Math.floor(dataCacheDuration / 1000)}, must-revalidate`);
                    res.setHeader('Vary', 'Accept-Encoding');
                }
            }
        })
    );

    app.use('/scripts', express.static(path.join(appDir, 'scripts')));
    app.use('/sounds', express.static(path.join(appDir, 'sounds')));

    // SPA test route - serve public/ directory
    app.use('/public', express.static(path.join(appDir, 'public')));
    app.get('/spa', (req, res) => {
        res.sendFile(path.join(appDir, 'public', 'index.html'));
    });
    app.use('/pages', express.static(path.join(appDir, 'public', 'pages')));

    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
    return app;
}

function startWebSocketServer(appDir, wsPort) {
    const c = new Cap();
    const ipFilePath = path.join(appDir, 'ip.txt');

    let adapterIp = fs.existsSync(ipFilePath) ?
        fs.readFileSync(ipFilePath, {encoding: 'utf-8', flag: 'r'}).trim() :
        getAdapterIp(appDir);

    console.log(`Using adapter IP: ${adapterIp}`);

    let device = Cap.findDevice(adapterIp);
    while (device === undefined) {
        console.log(`Adapter with IP ${adapterIp} not found. Please select a new adapter.`);
        adapterIp = getAdapterIp(appDir);
        device = Cap.findDevice(adapterIp);
    }

    const filter = 'udp and (dst port 5056 or src port 5056)';
    const bufSize = 4096;
    const buffer = Buffer.alloc(4096);

    c.open(device, filter, bufSize, buffer);
    c.setMinBytes && c.setMinBytes(0);
    const wsServer = new WebSocketServer({port: wsPort, host: 'localhost'});
    console.log(`📡 WebSocket server started on ws://localhost:${wsPort}`);

    return {wsServer , capInstance: c, bufferInstance: buffer};
}

function handlePhotonEvents(server, manager) {
    BigInt.prototype.toJSON = function() { return this.toString() }
    server.on('listening', () => {
        manager.on('event', (dictionary) => {
            const eventCode = dictionary["parameters"][252];

            switch (eventCode) {
                case EventCodes.CharacterEquipmentChanged:
                    server.clients.forEach(function (client) {
                        client.send(JSON.stringify({code: "items", dictionary: JSON.stringify(dictionary)}));
                    });
                    break;
                default:
                    server.clients.forEach(function (client) {
                        client.send(JSON.stringify({code: "event", dictionary: JSON.stringify(dictionary)}));
                    });
                    break;
            }
        });

        manager.on('request', (dictionary) => {
            const dictionaryDataJSON = JSON.stringify(dictionary);
            server.clients.forEach(function (client) {
                client.send(JSON.stringify({code: "request", dictionary: dictionaryDataJSON}))
            });
        });

        manager.on('response', (dictionary) => {
            const dictionaryDataJSON = JSON.stringify(dictionary);
            server.clients.forEach(function (client) {
                client.send(JSON.stringify({code: "response", dictionary: dictionaryDataJSON}))
            });
        });
    });
    server.on('connection', (ws) => {
        console.log('📡 [App] Client connected to WebSocket');
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);

                // Handle logs from client
                if (data.type === 'logs' && Array.isArray(data.logs)) {
                    logger.writeLogs(data.logs);
                }
            } catch (error) {
                console.error('❌ [App] Error processing WebSocket message:', error);
            }
        });

        ws.on('close', () => {
            console.log('📡 [App] Client disconnected from WebSocket');
        });
    });

    server.on('close', () => {
        console.log('closed')
        manager.removeAllListeners()
    })
}

async function handlePayloadAsync(manager, payload) {
    try {
        manager.handle(payload);
    } catch (error) {
        console.error('Error processing the payload:', error);
    }
}