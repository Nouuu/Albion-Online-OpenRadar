import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { ZoneGraph } from "./ZoneGraph.js";

describe("ZoneGraph pathfinding", () => {
  let graph;

  beforeEach(() => {
    graph = new ZoneGraph();
  });

  test("getNextHop returns null before the graph is loaded", () => {
    expect(graph.getNextHop("A", "B")).toBeNull();
  });

  test("getNextHop on the current zone returns 0 hops", () => {
    graph.loadFromEdges([{ from: "A", to: "B", pos: [1, 1] }]);
    expect(graph.getNextHop("A", "A")).toEqual({
      nextZoneId: "A", viaPos: null, hops: 0, stale: false, assumed: false,
    });
  });

  test("getNextHop finds a direct single-hop static edge", () => {
    graph.loadFromEdges([{ from: "A", to: "B", pos: [10, 20] }]);
    expect(graph.getNextHop("A", "B")).toEqual({
      nextZoneId: "B", viaPos: [10, 20], hops: 1, stale: false, assumed: false,
    });
  });

  test("getNextHop finds the shortest multi-hop static path and reports the first hop only", () => {
    graph.loadFromEdges([
      { from: "A", to: "B", pos: [1, 1] },
      { from: "B", to: "C", pos: [2, 2] },
      { from: "C", to: "D", pos: [3, 3] },
    ]);
    const hop = graph.getNextHop("A", "D");
    expect(hop.nextZoneId).toBe("B");
    expect(hop.hops).toBe(3);
    expect(hop.stale).toBe(false);
    expect(hop.assumed).toBe(false);
  });

  test("getNextHop returns null when no path exists", () => {
    graph.loadFromEdges([{ from: "A", to: "B", pos: null }]);
    expect(graph.getNextHop("A", "Z")).toBeNull();
  });

  test("a newly discovered edge shortens the computed path", () => {
    // Long static route A -> B -> C -> D, plus a discovered shortcut A -> D.
    graph.loadFromEdges(
      [
        { from: "A", to: "B", pos: null },
        { from: "B", to: "C", pos: null },
        { from: "C", to: "D", pos: null },
      ],
      [{ from: "A", to: "D", pos: [9, 9], discoveredAt: new Date().toISOString() }]
    );
    const hop = graph.getNextHop("A", "D");
    expect(hop).toEqual({ nextZoneId: "D", viaPos: [9, 9], hops: 1, stale: false, assumed: false });
  });

  test("a stale-only discovered path falls back to a fresh alternative when one exists", () => {
    const staleDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
    graph.loadFromEdges(
      [
        { from: "A", to: "B", pos: null },
        { from: "B", to: "C", pos: null },
      ],
      [{ from: "A", to: "C", pos: [5, 5], discoveredAt: staleDate }]
    );
    // Stale shortcut A->C exists but should be deprioritized in favor of the fresh A->B->C route.
    const hop = graph.getNextHop("A", "C");
    expect(hop.nextZoneId).toBe("B");
    expect(hop.hops).toBe(2);
    expect(hop.stale).toBe(false);
  });

  test("a stale discovered edge is still used when it's the only path available", () => {
    const staleDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    graph.loadFromEdges([], [{ from: "A", to: "Z", pos: [1, 2], discoveredAt: staleDate }]);
    const hop = graph.getNextHop("A", "Z");
    expect(hop).toEqual({ nextZoneId: "Z", viaPos: [1, 2], hops: 1, stale: true, assumed: false });
  });

  test("hasEdge reports static edges, discovered edges, and their assumed reverse", () => {
    graph.loadFromEdges([{ from: "A", to: "B", pos: null }], [{ from: "B", to: "C", discoveredAt: new Date().toISOString() }]);
    expect(graph.hasEdge("A", "B")).toBe(true);
    expect(graph.hasEdge("B", "C")).toBe(true);
    // C->B was never observed directly, but is now known as an assumed reverse of the B->C discovery.
    expect(graph.hasEdge("C", "B")).toBe(true);
    // A static edge never gets a synthesized reverse: only discovered edges do (see loadFromEdges).
    expect(graph.hasEdge("B", "A")).toBe(false);
  });
});

