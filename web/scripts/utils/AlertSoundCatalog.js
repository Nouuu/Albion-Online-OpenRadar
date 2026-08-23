export const DEFAULT_SOUND = 'player.wav';

export const ALERT_SOUNDS = [
    {file: 'player.wav', label: 'Default'},
    {file: 'brass.wav', label: 'Brass'},
    {file: 'buzzer.wav', label: 'Buzzer'},
    {file: 'coin.wav', label: 'Coin'},
    {file: 'drums.wav', label: 'Drums'},
    {file: 'piano.wav', label: 'Piano'},
    {file: 'pop.wav', label: 'Pop'},
    {file: 'vibraphone.wav', label: 'Vibraphone'},
];

export function findSound(file) {
    return ALERT_SOUNDS.find(sound => sound.file === file) || null;
}
