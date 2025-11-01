/**
 * Analyse des logs terrain pour détecter les erreurs de TypeID
 * Compare typeNumber du jeu vs notre classification
 */

const fs = require('fs');

console.log('🔍 Analyse des logs terrain pour détecter les erreurs de TypeID...\n');

// Lire LOGS.json
const logs = fs.readFileSync('LOGS.json', 'utf8');
const lines = logs.split('\n').filter(l => l.trim());

// Lire notre MobsInfo.js
const mobsInfoContent = fs.readFileSync('scripts/Handlers/MobsInfo.js', 'utf8');
const regex = /addItem\((\d+),\s*(\d+),\s*(\d+),\s*"(.+?)"\)/g;
let match;
const ourData = new Map();

while ((match = regex.exec(mobsInfoContent)) !== null) {
    const [_, typeId, tier, type, name] = match;
    ourData.set(parseInt(typeId), {
        tier: parseInt(tier),
        type: parseInt(type),
        name: name
    });
}

console.log(`📊 Notre base de données: ${ourData.size} TypeIDs\n`);

// Mapping typeNumber → Type attendu
const typeNumberToType = {
    0: 'Log', 1: 'Log', 2: 'Log', 3: 'Log', 4: 'Log', 5: 'Log',
    6: 'Rock', 7: 'Rock', 8: 'Rock', 9: 'Rock', 10: 'Rock',
    11: 'Fiber', 12: 'Fiber', 13: 'Fiber', 14: 'Fiber', 15: 'Fiber',
    16: 'Hide', 17: 'Hide', 18: 'Hide', 19: 'Hide', 20: 'Hide', 21: 'Hide', 22: 'Hide',
    23: 'Ore', 24: 'Ore', 25: 'Ore', 26: 'Ore', 27: 'Ore'
};

// Analyser les logs
const errors = [];
const warnings = [];
const stats = { total: 0, mismatches: 0, gameOverrides: 0 };

lines.forEach(line => {
    try {
        if (!line.includes('STATIC_REGISTER') && !line.includes('STATIC_UPDATE')) return;

        const json = JSON.parse(line.split(/MobsHandler\.js:\d+\s+/)[1]);

        if (json.event !== 'STATIC_REGISTER' && json.event !== 'STATIC_UPDATE') return;

        stats.total++;

        const typeId = json.typeId;
        const typeNumber = json.typeNumber;
        const resourceType = json.resourceType;
        const tier = json.tier;
        const source = json.source;

        const ours = ourData.get(typeId);
        const expectedFromGame = typeNumberToType[typeNumber];

        // Cas 1: TypeID dans notre base
        if (ours) {
            // Vérifier si notre type matche le typeNumber du jeu
            if (expectedFromGame && ours.name !== expectedFromGame) {
                if (source === 'mobinfo') {
                    // On override volontairement (ex: Fiber 530/531)
                    warnings.push({
                        typeId,
                        tier,
                        ours: ours.name,
                        game: expectedFromGame,
                        typeNumber,
                        reason: 'Override intentionnel (bug serveur Albion)'
                    });
                    stats.gameOverrides++;
                } else {
                    // Mismatch non voulu !
                    errors.push({
                        typeId,
                        tier,
                        ours: ours.name,
                        game: expectedFromGame,
                        typeNumber,
                        resourceType
                    });
                    stats.mismatches++;
                }
            }
        } else {
            // Cas 2: TypeID absent de notre base
            errors.push({
                typeId,
                tier,
                ours: 'ABSENT',
                game: expectedFromGame,
                typeNumber,
                resourceType
            });
            stats.mismatches++;
        }

    } catch (e) {
        // Ligne invalide, ignorer
    }
});

console.log('=' .repeat(80));
console.log('📋 RÉSULTATS DE L\'ANALYSE DES LOGS\n');

console.log(`📊 Statistiques:`);
console.log(`   Total events analysés: ${stats.total}`);
console.log(`   Overrides intentionnels: ${stats.gameOverrides} (Fiber 530/531)`);
console.log(`   Erreurs détectées: ${stats.mismatches}\n`);

