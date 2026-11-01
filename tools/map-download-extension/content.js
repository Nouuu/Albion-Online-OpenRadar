(async () => {
    const match = location.hash.match(/^#openradar=(\d+)$/);
    if (!match || !document.contentType.startsWith('image/')) return;

    const server = `http://127.0.0.1:${match[1]}`;
    const base = location.href.replace(/[^/]*$/, '');
    const names = await (await fetch(`${server}/list`)).json();

    for (const name of names) {
        const res = await fetch(base + name);
        const body = res.status === 200 ? await res.arrayBuffer() : new ArrayBuffer(0);
        await fetch(`${server}/map/${encodeURIComponent(name)}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/octet-stream', 'X-Status': String(res.status)},
            body,
        });
        if (res.status === 403) {
            location.reload();
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    }

    await fetch(`${server}/done`, {method: 'POST'});
})();
