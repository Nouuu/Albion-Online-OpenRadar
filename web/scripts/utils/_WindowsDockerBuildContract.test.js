import {readFileSync} from 'node:fs';
import {describe, expect, test} from 'vitest';

const dockerfile = readFileSync('Dockerfile.windows', 'utf8');

describe('Windows Docker build frontend assets', () => {
    test('builds and embeds the generated Tailwind stylesheet', () => {
        expect(dockerfile).toContain('AS frontend');
        expect(dockerfile).toContain('RUN npm ci');
        expect(dockerfile).toContain('RUN npm run build');
        expect(dockerfile).toContain(
            'COPY --from=frontend /app/web/styles/tailwind.css ./web/styles/tailwind.css',
        );
    });
});
