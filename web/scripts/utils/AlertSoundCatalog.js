export const DEFAULT_SOUND = 'player.wav';

export const LICENCE_EXEMPT = ['player.wav'];

export const ALERT_SOUNDS = [
    {file: 'player.wav', label: 'Default', source: 'unknown, predates the catalog', licence: 'unknown'},
    {file: 'brass.wav', label: 'Brass', source: 'supplied by the maintainer', licence: 'CC0'},
    {file: 'buzzer.wav', label: 'Buzzer', source: 'supplied by the maintainer', licence: 'CC0'},
    {file: 'coin.wav', label: 'Coin', source: 'supplied by the maintainer', licence: 'CC0'},
    {file: 'drums.wav', label: 'Drums', source: 'supplied by the maintainer', licence: 'CC0'},
    {file: 'piano.wav', label: 'Piano', source: 'supplied by the maintainer', licence: 'CC0'},
    {file: 'pop.wav', label: 'Pop', source: 'supplied by the maintainer', licence: 'CC0'},
    {file: 'vibraphone.wav', label: 'Vibraphone', source: 'supplied by the maintainer', licence: 'CC0'},
];

export function findSound(file) {
    return ALERT_SOUNDS.find(sound => sound.file === file) || null;
}

export function defaultSound() {
    return findSound(DEFAULT_SOUND);
}
