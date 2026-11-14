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

	{Name: "harvestables/ore-dynamic-single", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: eventcodes.NewHarvestableObject, Where: map[byte]func(any) bool{5: intEq(28)}}},
	{Name: "harvestables/ore-dynamic-batch", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: eventcodes.NewSimpleHarvestableObjectList, Where: map[byte]func(any) bool{1: arrayContains(28)}}, Limit: 3},
	{Name: "harvestables/mob-critter", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: eventcodes.NewHarvestableObject, Where: map[byte]func(any) bool{5: intIn(23, 48), 6: intNe(-1)}}, Limit: 7},
	{Name: "harvestables/mob-critter-48", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: eventcodes.NewHarvestableObject, Where: map[byte]func(any) bool{5: intEq(48), 6: intNe(-1)}}},
	{Name: "harvestables/mob-leave", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: eventcodes.NewHarvestableObject, Where: map[byte]func(any) bool{6: intNe(-1)}}, FollowUps: []MatchCriteria{{Kind: "event", Code: eventcodes.Leave}}, CorrelateBy: 0, Limit: 5},
	{Name: "harvestables/batch-resend", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: eventcodes.NewSimpleHarvestableObjectList}, Limit: 23},
	{Name: "harvestables/count-variants", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: eventcodes.NewSimpleHarvestableObjectList, Where: map[byte]func(any) bool{1: arrayContains(2), 2: arrayContains(1)}}, Limit: 2},
	{Name: "harvestables/positions", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: eventcodes.NewHarvestableObject, Where: map[byte]func(any) bool{5: intIn(5, 20, 22)}}, Limit: 13},
	{Name: "harvestables/positions-29", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: eventcodes.NewHarvestableObject, Where: map[byte]func(any) bool{5: intEq(29)}}},
	{Name: "harvestables/empty-regrow", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: eventcodes.NewHarvestableObject, Where: map[byte]func(any) bool{6: intEq(-1), 10: intEq(0)}}, FollowUps: []MatchCriteria{{Kind: "event", Code: eventcodes.HarvestableChangeState, Where: map[byte]func(any) bool{1: intGt(0)}}}, CorrelateBy: 0, Limit: 4},

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
