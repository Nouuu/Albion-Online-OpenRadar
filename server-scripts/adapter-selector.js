import { networkInterfaces } from 'os';
import fs from 'fs';
import path from 'path';
import readlineSync from 'readline-sync';

function printAdapters(adapters) {
    console.log('\nVeuillez sélectionner l\'adaptateur utilisé pour vous connecter à Internet :');
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
        const input = readlineSync.question('Entrez le numéro de l\'adaptateur : ');
        selectedIdx = parseInt(input, 10) - 1;
        if (adapters[selectedIdx]) break;
        console.clear();
        console.log('Entrée invalide, réessayez.\n');
    }

    const selected = adapters[selectedIdx];
    console.log(`\nVous avez sélectionné "${selected.name} - ${selected.address}"\n`);

    const ipFilePath = path.join(appDir, 'ip.txt');
    try {
        fs.writeFileSync(ipFilePath, selected.address);
    } catch {
        console.log('Erreur lors de la sauvegarde de l\'IP.');
    }

    return selected.address;
};

export { getAdapterIp };
