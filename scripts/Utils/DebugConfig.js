// filepath: C:\Projets\Albion-Online-ZQRadar\scripts\Utils\DebugConfig.js

/**
 * 🐛 DEBUG CONFIGURATION
 *
 * Activer/désactiver les logs de debug selon DOCS_GUIDE.md
 *
 * Usage:
 *   - Ouvrir la console navigateur (F12)
 *   - Taper: window.debugLogs = true
 *   - Recharger la page pour activer les logs
 *
 * Logs activés quand window.debugLogs = true :
 *   ✅ Découverte d'ItemIds (HarvestablesHandler)
 *   ✅ Tracking de ressources (NewSimpleItem)
 *   ✅ Cache HarvestUpdateEvent
 *   ✅ Erreurs/Warnings importants
 *
 * Logs désactivés par défaut :
 *   ❌ Tous les événements réseau
 *   ❌ Mise à jour de positions
 *   ❌ Logs verbose de récolte
 */

// Par défaut: logs désactivés (production)
window.debugLogs = false;

// Pour activer temporairement :
// window.debugLogs = true;

console.log(`🐛 [DebugConfig] Debug logs: ${window.debugLogs ? 'ENABLED ✅' : 'DISABLED ❌'}`);
console.log('💡 [DebugConfig] To enable: window.debugLogs = true');

