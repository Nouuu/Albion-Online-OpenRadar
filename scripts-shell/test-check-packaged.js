// Script de test: simule le mode packagé en définissant process.pkg et en appelant runRuntimeChecks()
import {runRuntimeChecks} from '../server-scripts/Utils/runtime-check';

(function () {
    console.log('Simulate packaged environment for runtime-check');
    // Simuler process.pkg
    process.pkg = {};
    const ok = runRuntimeChecks();
    console.log('runRuntimeChecks returned:', ok);
    process.exit(ok ? 0 : 1);
})();

