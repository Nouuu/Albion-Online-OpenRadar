/**
 * MobsInfo_Enriched - Living Resources database with 230 TypeIDs
 * Extracted from existing MobsInfo.js
 * Use this as Priority 1 for living resource detection
 */

class MobsInfo_Enriched {
    constructor() {
        this.moblist = {};
        this.initEnrichedMobs();
    }

    initEnrichedMobs() {
        // ========================================
        // FIBER (LivingHarvestable) - 36 TypeIDs
        // ========================================
        // Fiber T3-T8
        this.addItem(472, 3, 0, "Fiber");
        this.addItem(586, 3, 0, "Fiber");
        this.addItem(610, 3, 0, "Fiber");
        this.addItem(634, 3, 0, "Fiber");

        // ⚠️ TypeID 530/531 = FIBER (confirmé terrain, jeu envoie typeNumber=16 par erreur)
        this.addItem(530, 4, 0, "Fiber"); // 🔧 OVERRIDE: Was Rock T6 in original, actually Fiber T4
        this.addItem(531, 5, 0, "Fiber"); // 🔧 OVERRIDE: Was Rock T7 in original, actually Fiber T5

        this.addItem(553, 4, 0, "Fiber");
        this.addItem(558, 4, 0, "Fiber");
        this.addItem(563, 4, 0, "Fiber");
        this.addItem(587, 4, 0, "Fiber");
        this.addItem(611, 4, 0, "Fiber");
        this.addItem(635, 4, 0, "Fiber");
        this.addItem(473, 5, 0, "Fiber");
        this.addItem(554, 5, 0, "Fiber");
        this.addItem(559, 5, 0, "Fiber");
        this.addItem(564, 5, 0, "Fiber");
        this.addItem(588, 5, 0, "Fiber");
        this.addItem(612, 5, 0, "Fiber");
        this.addItem(636, 5, 0, "Fiber");
        this.addItem(555, 6, 0, "Fiber");
        this.addItem(560, 6, 0, "Fiber");
        this.addItem(565, 6, 0, "Fiber");
        this.addItem(589, 6, 0, "Fiber");
        this.addItem(613, 6, 0, "Fiber");
        this.addItem(637, 6, 0, "Fiber");
        this.addItem(474, 7, 0, "Fiber");
        this.addItem(556, 7, 0, "Fiber");
        this.addItem(561, 7, 0, "Fiber");
        this.addItem(566, 7, 0, "Fiber");
        this.addItem(590, 7, 0, "Fiber");
        this.addItem(614, 7, 0, "Fiber");
        this.addItem(638, 7, 0, "Fiber");
        this.addItem(557, 8, 0, "Fiber");
        this.addItem(562, 8, 0, "Fiber");
        this.addItem(567, 8, 0, "Fiber");
        this.addItem(591, 8, 0, "Fiber");
        this.addItem(615, 8, 0, "Fiber");
        this.addItem(639, 8, 0, "Fiber");

        // ========================================
        // HIDE (LivingSkinnable) - 81 TypeIDs
        // ========================================
        // Steppe biome
        this.addItem(386, 1, 1, "Hide");
        this.addItem(387, 2, 1, "Hide");
        this.addItem(388, 3, 1, "Hide");
        this.addItem(389, 4, 1, "Hide");
        this.addItem(390, 5, 1, "Hide");
        this.addItem(391, 6, 1, "Hide");
        this.addItem(392, 7, 1, "Hide");
        this.addItem(393, 7, 1, "Hide");
        this.addItem(394, 8, 1, "Hide");
        this.addItem(395, 8, 1, "Hide");

        // Steppe treasure
        this.addItem(396, 4, 1, "Hide");
        this.addItem(397, 5, 1, "Hide");
        this.addItem(398, 6, 1, "Hide");
        this.addItem(399, 7, 1, "Hide");
        this.addItem(400, 8, 1, "Hide");

        // Cougar variants
        this.addItem(475, 3, 1, "Hide");
        this.addItem(476, 5, 1, "Hide");
        this.addItem(477, 7, 1, "Hide");

        // Forest biome
        this.addItem(358, 1, 1, "Hide");
        this.addItem(359, 2, 1, "Hide");
        this.addItem(360, 2, 1, "Hide");
        this.addItem(361, 3, 1, "Hide");
        this.addItem(362, 4, 1, "Hide");
        this.addItem(363, 5, 1, "Hide");

        // ⚠️ TypeID manquants critiques (confirmés terrain) - AJOUT MANUEL
        this.addItem(421, 1, 1, "Hide"); // Hide T1 (Rabbit)
        this.addItem(423, 3, 1, "Hide"); // Hide T3 (Fox)
        this.addItem(425, 4, 1, "Hide"); // Hide T4 (Boar)
        this.addItem(427, 5, 1, "Hide"); // Hide T5 (Wolf)

        this.addItem(364, 6, 1, "Hide");
        this.addItem(365, 6, 1, "Hide");
        this.addItem(366, 7, 1, "Hide");
        this.addItem(367, 7, 1, "Hide");
        this.addItem(368, 8, 1, "Hide");
        this.addItem(369, 8, 1, "Hide");

        // ⚠️ TypeID manquants dans extraction - ajoutés manuellement
        this.addItem(425, 4, 1, "Hide"); // Hide T4 (confirmé terrain)
        this.addItem(427, 5, 1, "Hide"); // Hide T5 (confirmé terrain)

        // Forest treasure
        this.addItem(370, 4, 1, "Hide");
        this.addItem(371, 5, 1, "Hide");
        this.addItem(372, 6, 1, "Hide");
        this.addItem(373, 7, 1, "Hide");
        this.addItem(374, 8, 1, "Hide");

        // Swamp biome
        this.addItem(375, 1, 1, "Hide");
        this.addItem(376, 2, 1, "Hide");
        this.addItem(377, 3, 1, "Hide");
        this.addItem(378, 4, 1, "Hide");
        this.addItem(379, 5, 1, "Hide");
        this.addItem(380, 6, 1, "Hide");
        this.addItem(381, 7, 1, "Hide");
        this.addItem(382, 8, 1, "Hide");

        // Swamp treasure
        this.addItem(383, 4, 1, "Hide");
        this.addItem(384, 5, 1, "Hide");
        this.addItem(385, 6, 1, "Hide");

        // Mists
        this.addItem(330, 1, 1, "Hide");
        this.addItem(331, 2, 1, "Hide");
        this.addItem(332, 3, 1, "Hide");
        this.addItem(333, 4, 1, "Hide");
        this.addItem(334, 5, 1, "Hide");
        this.addItem(335, 6, 1, "Hide");
        this.addItem(336, 7, 1, "Hide");
        this.addItem(337, 8, 1, "Hide");

        // Mists treasure
        this.addItem(338, 4, 1, "Hide");
        this.addItem(339, 5, 1, "Hide");
        this.addItem(340, 6, 1, "Hide");
        this.addItem(341, 7, 1, "Hide");
        this.addItem(342, 8, 1, "Hide");

        // Cougars (Normal/Veteran/Elite)
        for (let i = 493; i <= 507; i++) {
            const tier = 4 + ((i - 493) % 5);
            this.addItem(i, tier, 1, "Hide");
        }

        // ========================================
        // WOOD (LivingHarvestable) - 38 TypeIDs
        // ========================================
        // Forest
        this.addItem(483, 3, 0, "Wood");
        this.addItem(484, 3, 0, "Wood");
        this.addItem(485, 5, 0, "Wood");
        this.addItem(486, 5, 0, "Wood");
        this.addItem(487, 7, 0, "Wood");

        // Roads (Normal/Veteran/Elite)
        for (let base = 508; base <= 522; base += 5) {
            for (let i = 0; i < 5; i++) {
                this.addItem(base + i, 4 + i, 0, "Wood");
            }
        }

        // Mists Green/Red/Dead
        const mistWoodBases = [568, 592, 616];
        mistWoodBases.forEach(base => {
            for (let i = 0; i < 6; i++) {
                this.addItem(base + i, 3 + i, 0, "Wood");
            }
        });

        // ========================================
        // ROCK (LivingHarvestable) - 37 TypeIDs
        // ========================================
        // Highland
        this.addItem(488, 3, 0, "Rock");
        this.addItem(489, 3, 0, "Rock");
        this.addItem(490, 5, 0, "Rock");
        this.addItem(491, 5, 0, "Rock");
        this.addItem(492, 7, 0, "Rock");

        // Roads (Normal/Veteran/Elite) - some gaps
        this.addItem(523, 4, 0, "Rock");
        this.addItem(524, 5, 0, "Rock");
        this.addItem(525, 6, 0, "Rock");
        this.addItem(526, 7, 0, "Rock");
        this.addItem(528, 4, 0, "Rock");
        // TypeID 530/531 removed - they are actually Fiber T4/T5 (see Fiber section)
        this.addItem(532, 8, 0, "Rock");
        this.addItem(533, 4, 0, "Rock");
        this.addItem(534, 5, 0, "Rock");
        this.addItem(535, 6, 0, "Rock");
        this.addItem(536, 7, 0, "Rock");
        this.addItem(537, 8, 0, "Rock");

        // Mists Green/Red/Dead
        const mistRockBases = [574, 598, 622];
        mistRockBases.forEach(base => {
            for (let i = 0; i < 6; i++) {
                this.addItem(base + i, 3 + i, 0, "Rock");
            }
        });

        // ========================================
        // ORE (LivingHarvestable) - 38 TypeIDs
        // ========================================
        // Mountain
        this.addItem(478, 3, 0, "Ore");
        this.addItem(479, 3, 0, "Ore");
        this.addItem(480, 5, 0, "Ore");
        this.addItem(481, 5, 0, "Ore");
        this.addItem(482, 7, 0, "Ore");

        // Roads (Normal/Veteran/Elite)
        for (let base = 538; base <= 552; base += 5) {
            for (let i = 0; i < 5; i++) {
                this.addItem(base + i, 4 + i, 0, "Ore");
            }
        }

        // Mists Green/Red/Dead
        const mistOreBases = [580, 604, 628];
        mistOreBases.forEach(base => {
            for (let i = 0; i < 6; i++) {
                this.addItem(base + i, 3 + i, 0, "Ore");
            }
        });

        console.log(`[MobsInfo_Enriched] ✅ Loaded ${Object.keys(this.moblist).length} living resource TypeIDs`);
    }

    addItem(id, tier, type, name) {
        if (!this.moblist[id]) {
            this.moblist[id] = [];
        }
        this.moblist[id][0] = tier;
        this.moblist[id][1] = type; // 0 = LivingHarvestable, 1 = LivingSkinnable
        this.moblist[id][2] = name;
    }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobsInfo_Enriched;
}

