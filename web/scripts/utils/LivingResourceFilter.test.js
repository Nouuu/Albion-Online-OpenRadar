// synthetic: no pcap fixture needed for a pure function with no network dependency
// all scenarios constructed from known game constraints (T1-T8, e0-e4, 5 families)
import {describe, test, expect} from 'vitest';
import {shouldRenderLivingResource, shouldRenderStaticResource} from './LivingResourceFilter.js';

function strictSettings(map) {
    return key => map[key] ?? null;
}

function allTrueForFamily(family) {
    const key = {Fiber: 'settingLivingFiberEnchants', Hide: 'settingLivingHideEnchants', Log: 'settingLivingWoodEnchants', Ore: 'settingLivingOreEnchants', Rock: 'settingLivingRockEnchants'}[family];
    return {
        [key]: {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)},
    };
}

function allTrueStaticForFamily(family) {
    const key = {Fiber: 'settingStaticFiberEnchants', Hide: 'settingStaticHideEnchants', Log: 'settingStaticWoodEnchants', Ore: 'settingStaticOreEnchants', Rock: 'settingStaticRockEnchants'}[family];
    return {
        [key]: {e0: Array(8).fill(true), e1: Array(8).fill(true), e2: Array(8).fill(true), e3: Array(8).fill(true), e4: Array(8).fill(true)},
    };
}

