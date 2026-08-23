export const DEFAULT_SOUND = 'player.wav';

export const LICENCE_EXEMPT = ['player.wav'];

export const ALERT_SOUNDS = [
    {file: 'player.wav', label: 'Default', source: 'unknown, predates the catalog', licence: 'unknown'},
];

export function findSound(file) {
    return ALERT_SOUNDS.find(sound => sound.file === file) || null;
}

export function defaultSound() {
    return findSound(DEFAULT_SOUND);
}
