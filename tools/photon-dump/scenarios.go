package main

import (
	"github.com/nospy/albion-openradar/internal/photon/eventcodes"
	"github.com/nospy/albion-openradar/internal/photon/operationcodes"
)

type MatchCriteria struct {
	Kind  string
	Code  int
	Where map[byte]func(v any) bool
}

type Scenario struct {
	Name        string
	Handler     string
	Match       MatchCriteria
	FollowUps   []MatchCriteria
	CorrelateBy byte
	Limit       int
}

var scenarios = []Scenario{
	{Name: "players/spawn", Handler: "players", Match: MatchCriteria{Kind: "event", Code: eventcodes.NewCharacter}, Limit: 8},
	{Name: "players/equipment", Handler: "players", Match: MatchCriteria{Kind: "event", Code: eventcodes.CharacterEquipmentChanged}, Limit: 5},
	{Name: "players/faction-change", Handler: "players", Match: MatchCriteria{Kind: "event", Code: eventcodes.ChangeFlaggingFinished}, Limit: 3},
	{Name: "players/mounted", Handler: "players", Match: MatchCriteria{Kind: "event", Code: eventcodes.Mounted}, Limit: 3},

	{Name: "harvestables/batch-spawn", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: eventcodes.NewSimpleHarvestableObjectList}, Limit: 3},
	{Name: "harvestables/single-spawn", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: eventcodes.NewHarvestableObject}, Limit: 25},
	{Name: "harvestables/state-update", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: eventcodes.HarvestableChangeState}, Limit: 10},
	{Name: "harvestables/finished", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: eventcodes.HarvestFinished}, Limit: 5},

	{Name: "mobs/spawn", Handler: "mobs", Match: MatchCriteria{Kind: "event", Code: eventcodes.NewMob}, Limit: 20},
	{Name: "mobs/change-state", Handler: "mobs", Match: MatchCriteria{Kind: "event", Code: eventcodes.MobChangeState}, Limit: 5},

	{Name: "chests/spawn", Handler: "chests", Match: MatchCriteria{Kind: "event", Code: eventcodes.NewLootChest}, Limit: 8},
	{Name: "fishing/spawn", Handler: "fishing", Match: MatchCriteria{Kind: "event", Code: eventcodes.NewFishingZoneObject}, Limit: 5},
	{Name: "fishing/finished", Handler: "fishing", Match: MatchCriteria{Kind: "event", Code: eventcodes.FishingFinished}, Limit: 2},
	{Name: "dungeons/spawn", Handler: "dungeons", Match: MatchCriteria{Kind: "event", Code: eventcodes.NewRandomDungeonExit}, Limit: 10},
	{Name: "wispcage/spawn", Handler: "wispcage", Match: MatchCriteria{Kind: "event", Code: eventcodes.NewCagedObject}, Limit: 3},
	{Name: "wispcage/opened", Handler: "wispcage", Match: MatchCriteria{Kind: "event", Code: eventcodes.CagedObjectStateUpdated}, Limit: 2},

	{Name: "router/join-finished", Handler: "router", Match: MatchCriteria{Kind: "response", Code: operationcodes.Join}, Limit: 2},
	{Name: "router/change-cluster", Handler: "router", Match: MatchCriteria{Kind: "response", Code: operationcodes.ChangeCluster}, Limit: 4},
	{Name: "router/move-request", Handler: "router", Match: MatchCriteria{Kind: "request", Code: operationcodes.Move}, Limit: 5},

	{Name: "mists/player-joined-info", Handler: "mists", Match: MatchCriteria{Kind: "event", Code: eventcodes.MistsPlayerJoinedInfo}, Limit: 5},
	{Name: "mists/wisp-spawn", Handler: "mists", Match: MatchCriteria{Kind: "event", Code: eventcodes.NewMistsWispSpawn}, Limit: 5},
}

var anyEvent = MatchCriteria{Kind: "event", Code: -1}

func joinAndSpawnsOf(ids ...int) []MatchCriteria {
	keep := []MatchCriteria{{Kind: "response", Code: operationcodes.Join}}
	for _, id := range ids {
		keep = append(keep, eventWithIDs(eventcodes.NewCharacter, map[byte]int{0: id}))
	}
	return keep
}

