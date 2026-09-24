import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const pagesDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'internal', 'templates', 'pages');

export function mountPage(name) {
    const lines = readFileSync(join(pagesDir, `${name}.gohtml`), 'utf8').split(/\r?\n/);
    const start = lines.findIndex(line => line.trim() === `{{define "pages/${name}"}}`);
    const end = lines.findIndex((line, index) => index > start && line.trim() === '{{end}}');
    if (start < 0 || end < 0) throw new Error(`No pages/${name} define in ${name}.gohtml`);

    const body = lines.slice(start + 1, end).join('\n');
    if (body.includes('{{')) throw new Error(`pages/${name} still holds a template action`);

    document.body.innerHTML = `<main id="page-content" data-page="${name}">${body}</main>`;
    return document.getElementById('page-content');
}
