export const DEFAULT_SOUND = 'player.mp3';

export const LICENCE_EXEMPT = ['player.mp3'];

export const ALERT_SOUNDS = [
    {file: 'player.mp3', label: 'Default', source: 'unknown, predates the catalog', licence: 'unknown'},
];

export function findSound(file) {
    return ALERT_SOUNDS.find(sound => sound.file === file) || null;
}

export function defaultSound() {
    return findSound(DEFAULT_SOUND);
}
