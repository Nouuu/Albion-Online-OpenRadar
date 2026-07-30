import { CATEGORIES } from "../constants/LoggerConstants.js";

// Roads of Avalon reset well under a week in-game; 3 days balances "probably still
// usable" against "stale enough to mislead". Discovered edges older than this are kept
// (in case no fresher path exists) but deprioritized by getNextHop.
const STALE_MS = 3 * 24 * 60 * 60 * 1000;

export class ZoneGraph {
  constructor() {
    this.adjacency = new Map(); // zoneId -> [{to, pos, source: 'static'|'discovered'|'assumed', discoveredAt?}]
    this.loaded = false;
  }

  async load(graphPath = "/ao-bin-dumps/zone-graph.json", roadsUrl = "/api/roads/edges") {
    try {
      const [staticRes, discoveredRes] = await Promise.all([
        fetch(graphPath, { cache: "no-cache" }),
        fetch(roadsUrl).catch(() => null),
      ]);

      const staticData = staticRes.ok ? await staticRes.json() : { edges: [] };
      const discoveredData = discoveredRes && discoveredRes.ok ? await discoveredRes.json() : [];

      this.loadFromEdges(staticData.edges || [], discoveredData || []);

      window.logger?.info(CATEGORIES.GPS, "ZoneGraphLoaded", {
        staticEdges: (staticData.edges || []).length,
        discoveredEdges: (discoveredData || []).length,
      });
    } catch (error) {
      window.logger?.error(CATEGORIES.GPS, "ZoneGraphLoadError", { error: error.message });
      throw error;
    }
  }

  // Testable seam: bypasses fetch entirely, same role as ZonesDatabase's direct
  // `.zones` assignment in tests.
  loadFromEdges(staticEdges = [], discoveredEdges = []) {
    this.adjacency = new Map();
    for (const edge of staticEdges) {
      this._addEdge(edge.from, edge.to, edge.pos ?? null, "static");
    }
    for (const edge of discoveredEdges) {
      this._addEdge(edge.from, edge.to, edge.pos ?? null, "discovered", edge.discoveredAt);
    }
    // Second pass, after every real observed direction is in: assume each discovered edge is
    // reversible (you can back out the way you came) unless that reverse was itself separately
    // observed, in which case the real observation already added by the loop above wins.
    for (const edge of discoveredEdges) {
      this._addAssumedReverse(edge.to, edge.from, edge.discoveredAt);
    }
    this.loaded = true;
  }

  _addEdge(from, to, pos, source, discoveredAt) {
    if (!from || !to) return;
    if (!this.adjacency.has(from)) this.adjacency.set(from, []);
    const list = this.adjacency.get(from);
    const existing = list.find((e) => e.to === to);
    if (existing) {
      existing.pos = pos;
      existing.source = source;
      existing.discoveredAt = discoveredAt;
    } else {
      list.push({ to, pos, source, discoveredAt });
    }
  }

  // The exit position for the reverse direction lives in the *other* zone's local coordinates,
  // which reportTransition never observes (only the pre-transition position, in the origin zone,
  // is known) - so the assumed reverse carries no viaPos, only "which zone to head back to".
  _addAssumedReverse(from, to, discoveredAt) {
    if (!from || !to || from === to) return;
    if (this.hasEdge(from, to)) return; // never downgrade an already-known (real) edge
    this._addEdge(from, to, null, "assumed", discoveredAt);
  }

  hasEdge(from, to) {
    const edges = this.adjacency.get(from);
    return !!edges && edges.some((e) => e.to === to);
  }

  // "Stale" = a real observation old enough that the road may have reset since.
  isStale(edge) {
    if (edge.source !== "discovered" || !edge.discoveredAt) return false;
    return Date.now() - new Date(edge.discoveredAt).getTime() > STALE_MS;
  }

  // "Assumed" = never actually observed in this direction, only inferred as the reverse of a
  // real transition. Ages out via the same discoveredAt as a stale check would, since it's exactly
  // as likely to have been invalidated by a road reset as the observation it was inferred from.
  isAssumed(edge) {
    return edge.source === "assumed";
  }

  isUnreliable(edge) {
    return this.isAssumed(edge) || this.isStale(edge);
  }

