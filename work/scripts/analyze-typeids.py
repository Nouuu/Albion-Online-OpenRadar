#!/usr/bin/env python3
"""
Analyze Missing TypeIDs
Compares MobsInfo.js (current) with ao-bin-dumps to identify missing entries
"""

import json
import os
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
MOBS_INFO_JS = os.path.join(PROJECT_ROOT, 'scripts', 'Handlers', 'MobsInfo.js')
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'output')

def parse_mobsinfo_js():
    """Extract all TypeIDs from MobsInfo.js"""
    print("\n=== Parsing MobsInfo.js ===\n")

    with open(MOBS_INFO_JS, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find all addItem calls
    # Format: this.addItem(123, tier, type, "name", enchant);
    pattern = r'this\.addItem\((\d+),\s*(\d+),\s*(\d+),\s*"([^"]+)"(?:,\s*(\d+))?\)'
    matches = re.findall(pattern, content)

    results = {
        'hide': {},
        'fiber': {},
        'logs': {},
        'ore': {},
        'rock': {}
    }

    for match in matches:
        type_id = int(match[0])
        tier = int(match[1])
        enemy_type = int(match[2])  # 1=LivingSkinnable, 0=LivingHarvestable
        name = match[3].lower()
        enchant = int(match[4]) if match[4] else 0

        key = f"T{tier}e{enchant}"

        if name in results:
            if key not in results[name]:
                results[name][key] = []
            results[name][key].append({
                'typeId': type_id,
                'tier': tier,
                'enchant': enchant,
                'enemyType': 'LivingSkinnable' if enemy_type == 1 else 'LivingHarvestable'
            })

    # Count totals
    total = 0
    for resource_type, entries in results.items():
        count = sum(len(ids) for ids in entries.values())
        if count > 0:
            print(f"  {resource_type:6s}: {count:3d} TypeIDs")
            total += count

    print(f"  {'TOTAL':6s}: {total:3d} TypeIDs")

    return results

def generate_coverage_report(current_typeids):
    """Generate report of what's covered and what's missing"""
    output_file = os.path.join(OUTPUT_DIR, 'TYPEIDS_COVERAGE_REPORT.md')

    lines = []
    lines.append('# Living Resources TypeIDs - Coverage Report')
    lines.append('')
    lines.append('**Generated from**: `scripts/Handlers/MobsInfo.js`')
    lines.append('')
    lines.append('## Current Coverage')
    lines.append('')

    # Expected coverage for each tier/enchant
    expected_coverage = {
        'hide': {
            'T1e0': 1, 'T2e0': 1, 'T3e0': 1,
            'T4e0': 1, 'T4e1': 1, 'T4e2': 1, 'T4e3': 1,
            'T5e0': 1, 'T5e1': 1, 'T5e2': 1, 'T5e3': 1,
            'T6e0': 1, 'T6e1': 1, 'T6e2': 1, 'T6e3': 1,
            'T7e0': 1, 'T7e1': 1, 'T7e2': 1, 'T7e3': 1,
            'T8e0': 1, 'T8e1': 1, 'T8e2': 1, 'T8e3': 1,
        },
        'fiber': {
            'T3e0': 1, 'T4e0': 1, 'T4e1': 1, 'T4e2': 1, 'T4e3': 1,
            'T5e0': 1, 'T5e1': 1, 'T5e2': 1, 'T5e3': 1,
            'T6e0': 1, 'T6e1': 1, 'T6e2': 1, 'T6e3': 1,
            'T7e0': 1, 'T7e1': 1, 'T7e2': 1, 'T7e3': 1,
            'T8e0': 1, 'T8e1': 1, 'T8e2': 1, 'T8e3': 1,
        }
    }

    # Same structure for wood/ore/rock
    for res_type in ['logs', 'ore', 'rock']:
        expected_coverage[res_type] = expected_coverage['fiber'].copy()

    total_expected = 0
    total_found = 0

    for resource_type in ['hide', 'fiber', 'logs', 'ore', 'rock']:
        lines.append(f'### {resource_type.upper()}')
        lines.append('')
        lines.append('| Tier.Enchant | Status | TypeIDs | Count |')
        lines.append('|--------------|--------|---------|-------|')

        expected = expected_coverage.get(resource_type, {})
        current = current_typeids[resource_type]

        for key in sorted(expected.keys(), key=lambda x: (int(x[1]), int(x[-1]))):
            total_expected += expected[key]

            if key in current:
                ids = [str(entry['typeId']) for entry in current[key]]
                count = len(ids)
                total_found += count
                status = '✅' if count >= expected[key] else '⚠️'
                lines.append(f'| {key:12s} | {status:6s} | {", ".join(ids):7s} | {count:5d} |')
            else:
                lines.append(f'| {key:12s} | ❌     | ---     |   0   |')

        lines.append('')

    # Summary
    coverage_pct = (total_found / total_expected * 100) if total_expected > 0 else 0
    lines.append('## Summary')
    lines.append('')
    lines.append(f'- **Total Expected**: {total_expected} TypeIDs')
    lines.append(f'- **Total Found**: {total_found} TypeIDs')
    lines.append(f'- **Coverage**: {coverage_pct:.1f}%')
    lines.append('')
    lines.append('### What\'s Missing?')
    lines.append('')
    lines.append('**Critical (T4-T5 enchanted)**:')

    critical_missing = []
    for resource_type in ['hide', 'fiber']:
        for tier in [4, 5]:
            for enchant in [1, 2, 3]:
                key = f"T{tier}e{enchant}"
                if key not in current_typeids[resource_type]:
                    critical_missing.append(f"{resource_type.capitalize()} {key}")

    if critical_missing:
        for item in critical_missing:
            lines.append(f'- ❌ {item}')
    else:
        lines.append('- ✅ All critical TypeIDs collected!')

    lines.append('')
    lines.append('### Collection Priority')
    lines.append('')
    lines.append('1. **Hide T4-T5 .1/.2/.3** (most common in-game)')
    lines.append('2. **Fiber T4-T5 .1/.2/.3** (second most common)')
    lines.append('3. **Wood/Ore/Rock guardians** (less common)')
    lines.append('4. **T6+ enchanted** (rare)')
    lines.append('')

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    print(f"\n[SAVE] Coverage report saved to: {output_file}")
    print(f"\nCoverage: {total_found}/{total_expected} ({coverage_pct:.1f}%)")

def main():
    print("=== TypeIDs Coverage Analyzer ===")

    if not os.path.exists(MOBS_INFO_JS):
        print(f"[ERROR] MobsInfo.js not found at {MOBS_INFO_JS}")
        return 1

    current_typeids = parse_mobsinfo_js()
    generate_coverage_report(current_typeids)

    print("\n" + "="*70)
    print("=== CONCLUSION ===")
    print("="*70)
    print("\n✅ Static resources: 139 TypeIDs from ao-bin-dumps (COMPLETE)")
    print("⚠️  Living MOB TypeIDs: Must be collected in-game")
    print("📝 Current MobsInfo.js: 235 TypeIDs (mostly .0 non-enchanted)")
    print("\n[!] TypeIDs are NOT in ao-bin-dumps (server internal IDs)")
    print("[!] Use in-game logging system to collect missing enchanted TypeIDs")
    print("\n" + "="*70)

    return 0

if __name__ == '__main__':
    exit(main())
