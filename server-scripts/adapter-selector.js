const { networkInterfaces } = require('os')
const readlineSync = require('readline-sync');
const fs = require('node:fs');
const path = require('path');

// Detect if application is packaged with pkg
const isPkg = typeof process.pkg !== 'undefined';
// In build mode: ip.txt next to executable
// In dev mode: ip.txt in server-scripts/
const appDir = isPkg ? path.dirname(process.execPath) : __dirname;

const getAdapterIp = () => {
    const interfaces = networkInterfaces();

    console.log();
    console.log('Please select one of the adapter that you use to connect to the internet:');

    let i = 1;
    const selection = {};
    const selectionName = {};
    for (const [name, value] of Object.entries(interfaces)) {
        const detail = value.find(v => v.family === 'IPv4');
        if (!detail) continue;
        selection[i] = detail.address;
        selectionName[i] = name;
        console.log(`  ${i}. ${name}\t ip address: ${detail.address}`);
        i++;
    }

    let selectedIp;
    let selectedName;

    while (true)
    {
        console.log();
        let userSelect = readlineSync.question('input the number here: ');
        selectedIp = selection[userSelect];
        selectedName = selectionName[userSelect];

        if (selectedIp)
            break;

        console.clear();
        console.log('Invalid input, try again');
        console.log();

        console.log();
        console.log('Please select one of the adapter that you use to connect to the internet:');
        
        for (let j = 1; j < i; j++)
        {
            console.log(`  ${j}. ${selectionName[j]}\t ip address: ${selection[j]}`);
        }
    }

    console.log();
    console.log(`You have selected "${selectedName} - ${selectedIp}"`);
    console.log();

    const ipFilePath = path.join(appDir, 'ip.txt');
    fs.writeFile(ipFilePath, selectedIp, (err) => {
        if (err)
            console.log("Error when saving ip.")
    });

    return selectedIp;
}

module.exports = {
    getAdapterIp,
}