import { networkInterfaces } from 'os';
import fs from 'fs';
import path from 'path';
import readlineSync from 'readline-sync';

function printAdapters(adapters) {
    console.log('\nPlease select the adapter used to connect to the Internet:');
    adapters.forEach((adapter, idx) => {
        console.log(`  ${idx + 1}. ${adapter.name}\t ip address: ${adapter.address}`);
    });
    console.log();
}

const getAdapterIp = (appDir) => {
    const interfaces = networkInterfaces();
    const adapters = Object.entries(interfaces)
        .map(([name, values]) => {
            const detail = values.find(v => v.family === 'IPv4');
            return detail ? { name, address: detail.address } : null;
        })
        .filter(Boolean);

    let selectedIdx;
    while (true) {
        printAdapters(adapters);
        const input = readlineSync.question('Enter the adapter number: ');
        selectedIdx = parseInt(input, 10) - 1;
        if (adapters[selectedIdx]) break;
        console.clear();
        console.log('Invalid input, please try again.\n');
    }

    const selected = adapters[selectedIdx];
    console.log(`\nYou have selected "${selected.name} - ${selected.address}"\n`);

    const ipFilePath = path.join(appDir, 'ip.txt');
    try {
        fs.writeFileSync(ipFilePath, selected.address);
    } catch {
        console.log('Error while saving the IP address.');
    }

    return selected.address;
};

export { getAdapterIp };
