#!/usr/bin/env python3
"""
Parse living resources logs from browser console.

Usage:
    1. Copy logs from browser console to a file (e.g., logs.txt)
    2. Run: python parse-living-logs.py logs.txt

Output:
    - Summary of TypeIDs collected
    - Validation stats
    - Missing enchantments report
"""

import json
import re
import sys
from collections import defaultdict
from pathlib import Path


def parse_log_file(filepath):
    """Parse log file and extract living resources data."""
    living_logs = []

    # Try different encodings (Windows uses UTF-16 LE for Out-File)
    encodings = ['utf-16-le', 'utf-16', 'utf-8', 'latin-1']

    for encoding in encodings:
        try:
            with open(filepath, 'r', encoding=encoding) as f:
                for line in f:
                    # Match [LIVING_JSON] lines
                    match = re.search(r'\[LIVING_JSON\]\s*(\{.+\})', line)
                    if match:
                        try:
                            data = json.loads(match.group(1))
                            living_logs.append(data)
                        except json.JSONDecodeError as e:
                            print(f"⚠️  Failed to parse JSON: {e}")
                            continue
            break  # Success, stop trying other encodings
        except UnicodeDecodeError:
            if encoding == encodings[-1]:  # Last encoding failed
                raise
            continue  # Try next encoding

    return living_logs


def analyze_logs(logs):
    """Analyze collected logs and generate report."""
    # Group by TypeID
    by_typeid = defaultdict(list)
    for log in logs:
        type_id = log['typeId']
        by_typeid[type_id].append(log)

    print("\n" + "="*70)
    print("📊 LIVING RESOURCES COLLECTION REPORT")
    print("="*70)

    print(f"\n🔢 Total logs: {len(logs)}")
    print(f"🆔 Unique TypeIDs: {len(by_typeid)}")

    # Summary by TypeID
    print("\n" + "-"*70)
    print("📋 TypeIDs Summary:")
    print("-"*70)

    for type_id in sorted(by_typeid.keys()):
        entries = by_typeid[type_id]
        first = entries[0]

        resource = first['resource']
        name = resource['type']
        tier = resource['tier']
        enchant = resource['enchant']

        # Count alive/dead
        alive_count = sum(1 for e in entries if e['state']['alive'])
        dead_count = len(entries) - alive_count

        # Validation
        validated = 0
        if 'validation' in first:
            val = first['validation']
            animal = val.get('animal', '?')
            match = '✓' if val.get('match', False) else '✗'
            validated = sum(1 for e in entries if e.get('validation', {}).get('match', False))

            print(f"TypeID {type_id:>5} → {name:>6} T{tier}.{enchant} | "
                  f"{animal:>12} {match} | "
                  f"🟢 {alive_count:>3} 🔴 {dead_count:>3} | "
                  f"Validated: {validated}/{len(entries)}")
        else:
            print(f"TypeID {type_id:>5} → {name:>6} T{tier}.{enchant} | "
                  f"{'NO METADATA':>12}   | "
                  f"🟢 {alive_count:>3} 🔴 {dead_count:>3}")

    # Missing enchantments report
    print("\n" + "-"*70)
    print("🔍 Coverage Analysis:")
    print("-"*70)

    # Group by resource type and tier
    coverage = defaultdict(lambda: defaultdict(set))
    for type_id, entries in by_typeid.items():
        first = entries[0]
        name = first['resource']['type']
        tier = first['resource']['tier']
        enchant = first['resource']['enchant']
        coverage[name][tier].add(enchant)

    for resource_type in sorted(coverage.keys()):
        print(f"\n{resource_type}:")
        for tier in sorted(coverage[resource_type].keys()):
            enchants = sorted(coverage[resource_type][tier])
            missing = [e for e in range(4) if e not in enchants]

            enchant_str = ", ".join(f".{e}" for e in enchants)
            missing_str = ", ".join(f".{e}" for e in missing) if missing else "None"

            print(f"  T{tier}: Found [{enchant_str}] | Missing [{missing_str}]")

    # Validation stats
    print("\n" + "-"*70)
    print("✓ Validation Statistics:")
    print("-"*70)

    total_with_metadata = sum(1 for log in logs if 'validation' in log)
    total_matches = sum(1 for log in logs if log.get('validation', {}).get('match', False))

    if total_with_metadata > 0:
        match_rate = (total_matches / total_with_metadata) * 100
        print(f"Logs with metadata: {total_with_metadata}/{len(logs)}")
        print(f"HP matches: {total_matches}/{total_with_metadata} ({match_rate:.1f}%)")
    else:
        print("No metadata validation available")

    return by_typeid, coverage


def generate_mobsinfo_entries(by_typeid):
    """Generate MobsInfo.js entries from collected data."""
    print("\n" + "="*70)
    print("📝 MobsInfo.js Entries (Copy-paste ready):")
    print("="*70)
    print()

    for type_id in sorted(by_typeid.keys()):
        entries = by_typeid[type_id]
        first = entries[0]

        resource = first['resource']
        name = resource['type'].capitalize()
        tier = resource['tier']
        enchant = resource['enchant']
        category = resource['category']

        # Determine EnemyType
        if category == 'Skinnable':
            enemy_type = 'EnemyType.LivingSkinnable'
        else:
            enemy_type = 'EnemyType.LivingHarvestable'

        # Generate entry
        print(f'    {type_id}: [{tier}, {enemy_type}, "{name}", {enchant}],')


def main():
    if len(sys.argv) < 2:
        print("Usage: python parse-living-logs.py <logfile.txt>")
        print("\nExample:")
        print("  1. Copy console logs to 'logs.txt'")
        print("  2. python parse-living-logs.py logs.txt")
        sys.exit(1)

    log_file = Path(sys.argv[1])

    if not log_file.exists():
        print(f"❌ File not found: {log_file}")
        sys.exit(1)

    print(f"📂 Reading logs from: {log_file}")
    logs = parse_log_file(log_file)

    if not logs:
        print("❌ No living resources logs found!")
        print("\nMake sure:")
        print("  1. 'Log Living Creatures' is enabled in settings")
        print("  2. You copied logs containing [LIVING_JSON] lines")
        sys.exit(1)

    by_typeid, coverage = analyze_logs(logs)
    generate_mobsinfo_entries(by_typeid)

    print("\n" + "="*70)
    print("✅ Analysis complete!")
    print("="*70)


if __name__ == '__main__':
    main()