describe('shouldRenderLivingResource', () => {
    // @verified 2026-04-24: family-specific on+on path for Fiber at T5 e2.
    test('Fiber T5 e2 returns true when settings e2 T5 is on', () => {
        const settings = {settingLivingFiberEnchants: {e2: [false, false, false, false, true, false, false, false]}};
        expect(shouldRenderLivingResource({name: 'Fiber', tier: 5, enchantmentLevel: 2}, strictSettings(settings))).toBe(true);
    });

    // @verified 2026-04-24: family-specific tier-off path for Hide at T4 e0.
    test('Hide T4 e0 returns false when settings e0 T4 is off', () => {
        const settings = {settingLivingHideEnchants: {e0: [true, true, true, false, true, true, true, true]}};
        expect(shouldRenderLivingResource({name: 'Hide', tier: 4, enchantmentLevel: 0}, strictSettings(settings))).toBe(false);
    });

    // @verified 2026-04-24: Log maps to settingLivingWoodEnchants correctly.
    test('Log (wood) T4 e3 resolves via settingLivingWoodEnchants key', () => {
        const settings = {settingLivingWoodEnchants: {e3: [false, false, false, true, false, false, false, false]}};
        expect(shouldRenderLivingResource({name: 'Log', tier: 4, enchantmentLevel: 3}, strictSettings(settings))).toBe(true);
    });

    // @verified 2026-04-24: Ore T6 e4 passes when all-on settings grant it.
    test('Ore T6 e4 returns true', () => {
        expect(shouldRenderLivingResource({name: 'Ore', tier: 6, enchantmentLevel: 4}, strictSettings(allTrueForFamily('Ore')))).toBe(true);
    });

    // @verified 2026-04-24: Rock T3 e0 passes when all-on settings grant it.
    test('Rock T3 e0 returns true', () => {
        expect(shouldRenderLivingResource({name: 'Rock', tier: 3, enchantmentLevel: 0}, strictSettings(allTrueForFamily('Rock')))).toBe(true);
    });

    // @verified 2026-04-24: charges-only entity resolves via fallback chain.
    test('charges fallback for HarvestablesHandler entities without enchantmentLevel', () => {
        const settings = {settingLivingFiberEnchants: {e2: [false, false, false, true, false, false, false, false]}};
        expect(shouldRenderLivingResource({name: 'Fiber', tier: 4, charges: 2}, strictSettings(settings))).toBe(true);
    });

    // @verified 2026-04-24: enchantmentLevel takes precedence when both fields present.
    test('enchantmentLevel takes precedence over charges if both present', () => {
        const settings = {settingLivingFiberEnchants: {e1: Array(8).fill(true), e2: Array(8).fill(false)}};
        expect(shouldRenderLivingResource({name: 'Fiber', tier: 4, charges: 2, enchantmentLevel: 1}, strictSettings(settings))).toBe(true);
    });

    // @verified 2026-04-24: null entity guard returns false.
    test('null entity returns false', () => {
        expect(shouldRenderLivingResource(null, strictSettings({}))).toBe(false);
    });

    // @verified 2026-04-24: entity missing name returns false.
    test('entity without name returns false', () => {
        expect(shouldRenderLivingResource({tier: 4, enchantmentLevel: 2}, strictSettings({}))).toBe(false);
    });

    // @verified 2026-04-24: unknown family name returns false.
    test('entity with unknown name returns false', () => {
        expect(shouldRenderLivingResource({name: 'Silver', tier: 4, enchantmentLevel: 2}, strictSettings({}))).toBe(false);
    });

    // @verified 2026-04-24: tier 0 below range returns false.
    test('tier 0 returns false', () => {
        expect(shouldRenderLivingResource({name: 'Hide', tier: 0, enchantmentLevel: 0}, strictSettings(allTrueForFamily('Hide')))).toBe(false);
    });

    // @verified 2026-04-24: tier 9 above range returns false.
    test('tier 9 (out of range) returns false', () => {
        expect(shouldRenderLivingResource({name: 'Hide', tier: 9, enchantmentLevel: 0}, strictSettings(allTrueForFamily('Hide')))).toBe(false);
    });

    // @verified 2026-04-24: enchantment 5 above range returns false.
    test('enchantment 5 (out of range) returns false', () => {
        expect(shouldRenderLivingResource({name: 'Hide', tier: 4, enchantmentLevel: 5}, strictSettings(allTrueForFamily('Hide')))).toBe(false);
    });

    // @verified 2026-04-24: negative enchantment returns false.
    test('negative enchantment returns false', () => {
        expect(shouldRenderLivingResource({name: 'Hide', tier: 4, enchantmentLevel: -1}, strictSettings(allTrueForFamily('Hide')))).toBe(false);
    });

    // @verified 2026-04-24: getSetting returning null returns false.
    test('getSetting returns null returns false', () => {
        expect(shouldRenderLivingResource({name: 'Hide', tier: 4, enchantmentLevel: 2}, () => null)).toBe(false);
    });

    // @verified 2026-04-24: settings missing the e{n} key returns false.
    test('settings object missing e{n} key returns false', () => {
        const settings = {settingLivingHideEnchants: {e0: Array(8).fill(true)}};
        expect(shouldRenderLivingResource({name: 'Hide', tier: 4, enchantmentLevel: 2}, strictSettings(settings))).toBe(false);
    });

    // @verified 2026-04-24: undefined entity guard mirrors the null case; both must short-circuit to false.
    test('undefined entity returns false', () => {
        expect(shouldRenderLivingResource(undefined, strictSettings({}))).toBe(false);
    });

    // @verified 2026-04-24: enchantmentLevel=0 must be respected (not fallthrough to charges), proves ?? over ||.
    test('enchantmentLevel 0 does not fall through to charges', () => {
        const settings = {settingLivingFiberEnchants: {e0: Array(8).fill(true), e2: Array(8).fill(false)}};
        expect(shouldRenderLivingResource(
            {name: 'Fiber', tier: 4, enchantmentLevel: 0, charges: 2},
            strictSettings(settings)
        )).toBe(true);
    });
});

