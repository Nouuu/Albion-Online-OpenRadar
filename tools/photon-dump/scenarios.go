package main

// MatchCriteria selects a decoded Photon message by kind, opcode, and optional
// parameter predicates. All fields are AND-ed. nil map = wildcard.
type MatchCriteria struct {
	Kind  string                    // "event" | "request" | "response"
	Code  int                       // event code (252) / op code (253)
	Where map[byte]func(v any) bool // optional per-parameter filter
}

// Scenario declares a single fixture extraction target.
type Scenario struct {
	Name        string          // "players/passive-player-spawn"
	Handler     string          // "players"
	Match       MatchCriteria   // primary trigger
	FollowUps   []MatchCriteria // optional, in order, on the same correlation key
	CorrelateBy byte            // parameter key to follow entity across packets (e.g. 0 for id)
	Limit       int             // max matches for this scenario (0 = 1)
}

// Event codes cross-referenced against the authoritative upstream
// work/data/AlbionOnline-StatisticsAnalysis/src/StatisticsAnalysisTool/Network/EventCodes.cs.
// The local web/scripts/utils/EventCodes.js is STALE for event positions past
// ~200: Albion inserted new events into the middle of the enum and shifted
// later codes. This discrepancy is logged in docs/project/IMPROVEMENTS.md
// and will surface as @suspect tests during handler characterization because
// the frontend EventRouter.js switches on the outdated values.
//
// Per Rule 11 of CLAUDE.md, every literal is grounded in a reference. The
// observed counts in docs/technical/PROTOCOL18_OBSERVED_CODES.md (from the
// 2026-04-18 user capture) confirm these numbers against real game traffic.
const (
	evtNewCharacter          = 29  // NewCharacter, PlayersHandler.handleNewPlayerEvent
	evtCharacterEquipment    = 90  // CharacterEquipmentChanged, PlayersHandler.updateItems
	evtChangeFlaggingFinish  = 363 // ChangeFlaggingFinished, PlayersHandler.updatePlayerFaction
	evtMounted               = 211 // Mounted, PlayersHandler.handleMountedPlayerEvent

	evtNewSimpleHarvestList  = 39  // NewSimpleHarvestableObjectList, HarvestablesHandler.newSimpleHarvestableObject
	evtNewHarvestable        = 40  // NewHarvestableObject, HarvestablesHandler.newHarvestableObject
	evtHarvestUpdate         = 46  // HarvestableChangeState, HarvestablesHandler.HarvestUpdateEvent
	evtHarvestFinished       = 61  // HarvestFinished, HarvestablesHandler.harvestFinished

	evtNewMob                = 123 // NewMob, MobsHandler.NewMobEvent
	evtMobChangeState        = 47  // MobChangeState, MobsHandler.updateEnchantEvent

	evtNewLootChest          = 391 // NewLootChest, ChestsHandler.addChestEvent
	evtNewFishingZone        = 359 // NewFishingZoneObject, FishingHandler.newFishEvent
	evtFishingFinished       = 356 // FishingFinished, FishingHandler.fishingEnd
	evtNewRandomDungeonExit  = 323 // NewRandomDungeonExit, DungeonsHandler.dungeonEvent
	evtNewCagedObject        = 530 // NewCagedObject, WispCageHandler.newCageEvent
	evtCagedObjectUpdate     = 531 // CagedObjectStateUpdated, WispCageHandler.cageOpenedEvent

	// Operation codes on Parameters[253]. JoinFinished (opResponse 2) carries
	// map.id at Parameters[8] and the isBZ hashtable at Parameters[103]
	// (issue #57). ChangeCluster (opResponse 41) carries the mid-session zone
	// change. opRequest 21/22 is opMove (22 post Protocol18, 21 kept for
	// backward compatibility in EventRouter.onRequest).
	opMoveRequest    = 22 // opRequest, PR #51 port
	opJoinFinished   = 2  // opResponse, onResponse Parameters[253] == 2 path
	opChangeCluster  = 41 // opResponse, onResponse Parameters[253] == 41 path
)

var scenarios = []Scenario{
	// Players
	{Name: "players/spawn", Handler: "players", Match: MatchCriteria{Kind: "event", Code: evtNewCharacter}, Limit: 8},
	{Name: "players/equipment", Handler: "players", Match: MatchCriteria{Kind: "event", Code: evtCharacterEquipment}, Limit: 5},
	{Name: "players/faction-change", Handler: "players", Match: MatchCriteria{Kind: "event", Code: evtChangeFlaggingFinish}, Limit: 3},
	{Name: "players/mounted", Handler: "players", Match: MatchCriteria{Kind: "event", Code: evtMounted}, Limit: 3},

	// Harvestables
	{Name: "harvestables/batch-spawn", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: evtNewSimpleHarvestList}, Limit: 3},
	{Name: "harvestables/single-spawn", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: evtNewHarvestable}, Limit: 25},
	{Name: "harvestables/state-update", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: evtHarvestUpdate}, Limit: 10},
	{Name: "harvestables/finished", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: evtHarvestFinished}, Limit: 5},

	// Mobs
	{Name: "mobs/spawn", Handler: "mobs", Match: MatchCriteria{Kind: "event", Code: evtNewMob}, Limit: 20},
	{Name: "mobs/change-state", Handler: "mobs", Match: MatchCriteria{Kind: "event", Code: evtMobChangeState}, Limit: 5},

	// Chests / Fishing / Dungeons / WispCage
	{Name: "chests/spawn", Handler: "chests", Match: MatchCriteria{Kind: "event", Code: evtNewLootChest}, Limit: 8},
	{Name: "fishing/spawn", Handler: "fishing", Match: MatchCriteria{Kind: "event", Code: evtNewFishingZone}, Limit: 5},
	{Name: "fishing/finished", Handler: "fishing", Match: MatchCriteria{Kind: "event", Code: evtFishingFinished}, Limit: 2},
	{Name: "dungeons/spawn", Handler: "dungeons", Match: MatchCriteria{Kind: "event", Code: evtNewRandomDungeonExit}, Limit: 10},
	{Name: "wispcage/spawn", Handler: "wispcage", Match: MatchCriteria{Kind: "event", Code: evtNewCagedObject}, Limit: 3},
	{Name: "wispcage/opened", Handler: "wispcage", Match: MatchCriteria{Kind: "event", Code: evtCagedObjectUpdate}, Limit: 2},

	// Router op-level
	{Name: "router/join-finished", Handler: "router", Match: MatchCriteria{Kind: "response", Code: opJoinFinished}, Limit: 2},
	{Name: "router/change-cluster", Handler: "router", Match: MatchCriteria{Kind: "response", Code: opChangeCluster}, Limit: 4},
	{Name: "router/move-request", Handler: "router", Match: MatchCriteria{Kind: "request", Code: opMoveRequest}, Limit: 5},
}
