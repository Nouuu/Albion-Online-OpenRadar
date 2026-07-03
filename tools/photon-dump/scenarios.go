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
