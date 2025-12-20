#!/usr/bin/env python3
"""
Chrome DevTools Performance Trace Analyzer
Identifies performance bottlenecks and memory issues
"""

import json
import sys
from collections import defaultdict


def load_trace(filepath):
    """Load trace file, handling large files efficiently"""
    print(f"Loading trace file: {filepath}")
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data


def analyze_trace(data):
    """Analyze trace events for performance issues"""
    events = data.get('traceEvents', [])
    metadata = data.get('metadata', {})

    print(f"\n{'=' * 60}")
    print("CHROME DEVTOOLS PERFORMANCE TRACE ANALYSIS")
    print(f"{'=' * 60}")
    print(f"\nMetadata:")
    print(f"  Start Time: {metadata.get('startTime', 'N/A')}")
    print(f"  CPU Throttling: {metadata.get('cpuThrottling', 1)}x")
    print(f"  Total Events: {len(events):,}")

    # Find renderer main thread (CrRendererMain)
    renderer_pid = None
    main_tid = None
    for e in events:
        if e.get('name') == 'thread_name' and e.get('args', {}).get('name') == 'CrRendererMain':
            renderer_pid = e.get('pid')
            main_tid = e.get('tid')
            break

    print(f"  Renderer PID: {renderer_pid}, Main TID: {main_tid}")

    # Analysis containers
    long_tasks = []  # Tasks > 50ms
    function_calls = defaultdict(lambda: {'count': 0, 'total_dur': 0, 'max_dur': 0})
    gc_events = []
    layout_events = []
    paint_events = []
    script_events = []
    raf_events = []
    websocket_events = []
    memory_snapshots = []
    frame_times = []

    # Parse events
    for e in events:
        name = e.get('name', '')
        cat = e.get('cat', '')
        dur = e.get('dur', 0)  # microseconds
        ts = e.get('ts', 0)
        pid = e.get('pid')
        tid = e.get('tid')
        args = e.get('args', {})
        ph = e.get('ph', '')  # phase

        # Only analyze main thread for most metrics
        is_main_thread = (pid == renderer_pid and tid == main_tid)

        # Long tasks (> 50ms on main thread)
        if is_main_thread and dur > 50000:  # 50ms in microseconds
            long_tasks.append({
                'name': name,
                'dur_ms': dur / 1000,
                'ts': ts,
                'args': args
            })

        # Function calls
        if name == 'FunctionCall' and dur > 0:
            func_name = args.get('data', {}).get('functionName', 'anonymous')
            url = args.get('data', {}).get('url', '')
            key = f"{func_name} ({url.split('/')[-1] if url else 'inline'})"
            function_calls[key]['count'] += 1
            function_calls[key]['total_dur'] += dur
            function_calls[key]['max_dur'] = max(function_calls[key]['max_dur'], dur)

        # Garbage Collection
        if 'GC' in name or name in ['MinorGC', 'MajorGC', 'V8.GC', 'BlinkGC']:
            gc_events.append({
                'name': name,
                'dur_ms': dur / 1000 if dur else 0,
                'ts': ts
            })

        # Layout/Reflow events
        if name in ['Layout', 'UpdateLayoutTree', 'RecalculateStyles', 'InvalidateLayout']:
            layout_events.append({
                'name': name,
                'dur_ms': dur / 1000 if dur else 0,
                'ts': ts,
                'forced': args.get('data', {}).get('frame') == 'forced'
            })

        # Paint events
        if name in ['Paint', 'PaintImage', 'CompositeLayers', 'UpdateLayer', 'RasterTask']:
            paint_events.append({
                'name': name,
                'dur_ms': dur / 1000 if dur else 0,
                'ts': ts
            })

        # Script evaluation
        if name in ['EvaluateScript', 'v8.compile', 'v8.run']:
            script_events.append({
                'name': name,
                'dur_ms': dur / 1000 if dur else 0,
                'url': args.get('data', {}).get('url', ''),
                'ts': ts
            })

        # requestAnimationFrame
        if name == 'FireAnimationFrame' or name == 'RequestAnimationFrame':
            raf_events.append({
                'name': name,
                'dur_ms': dur / 1000 if dur else 0,
                'ts': ts,
                'id': args.get('data', {}).get('id')
            })

        # WebSocket events
        if 'WebSocket' in name or 'websocket' in name.lower():
            websocket_events.append({
                'name': name,
                'dur_ms': dur / 1000 if dur else 0,
                'ts': ts
            })

        # Memory snapshots
        if name == 'UpdateCounters' or 'memory' in cat.lower():
            counters = args.get('data', {})
            if counters:
                memory_snapshots.append({
                    'ts': ts,
                    'jsHeapSizeUsed': counters.get('jsHeapSizeUsed', 0),
                    'documents': counters.get('documents', 0),
                    'nodes': counters.get('nodes', 0),
                    'jsEventListeners': counters.get('jsEventListeners', 0)
                })

        # Frame timing
        if name == 'BeginFrame':
            frame_times.append(ts)

    # Generate report
    print(f"\n{'=' * 60}")
    print("1. LONG TASKS (>50ms on main thread)")
    print(f"{'=' * 60}")

    if long_tasks:
        long_tasks.sort(key=lambda x: -x['dur_ms'])
        print(f"\nFound {len(long_tasks)} long tasks")
        print("\nTop 20 longest tasks:")
        for i, task in enumerate(long_tasks[:20]):
            print(f"  {i + 1:2}. {task['name']:<40} {task['dur_ms']:>8.1f}ms")

        # Aggregate by name
        task_by_name = defaultdict(lambda: {'count': 0, 'total': 0, 'max': 0})
        for task in long_tasks:
            task_by_name[task['name']]['count'] += 1
            task_by_name[task['name']]['total'] += task['dur_ms']
            task_by_name[task['name']]['max'] = max(task_by_name[task['name']]['max'], task['dur_ms'])

        print("\nLong tasks aggregated by type:")
        sorted_tasks = sorted(task_by_name.items(), key=lambda x: -x[1]['total'])
        for name, stats in sorted_tasks[:15]:
            print(f"  {name:<40} count={stats['count']:>4}, total={stats['total']:>8.1f}ms, max={stats['max']:>8.1f}ms")
    else:
        print("  No long tasks detected (good!)")

    print(f"\n{'=' * 60}")
    print("2. EXPENSIVE FUNCTION CALLS")
    print(f"{'=' * 60}")

    if function_calls:
        # Sort by total duration
        sorted_funcs = sorted(function_calls.items(), key=lambda x: -x[1]['total_dur'])
        print("\nTop 20 most expensive functions (by total time):")
        for i, (name, stats) in enumerate(sorted_funcs[:20]):
            total_ms = stats['total_dur'] / 1000
            max_ms = stats['max_dur'] / 1000
            avg_ms = total_ms / stats['count'] if stats['count'] else 0
            print(f"  {i + 1:2}. {name[:50]:<50}")
            print(
                f"      count={stats['count']:>5}, total={total_ms:>8.1f}ms, avg={avg_ms:>6.2f}ms, max={max_ms:>8.1f}ms")
    else:
        print("  No function call data available")

    print(f"\n{'=' * 60}")
    print("3. GARBAGE COLLECTION")
    print(f"{'=' * 60}")

    if gc_events:
        total_gc_time = sum(e['dur_ms'] for e in gc_events)
        gc_by_type = defaultdict(lambda: {'count': 0, 'total': 0, 'max': 0})
        for gc in gc_events:
            gc_by_type[gc['name']]['count'] += 1
            gc_by_type[gc['name']]['total'] += gc['dur_ms']
            gc_by_type[gc['name']]['max'] = max(gc_by_type[gc['name']]['max'], gc['dur_ms'])

        print(f"\nTotal GC events: {len(gc_events)}")
        print(f"Total GC time: {total_gc_time:.1f}ms")
        print("\nGC by type:")
        for name, stats in sorted(gc_by_type.items(), key=lambda x: -x[1]['total']):
            print(f"  {name:<30} count={stats['count']:>4}, total={stats['total']:>8.1f}ms, max={stats['max']:>6.1f}ms")

        # Find GC spikes (>10ms)
        gc_spikes = [g for g in gc_events if g['dur_ms'] > 10]
        if gc_spikes:
            print(f"\nGC spikes (>10ms): {len(gc_spikes)}")
            for g in sorted(gc_spikes, key=lambda x: -x['dur_ms'])[:10]:
                print(f"  {g['name']:<30} {g['dur_ms']:>6.1f}ms")
    else:
        print("  No GC events recorded")

    print(f"\n{'=' * 60}")
    print("4. LAYOUT/REFLOW ANALYSIS")
    print(f"{'=' * 60}")

    if layout_events:
        total_layout_time = sum(e['dur_ms'] for e in layout_events)
        layout_by_type = defaultdict(lambda: {'count': 0, 'total': 0, 'max': 0, 'forced': 0})
        for l in layout_events:
            layout_by_type[l['name']]['count'] += 1
            layout_by_type[l['name']]['total'] += l['dur_ms']
            layout_by_type[l['name']]['max'] = max(layout_by_type[l['name']]['max'], l['dur_ms'])
            if l.get('forced'):
                layout_by_type[l['name']]['forced'] += 1

        print(f"\nTotal layout events: {len(layout_events)}")
        print(f"Total layout time: {total_layout_time:.1f}ms")
        print("\nLayout by type:")
        for name, stats in sorted(layout_by_type.items(), key=lambda x: -x[1]['total']):
            forced_str = f", FORCED={stats['forced']}" if stats['forced'] else ""
            print(
                f"  {name:<25} count={stats['count']:>5}, total={stats['total']:>8.1f}ms, max={stats['max']:>6.1f}ms{forced_str}")

        # Detect layout thrashing (many layouts in short time)
        if len(layout_events) > 100:
            layout_events_sorted = sorted(layout_events, key=lambda x: x['ts'])
            # Check for 10+ layouts within 100ms
            thrashing_periods = []
            window_size = 100000  # 100ms in microseconds
            for i, l in enumerate(layout_events_sorted):
                count_in_window = sum(1 for l2 in layout_events_sorted[i:]
                                      if l2['ts'] - l['ts'] < window_size)
                if count_in_window >= 10:
                    thrashing_periods.append({
                        'ts': l['ts'],
                        'count': count_in_window
                    })

            if thrashing_periods:
                print(f"\n[!] LAYOUT THRASHING DETECTED: {len(thrashing_periods)} periods with 10+ layouts in 100ms")
    else:
        print("  No layout events recorded")

    print(f"\n{'=' * 60}")
    print("5. PAINT/RENDER ANALYSIS")
    print(f"{'=' * 60}")

    if paint_events:
        total_paint_time = sum(e['dur_ms'] for e in paint_events)
        paint_by_type = defaultdict(lambda: {'count': 0, 'total': 0, 'max': 0})
        for p in paint_events:
            paint_by_type[p['name']]['count'] += 1
            paint_by_type[p['name']]['total'] += p['dur_ms']
            paint_by_type[p['name']]['max'] = max(paint_by_type[p['name']]['max'], p['dur_ms'])

        print(f"\nTotal paint events: {len(paint_events)}")
        print(f"Total paint time: {total_paint_time:.1f}ms")
        print("\nPaint by type:")
        for name, stats in sorted(paint_by_type.items(), key=lambda x: -x[1]['total']):
            print(f"  {name:<25} count={stats['count']:>5}, total={stats['total']:>8.1f}ms, max={stats['max']:>6.1f}ms")
    else:
        print("  No paint events recorded")

    print(f"\n{'=' * 60}")
    print("6. SCRIPT EVALUATION")
    print(f"{'=' * 60}")

    if script_events:
        script_by_url = defaultdict(lambda: {'count': 0, 'total': 0})
        for s in script_events:
            url = s['url'].split('/')[-1] if s['url'] else 'inline'
            script_by_url[url]['count'] += 1
            script_by_url[url]['total'] += s['dur_ms']

        print("\nScript evaluation by file:")
        for url, stats in sorted(script_by_url.items(), key=lambda x: -x[1]['total'])[:15]:
            print(f"  {url:<40} count={stats['count']:>3}, total={stats['total']:>8.1f}ms")
    else:
        print("  No script evaluation events recorded")

    print(f"\n{'=' * 60}")
    print("7. ANIMATION FRAMES (requestAnimationFrame)")
    print(f"{'=' * 60}")

    if raf_events:
        fire_events = [r for r in raf_events if r['name'] == 'FireAnimationFrame']
        if fire_events:
            total_raf_time = sum(e['dur_ms'] for e in fire_events)
            avg_raf_time = total_raf_time / len(fire_events)
            max_raf_time = max(e['dur_ms'] for e in fire_events)

            print(f"\nTotal RAF callbacks: {len(fire_events)}")
            print(f"Total RAF time: {total_raf_time:.1f}ms")
            print(f"Average RAF time: {avg_raf_time:.2f}ms")
            print(f"Max RAF time: {max_raf_time:.1f}ms")

            # Long RAFs (> 16ms budget)
            long_rafs = [r for r in fire_events if r['dur_ms'] > 16]
            if long_rafs:
                print(
                    f"\n[!] RAF callbacks exceeding 16ms budget: {len(long_rafs)} ({100 * len(long_rafs) / len(fire_events):.1f}%)")
                # Distribution
                ranges = [(16, 32), (32, 50), (50, 100), (100, float('inf'))]
                for low, high in ranges:
                    count = len([r for r in fire_events if low <= r['dur_ms'] < high])
                    if count:
                        print(f"    {low}-{high if high != float('inf') else 'INF'}ms: {count}")
    else:
        print("  No RAF events recorded")

    print(f"\n{'=' * 60}")
    print("8. WEBSOCKET EVENTS")
    print(f"{'=' * 60}")

    if websocket_events:
        ws_by_type = defaultdict(lambda: {'count': 0, 'total': 0})
        for ws in websocket_events:
            ws_by_type[ws['name']]['count'] += 1
            ws_by_type[ws['name']]['total'] += ws['dur_ms']

        print(f"\nWebSocket events: {len(websocket_events)}")
        for name, stats in sorted(ws_by_type.items(), key=lambda x: -x[1]['count']):
            print(f"  {name:<30} count={stats['count']:>5}, total={stats['total']:>8.1f}ms")
    else:
        print("  No WebSocket events recorded (may be in different category)")

    print(f"\n{'=' * 60}")
    print("9. MEMORY ANALYSIS")
    print(f"{'=' * 60}")

    if memory_snapshots:
        # Filter out empty snapshots
        valid_snapshots = [m for m in memory_snapshots if m['jsHeapSizeUsed'] > 0]
        if valid_snapshots:
            heap_sizes = [m['jsHeapSizeUsed'] for m in valid_snapshots]
            min_heap = min(heap_sizes) / 1024 / 1024  # MB
            max_heap = max(heap_sizes) / 1024 / 1024
            avg_heap = sum(heap_sizes) / len(heap_sizes) / 1024 / 1024

            print(f"\nJS Heap Size:")
            print(f"  Min: {min_heap:.1f} MB")
            print(f"  Max: {max_heap:.1f} MB")
            print(f"  Avg: {avg_heap:.1f} MB")
            print(f"  Growth: {max_heap - min_heap:.1f} MB")

            if max_heap - min_heap > 50:  # More than 50MB growth
                print(f"\n[!] POTENTIAL MEMORY LEAK: Heap grew by {max_heap - min_heap:.1f} MB")

            # Check DOM nodes
            if valid_snapshots[0].get('nodes'):
                node_counts = [m['nodes'] for m in valid_snapshots if m.get('nodes')]
                if node_counts:
                    print(f"\nDOM Nodes:")
                    print(f"  Min: {min(node_counts):,}")
                    print(f"  Max: {max(node_counts):,}")
                    if max(node_counts) - min(node_counts) > 1000:
                        print(f"  [!] DOM node count increased by {max(node_counts) - min(node_counts):,}")

            # Check event listeners
            if valid_snapshots[0].get('jsEventListeners'):
                listener_counts = [m['jsEventListeners'] for m in valid_snapshots if m.get('jsEventListeners')]
                if listener_counts:
                    print(f"\nJS Event Listeners:")
                    print(f"  Min: {min(listener_counts):,}")
                    print(f"  Max: {max(listener_counts):,}")
                    if max(listener_counts) - min(listener_counts) > 100:
                        print(
                            f"  [!] Event listener count increased by {max(listener_counts) - min(listener_counts):,}")
        else:
            print("  No valid memory snapshots")
    else:
        print("  No memory snapshots recorded")

    print(f"\n{'=' * 60}")
    print("10. FRAME RATE ANALYSIS")
    print(f"{'=' * 60}")

    if len(frame_times) > 1:
        frame_deltas = []
        for i in range(1, len(frame_times)):
            delta = (frame_times[i] - frame_times[i - 1]) / 1000  # ms
            if 0 < delta < 1000:  # Filter outliers
                frame_deltas.append(delta)

        if frame_deltas:
            avg_frame_time = sum(frame_deltas) / len(frame_deltas)
            fps = 1000 / avg_frame_time if avg_frame_time > 0 else 0

            print(f"\nFrame count: {len(frame_times)}")
            print(f"Average frame time: {avg_frame_time:.2f}ms")
            print(f"Estimated FPS: {fps:.1f}")

            # Frame drops (>33ms = <30fps)
            dropped_frames = len([d for d in frame_deltas if d > 33])
            if dropped_frames:
                print(
                    f"\n[!] Dropped frames (>33ms): {dropped_frames} ({100 * dropped_frames / len(frame_deltas):.1f}%)")

            # Jank (>50ms)
            jank_frames = len([d for d in frame_deltas if d > 50])
            if jank_frames:
                print(f"[!] Jank frames (>50ms): {jank_frames} ({100 * jank_frames / len(frame_deltas):.1f}%)")
    else:
        print("  Insufficient frame data")

    print(f"\n{'=' * 60}")
    print("SUMMARY & RECOMMENDATIONS")
    print(f"{'=' * 60}\n")

    issues = []

    # Check for issues
    if long_tasks and len(long_tasks) > 10:
        issues.append(f"[HIGH] {len(long_tasks)} long tasks detected - main thread is frequently blocked")

    if gc_events:
        total_gc = sum(e['dur_ms'] for e in gc_events)
        if total_gc > 1000:
            issues.append(f"[MED] {total_gc:.0f}ms spent in GC - consider reducing allocations")

    if layout_events:
        layout_count = len(layout_events)
        if layout_count > 1000:
            issues.append(f"[MED] {layout_count} layout events - watch for layout thrashing")

    if raf_events:
        fire_events = [r for r in raf_events if r['name'] == 'FireAnimationFrame']
        long_rafs = [r for r in fire_events if r['dur_ms'] > 16]
        if len(long_rafs) > len(fire_events) * 0.2:
            issues.append(f"[HIGH] {100 * len(long_rafs) / len(fire_events):.0f}% of RAF callbacks exceed 16ms budget")

    if memory_snapshots:
        valid_snapshots = [m for m in memory_snapshots if m['jsHeapSizeUsed'] > 0]
        if valid_snapshots:
            heap_sizes = [m['jsHeapSizeUsed'] for m in valid_snapshots]
            growth_mb = (max(heap_sizes) - min(heap_sizes)) / 1024 / 1024
            if growth_mb > 50:
                issues.append(f"[HIGH] Memory grew by {growth_mb:.0f}MB - potential memory leak")

            # Check for DOM node leaks
            node_counts = [m['nodes'] for m in valid_snapshots if m.get('nodes')]
            if node_counts and max(node_counts) - min(node_counts) > 5000:
                issues.append(f"[HIGH] DOM nodes increased by {max(node_counts) - min(node_counts):,} - potential leak")

            # Check for event listener leaks
            listener_counts = [m['jsEventListeners'] for m in valid_snapshots if m.get('jsEventListeners')]
            if listener_counts and max(listener_counts) - min(listener_counts) > 500:
                issues.append(
                    f"[HIGH] Event listeners increased by {max(listener_counts) - min(listener_counts):,} - potential leak")

    if issues:
        print("Issues detected:\n")
        for issue in issues:
            print(f"  {issue}")
    else:
        print("[OK] No major performance issues detected")

    print("\n" + "=" * 60)


if __name__ == '__main__':
    trace_file = sys.argv[1] if len(sys.argv) > 1 else 'Trace-20251219T154708.json'
    data = load_trace(trace_file)
    analyze_trace(data)
