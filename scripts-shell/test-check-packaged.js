// Test script: simulates packaged mode by setting process.pkg and calling runRuntimeChecks()
import {runRuntimeChecks} from '../server-scripts/Utils/runtime-check';

(function () {
    console.log('Simulate packaged environment for runtime-check');
    // Simuler process.pkg
    process.pkg = {};
    const ok = runRuntimeChecks();
    console.log('runRuntimeChecks returned:', ok);
    process.exit(ok ? 0 : 1);
})();
