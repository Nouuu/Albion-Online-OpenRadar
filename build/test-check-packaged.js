// Script de test: simule le mode packagé en définissant process.pkg et en appelant runRuntimeChecks()
(function(){
  console.log('Simulate packaged environment for runtime-check');
  // Simuler process.pkg
  process.pkg = {};
  const { runRuntimeChecks } = require('../scripts/Utils/runtime-check');
  const ok = runRuntimeChecks();
  console.log('runRuntimeChecks returned:', ok);
  process.exit(ok ? 0 : 1);
})();

