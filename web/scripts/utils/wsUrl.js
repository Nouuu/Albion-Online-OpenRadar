export function buildWsUrl(loc = window.location) {
    const scheme = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${scheme}//${loc.host}/ws`;
}