  // Unweighted BFS: "which exit do I take now" is answered correctly by hop-count
  // shortest path in the vast majority of cases; weighting by zone danger would be an
  // unjustified value judgment (safe-but-long vs. short-but-black has no universal answer).
  // Tries reliable-only edges first (static + confirmed discoveries), falling back to also
  // allowing stale/assumed edges only when no fully-reliable path exists - so a confirmed
  // route is always preferred over "probably still works" guesses, but a U-turn through an
  // unconfirmed-reversible road beats no suggestion at all.
  _shortestPath(fromZoneId, toZoneId, includeUnreliable) {
    const visited = new Set([fromZoneId]);
    const queue = [{ id: fromZoneId, path: [fromZoneId], usedStale: false, usedAssumed: false }];
    let head = 0;
    while (head < queue.length) {
      const { id, path, usedStale, usedAssumed } = queue[head++];
      const edges = this.adjacency.get(id) || [];
      for (const edge of edges) {
        if (visited.has(edge.to)) continue;
        if (this.isUnreliable(edge) && !includeUnreliable) continue;

        const nextPath = [...path, edge.to];
        const nextUsedStale = usedStale || this.isStale(edge);
        const nextUsedAssumed = usedAssumed || this.isAssumed(edge);
        if (edge.to === toZoneId) {
          return { path: nextPath, usedStale: nextUsedStale, usedAssumed: nextUsedAssumed };
        }
        visited.add(edge.to);
        queue.push({ id: edge.to, path: nextPath, usedStale: nextUsedStale, usedAssumed: nextUsedAssumed });
      }
    }
    return null;
  }

  // Returns only the next hop (zone + exit position), not the full route.
  getNextHop(fromZoneId, toZoneId) {
    if (!this.loaded || !fromZoneId || !toZoneId) return null;
    if (fromZoneId === toZoneId) {
      return { nextZoneId: fromZoneId, viaPos: null, hops: 0, stale: false, assumed: false };
    }

    const result =
      this._shortestPath(fromZoneId, toZoneId, false) ?? this._shortestPath(fromZoneId, toZoneId, true);
    if (!result) return null;

    const nextZoneId = result.path[1];
    const usedEdge = (this.adjacency.get(fromZoneId) || []).find((e) => e.to === nextZoneId);
    return {
      nextZoneId,
      viaPos: usedEdge?.pos ?? null,
      hops: result.path.length - 1,
      stale: result.usedStale,
      assumed: result.usedAssumed,
    };
  }

  // Called on every zone transition (see EventRouter.applyMapChange). Only real
  // cluster-to-cluster transitions that aren't already explainable by the static or
  // previously-discovered graph get recorded - that's exactly the "must be an Avalon
  // Road" signal, since static adjacency already covers ordinary open-world exits.
  reportTransition(fromZoneId, toZoneId, pos) {
    // Before the graph has loaded, adjacency is empty, so "not already known" can't be trusted -
    // every edge would look novel. Also keeps this a no-op in contexts that never call load().
    if (!this.loaded) return;
    if (!fromZoneId || !toZoneId || fromZoneId === toZoneId) return;
    if (this.hasEdge(fromZoneId, toZoneId)) return;

    const discoveredAt = new Date().toISOString();
    const posArray = pos && Number.isFinite(pos.x) && Number.isFinite(pos.y) ? [pos.x, pos.y] : null;
    this._addEdge(fromZoneId, toZoneId, posArray, "discovered", discoveredAt);
    this._addAssumedReverse(toZoneId, fromZoneId, discoveredAt);

    // fetch() can throw synchronously (e.g. unavailable in the current environment) in addition
    // to rejecting asynchronously (network error) - guard both so a reporting failure never
    // breaks the zone transition it's piggybacking on.
    try {
      Promise.resolve(
        fetch("/api/roads/edges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from: fromZoneId, to: toZoneId, pos: posArray }),
        })
      ).catch((error) => {
        window.logger?.warn(CATEGORIES.GPS, "RoadReportFailed", { error: error?.message });
      });
    } catch (error) {
      window.logger?.warn(CATEGORIES.GPS, "RoadReportFailed", { error: error?.message });
    }
  }
}

const zoneGraph = new ZoneGraph();
export default zoneGraph;