describe("ZoneGraph assumed reverse (U-turn) edges", () => {
  let graph;

  beforeEach(() => {
    graph = new ZoneGraph();
  });

  // @verified: motivating case - entering a brand new, never-explored Avalonian Road should
  // immediately let the GPS suggest turning back, since we know how we got here.
  test("a freshly discovered A->B edge lets getNextHop(B, A) suggest turning back", () => {
    graph.loadFromEdges([], [{ from: "A", to: "TNL-001", pos: [5, 5], discoveredAt: new Date().toISOString() }]);

    const hop = graph.getNextHop("TNL-001", "A");
    expect(hop.nextZoneId).toBe("A");
    expect(hop.hops).toBe(1);
    expect(hop.assumed).toBe(true);
    // The return exit's position lives in TNL-001's own local coordinates, which was never
    // observed (only the pre-transition position, in A, is known) - so it's honestly null.
    expect(hop.viaPos).toBeNull();
  });

  test("a real observed edge always wins over its synthesized assumed counterpart", () => {
    // Player walked A->B once, then separately walked B->A later - both are real observations.
    graph.loadFromEdges([], [
      { from: "A", to: "B", pos: [1, 1], discoveredAt: new Date().toISOString() },
      { from: "B", to: "A", pos: [9, 9], discoveredAt: new Date().toISOString() },
    ]);

    const hop = graph.getNextHop("B", "A");
    expect(hop.assumed).toBe(false);
    expect(hop.viaPos).toEqual([9, 9]); // the real B->A observation's own position, not null
  });

  test("chained discoveries let getNextHop retrace multiple hops back out via assumed edges", () => {
    // Simulates walking three tunnel hops deep: A -> R1 -> R2 -> R3, each reported individually.
    const now = new Date().toISOString();
    graph.loadFromEdges([], [
      { from: "A", to: "R1", pos: [1, 1], discoveredAt: now },
      { from: "R1", to: "R2", pos: [2, 2], discoveredAt: now },
      { from: "R2", to: "R3", pos: [3, 3], discoveredAt: now },
    ]);

    const hop = graph.getNextHop("R3", "A");
    expect(hop.nextZoneId).toBe("R2");
    expect(hop.hops).toBe(3);
    expect(hop.assumed).toBe(true);
  });

  test("reportTransition immediately makes the reverse direction usable, not just on next load", () => {
    graph.loadFromEdges([]);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ status: "ok" }) });

    graph.reportTransition("A", "TNL-005", { x: 3, y: 4 });

    const hop = graph.getNextHop("TNL-005", "A");
    expect(hop).toEqual({ nextZoneId: "A", viaPos: null, hops: 1, stale: false, assumed: true });

    globalThis.fetch = originalFetch;
  });

  test("an assumed edge does not overwrite an existing static edge in the opposite direction", () => {
    // A->B is a known static (bidirectional-by-construction, since the static graph already
    // emits both directions) edge; reportTransition should never downgrade it to "assumed".
    graph.loadFromEdges([
      { from: "A", to: "B", pos: [1, 1] },
      { from: "B", to: "A", pos: [2, 2] },
    ]);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ status: "ok" }) });

    // Not expected in practice (static edges are already known) but exercises the guard directly.
    graph._addAssumedReverse("B", "A", new Date().toISOString());

    expect(graph.getNextHop("B", "A")).toEqual({
      nextZoneId: "A", viaPos: [2, 2], hops: 1, stale: false, assumed: false,
    });

    globalThis.fetch = originalFetch;
  });
});

describe("ZoneGraph.reportTransition", () => {
  let graph;
  let originalFetch;
  let calls;

  beforeEach(() => {
    graph = new ZoneGraph();
    originalFetch = globalThis.fetch;
    calls = [];
    globalThis.fetch = (url, init) => {
      calls.push({ url, init });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ status: "ok" }) });
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("records a new edge in memory and POSTs it", async () => {
    graph.loadFromEdges([]);
    graph.reportTransition("A", "TNL-001", { x: 1.5, y: -2.5 });

    expect(graph.hasEdge("A", "TNL-001")).toBe(true);
    expect(graph.getNextHop("A", "TNL-001")).toEqual({
      nextZoneId: "TNL-001",
      viaPos: [1.5, -2.5],
      hops: 1,
      stale: false,
      assumed: false,
    });

    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].url).toBe("/api/roads/edges");
    const body = JSON.parse(calls[0].init.body);
    expect(body).toEqual({ from: "A", to: "TNL-001", pos: [1.5, -2.5] });
  });

  test("does not report a transition to the same zone", () => {
    graph.loadFromEdges([]);
    graph.reportTransition("A", "A", { x: 0, y: 0 });
    expect(calls).toHaveLength(0);
  });

  test("does not re-report an edge already known from the static graph", () => {
    graph.loadFromEdges([{ from: "A", to: "B", pos: [1, 1] }]);
    graph.reportTransition("A", "B", { x: 9, y: 9 });
    expect(calls).toHaveLength(0);
  });

  test("does not re-report an edge already discovered previously", () => {
    graph.loadFromEdges([], [{ from: "A", to: "B", pos: [1, 1], discoveredAt: new Date().toISOString() }]);
    graph.reportTransition("A", "B", { x: 9, y: 9 });
    expect(calls).toHaveLength(0);
  });

  test("stores a null position when the given position is missing or invalid", () => {
    graph.loadFromEdges([]);
    graph.reportTransition("A", "B", null);
    expect(graph.getNextHop("A", "B").viaPos).toBeNull();
  });
});

describe("ZoneGraph.load", () => {
  let originalFetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("merges static edges and discovered edges fetched from their respective endpoints", async () => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = (url) => {
      if (url === "/ao-bin-dumps/zone-graph.json") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ edges: [{ from: "A", to: "B", pos: [1, 1] }] }) });
      }
      if (url === "/api/roads/edges") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ from: "B", to: "C", pos: [2, 2], discoveredAt: new Date().toISOString() }]),
        });
      }
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    };

    const graph = new ZoneGraph();
    await graph.load();

    expect(graph.hasEdge("A", "B")).toBe(true);
    expect(graph.hasEdge("B", "C")).toBe(true);
    expect(graph.getNextHop("A", "C")).toEqual({ nextZoneId: "B", viaPos: [1, 1], hops: 2, stale: false, assumed: false });
  });
});
