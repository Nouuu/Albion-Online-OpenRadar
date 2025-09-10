const express = require('express');
const PhotonParser = require('./scripts/classes/PhotonPacketParser');
var Cap = require('cap').Cap;
var decoders = require('cap').decoders;
const WebSocket = require('ws');

const fs = require("fs");

const { getAdapterIp } = require('./server-scripts/adapter-selector');

const EventCodes = require('./scripts/Utils/EventCodesApp.js')

StartRadar();

function StartRadar()
{
  const app = express();

  BigInt.prototype.toJSON = function() { return this.toString() }

  app.use(express.static(__dirname + '/views'));
  app.set('view engine', 'ejs');


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

    fs.access("./images/Maps", function(error) {
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

    res.render('main/drawing');
  });

  app.get('/items', (req, res) => {

    res.render('main/drawing-items');
  });

  /*app.get('/logout', (req, res) => {

    req.session.destroy();
    res.redirect('/');
  });*/



  app.use('/scripts', express.static(__dirname + '/scripts'));
  app.use('/scripts/Handlers', express.static(__dirname + '/scripts/Handlers'));
  app.use('/scripts/Drawings', express.static(__dirname + '/scripts/Drawings'));
  app.use('/scripts/Utils', express.static(__dirname + '/scripts/Utils'));
  app.use('/scripts/Utils/languages', express.static(__dirname + '/scripts/Utils/languages'));
  app.use('/images/Resources', express.static(__dirname + '/images/Resources'));
  app.use('/images/Maps', express.static(__dirname + '/images/Maps'));
  app.use('/images/Items', express.static(__dirname + '/images/Items'));
  app.use('/images/Flags', express.static(__dirname + '/images/Flags'));
  app.use('/sounds', express.static(__dirname + '/sounds'));
  app.use('/config', express.static(__dirname + '/config'));



  const port = 5001;


  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    //open(`http://localhost:${port}`);
    require('child_process').exec(`start http://localhost:${port}`);
  });


  var c = new Cap();

  let adapterIp;

  if (fs.existsSync('ip.txt'))
    adapterIp = fs.readFileSync('ip.txt', { encoding: 'utf-8', flag: 'r' })
    

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

  server.on('close', () => {
    console.log('closed')
    manager.removeAllListeners()
  })
}