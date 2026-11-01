import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'happy-dom',
        // Node 25+ defines a native localStorage global that vitest keeps over the happy-dom one.
        execArgv: ['--no-experimental-webstorage'],
        include: ['web/scripts/**/_*.test.js', 'tools/**/_*.test.ts'],
        globals: false
    }
});
