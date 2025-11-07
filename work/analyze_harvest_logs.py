#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Analyse des logs de ressources récoltables (harvestables) pour identifier les problèmes de détection.
Focalisé sur les ressources T6 qui ne sont pas correctement détectées quand vivantes.
"""

import json
import sys
import io
from collections import defaultdict, Counter
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime

# Fix encoding pour Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


class HarvestLogAnalyzer:
    """Analyseur de logs pour les ressources récoltables."""

    def __init__(self, log_file: Path):
        self.log_file = log_file
        self.harvest_events = []
        self.stats = {
            'total_events': 0,
            'harvest_events': 0,
            'by_category': Counter(),
            'by_tier': defaultdict(lambda: {'living': 0, 'static': 0, 'events': []}),
            'by_type': defaultdict(lambda: {'living': 0, 'static': 0}),
            't6_issues': []
        }

    def parse_logs(self):
        """Parse le fichier JSONL et extrait les événements HARVEST."""
        print(f"📖 Parsing {self.log_file.name}...")

        with open(self.log_file, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                try:
                    entry = json.loads(line.strip())
                    self.stats['total_events'] += 1

                    if 'HARVEST' in entry.get('category', ''):
                        self.harvest_events.append(entry)
                        self.stats['harvest_events'] += 1
                        self.analyze_harvest_event(entry)

                except json.JSONDecodeError as e:
                    print(f"⚠️  Line {line_num}: JSON error: {e}")
                except Exception as e:
                    print(f"⚠️  Line {line_num}: Error: {e}")

        print(f"✅ Parsed {self.stats['total_events']:,} total events")
        print(f"✅ Found {self.stats['harvest_events']:,} harvest events\n")

    def analyze_harvest_event(self, entry: Dict[str, Any]):
        """Analyse un événement HARVEST individuel."""
        category = entry.get('category', '')
        event = entry.get('event', '')
        data = entry.get('data', {})

        # Comptage par catégorie
        self.stats['by_category'][category] += 1

        # Analyse des ressources avec tier
        tier = data.get('tier')
        if tier is None:
            return

        mobile_type_id = data.get('mobileTypeId')
        string_type = data.get('stringType', 'Unknown')
        resource_id = data.get('id')
        size = data.get('size', 0)
        enchant = data.get('enchant', 0)

        # Déterminer si living ou static
        is_living = mobile_type_id == 65535
        status = 'living' if is_living else 'static'

        # Stats par tier
        tier_stats = self.stats['by_tier'][tier]
        tier_stats[status] += 1
        tier_stats['events'].append({
            'timestamp': entry.get('timestamp'),
            'category': category,
            'event': event,
            'id': resource_id,
            'type': string_type,
            'size': size,
            'enchant': enchant,
            'is_living': is_living
        })

        # Stats par type de ressource
        type_key = f"T{tier} {string_type}"
        self.stats['by_type'][type_key][status] += 1

        # Identifier les problèmes T6
        if tier == 6:
            # Vérifier la catégorie
            if category == 'HARVEST_HIDE_T4':
                self.stats['t6_issues'].append({
                    'issue': 'Wrong category (HARVEST_HIDE_T4 for T6)',
                    'timestamp': entry.get('timestamp'),
                    'id': resource_id,
                    'type': string_type,
                    'is_living': is_living,
                    'category': category,
                    'event': event,
                    'enchant': enchant,
                    'size': size
                })

            # Vérifier size=0 pour living
            if is_living and size == 0:
                self.stats['t6_issues'].append({
                    'issue': 'Living resource with size=0',
                    'timestamp': entry.get('timestamp'),
                    'id': resource_id,
                    'type': string_type,
                    'is_living': is_living,
                    'category': category,
                    'event': event,
                    'enchant': enchant,
                    'size': size
                })

    def print_report(self):
        """Affiche le rapport d'analyse."""
        print("=" * 80)
        print("📊 RAPPORT D'ANALYSE DES LOGS HARVEST")
        print("=" * 80)
        print()

        # Catégories utilisées
        print("📂 Catégories HARVEST détectées:")
        for category, count in sorted(self.stats['by_category'].items(), key=lambda x: x[1], reverse=True):
            print(f"   • {category}: {count:,} événements")
        print()

        # Stats par tier
        print("⚡ Statistiques par Tier:")
        for tier in sorted(self.stats['by_tier'].keys()):
            tier_stats = self.stats['by_tier'][tier]
            living = tier_stats['living']
            static = tier_stats['static']
            total = living + static
            living_pct = (living / total * 100) if total > 0 else 0

            print(f"\n   T{tier}: {total:,} détections")
            print(f"      → Living: {living:,} ({living_pct:.1f}%)")
            print(f"      → Static: {static:,} ({100-living_pct:.1f}%)")
        print()

        # Stats par type de ressource
        print("🌲 Statistiques par Type de Ressource:")
        for resource_type in sorted(self.stats['by_type'].keys()):
            type_stats = self.stats['by_type'][resource_type]
            living = type_stats['living']
            static = type_stats['static']
            total = living + static

            if 'T6' in resource_type or 'T5' in resource_type:  # Focus sur T5-T6
                print(f"   • {resource_type}:")
                print(f"      → Living: {living:,} | Static: {static:,} | Total: {total:,}")
        print()

        # Problèmes T6
        print("🚨 PROBLÈMES IDENTIFIÉS POUR T6:")
        print()

        if not self.stats['t6_issues']:
            print("   ✅ Aucun problème détecté")
        else:
            # Grouper par type de problème
            issues_by_type = defaultdict(list)
            for issue in self.stats['t6_issues']:
                issues_by_type[issue['issue']].append(issue)

            for issue_type, issues in issues_by_type.items():
                print(f"   ⚠️  {issue_type}: {len(issues)} occurrences")

                # Afficher quelques exemples
                print(f"      Exemples:")
                for i, issue in enumerate(issues[:3], 1):
                    print(f"         {i}. ID:{issue['id']} | {issue['type']} | "
                          f"Living:{issue['is_living']} | Size:{issue['size']} | "
                          f"Category:{issue['category']}")

                if len(issues) > 3:
                    print(f"         ... et {len(issues) - 3} autres")
                print()

        # Analyse spécifique T6
        print("🔍 ANALYSE DÉTAILLÉE T6:")
        t6_stats = self.stats['by_tier'].get(6, {})
        if t6_stats:
            # Compter les catégories utilisées pour T6
            t6_categories = Counter()
            t6_by_type_and_status = defaultdict(lambda: {'living': [], 'static': []})

            for event in t6_stats.get('events', []):
                t6_categories[event['category']] += 1
                status = 'living' if event['is_living'] else 'static'
                t6_by_type_and_status[event['type']][status].append(event)

            print("   📌 Catégories utilisées pour T6:")
            for cat, count in t6_categories.most_common():
                print(f"      → {cat}: {count} événements")
            print()

            print("   📌 Détail par type de ressource T6:")
            for resource_type in sorted(t6_by_type_and_status.keys()):
                type_data = t6_by_type_and_status[resource_type]
                living_events = type_data['living']
                static_events = type_data['static']

                print(f"\n      🌿 T6 {resource_type}:")
                print(f"         Living: {len(living_events)} détections")
                if living_events:
                    sizes = [e['size'] for e in living_events]
                    enchants = [e['enchant'] for e in living_events]
                    print(f"            Sizes: {set(sizes)}")
                    print(f"            Enchants: {set(enchants)}")
                    print(f"            Categories: {set(e['category'] for e in living_events)}")

                print(f"         Static: {len(static_events)} détections")
                if static_events:
                    print(f"            Categories: {set(e['category'] for e in static_events)}")

        print()
        print("=" * 80)