if (errors.length > 0) {
    console.log(`❌ ${errors.length} ERREURS DÉTECTÉES:\n`);

    // Grouper par TypeID
    const byTypeId = {};
    errors.forEach(e => {
        if (!byTypeId[e.typeId]) byTypeId[e.typeId] = [];
        byTypeId[e.typeId].push(e);
    });

    for (const [typeId, items] of Object.entries(byTypeId)) {
        const first = items[0];
        console.log(`TypeID ${typeId}:`);
        console.log(`   NOUS: ${first.ours} T${first.tier}`);
        console.log(`   JEU:  ${first.game} (typeNumber=${first.typeNumber})`);
        console.log(`   → ${items.length} occurrences dans les logs\n`);
    }

    // Générer les corrections
    console.log('🔧 CORRECTIONS À APPLIQUER:\n');

    for (const [typeId, items] of Object.entries(byTypeId)) {
        const first = items[0];
        if (first.ours === 'ABSENT') {
            console.log(`this.addItem(${typeId}, ${first.tier}, 0, "${first.game}"); // Manquant`);
        } else {
            console.log(`// TypeID ${typeId}: ${first.ours} → ${first.game}`);
            console.log(`this.addItem(${typeId}, ${first.tier}, 0, "${first.game}"); // Corriger`);
        }
    }
    console.log();

} else {
    console.log('✅ Aucune erreur détectée dans les logs!\n');
}

if (warnings.length > 0) {
    console.log(`⚠️  ${warnings.length} OVERRIDES INTENTIONNELS (OK):\n`);

    const byTypeId = {};
    warnings.forEach(w => {
        if (!byTypeId[w.typeId]) byTypeId[w.typeId] = w;
    });

    for (const [typeId, w] of Object.entries(byTypeId)) {
        console.log(`TypeID ${typeId}: ${w.ours} T${w.tier} (override game=${w.game})`);
        console.log(`   → ${w.reason}\n`);
    }
}

// Liste des TypeID avec override suspect (jeu dit Hide mais on dit autre chose)
const suspectOverrides = warnings.filter(w => w.game === 'Hide' && w.ours !== 'Hide');

if (suspectOverrides.length > 0) {
    console.log(`🚨 ${suspectOverrides.length} TYPEIDS SUSPECTS À VÉRIFIER EN JEU:\n`);
    console.log('Ces TypeID ont un override mais le jeu dit Hide (typeNumber=16).');
    console.log('Vérifiez EN JEU quelle ressource c\'est réellement:\n');

    suspectOverrides.forEach(s => {
        console.log(`TypeID ${s.typeId}:`);
        console.log(`   NOTRE BASE: ${s.ours} T${s.tier}`);
        console.log(`   JEU ENVOIE: ${s.game} (typeNumber=${s.typeNumber})`);
        console.log(`   ⚠️  À VÉRIFIER: Tuez cette ressource en jeu et notez ce que c'est !\n`);
    });

    console.log('💡 Comment vérifier:');
    console.log('   1. Activez les logs living resources');
    console.log('   2. Trouvez en jeu une ressource avec ce TypeID');
    console.log('   3. AVANT de la tuer, notez si c\'est Fiber, Hide, Wood, etc.');
    console.log('   4. Comparez avec nos logs\n');
}

console.log('=' .repeat(80));

// Sauvegarder les erreurs
if (errors.length > 0) {
    fs.writeFileSync('TYPEIDS_ERRORS.json', JSON.stringify(errors, null, 2));
    console.log('\n📁 Fichier TYPEIDS_ERRORS.json généré pour analyse détaillée\n');
}

// Sauvegarder les suspects
if (suspectOverrides.length > 0) {
    fs.writeFileSync('TYPEIDS_SUSPECTS.json', JSON.stringify(suspectOverrides, null, 2));
    console.log('📁 Fichier TYPEIDS_SUSPECTS.json généré (TypeID à vérifier en jeu)\n');
}

