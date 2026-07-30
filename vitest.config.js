import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'happy-dom',
        include: ['web/scripts/**/_*.test.js', 'tools/**/_*.test.ts'],
        globals: false
    }
});