def main():
    """Point d'entrée principal."""
    if len(sys.argv) > 1:
        log_path = Path(sys.argv[1])
    else:
        # Chercher le fichier le plus récent
        log_dirs = [
            Path('dist/logs/sessions'),
            Path('logs/sessions')
        ]

        log_files = []
        for log_dir in log_dirs:
            if log_dir.exists():
                log_files.extend(log_dir.glob('*.jsonl'))

        if not log_files:
            print("❌ Aucun fichier de log trouvé!")
            print("Usage: python analyze_harvest_logs.py [path/to/session.jsonl]")
            return

        # Prendre le plus récent
        log_path = max(log_files, key=lambda p: p.stat().st_mtime)
        print(f"📁 Fichier le plus récent: {log_path}\n")

    if not log_path.exists():
        print(f"❌ Fichier non trouvé: {log_path}")
        return

    # Analyser
    analyzer = HarvestLogAnalyzer(log_path)
    analyzer.parse_logs()
    analyzer.print_report()

    # Sauvegarder les résultats
    output_file = Path('work') / f'harvest_analysis_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
    output_file.parent.mkdir(exist_ok=True)

    with open(output_file, 'w', encoding='utf-8') as f:
        # Convertir les defaultdict en dict normal pour JSON
        stats_clean = {
            'total_events': analyzer.stats['total_events'],
            'harvest_events': analyzer.stats['harvest_events'],
            'by_category': dict(analyzer.stats['by_category']),
            'by_tier': {k: {
                'living': v['living'],
                'static': v['static'],
                'total': v['living'] + v['static']
            } for k, v in analyzer.stats['by_tier'].items()},
            't6_issues_count': len(analyzer.stats['t6_issues']),
            't6_issues_summary': {
                issue_type: len([i for i in analyzer.stats['t6_issues'] if i['issue'] == issue_type])
                for issue_type in set(i['issue'] for i in analyzer.stats['t6_issues'])
            }
        }
        json.dump(stats_clean, f, indent=2)

    print(f"💾 Résultats sauvegardés dans: {output_file}")


if __name__ == '__main__':
    main()