/**
 * Créer une liste de tous les TypeID suspects à vérifier en jeu
 * Basé sur les patterns d'overrides détectés
 */

const fs = require('fs');

console.log('🔍 Recherche de tous les TypeID suspects...\n');

// Lire MobsInfo.js
const content = fs.readFileSync('scripts/Handlers/MobsInfo.js', 'utf8');
const regex = /addItem\((\d+),\s*(\d+),\s*(\d+),\s*"(.+?)"\)/g;
let match;
const allTypeIds = [];

while ((match = regex.exec(content)) !== null) {
    const [_, typeId, tier, type, name] = match;
    allTypeIds.push({
        typeId: parseInt(typeId),
        tier: parseInt(tier),
        type: parseInt(type),
        name: name
    });
}

console.log(`📊 Total: ${allTypeIds.size} TypeIDs dans notre base\n`);

// Patterns suspects identifiés
// TypeID 528, 530, 531 = Fiber mais jeu envoie typeNumber=16 (Hide)
// Pattern: Range 528-531 semble buggée

console.log('🚨 TypeID SUSPECTS (même range que 528-531):\n');
console.log('Ces TypeID sont dans le même range que les TypeID buggés confirmés.');
console.log('À vérifier en jeu si ce sont vraiment Rock/Fiber ou autre chose:\n');

// Range suspect: 523-537 (Roads Rock/Fiber)
const suspectRange = allTypeIds.filter(t => t.typeId >= 523 && t.typeId <= 537);

suspectRange.forEach(t => {
    const status = [528, 530, 531].includes(t.typeId) ? '✅ CORRIGÉ' : '⚠️  À VÉRIFIER';
    console.log(`TypeID ${t.typeId}: ${t.name} T${t.tier} ${status}`);
});

console.log('\n💡 ACTIONS RECOMMANDÉES:\n');
console.log('1. Effacer le cache TypeID (bouton dans le radar)');
console.log('2. Recharger la page');
console.log('3. Aller en zone Roads (Fiber/Rock/Ore)');
console.log('4. Activer logs living resources');
console.log('5. Pour CHAQUE TypeID de la liste ci-dessus:');
console.log('   a. Trouver la ressource vivante');
console.log('   b. Noter VISUELLEMENT ce que c\'est (Fiber/Rock/etc)');
console.log('   c. Tuer la ressource');
console.log('   d. Noter le typeNumber dans les logs');
console.log('   e. Si mismatch → me transmettre: "TypeID XXX = Type réel"\n');

console.log('📋 Template de rapport:\n');
console.log('```');
suspectRange
    .filter(t => ![528, 530, 531].includes(t.typeId))
    .forEach(t => {
        console.log(`TypeID ${t.typeId}: [À remplir après vérification en jeu]`);
    });
console.log('```\n');

// Chercher d'autres patterns suspects
console.log('🔍 Autres ranges à surveiller:\n');

const ranges = [
    { name: 'Roads Fiber', start: 553, end: 567 },
    { name: 'Roads Rock', start: 523, end: 537 },
    { name: 'Roads Ore', start: 538, end: 552 },
    { name: 'Mists Fiber Green', start: 586, end: 591 },
    { name: 'Mists Rock Green', start: 574, end: 579 },
];

ranges.forEach(range => {
    const items = allTypeIds.filter(t => t.typeId >= range.start && t.typeId <= range.end);
    console.log(`${range.name} (${range.start}-${range.end}): ${items.length} TypeIDs`);

    // Vérifier si tous sont du même type
    const types = [...new Set(items.map(i => i.name))];
    if (types.length > 1) {
        console.log(`   ⚠️  ATTENTION: Plusieurs types dans ce range: ${types.join(', ')}`);
    }
});

console.log('\n' + '='.repeat(80));

