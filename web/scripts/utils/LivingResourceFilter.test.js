import {describe, test, expect} from 'vitest';
import {shouldRenderLivingResource} from './LivingResourceFilter.js';

function strictSettings(map) {
    return key => map[key] ?? null;
}

function allTrueForFamily(family) {
    const key = {Fiber: 'settingLivingFiberEnchants', Hide: 'settingLivingHideEnchants', Log: 'settingLivingWoodEnchants', Ore: 'settingLivingOreEnchants', Rock: 'settingLivingRockEnchants'}[family];
    return {
        [key]: {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)},
    };
}

describe('shouldRenderLivingResource', () => {
    test('Fiber T5 e2 returns true when settings e2 T5 is on', () => {
        const settings = {settingLivingFiberEnchants: {e2: [false, false, false, false, true, false, false, false]}};
        expect(shouldRenderLivingResource({name: 'Fiber', tier: 5, enchantmentLevel: 2}, strictSettings(settings))).toBe(true);
    });

    test('Hide T4 e0 returns false when settings e0 T4 is off', () => {
        const settings = {settingLivingHideEnchants: {e0: [true, true, true, false, true, true, true, true]}};
        expect(shouldRenderLivingResource({name: 'Hide', tier: 4, enchantmentLevel: 0}, strictSettings(settings))).toBe(false);
    });

    test('Log (wood) T4 e3 resolves via settingLivingWoodEnchants key', () => {
        const settings = {settingLivingWoodEnchants: {e3: [false, false, false, true, false, false, false, false]}};
        expect(shouldRenderLivingResource({name: 'Log', tier: 4, enchantmentLevel: 3}, strictSettings(settings))).toBe(true);
    });

    test('Ore T6 e4 returns true', () => {
        expect(shouldRenderLivingResource({name: 'Ore', tier: 6, enchantmentLevel: 4}, strictSettings(allTrueForFamily('Ore')))).toBe(true);
    });

    test('Rock T3 e0 returns true', () => {
        expect(shouldRenderLivingResource({name: 'Rock', tier: 3, enchantmentLevel: 0}, strictSettings(allTrueForFamily('Rock')))).toBe(true);
    });

    test('charges fallback for HarvestablesHandler entities without enchantmentLevel', () => {
        const settings = {settingLivingFiberEnchants: {e2: [false, false, false, true, false, false, false, false]}};
        expect(shouldRenderLivingResource({name: 'Fiber', tier: 4, charges: 2}, strictSettings(settings))).toBe(true);
    });

    test('enchantmentLevel takes precedence over charges if both present', () => {
        const settings = {settingLivingFiberEnchants: {e1: Array(8).fill(true), e2: Array(8).fill(false)}};
        expect(shouldRenderLivingResource({name: 'Fiber', tier: 4, charges: 2, enchantmentLevel: 1}, strictSettings(settings))).toBe(true);
    });

    test('null entity returns false', () => {
        expect(shouldRenderLivingResource(null, strictSettings({}))).toBe(false);
    });

    test('entity without name returns false', () => {
        expect(shouldRenderLivingResource({tier: 4, enchantmentLevel: 2}, strictSettings({}))).toBe(false);
    });

    test('entity with unknown name returns false', () => {
        expect(shouldRenderLivingResource({name: 'Silver', tier: 4, enchantmentLevel: 2}, strictSettings({}))).toBe(false);
    });

    test('tier 0 returns false', () => {
        expect(shouldRenderLivingResource({name: 'Hide', tier: 0, enchantmentLevel: 0}, strictSettings(allTrueForFamily('Hide')))).toBe(false);
    });

    test('tier 9 (out of range) returns false', () => {
        expect(shouldRenderLivingResource({name: 'Hide', tier: 9, enchantmentLevel: 0}, strictSettings(allTrueForFamily('Hide')))).toBe(false);
    });

    test('enchantment 5 (out of range) returns false', () => {
        expect(shouldRenderLivingResource({name: 'Hide', tier: 4, enchantmentLevel: 5}, strictSettings(allTrueForFamily('Hide')))).toBe(false);
    });

    test('negative enchantment returns false', () => {
        expect(shouldRenderLivingResource({name: 'Hide', tier: 4, enchantmentLevel: -1}, strictSettings(allTrueForFamily('Hide')))).toBe(false);
    });

    test('getSetting returns null returns false', () => {
        expect(shouldRenderLivingResource({name: 'Hide', tier: 4, enchantmentLevel: 2}, () => null)).toBe(false);
    });

    test('settings object missing e{n} key returns false', () => {
        const settings = {settingLivingHideEnchants: {e0: Array(8).fill(true)}};
        expect(shouldRenderLivingResource({name: 'Hide', tier: 4, enchantmentLevel: 2}, strictSettings(settings))).toBe(false);
    });
});
