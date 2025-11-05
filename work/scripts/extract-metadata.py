#!/usr/bin/env python3
"""
Extract Living Resource Metadata
Create enriched mappings for the detection system even without TypeIDs
"""

import json
import os
import re
from collections import defaultdict

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DUMPS_DIR = os.path.join(SCRIPT_DIR, 'output', 'ao-bin-dumps-master')
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'output')

MOBS_JSON = os.path.join(DUMPS_DIR, 'mobs.json')
SPAWN_JSON = os.path.join(DUMPS_DIR, 'randomspawnbehaviors.json')

# Categories of living resources
ANIMALS = {
    'RABBIT': {'tier_range': (1, 1), 'type': 'hide', 'display': 'Rabbit'},
    'CHICKEN': {'tier_range': (1, 1), 'type': 'hide', 'display': 'Chicken'},
    'GOOSE': {'tier_range': (2, 2), 'type': 'hide', 'display': 'Goose'},
    'GOAT': {'tier_range': (2, 2), 'type': 'hide', 'display': 'Goat'},
    'FOX': {'tier_range': (3, 3), 'type': 'hide', 'display': 'Fox'},
    'BOAR': {'tier_range': (3, 3), 'type': 'hide', 'display': 'Boar'},
    'WOLF': {'tier_range': (4, 4), 'type': 'hide', 'display': 'Wolf'},
    'DEER': {'tier_range': (4, 4), 'type': 'hide', 'display': 'Deer'},
    'BEAR': {'tier_range': (5, 5), 'type': 'hide', 'display': 'Bear'},
    'DIREWOLF': {'tier_range': (5, 5), 'type': 'hide', 'display': 'Direwolf'},
    'DIREBEAR': {'tier_range': (6, 6), 'type': 'hide', 'display': 'Direbear'},
    'TERRORBIRD': {'tier_range': (6, 6), 'type': 'hide', 'display': 'Terrorbird'},
    'MOABIRD': {'tier_range': (7, 7), 'type': 'hide', 'display': 'Moabird'},
    'SWAMPDRAGON': {'tier_range': (7, 7), 'type': 'hide', 'display': 'Swamp Dragon'},
    'MAMMOTH': {'tier_range': (8, 8), 'type': 'hide', 'display': 'Mammoth'},
    'RHINOCEROS': {'tier_range': (8, 8), 'type': 'hide', 'display': 'Rhinoceros'},
    'COUGAR': {'tier_range': (4, 5), 'type': 'hide', 'display': 'Cougar'},
}

def parse_mobs():
    """Extract living resource mobs with metadata"""
    print("\n=== Extracting Living Resource Metadata ===\n")

    with open(MOBS_JSON, 'r', encoding='utf-8') as f:
        data = json.load(f)

    mobs_data = data.get('Mobs', {}).get('Mob', [])
    if not isinstance(mobs_data, list):
        mobs_data = [mobs_data]

    living_resources = {
        'animals': [],  # LivingSkinnable (hide)
        'guardians': {  # LivingHarvestable
            'fiber': [],
            'wood': [],
            'ore': [],
            'rock': []
        }
    }

    # Find animals
    for mob in mobs_data:
        unique_name = mob.get('@uniquename', '')
        tier = mob.get('@tier', '')
        prefab = mob.get('@prefab', '')
        hp = mob.get('@hitpointsmax', '')
        faction = mob.get('@faction', '')

        # Check if it's an animal
        for animal_key, animal_info in ANIMALS.items():
            if animal_key in unique_name.upper():
                # Extract enchantment level if present
                enchant = 0
                if '_ROADS' in unique_name:
                    enchant = 1  # Roads mobs are typically enchanted

                living_resources['animals'].append({
                    'uniqueName': unique_name,
                    'prefab': prefab,
                    'tier': int(tier) if tier else animal_info['tier_range'][0],
                    'enchant': enchant,
                    'animal': animal_info['display'],
                    'type': 'hide',
                    'hp': int(hp) if hp else 0,
                    'faction': faction
                })
                break

        # Check for guardians (CRITTER_WOOD, CRITTER_FIBER, etc.)
        if 'CRITTER' in unique_name:
            resource_type = None
            if 'WOOD' in unique_name:
                resource_type = 'wood'
            elif 'FIBER' in unique_name:
                resource_type = 'fiber'
            elif 'ORE' in unique_name:
                resource_type = 'ore'
            elif 'ROCK' in unique_name:
                resource_type = 'rock'

            if resource_type:
                # Determine enchantment
                enchant = 0
                if '_ROADS' in unique_name:
                    enchant = 1
                elif '_MISTS' in unique_name or '_AVALON' in unique_name:
                    enchant = 2

                living_resources['guardians'][resource_type].append({
                    'uniqueName': unique_name,
                    'prefab': prefab,
                    'tier': int(tier) if tier else 4,
                    'enchant': enchant,
                    'type': resource_type,
                    'hp': int(hp) if hp else 0,
                    'faction': faction
                })

    return living_resources

