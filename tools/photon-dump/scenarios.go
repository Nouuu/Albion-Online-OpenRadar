package main

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

const (
	evtNewCharacter         = 29
	evtCharacterEquipment   = 90
	evtMounted              = 211
	evtChangeFlaggingFinish = 363
	evtNewSimpleHarvestList = 39
	evtNewHarvestable       = 40
	evtHarvestUpdate        = 46
	evtHarvestFinished      = 61
	evtNewMob               = 123
	evtMobChangeState       = 47
	evtNewRandomDungeonExit = 323
	evtFishingFinished      = 356
	evtNewFishingZone       = 359
	evtNewLootChest         = 391
	evtNewCagedObject       = 530
	evtCagedObjectUpdate    = 531

	opMoveRequest   = 22
	opJoinFinished  = 2
	opChangeCluster = 41
)

var scenarios = []Scenario{
	{Name: "players/spawn", Handler: "players", Match: MatchCriteria{Kind: "event", Code: evtNewCharacter}, Limit: 8},
	{Name: "players/equipment", Handler: "players", Match: MatchCriteria{Kind: "event", Code: evtCharacterEquipment}, Limit: 5},
	{Name: "players/faction-change", Handler: "players", Match: MatchCriteria{Kind: "event", Code: evtChangeFlaggingFinish}, Limit: 3},
	{Name: "players/mounted", Handler: "players", Match: MatchCriteria{Kind: "event", Code: evtMounted}, Limit: 3},

	{Name: "harvestables/batch-spawn", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: evtNewSimpleHarvestList}, Limit: 3},
	{Name: "harvestables/single-spawn", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: evtNewHarvestable}, Limit: 25},
	{Name: "harvestables/state-update", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: evtHarvestUpdate}, Limit: 10},
	{Name: "harvestables/finished", Handler: "harvestables", Match: MatchCriteria{Kind: "event", Code: evtHarvestFinished}, Limit: 5},

	{Name: "mobs/spawn", Handler: "mobs", Match: MatchCriteria{Kind: "event", Code: evtNewMob}, Limit: 20},
	{Name: "mobs/change-state", Handler: "mobs", Match: MatchCriteria{Kind: "event", Code: evtMobChangeState}, Limit: 5},

	{Name: "chests/spawn", Handler: "chests", Match: MatchCriteria{Kind: "event", Code: evtNewLootChest}, Limit: 8},
	{Name: "fishing/spawn", Handler: "fishing", Match: MatchCriteria{Kind: "event", Code: evtNewFishingZone}, Limit: 5},
	{Name: "fishing/finished", Handler: "fishing", Match: MatchCriteria{Kind: "event", Code: evtFishingFinished}, Limit: 2},
	{Name: "dungeons/spawn", Handler: "dungeons", Match: MatchCriteria{Kind: "event", Code: evtNewRandomDungeonExit}, Limit: 10},
	{Name: "wispcage/spawn", Handler: "wispcage", Match: MatchCriteria{Kind: "event", Code: evtNewCagedObject}, Limit: 3},
	{Name: "wispcage/opened", Handler: "wispcage", Match: MatchCriteria{Kind: "event", Code: evtCagedObjectUpdate}, Limit: 2},

	{Name: "router/join-finished", Handler: "router", Match: MatchCriteria{Kind: "response", Code: opJoinFinished}, Limit: 2},
	{Name: "router/change-cluster", Handler: "router", Match: MatchCriteria{Kind: "response", Code: opChangeCluster}, Limit: 4},
	{Name: "router/move-request", Handler: "router", Match: MatchCriteria{Kind: "request", Code: opMoveRequest}, Limit: 5},
}