describe('shouldRenderStaticResource', () => {
    // @verified 2026-04-24: Fiber maps to settingStaticFiberEnchants for the static filter path.
    test('Fiber T5 e2 returns true when settingStaticFiberEnchants e2 T5 is on', () => {
        const settings = {settingStaticFiberEnchants: {e2: [false, false, false, false, true, false, false, false]}};
        expect(shouldRenderStaticResource({name: 'Fiber', tier: 5, enchantmentLevel: 2}, strictSettings(settings))).toBe(true);
    });

    // @verified 2026-04-24: Hide maps to settingStaticHideEnchants (dead carcass flow).
    test('Hide T4 e0 returns false when settingStaticHideEnchants e0 T4 is off', () => {
        const settings = {settingStaticHideEnchants: {e0: [true, true, true, false, true, true, true, true]}};
        expect(shouldRenderStaticResource({name: 'Hide', tier: 4, enchantmentLevel: 0}, strictSettings(settings))).toBe(false);
    });

    // @verified 2026-04-24: Log maps to settingStaticWoodEnchants, parity with living path.
    test('Log (wood) T4 e3 resolves via settingStaticWoodEnchants key', () => {
        const settings = {settingStaticWoodEnchants: {e3: [false, false, false, true, false, false, false, false]}};
        expect(shouldRenderStaticResource({name: 'Log', tier: 4, enchantmentLevel: 3}, strictSettings(settings))).toBe(true);
    });

    // @verified 2026-04-24: Ore T6 e4 passes when all-on static settings grant it.
    test('Ore T6 e4 returns true under all-on static settings', () => {
        expect(shouldRenderStaticResource({name: 'Ore', tier: 6, enchantmentLevel: 4}, strictSettings(allTrueStaticForFamily('Ore')))).toBe(true);
    });

    // @verified 2026-04-24: Rock T3 e0 passes symmetric with living check.
    test('Rock T3 e0 returns true under all-on static settings', () => {
        expect(shouldRenderStaticResource({name: 'Rock', tier: 3, enchantmentLevel: 0}, strictSettings(allTrueStaticForFamily('Rock')))).toBe(true);
    });

    // @verified 2026-04-24: charges fallback works for HarvestablesHandler entities that carry charges only.
    test('charges fallback resolves for HarvestablesHandler carcass entities', () => {
        const settings = {settingStaticFiberEnchants: {e2: [false, false, false, true, false, false, false, false]}};
        expect(shouldRenderStaticResource({name: 'Fiber', tier: 4, charges: 2}, strictSettings(settings))).toBe(true);
    });

    // @verified 2026-04-24: static lookup does not leak into living settings (key isolation).
    test('static function uses static key, ignores a living-only settings object', () => {
        const settingsLivingOnly = {settingLivingFiberEnchants: {e0: Array(8).fill(true)}};
        expect(shouldRenderStaticResource({name: 'Fiber', tier: 4, enchantmentLevel: 0}, strictSettings(settingsLivingOnly))).toBe(false);
    });

    // @verified 2026-04-24: null entity guard mirrors living variant.
    test('null entity returns false', () => {
        expect(shouldRenderStaticResource(null, strictSettings({}))).toBe(false);
    });

    // @verified 2026-04-24: unknown family returns false.
    test('entity with unknown name returns false', () => {
        expect(shouldRenderStaticResource({name: 'Silver', tier: 4, enchantmentLevel: 2}, strictSettings({}))).toBe(false);
    });

    // @verified 2026-04-24: tier out-of-range returns false.
    test('tier 9 (out of range) returns false', () => {
        expect(shouldRenderStaticResource({name: 'Hide', tier: 9, enchantmentLevel: 0}, strictSettings(allTrueStaticForFamily('Hide')))).toBe(false);
    });

    // @verified 2026-04-24: enchantmentLevel=0 static path (proves ?? behaviour matches living path).
    test('enchantmentLevel 0 respected for static path, does not fallthrough to charges', () => {
        const settings = {settingStaticFiberEnchants: {e0: Array(8).fill(true), e2: Array(8).fill(false)}};
        expect(shouldRenderStaticResource(
            {name: 'Fiber', tier: 4, enchantmentLevel: 0, charges: 2},
            strictSettings(settings)
        )).toBe(true);
    });
});
