// Test script: simulates packaged mode by setting process.pkg and calling runRuntimeChecks()
import {runRuntimeChecks} from '../server-scripts/Utils/runtime-check.js';

(function () {
    console.log('Simulate packaged environment for runtime-check');
    // Simulate process.pkg
    process.pkg = {};
    const result = runRuntimeChecks();
    console.log('runRuntimeChecks returned:', result);
    process.exit(result.ok ? 0 : 1);
})();