def generate_enhanced_mappings(living_resources):
    """Generate enhanced detection mappings"""
    output_file = os.path.join(OUTPUT_DIR, 'living-resources-enhanced.json')

    # Summary stats
    animal_count = len(living_resources['animals'])
    guardian_counts = {k: len(v) for k, v in living_resources['guardians'].items()}

    print(f"\n[OK] Animals found: {animal_count}")
    for resource_type, count in guardian_counts.items():
        print(f"[OK] {resource_type.capitalize()} guardians: {count}")

    # Save to JSON
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(living_resources, f, indent=2)

    print(f"\n[SAVE] Enhanced mappings: {output_file}")

    # Generate JavaScript reference file
    js_file = os.path.join(OUTPUT_DIR, 'living-resources-reference.js')

    lines = []
    lines.append('// Living Resources Reference Data')
    lines.append('// Generated from ao-bin-dumps mobs.json')
    lines.append('// Use this to enhance detection and validation')
    lines.append('')
    lines.append('const LivingResourcesReference = {')
    lines.append('  animals: [')

    # Group animals by tier
    animals_by_tier = defaultdict(list)
    for animal in living_resources['animals']:
        animals_by_tier[animal['tier']].append(animal)

    for tier in sorted(animals_by_tier.keys()):
        lines.append(f'    // Tier {tier}')
        for animal in animals_by_tier[tier]:
            lines.append(f'    {{')
            lines.append(f'      animal: "{animal["animal"]}",')
            lines.append(f'      tier: {animal["tier"]},')
            lines.append(f'      enchant: {animal["enchant"]},')
            lines.append(f'      prefab: "{animal["prefab"]}",')
            lines.append(f'      hp: {animal["hp"]},')
            lines.append(f'      faction: "{animal["faction"]}"')
            lines.append(f'    }},')

    lines.append('  ],')
    lines.append('')
    lines.append('  guardians: {')

    for resource_type in ['fiber', 'wood', 'ore', 'rock']:
        guardians = living_resources['guardians'][resource_type]
        if guardians:
            lines.append(f'    {resource_type}: [')

            # Group by tier
            guardians_by_tier = defaultdict(list)
            for guardian in guardians:
                guardians_by_tier[guardian['tier']].append(guardian)

            for tier in sorted(guardians_by_tier.keys()):
                lines.append(f'      // Tier {tier}')
                for guardian in guardians_by_tier[tier]:
                    lines.append(f'      {{')
                    lines.append(f'        tier: {guardian["tier"]},')
                    lines.append(f'        enchant: {guardian["enchant"]},')
                    lines.append(f'        prefab: "{guardian["prefab"]}",')
                    lines.append(f'        hp: {guardian["hp"]},')
                    lines.append(f'        faction: "{guardian["faction"]}"')
                    lines.append(f'      }},')

            lines.append(f'    ],')

    lines.append('  }')
    lines.append('};')
    lines.append('')
    lines.append('// Export for use in MobsHandler.js')
    lines.append('if (typeof module !== "undefined") {')
    lines.append('  module.exports = LivingResourcesReference;')
    lines.append('}')

    with open(js_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    print(f"[SAVE] JavaScript reference: {js_file}")

def generate_validation_report(living_resources):
    """Generate validation report comparing with expected values"""
    output_file = os.path.join(OUTPUT_DIR, 'living-resources-validation.md')

    lines = []
    lines.append('# Living Resources Validation Report')
    lines.append('')
    lines.append('**Source**: ao-bin-dumps mobs.json')
    lines.append('**Purpose**: Validate expected creatures per tier/type')
    lines.append('')

    # Animals by tier
    lines.append('## Animals (LivingSkinnable - Hide)')
    lines.append('')

    animals_by_tier = defaultdict(list)
    for animal in living_resources['animals']:
        animals_by_tier[animal['tier']].append(animal)

    for tier in sorted(animals_by_tier.keys()):
        lines.append(f'### Tier {tier}')
        lines.append('')

        seen_animals = set()
        for animal in animals_by_tier[tier]:
            animal_name = animal['animal']
            if animal_name not in seen_animals:
                seen_animals.add(animal_name)
                variants = [a for a in animals_by_tier[tier] if a['animal'] == animal_name]

                lines.append(f'**{animal_name}**')
                lines.append(f'- Variants found: {len(variants)}')
                lines.append(f'- HP range: {min(v["hp"] for v in variants if v["hp"])} - {max(v["hp"] for v in variants if v["hp"])}')

                # List unique names
                for v in variants[:3]:  # Max 3 examples
                    lines.append(f'  - `{v["uniqueName"]}`')

                if len(variants) > 3:
                    lines.append(f'  - ... and {len(variants) - 3} more')

                lines.append('')

    # Guardians by type and tier
    lines.append('## Guardians (LivingHarvestable)')
    lines.append('')

    for resource_type in ['fiber', 'wood', 'ore', 'rock']:
        guardians = living_resources['guardians'][resource_type]
        if guardians:
            lines.append(f'### {resource_type.capitalize()} Guardians')
            lines.append('')

            guardians_by_tier = defaultdict(list)
            for guardian in guardians:
                guardians_by_tier[guardian['tier']].append(guardian)

            for tier in sorted(guardians_by_tier.keys()):
                lines.append(f'**Tier {tier}**')
                lines.append(f'- Variants: {len(guardians_by_tier[tier])}')

                # Group by enchantment
                by_enchant = defaultdict(list)
                for g in guardians_by_tier[tier]:
                    by_enchant[g['enchant']].append(g)

                for enchant in sorted(by_enchant.keys()):
                    enchant_label = f".{enchant}" if enchant > 0 else ".0"
                    lines.append(f'  - Enchant {enchant_label}: {len(by_enchant[enchant])} variants')

                lines.append('')

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    print(f"[SAVE] Validation report: {output_file}")

def main():
    print("=== Living Resources Metadata Extractor ===")

    if not os.path.exists(MOBS_JSON):
        print(f"[ERROR] mobs.json not found at {MOBS_JSON}")
        return 1

    living_resources = parse_mobs()
    generate_enhanced_mappings(living_resources)
    generate_validation_report(living_resources)

    print("\n" + "="*70)
    print("=== NEXT STEPS ===")
    print("="*70)
    print("\nGenerated files can be used to:")
    print("1. Validate TypeIDs collected in-game")
    print("2. Cross-reference creature names with TypeIDs")
    print("3. Add metadata to MobsInfo.js (HP, prefab names)")
    print("4. Improve detection accuracy with expected HP ranges")
    print("5. Add faction information for better filtering")
    print("\n" + "="*70)

    return 0

if __name__ == '__main__':
    exit(main())