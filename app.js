const express = require('express');
const PhotonParser = require('./scripts/classes/PhotonPacketParser');
var Cap = require('cap').Cap;
var decoders = require('cap').decoders;
const WebSocket = require('ws');

const fs = require("fs");
const path = require("path");

// Runtime checks: use lightweight module included in the packaged executable
try {
  const { runRuntimeChecks } = require('./scripts/Utils/runtime-check');
  const ok = runRuntimeChecks();
  const isPkg = typeof process.pkg !== 'undefined';
  if (!ok && isPkg) {
    console.error('Startup runtime check failed: Npcap >= 1.84 required. Aborting.');
    process.exit(1);
  } else if (!ok) {
    console.warn('Runtime check reported issues; continuing in development mode.');
  }
} catch (e) {
    console.warn('Runtime check module not available:', e?.message ?? e);
}

const { getAdapterIp } = require('./server-scripts/adapter-selector');
const LoggerServer = require('./server-scripts/LoggerServer');

const EventCodes = require('./scripts/Utils/EventCodesApp.js')

// Detect if application is packaged with pkg
const isPkg = typeof process.pkg !== 'undefined';
const appDir = isPkg ? path.dirname(process.execPath) : __dirname;

StartRadar();

function StartRadar()
{
  const app = express();

  BigInt.prototype.toJSON = function() { return this.toString() }

  // Configure views directory for pkg compatibility
  // When packaged with pkg, EJS needs access to real files
  const viewsPath = isPkg ? path.join(appDir, 'views') : path.join(__dirname, 'views');
  app.set('views', viewsPath);
  app.set('view engine', 'ejs');
  app.use(express.static(viewsPath));


  app.get('/', (req, res) => {
    const viewName = 'main/home'; 
    res.render('layout', { mainContent: viewName});
  });

  app.get('/home', (req, res) => {
    const viewName = 'main/home'; 
    res.render('./layout', { mainContent: viewName});
  });

  app.get('/resources', (req, res) => {
    const viewName = 'main/resources'; 
    res.render('layout', { mainContent: viewName });
  });

  app.get('/enemies', (req, res) => {
    const viewName = 'main/enemies'; 
    res.render('layout', { mainContent: viewName });
  });

  app.get('/chests', (req, res) => {
    const viewName = 'main/chests'; 
    res.render('layout', { mainContent: viewName });
  });

  app.get('/map', (req, res) => {
    const viewName = 'main/map';
    const viewRequireName = 'main/require-map'

    fs.access(path.join(appDir, 'images', 'Maps'), function(error) {
      if (error)
      {
        res.render('layout', { mainContent: viewRequireName });
      }
      else
      {
        res.render('layout', { mainContent: viewName });
      }
    });
  });

  app.get('/ignorelist', (req, res) => {
    const viewName = 'main/ignorelist'; 
    res.render('layout', { mainContent: viewName });
  });

  app.get('/settings', (req, res) => {
    const viewName = 'main/settings'; 
    res.render('layout', { mainContent: viewName });
  });



  app.get('/drawing', (req, res) => {
    const viewName = 'main/drawing';
    res.render('layout', { mainContent: viewName });
  });

  app.get('/items', (req, res) => {

    res.render('main/drawing-items');
  });

  app.get('/radar-overlay', (req, res) => {

    res.render('main/radar-overlay');
  });

  app.get('/stats', (req, res) => {
    const viewName = 'main/stats';
    res.render('layout', { mainContent: viewName });
  });

  /*app.get('/logout', (req, res) => {

    req.session.destroy();
    res.redirect('/');
  });*/



  app.use('/scripts', express.static(path.join(appDir, 'scripts')));
  app.use('/scripts/Handlers', express.static(path.join(appDir, 'scripts', 'Handlers')));
  app.use('/scripts/Drawings', express.static(path.join(appDir, 'scripts', 'Drawings')));
  app.use('/scripts/Utils', express.static(path.join(appDir, 'scripts', 'Utils')));
  app.use('/scripts/Utils/languages', express.static(path.join(appDir, 'scripts', 'Utils', 'languages')));
  app.use('/scripts/styles', express.static(path.join(appDir, 'scripts', 'styles')));
  app.use('/images/Resources', express.static(path.join(appDir, 'images', 'Resources')));
  app.use('/images/Maps', express.static(path.join(appDir, 'images', 'Maps')));
  app.use('/images/Items', express.static(path.join(appDir, 'images', 'Items')));
  app.use('/images/Flags', express.static(path.join(appDir, 'images', 'Flags')));
  app.use('/sounds', express.static(path.join(appDir, 'sounds')));
  app.use('/config', express.static(path.join(appDir, 'config')));
  app.use('/server-scripts', express.static(path.join(appDir, 'server-scripts')));



  const port = 5001;


  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    // Open the browser only once to avoid opening a new tab on every nodemon restart.
    // We use a small lock file `.browser_opened` in appDir to remember that we've already opened it.
    // You can force open with an env var FORCE_BROWSER_OPEN=1 or by passing --open as an argument.
    try {
      const browserFlagPath = path.join(appDir, '.browser_opened');
      const forceOpen = process.env.FORCE_BROWSER_OPEN === '1' || process.argv.includes('--open');
      if (forceOpen || !fs.existsSync(browserFlagPath)) {
        require('child_process').exec(`start http://localhost:${port}`);
        try { fs.writeFileSync(browserFlagPath, Date.now().toString(), { encoding: 'utf8' }); } catch (e) { /* non-fatal */ }
      }
    } catch (err) {
      console.error('Error while trying to open the browser:', err);
    }
  });


  var c = new Cap();

  let adapterIp;
  // In build mode (pkg): ip.txt next to executable
  // In dev mode: ip.txt in server-scripts/
  const ipFilePath = isPkg ? path.join(appDir, 'ip.txt') : path.join(appDir, 'server-scripts', 'ip.txt');

  if (fs.existsSync(ipFilePath))
    adapterIp = fs.readFileSync(ipFilePath, { encoding: 'utf-8', flag: 'r' }).trim();


  if (!adapterIp)
  {
    adapterIp = getAdapterIp()
  }
  else
  {
    console.log();
    console.log(`Using last adapter selected - ${adapterIp}`);
    console.log('If you want to change adapter, delete the  "ip.txt"  file.');
    console.log();
  }

  let device = Cap.findDevice(adapterIp);

  if (device == undefined)
  {
    console.log();
    console.log(`Last adapter is not working, please choose a new one.`);
    console.log();

    adapterIp = getAdapterIp();
    device = Cap.findDevice(adapterIp);
  }

  const filter = 'udp and (dst port 5056 or src port 5056)';
  var bufSize =  4096;
  var buffer = Buffer.alloc(4096);
  const manager = new PhotonParser();
  var linkType = c.open(device, filter, bufSize, buffer);
  // 📊 Initialize Logger Server
  const logger = new LoggerServer('./logs');
  console.log('📊 [App] Logger initialized');


  c.setMinBytes && c.setMinBytes(0);


  async function handlePayloadAsync(payload) {
    try {
      manager.handle(payload);
    } catch (error) {
      console.error('Error processing the payload:', error);
    }
  }

  // setup Cap event listener on global level
  c.on('packet', function (nbytes, trunc) {
    const ret = decoders.Ethernet(buffer);
    const ipRet = decoders.IPV4(buffer, ret.offset);
    const udpRet = decoders.UDP(buffer, ipRet.offset);
  
    // Slice the buffer to get the actual payload from the offset where the UDP packet data starts
    const payload = buffer.slice(udpRet.offset, nbytes);
  
    // Call the asynchronous handler
    handlePayloadAsync(payload);
  });

  const server = new WebSocket.Server({ port: 5002, host: 'localhost'});
  server.on('listening', () => {
    manager.on('event', (dictonary) =>
    {
      const eventCode = dictonary["parameters"][252];

      switch (eventCode) {
        case EventCodes.EventCodes.NewCharacter:
        case EventCodes.EventCodes.Leave:
        case EventCodes.EventCodes.CharacterEquipmentChanged:
          server.clients.forEach(function(client) {
            client.send(JSON.stringify({ code : "items", dictionary: JSON.stringify(dictonary) }));
          });
      
        default:
          server.clients.forEach(function(client) {
            client.send(JSON.stringify({ code : "event", dictionary: JSON.stringify(dictonary) }));
          });
          break;
      }

      /*const dictionaryDataJSON = JSON.stringify(dictonary);
      server.clients.forEach(function(client) {
        client.send(JSON.stringify({ code : "event", dictionary: dictionaryDataJSON }))
      });*/
    });

    
    manager.on('request', (dictonary) =>
    {
      const dictionaryDataJSON = JSON.stringify(dictonary);
      server.clients.forEach(function(client) {
        client.send(JSON.stringify({ code : "request", dictionary: dictionaryDataJSON }))
      });
    });

    manager.on('response', (dictonary) =>
    {
      const dictionaryDataJSON = JSON.stringify(dictonary);
      server.clients.forEach(function(client) {
        client.send(JSON.stringify({ code : "response", dictionary: dictionaryDataJSON }))
      });
    });
  });

  // 📊 WebSocket connection handler for client logs
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
  // 📊 WebSocket connection handler for client logs
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