var rangeScenarios = []RangeScenario{
	{Name: "actions/self-cast", Handler: "actions", Port: 55153, Keep: joinAndSpawnsOf(1255088), Start: eventWithIDs(eventcodes.CastSpell, map[byte]int{0: 1255088, 1: 1255088}), Nth: 2, End: anyEvent, Span: 1},
	{Name: "actions/mount-up", Handler: "actions", Port: 55153, Keep: joinAndSpawnsOf(1255088), Start: eventWithIDs(eventcodes.CastSpell, map[byte]int{0: 1255088, 1: 1255088}), Nth: 3, End: anyEvent, Span: 1},
	{Name: "actions/dismount", Handler: "actions", Port: 55153, Keep: joinAndSpawnsOf(1254486), Start: eventWithIDs(eventcodes.CastSpell, map[byte]int{0: 1254486, 1: 1254486}), Nth: 1, End: anyEvent, Span: 1},
	{Name: "actions/forced-movement", Handler: "actions", Port: 55153, Keep: joinAndSpawnsOf(1255446), Start: eventWithIDs(eventcodes.ForcedMovement, map[byte]int{0: 1255446}), Nth: 1, End: anyEvent, Span: 1},
	{Name: "actions/leave", Handler: "actions", Port: 55153, Keep: joinAndSpawnsOf(1254726), Start: eventWithIDs(eventcodes.CastSpell, map[byte]int{0: 1254726, 1: 1254726}), Nth: 1, End: eventWithIDs(eventcodes.Leave, map[byte]int{0: 1254726}), Span: 1},
	{Name: "actions/local-self-cast", Handler: "actions", Port: 54920, Keep: joinAndSpawnsOf(), Start: eventWithIDs(eventcodes.CastSpell, map[byte]int{0: 41475, 1: 41475}), Nth: 5, End: anyEvent, Span: 1},
	{Name: "actions/cast-on-mob", Handler: "actions", Port: 54920, Keep: joinAndSpawnsOf(41362), Start: eventWithIDs(eventcodes.CastSpell, map[byte]int{0: 41362, 1: 12790}), Nth: 1, End: anyEvent, Span: 1},
	{Name: "actions/mob-cast-on-local", Handler: "actions", Port: 54920, Keep: joinAndSpawnsOf(), Start: eventWithIDs(eventcodes.CastStart, map[byte]int{0: 5306, 7: 41475}), Nth: 1, End: anyEvent, Span: 1},
	{Name: "actions/mob-attack-on-local", Handler: "actions", Port: 65257, Keep: joinAndSpawnsOf(), Start: eventWithIDs(eventcodes.Attack, map[byte]int{0: 1987, 2: 2598}), Nth: 1, End: anyEvent, Span: 1},
	{Name: "actions/teleport", Handler: "actions", Port: 52173, Keep: joinAndSpawnsOf(1448788), Start: eventWithIDs(eventcodes.Teleport, map[byte]int{0: 1448788}), Nth: 1, End: anyEvent, Span: 1},
	{Name: "actions/cast-spells", Handler: "actions", Port: 52173, Keep: joinAndSpawnsOf(1453850, 1448788, 1441391), Start: eventWithIDs(eventcodes.CastSpells, map[byte]int{0: 1453850}), Nth: 1, End: anyEvent, Span: 1},
	{Name: "actions/cast-between-players", Handler: "actions", Port: 52173, Keep: joinAndSpawnsOf(1453850, 1298481), Start: eventWithIDs(eventcodes.CastSpell, map[byte]int{0: 1453850, 1: 1298481}), Nth: 5, End: eventWithIDs(eventcodes.HealthUpdate, map[byte]int{0: 1298481, 6: 1453850}), Span: 2},
	{Name: "actions/respawn", Handler: "actions", Port: 64945, Keep: joinAndSpawnsOf(1655584), Start: eventWithIDs(eventcodes.Respawn, map[byte]int{0: 1655584}), Nth: 1, End: anyEvent, Span: 1},
	{Name: "actions/cast-start-target", Handler: "actions", Port: 64945, Keep: joinAndSpawnsOf(1659694, 1640953), Start: eventWithIDs(eventcodes.CastStart, map[byte]int{0: 1659694, 7: 1640953}), Nth: 7, End: anyEvent, Span: 1},
	{Name: "actions/attack-between-players", Handler: "actions", Port: 64945, Keep: joinAndSpawnsOf(1656011, 1655584), Start: eventWithIDs(eventcodes.Attack, map[byte]int{0: 1656011, 2: 1655584}), Nth: 1, End: eventWithIDs(eventcodes.HealthUpdate, map[byte]int{0: 1655584, 6: 1656011}), Span: 1},
	{Name: "actions/health-update", Handler: "actions", Port: 64945, Keep: joinAndSpawnsOf(1655584, 1656011), Start: eventWithIDs(eventcodes.HealthUpdate, map[byte]int{0: 1655584, 6: 1656011}), Nth: 1, End: anyEvent, Span: 1},
	{Name: "actions/heal", Handler: "actions", Port: 64945, Keep: joinAndSpawnsOf(1655584, 1656044, 1656011), Start: eventWithIDs(eventcodes.CastSpell, map[byte]int{0: 1655584, 1: 1656044}), Nth: 1, End: eventWithIDs(eventcodes.HealthUpdate, map[byte]int{0: 1656044, 6: 1655584}), Span: 1},
	{Name: "actions/health-updates", Handler: "actions", Port: 64945, Keep: joinAndSpawnsOf(1655584, 1656011), Start: eventWithIDs(eventcodes.HealthUpdates, map[byte]int{0: 1655584}), Nth: 2, End: anyEvent, Span: 1},
	{Name: "actions/ground-cast", Handler: "actions", Port: 64945, Keep: joinAndSpawnsOf(1656011), Start: eventWithIDs(eventcodes.CastSpell, map[byte]int{0: 1656011}), Nth: 4, End: anyEvent, Span: 1},
	{Name: "actions/attack-on-local", Handler: "actions", Port: 51645, Keep: joinAndSpawnsOf(2757), Start: eventWithIDs(eventcodes.CastStart, map[byte]int{0: 2757, 7: 2944}), Nth: 1, End: eventWithIDs(eventcodes.HealthUpdate, map[byte]int{0: 2944, 6: 2757}), Span: 1},
}
