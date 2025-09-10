class MobsInfo{


    constructor()
    {
        this.moblist = {};
    }

    addItem(id, tier, type, loc)
    {
        if (!this.moblist[id])
        {
            this.moblist[id] = [];
        }
    
        this.moblist[id][0] = tier;
        this.moblist[id][1] = type;
        this.moblist[id][2] = loc;
    }

    initMobs()
    {
        //#region Hide        
        // Steppe biome
        this.addItem(386, 1, EnemyType.LivingSkinnable, "hide"); // Marmot
        this.addItem(387, 2, EnemyType.LivingSkinnable, "hide"); // Impala
        this.addItem(388, 3, EnemyType.LivingSkinnable, "hide"); // Moabird
        this.addItem(389, 4, EnemyType.LivingSkinnable, "hide"); // Giant stag
        this.addItem(390, 5, EnemyType.LivingSkinnable, "hide"); // Terrorbird
        this.addItem(391, 6, EnemyType.LivingSkinnable, "hide"); // Hyena
        this.addItem(392, 7, EnemyType.LivingSkinnable, "hide"); // Rhino
        this.addItem(393, 7, EnemyType.LivingSkinnable, "hide"); // Bighorn Rhino
        this.addItem(394, 8, EnemyType.LivingSkinnable, "hide"); // Mammoth
        this.addItem(395, 8, EnemyType.LivingSkinnable, "hide"); // Ancient Mammoth

        // Steppe biome treasure
        this.addItem(396, 4, EnemyType.LivingSkinnable, "hide"); // T4_MOB_TREASURE_HIDE_STEPPE_GIANTSTAG
        this.addItem(397, 5, EnemyType.LivingSkinnable, "hide"); // T5_MOB_TREASURE_TERRORBIRD
        this.addItem(398, 6, EnemyType.LivingSkinnable, "hide"); // T6_MOB_TREASURE_DESERTWOLF
        this.addItem(399, 7, EnemyType.LivingSkinnable, "hide"); // T7_MOB_TREASURE_RHINO
        this.addItem(400, 8, EnemyType.LivingSkinnable, "hide"); // T8_MOB_TREASURE_ANCIENTMAMMOTH

        this.addItem(475, 3, EnemyType.LivingSkinnable, "hide"); // Cougar
        this.addItem(476, 5, EnemyType.LivingSkinnable, "hide"); // Cougar
        this.addItem(477, 7, EnemyType.LivingSkinnable, "hide"); // Cougar

        /*// Highland
        this.addItem(372, 1, EnemyType.LivingSkinnable, "hide"); // Rabbit
        this.addItem(373, 1, EnemyType.LivingSkinnable, "hide"); // Marmot*/

        // Forest biome 
        this.addItem(358, 1, EnemyType.LivingSkinnable, "hide"); // Rabbit
        this.addItem(359, 2, EnemyType.LivingSkinnable, "hide"); // Fox
        this.addItem(360, 2, EnemyType.LivingSkinnable, "hide"); // Fox tutorial
        this.addItem(361, 3, EnemyType.LivingSkinnable, "hide"); // Wolf
        this.addItem(362, 4, EnemyType.LivingSkinnable, "hide"); // Boar
        this.addItem(363, 5, EnemyType.LivingSkinnable, "hide"); // Bear
        this.addItem(364, 6, EnemyType.LivingSkinnable, "hide"); // Direwolf
        this.addItem(365, 6, EnemyType.LivingSkinnable, "hide"); // Giant Stag
        this.addItem(366, 7, EnemyType.LivingSkinnable, "hide"); // Direboar small
        this.addItem(367, 7, EnemyType.LivingSkinnable, "hide"); // Direboar
        this.addItem(368, 8, EnemyType.LivingSkinnable, "hide"); // Direbear small
        this.addItem(369, 8, EnemyType.LivingSkinnable, "hide"); // Direbear

        // Forest biome treasure
        this.addItem(370, 4, EnemyType.LivingSkinnable, "hide"); // T4_MOB_TREASURE_BOAR
        this.addItem(371, 5, EnemyType.LivingSkinnable, "hide"); // T5_MOB_TREASURE_BEAR
        this.addItem(372, 6, EnemyType.LivingSkinnable, "hide"); // T6_MOB_TREASURE_DIREWOLF
        this.addItem(373, 7, EnemyType.LivingSkinnable, "hide"); // T7_MOB_TREASURE_DIREBOAR
        this.addItem(374, 8, EnemyType.LivingSkinnable, "hide"); // T8_MOB_TREASURE_DIREBEAR

        // Swamp biome
        this.addItem(375, 1, EnemyType.LivingSkinnable, "hide"); // Toad
        this.addItem(376, 2, EnemyType.LivingSkinnable, "hide"); // Snake
        this.addItem(377, 3, EnemyType.LivingSkinnable, "hide"); // Giant toad
        this.addItem(378, 4, EnemyType.LivingSkinnable, "hide"); // Monitor lizard
        this.addItem(379, 5, EnemyType.LivingSkinnable, "hide"); // Giant snake
        this.addItem(380, 6, EnemyType.LivingSkinnable, "hide"); // Dragon
        this.addItem(381, 7, EnemyType.LivingSkinnable, "hide"); // Marabou
        this.addItem(382, 8, EnemyType.LivingSkinnable, "hide"); // Alligator

        // Swamp biome treasure
        this.addItem(383, 4, EnemyType.LivingSkinnable, "hide"); // T4_MOB_TREASURE_HIDE_SWAMP_MONITORLIZARD
        this.addItem(384, 5, EnemyType.LivingSkinnable, "hide"); // T5_MOB_TREASURE_GIANTSNAKE
        this.addItem(385, 6, EnemyType.LivingSkinnable, "hide"); // T6_MOB_TREASURE_DRAGON

        // Roads // TODO
        /*this.addItem(322, 1, EnemyType.LivingSkinnable, "hide"); // SALAMANDER
        this.addItem(323, 3, EnemyType.LivingSkinnable, "hide"); // STAG
        this.addItem(324, 4, EnemyType.LivingSkinnable, "hide"); // DIREWOLF
        this.addItem(325, 5, EnemyType.LivingSkinnable, "hide"); // BISON
        this.addItem(326, 6, EnemyType.LivingSkinnable, "hide"); // OWL
        this.addItem(327, 7, EnemyType.LivingSkinnable, "hide"); // DIREBEAR
        this.addItem(328, 8, EnemyType.LivingSkinnable, "hide"); // BASILISK*/

        // Mists
        this.addItem(330, 1, EnemyType.LivingSkinnable, "hide"); // WOLPERTINGER
        this.addItem(331, 2, EnemyType.LivingSkinnable, "hide"); // FOX
        this.addItem(332, 3, EnemyType.LivingSkinnable, "hide"); // DEER
        this.addItem(333, 4, EnemyType.LivingSkinnable, "hide"); // GIANTSTAG
        this.addItem(334, 5, EnemyType.LivingSkinnable, "hide"); // OWL
        this.addItem(335, 6, EnemyType.LivingSkinnable, "hide"); // HOUND
        this.addItem(336, 7, EnemyType.LivingSkinnable, "hide"); // DIREBEAR
        this.addItem(337, 8, EnemyType.LivingSkinnable, "hide"); // DRAGONHAWK

        // Treasure Mists
        this.addItem(338, 4, EnemyType.LivingSkinnable, "hide"); // T4_MOB_TREASURE_MISTS_GIANTSTAG
        this.addItem(339, 5, EnemyType.LivingSkinnable, "hide"); // T5_MOB_TREASURE_MISTS_OWL   
        this.addItem(340, 6, EnemyType.LivingSkinnable, "hide"); // T6_MOB_TREASURE_MISTS_HOUND
        this.addItem(341, 7, EnemyType.LivingSkinnable, "hide"); // T7_MOB_TREASURE_MISTS_DIREBEAR
        this.addItem(342, 8, EnemyType.LivingSkinnable, "hide"); // T8_MOB_TREASURE_MISTS_DRAGONHAWK

        // Cougars
        this.addItem(493, 4, EnemyType.LivingSkinnable, "hide");
        this.addItem(494, 5, EnemyType.LivingSkinnable, "hide");
        this.addItem(495, 6, EnemyType.LivingSkinnable, "hide");
        this.addItem(496, 7, EnemyType.LivingSkinnable, "hide");
        this.addItem(497, 8, EnemyType.LivingSkinnable, "hide");
        // Veteran
        this.addItem(498, 4, EnemyType.LivingSkinnable, "hide");
        this.addItem(499, 5, EnemyType.LivingSkinnable, "hide");
        this.addItem(500, 6, EnemyType.LivingSkinnable, "hide");
        this.addItem(501, 7, EnemyType.LivingSkinnable, "hide");
        this.addItem(502, 8, EnemyType.LivingSkinnable, "hide");
        // Elite
        this.addItem(503, 4, EnemyType.LivingSkinnable, "hide");
        this.addItem(504, 5, EnemyType.LivingSkinnable, "hide");
        this.addItem(505, 6, EnemyType.LivingSkinnable, "hide");
        this.addItem(506, 7, EnemyType.LivingSkinnable, "hide");
        this.addItem(507, 8, EnemyType.LivingSkinnable, "hide");

        //#endregion

        //#region Logs
        // Forest +25
        this.addItem(483, 3, EnemyType.LivingHarvestable, "Logs");
        this.addItem(484, 3, EnemyType.LivingHarvestable, "Logs");
        this.addItem(485, 5, EnemyType.LivingHarvestable, "Logs");
        this.addItem(486, 5, EnemyType.LivingHarvestable, "Logs");
        this.addItem(487, 7, EnemyType.LivingHarvestable, "Logs");

        // Roads <=> Tx_MOB_CRITTER_WOOD_ROADS
        this.addItem(508, 4, EnemyType.LivingHarvestable, "Logs");
        this.addItem(509, 5, EnemyType.LivingHarvestable, "Logs");
        this.addItem(510, 6, EnemyType.LivingHarvestable, "Logs");
        this.addItem(511, 7, EnemyType.LivingHarvestable, "Logs");
        this.addItem(512, 8, EnemyType.LivingHarvestable, "Logs");
        // Roads Veteran <=> Tx_MOB_CRITTER_WOOD_ROADS_VETERAN
        this.addItem(513, 4, EnemyType.LivingHarvestable, "Logs");
        this.addItem(514, 5, EnemyType.LivingHarvestable, "Logs");
        this.addItem(515, 6, EnemyType.LivingHarvestable, "Logs");
        this.addItem(516, 7, EnemyType.LivingHarvestable, "Logs");
        this.addItem(517, 8, EnemyType.LivingHarvestable, "Logs");
        // Roads Elite <=> Tx_MOB_CRITTER_WOOD_ROADS_ELITE
        this.addItem(518, 4, EnemyType.LivingHarvestable, "Logs");
        this.addItem(519, 5, EnemyType.LivingHarvestable, "Logs");
        this.addItem(520, 6, EnemyType.LivingHarvestable, "Logs");
        this.addItem(521, 7, EnemyType.LivingHarvestable, "Logs");
        this.addItem(522, 8, EnemyType.LivingHarvestable, "Logs");

        // Mists Green <=> Tx_MOB_CRITTER_WOOD_MISTS_GREEN +25
        this.addItem(568, 3, EnemyType.LivingHarvestable, "Logs");
        this.addItem(569, 4, EnemyType.LivingHarvestable, "Logs");
        this.addItem(570, 5, EnemyType.LivingHarvestable, "Logs");
        this.addItem(571, 6, EnemyType.LivingHarvestable, "Logs");
        this.addItem(572, 7, EnemyType.LivingHarvestable, "Logs");
        this.addItem(573, 8, EnemyType.LivingHarvestable, "Logs");
        // Mists Red <=> Tx_MOB_CRITTER_WOOD_MISTS_RED +25
        this.addItem(592, 3, EnemyType.LivingHarvestable, "Logs");
        this.addItem(593, 4, EnemyType.LivingHarvestable, "Logs");
        this.addItem(594, 5, EnemyType.LivingHarvestable, "Logs");
        this.addItem(595, 6, EnemyType.LivingHarvestable, "Logs");
        this.addItem(596, 7, EnemyType.LivingHarvestable, "Logs");
        this.addItem(597, 8, EnemyType.LivingHarvestable, "Logs");
        // Mists Dead <=> Tx_MOB_CRITTER_WOOD_MISTS_DEAD +25
        this.addItem(616, 3, EnemyType.LivingHarvestable, "Logs");
        this.addItem(617, 4, EnemyType.LivingHarvestable, "Logs");
        this.addItem(618, 5, EnemyType.LivingHarvestable, "Logs");
        this.addItem(619, 6, EnemyType.LivingHarvestable, "Logs");
        this.addItem(620, 7, EnemyType.LivingHarvestable, "Logs");
        this.addItem(621, 8, EnemyType.LivingHarvestable, "Logs");
        //#endregion

        //#region Rock
        // Highland +25
        this.addItem(488, 3, EnemyType.LivingHarvestable, "rock");
        this.addItem(489, 3, EnemyType.LivingHarvestable, "rock");
        this.addItem(490, 5, EnemyType.LivingHarvestable, "rock");
        this.addItem(491, 5, EnemyType.LivingHarvestable, "rock");
        this.addItem(492, 7, EnemyType.LivingHarvestable, "rock");

        // Roads <=> Tx_MOB_CRITTER_ROCK_ROADS +25
        this.addItem(523, 4, EnemyType.LivingHarvestable, "rock");
        this.addItem(524, 5, EnemyType.LivingHarvestable, "rock");
        this.addItem(525, 6, EnemyType.LivingHarvestable, "rock");
        this.addItem(526, 7, EnemyType.LivingHarvestable, "rock");
        this.addItem(527, 8, EnemyType.LivingHarvestable, "rock");
        // Veteran Roads <=> Tx_MOB_CRITTER_ROCK_ROADS_VETERAN +25
        this.addItem(528, 4, EnemyType.LivingHarvestable, "rock");
        this.addItem(529, 5, EnemyType.LivingHarvestable, "rock");
        this.addItem(530, 6, EnemyType.LivingHarvestable, "rock");
        this.addItem(533, 7, EnemyType.LivingHarvestable, "rock");
        this.addItem(532, 8, EnemyType.LivingHarvestable, "rock");
        // Elite Roads <=> Tx_MOB_CRITTER_ROCK_ROADS_ELITE +25
        this.addItem(533, 4, EnemyType.LivingHarvestable, "rock");
        this.addItem(534, 5, EnemyType.LivingHarvestable, "rock");
        this.addItem(535, 6, EnemyType.LivingHarvestable, "rock");
        this.addItem(536, 7, EnemyType.LivingHarvestable, "rock");
        this.addItem(537, 8, EnemyType.LivingHarvestable, "rock");

        // Mists Green <=> Tx_MOB_CRITTER_ROCK_MISTS_GREEN +25
        this.addItem(574, 3, EnemyType.LivingHarvestable, "rock");
        this.addItem(575, 4, EnemyType.LivingHarvestable, "rock");
        this.addItem(576, 5, EnemyType.LivingHarvestable, "rock");
        this.addItem(577, 6, EnemyType.LivingHarvestable, "rock");
        this.addItem(578, 7, EnemyType.LivingHarvestable, "rock");
        this.addItem(579, 8, EnemyType.LivingHarvestable, "rock");
        // Mists Red <=> Tx_MOB_CRITTER_ROCK_MISTS_RED +25
        this.addItem(598, 3, EnemyType.LivingHarvestable, "rock");
        this.addItem(599, 4, EnemyType.LivingHarvestable, "rock");
        this.addItem(600, 5, EnemyType.LivingHarvestable, "rock");
        this.addItem(601, 6, EnemyType.LivingHarvestable, "rock");
        this.addItem(602, 7, EnemyType.LivingHarvestable, "rock");
        this.addItem(603, 8, EnemyType.LivingHarvestable, "rock");
        // Mists Dead <=> Tx_MOB_CRITTER_ROCK_MISTS_DEAD +25
        this.addItem(622, 3, EnemyType.LivingHarvestable, "rock");
        this.addItem(623, 4, EnemyType.LivingHarvestable, "rock");
        this.addItem(624, 5, EnemyType.LivingHarvestable, "rock");
        this.addItem(625, 6, EnemyType.LivingHarvestable, "rock");
        this.addItem(626, 7, EnemyType.LivingHarvestable, "rock");
        this.addItem(627, 8, EnemyType.LivingHarvestable, "rock");
        //#endregion

        //#region Ore
        // Mountain +25
        this.addItem(478, 3, EnemyType.LivingHarvestable, "ore");
        this.addItem(479, 3, EnemyType.LivingHarvestable, "ore");
        this.addItem(480, 5, EnemyType.LivingHarvestable, "ore");
        this.addItem(481, 5, EnemyType.LivingHarvestable, "ore");
        this.addItem(482, 7, EnemyType.LivingHarvestable, "ore");

        // Roads <=> Tx_MOB_CRITTER_ORE_ROADS +25
        this.addItem(538, 4, EnemyType.LivingHarvestable, "ore");
        this.addItem(539, 5, EnemyType.LivingHarvestable, "ore");
        this.addItem(540, 6, EnemyType.LivingHarvestable, "ore");
        this.addItem(541, 7, EnemyType.LivingHarvestable, "ore");
        this.addItem(542, 8, EnemyType.LivingHarvestable, "ore");
        // Veteran Roads <=> Tx_MOB_CRITTER_ORE_ROADS_VETERAN +25
        this.addItem(543, 4, EnemyType.LivingHarvestable, "ore");
        this.addItem(544, 5, EnemyType.LivingHarvestable, "ore");
        this.addItem(545, 6, EnemyType.LivingHarvestable, "ore");
        this.addItem(546, 7, EnemyType.LivingHarvestable, "ore");
        this.addItem(547, 8, EnemyType.LivingHarvestable, "ore");
        // Elite Roads <=> Tx_MOB_CRITTER_ORE_ROADS_ELITE +25
        this.addItem(548, 4, EnemyType.LivingHarvestable, "ore");
        this.addItem(549, 5, EnemyType.LivingHarvestable, "ore");
        this.addItem(550, 6, EnemyType.LivingHarvestable, "ore");
        this.addItem(551, 7, EnemyType.LivingHarvestable, "ore");
        this.addItem(552, 8, EnemyType.LivingHarvestable, "ore");

        // Mists Green <=> Tx_MOB_CRITTER_ORE_MISTS_GREEN +25
        this.addItem(580, 3, EnemyType.LivingHarvestable, "ore");
        this.addItem(581, 4, EnemyType.LivingHarvestable, "ore");
        this.addItem(582, 5, EnemyType.LivingHarvestable, "ore");
        this.addItem(583, 6, EnemyType.LivingHarvestable, "ore");
        this.addItem(584, 7, EnemyType.LivingHarvestable, "ore");
        this.addItem(585, 8, EnemyType.LivingHarvestable, "ore");
        // Mists Red <=> Tx_MOB_CRITTER_ORE_MISTS_RED +25
        this.addItem(604, 3, EnemyType.LivingHarvestable, "ore");
        this.addItem(605, 4, EnemyType.LivingHarvestable, "ore");
        this.addItem(606, 5, EnemyType.LivingHarvestable, "ore");
        this.addItem(607, 6, EnemyType.LivingHarvestable, "ore");
        this.addItem(608, 7, EnemyType.LivingHarvestable, "ore");
        this.addItem(609, 8, EnemyType.LivingHarvestable, "ore");
        // Mists Dead <=> Tx_MOB_CRITTER_ORE_MISTS_DEAD +25
        this.addItem(628, 3, EnemyType.LivingHarvestable, "ore");
        this.addItem(629, 4, EnemyType.LivingHarvestable, "ore");
        this.addItem(630, 5, EnemyType.LivingHarvestable, "ore");
        this.addItem(631, 6, EnemyType.LivingHarvestable, "ore");
        this.addItem(632, 7, EnemyType.LivingHarvestable, "ore");
        this.addItem(633, 8, EnemyType.LivingHarvestable, "ore");
        //#endregion

        //#region Fiber
        // ??? <=> Don't know the location <=> Tx_MOB_CRITTER_FIBER + 25
        this.addItem(472, 3, EnemyType.LivingHarvestable, "fiber");
        this.addItem(473, 5, EnemyType.LivingHarvestable, "fiber");
        this.addItem(474, 7, EnemyType.LivingHarvestable, "fiber");

        // Roads <=> Tx_MOB_CRITTER_FIBER_ROADS +25
        this.addItem(553, 4, EnemyType.LivingHarvestable, "fiber");
        this.addItem(554, 5, EnemyType.LivingHarvestable, "fiber");
        this.addItem(555, 6, EnemyType.LivingHarvestable, "fiber"); // 509 // -17
        this.addItem(556, 7, EnemyType.LivingHarvestable, "fiber"); // 510 // -17
        this.addItem(557, 8, EnemyType.LivingHarvestable, "fiber");
        // Veteran Roads <=> Tx_MOB_CRITTER_FIBER_ROADS_VETERAN +25
        this.addItem(558, 4, EnemyType.LivingHarvestable, "fiber");
        this.addItem(559, 5, EnemyType.LivingHarvestable, "fiber");
        this.addItem(560, 6, EnemyType.LivingHarvestable, "fiber");
        this.addItem(561, 7, EnemyType.LivingHarvestable, "fiber");
        this.addItem(562, 8, EnemyType.LivingHarvestable, "fiber");
        // Elite Roads <=> Tw_MOB_CRITTER_FIBER_ROADS_ELITE +25
        this.addItem(563, 4, EnemyType.LivingHarvestable, "fiber");
        this.addItem(564, 5, EnemyType.LivingHarvestable, "fiber");
        this.addItem(565, 6, EnemyType.LivingHarvestable, "fiber");
        this.addItem(566, 7, EnemyType.LivingHarvestable, "fiber");
        this.addItem(567, 8, EnemyType.LivingHarvestable, "fiber");

        // Mists Green <=> Tx_MOB_CRITTER_FIBER_MISTS_GREEN +25
        this.addItem(586, 3, EnemyType.LivingHarvestable, "fiber");
        this.addItem(587, 4, EnemyType.LivingHarvestable, "fiber");
        this.addItem(588, 5, EnemyType.LivingHarvestable, "fiber");
        this.addItem(589, 6, EnemyType.LivingHarvestable, "fiber");
        this.addItem(590, 7, EnemyType.LivingHarvestable, "fiber");
        this.addItem(591, 8, EnemyType.LivingHarvestable, "fiber");
        // Mists Red <=> Tx_MOB_CRITTER_FIBER_MISTS_RED +25
        this.addItem(610, 3, EnemyType.LivingHarvestable, "fiber");
        this.addItem(611, 4, EnemyType.LivingHarvestable, "fiber");
        this.addItem(612, 5, EnemyType.LivingHarvestable, "fiber");
        this.addItem(613, 6, EnemyType.LivingHarvestable, "fiber");
        this.addItem(614, 7, EnemyType.LivingHarvestable, "fiber");
        this.addItem(615, 8, EnemyType.LivingHarvestable, "fiber");
        // Mists Dead <=> Tx_MOB_CRITTER_FIBER_MISTS_DEAD +25
        this.addItem(634, 3, EnemyType.LivingHarvestable, "fiber");
        this.addItem(635, 4, EnemyType.LivingHarvestable, "fiber");
        this.addItem(636, 5, EnemyType.LivingHarvestable, "fiber");
        this.addItem(637, 6, EnemyType.LivingHarvestable, "fiber");
        this.addItem(638, 7, EnemyType.LivingHarvestable, "fiber");
        this.addItem(639, 8, EnemyType.LivingHarvestable, "fiber");
        //#endregion
        
        //#region Mist bosses
        
        // CRYSTALSPIDER <=> Tx_MOB_ARCANE_CRYSTALSPIDER_BOSS
        this.addItem(314, 5, EnemyType.MistBoss, "CRYSTALSPIDER");
        this.addItem(315, 6, EnemyType.MistBoss, "CRYSTALSPIDER");
        this.addItem(316, 7, EnemyType.MistBoss, "CRYSTALSPIDER");
        this.addItem(317, 8, EnemyType.MistBoss, "CRYSTALSPIDER");
        // CRYSTALSPIDER VETERAN <=> Tx_MOB_ARCANE_CRYSTALSPIDER_VETERAN_BOSS 
        this.addItem(318, 4, EnemyType.MistBoss, "CRYSTALSPIDER");
        this.addItem(319, 5, EnemyType.MistBoss, "CRYSTALSPIDER");
        this.addItem(320, 6, EnemyType.MistBoss, "CRYSTALSPIDER");
        this.addItem(321, 7, EnemyType.MistBoss, "CRYSTALSPIDER");
        this.addItem(322, 8, EnemyType.MistBoss, "CRYSTALSPIDER");
        
        // Spider : VEILWEAVER <=> Tx_MOB_MISTS_SPIDER +25
        this.addItem(343, 4, EnemyType.MistBoss, "VEILWEAVER");
        this.addItem(344, 5, EnemyType.MistBoss, "VEILWEAVER");
        this.addItem(345, 6, EnemyType.MistBoss, "VEILWEAVER");
        this.addItem(346, 7, EnemyType.MistBoss, "VEILWEAVER");
        this.addItem(347, 8, EnemyType.MistBoss, "VEILWEAVER");

        // FAIRYDRAGON <=> Tx_MOB_MISTS_FAIRYDRAGON +25
        this.addItem(348, 4, EnemyType.MistBoss, "FAIRYDRAGON");
        this.addItem(349, 5, EnemyType.MistBoss, "FAIRYDRAGON");
        this.addItem(350, 6, EnemyType.MistBoss, "FAIRYDRAGON");
        this.addItem(351, 7, EnemyType.MistBoss, "FAIRYDRAGON");
        this.addItem(352, 8, EnemyType.MistBoss, "FAIRYDRAGON");

        // GRIFFIN <=> Tx_MOB_MISTS_GRIFFIN +25
        this.addItem(353, 4, EnemyType.MistBoss, "GRIFFIN");
        this.addItem(354, 5, EnemyType.MistBoss, "GRIFFIN");
        this.addItem(355, 6, EnemyType.MistBoss, "GRIFFIN");
        this.addItem(356, 7, EnemyType.MistBoss, "GRIFFIN");
        this.addItem(357, 8, EnemyType.MistBoss, "GRIFFIN");
        //#endregion
        
        
        // TODO
        // ADD ENEMIES
        //#region Enemies

        //#region Avalon
        //#region Drones
        //#region Avalon Drones Treasure
        // Standard
        this.addItem(830, 5, EnemyType.Drone, "AVALONMINIONCHEST");
        this.addItem(831, 6, EnemyType.Drone, "AVALONMINIONCHEST");
        this.addItem(832, 7, EnemyType.Drone, "AVALONMINIONCHEST");
        this.addItem(833, 8, EnemyType.Drone, "AVALONMINIONCHEST");
        // Uncomon
        this.addItem(834, 5, EnemyType.Drone, "AVALONMINIONCHEST");
        this.addItem(835, 6, EnemyType.Drone, "AVALONMINIONCHEST");
        this.addItem(836, 7, EnemyType.Drone, "AVALONMINIONCHEST");
        this.addItem(837, 8, EnemyType.Drone, "AVALONMINIONCHEST");
        // Rare
        this.addItem(838, 5, EnemyType.Drone, "AVALONMINIONCHEST");
        this.addItem(839, 6, EnemyType.Drone, "AVALONMINIONCHEST");
        this.addItem(840, 7, EnemyType.Drone, "AVALONMINIONCHEST");
        this.addItem(841, 8, EnemyType.Drone, "AVALONMINIONCHEST");
        // Legendary
        this.addItem(842, 5, EnemyType.Drone, "AVALONMINIONCHEST");
        this.addItem(843, 6, EnemyType.Drone, "AVALONMINIONCHEST");
        this.addItem(844, 7, EnemyType.Drone, "AVALONMINIONCHEST");
        this.addItem(845, 8, EnemyType.Drone, "AVALONMINIONCHEST");
        //#endregion
        /*
        // Worker
        this.addItem(791, 4, EnemyType.Drone, "");
        this.addItem(792, 6, EnemyType.Drone, "");
        this.addItem(793, 8, EnemyType.Drone, "");
        // Lamp
        this.addItem(794, 4, EnemyType.Drone, "");
        this.addItem(795, 6, EnemyType.Drone, "");
        this.addItem(796, 8, EnemyType.Drone, "");
        // Normal
        this.addItem(797, 4, EnemyType.Drone, "");
        this.addItem(798, 6, EnemyType.Drone, "");
        this.addItem(799, 8, EnemyType.Drone, "");
        // Scout
        this.addItem(800, 4, EnemyType.Drone, "");
        this.addItem(801, 6, EnemyType.Drone, "");
        this.addItem(802, 8, EnemyType.Drone, "");
        // Builder
        this.addItem(803, 4, EnemyType.Drone, "");
        this.addItem(804, 6, EnemyType.Drone, "");
        this.addItem(805, 8, EnemyType.Drone, "");
        //#endregion

        //#region Pikeman
        // Standard
        this.addItem(806, 4, EnemyType.Enemy, "");
        this.addItem(807, 6, EnemyType.Enemy, "");
        this.addItem(808, 8, EnemyType.Enemy, "");
        // Champion
        this.addItem(806, 4, EnemyType.EnchantedEnemy, "");
        this.addItem(807, 6, EnemyType.EnchantedEnemy, "");
        this.addItem(808, 8, EnemyType.EnchantedEnemy, "");
        //#endregion
        
        //#region Monk
        // Standard
        this.addItem(812, 4, EnemyType.Enemy, "");
        this.addItem(813, 6, EnemyType.Enemy, "");
        this.addItem(814, 8, EnemyType.Enemy, "");
        // Champion
        this.addItem(815, 4, EnemyType.EnchantedEnemy, "");
        this.addItem(816, 6, EnemyType.EnchantedEnemy, "");
        this.addItem(817, 8, EnemyType.EnchantedEnemy, "");
        //#endregion
        
        //#region Berserk
        // Mini Boss
        this.addItem(818, 4, EnemyType.MiniBoss, "");
        this.addItem(819, 6, EnemyType.MiniBoss, "");
        this.addItem(820, 8, EnemyType.MiniBoss, "");
        //#endregion
        
        //#region Knight
        // Standard
        this.addItem(821, 4, EnemyType.Boss, "");
        this.addItem(822, 6, EnemyType.Boss, "");
        this.addItem(823, 8, EnemyType.Boss, "");
        //#endregion

        //#region Bowman
        // Standard
        this.addItem(824, 4, EnemyType.Enemy, "");
        this.addItem(825, 6, EnemyType.Enemy, "");
        this.addItem(826, 8, EnemyType.Enemy, "");
        // Champion
        this.addItem(827, 4, EnemyType.EnchantedEnemy, "");
        this.addItem(828, 6, EnemyType.EnchantedEnemy, "");
        this.addItem(829, 8, EnemyType.EnchantedEnemy, "");
        // Mini Boss
        this.addItem(830, 4, EnemyType.MiniBoss, "");
        this.addItem(831, 6, EnemyType.MiniBoss, "");
        this.addItem(832, 8, EnemyType.MiniBoss, "");
        // Boss
        this.addItem(833, 4, EnemyType.Boss, "");
        this.addItem(834, 6, EnemyType.Boss, "");
        this.addItem(835, 8, EnemyType.Boss, "");
        //#endregion

        //#region Wizard
        // Standard
        this.addItem(836, 4, EnemyType.Enemy, "");
        this.addItem(837, 6, EnemyType.Enemy, "");
        this.addItem(838, 8, EnemyType.Enemy, "");
        //#endregion

        //#region Cleric
        // Champion
        this.addItem(839, 4, EnemyType.EnchantedEnemy, "");
        this.addItem(840, 6, EnemyType.EnchantedEnemy, "");
        this.addItem(841, 8, EnemyType.EnchantedEnemy, "");
        //#endregion

        //#region Mage
        // Standard
        this.addItem(842, 4, EnemyType.Enemy, "");
        this.addItem(843, 6, EnemyType.Enemy, "");
        this.addItem(844, 8, EnemyType.Enemy, "");
        // Champion
        this.addItem(845, 4, EnemyType.EnchantedEnemy, "");
        this.addItem(846, 6, EnemyType.EnchantedEnemy, "");
        this.addItem(847, 8, EnemyType.EnchantedEnemy, "");
        // Mini Boss
        this.addItem(848, 4, EnemyType.MiniBoss, "");
        this.addItem(849, 6, EnemyType.MiniBoss, "");
        this.addItem(850, 8, EnemyType.MiniBoss, "");
        // Boss
        this.addItem(848, 4, EnemyType.Boss, "");
        this.addItem(849, 6, EnemyType.Boss, "");
        this.addItem(850, 8, EnemyType.Boss, "");
        //#endregion
        //#endregion

        //#region Heretic
        // Normal and camp are exactly the same, just id change 
        //#region Scavenger
        // Normal
        this.addItem(854, 3, EnemyType.Enemy, "");
        this.addItem(855, 5, EnemyType.Enemy, "");
        this.addItem(856, 6, EnemyType.Enemy, "");
        this.addItem(857, 7, EnemyType.Enemy, "");
        this.addItem(858, 8, EnemyType.Enemy, "");
        // Camp
        this.addItem(859, 5, EnemyType.Enemy, "");
        this.addItem(860, 6, EnemyType.Enemy, "");
        this.addItem(861, 7, EnemyType.Enemy, "");
        this.addItem(862, 8, EnemyType.Enemy, "");
        //#endregion
        
        //#region Woodgatherer
        // Normal
        this.addItem(863, 3, EnemyType.Enemy, "");
        this.addItem(864, 5, EnemyType.Enemy, "");
        this.addItem(865, 6, EnemyType.Enemy, "");
        this.addItem(866, 7, EnemyType.Enemy, "");
        this.addItem(867, 8, EnemyType.Enemy, "");
        // Camp
        this.addItem(868, 5, EnemyType.Enemy, "");
        this.addItem(869, 6, EnemyType.Enemy, "");
        this.addItem(870, 7, EnemyType.Enemy, "");
        this.addItem(871, 8, EnemyType.Enemy, "");
        //#endregion
        
        //#region Thief
        // Normal
        this.addItem(872, 3, EnemyType.Enemy, "");
        this.addItem(873, 5, EnemyType.Enemy, "");
        this.addItem(874, 6, EnemyType.Enemy, "");
        this.addItem(875, 7, EnemyType.Enemy, "");
        this.addItem(876, 8, EnemyType.Enemy, "");
        // Camp
        this.addItem(877, 5, EnemyType.Enemy, "");
        this.addItem(878, 6, EnemyType.Enemy, "");
        this.addItem(879, 7, EnemyType.Enemy, "");
        this.addItem(880, 8, EnemyType.Enemy, "");

        // Normal Champion
        this.addItem(881, 3, EnemyType.EnchantedEnemy, "");
        this.addItem(882, 5, EnemyType.EnchantedEnemy, "");
        this.addItem(883, 6, EnemyType.EnchantedEnemy, "");
        this.addItem(884, 7, EnemyType.EnchantedEnemy, "");
        this.addItem(885, 8, EnemyType.EnchantedEnemy, "");
        // Camp Champion
        this.addItem(886, 5, EnemyType.EnchantedEnemy, "");
        this.addItem(887, 6, EnemyType.EnchantedEnemy, "");
        this.addItem(888, 7, EnemyType.EnchantedEnemy, "");
        this.addItem(889, 8, EnemyType.EnchantedEnemy, "");

        // Normal Miniboss
        this.addItem(890, 3, EnemyType.MiniBoss, "");
        this.addItem(891, 5, EnemyType.MiniBoss, "");
        this.addItem(892, 6, EnemyType.MiniBoss, "");
        this.addItem(893, 7, EnemyType.MiniBoss, "");
        this.addItem(894, 8, EnemyType.MiniBoss, "");
        // Camp Miniboss
        this.addItem(895, 5, EnemyType.MiniBoss, "");
        this.addItem(896, 6, EnemyType.MiniBoss, "");
        this.addItem(897, 7, EnemyType.MiniBoss, "");
        this.addItem(898, 8, EnemyType.MiniBoss, "");
        //#endregion

        //#region Archer
        // Normal
        this.addItem(899, 3, EnemyType.Enemy, "");
        this.addItem(900, 5, EnemyType.Enemy, "");
        this.addItem(901, 6, EnemyType.Enemy, "");
        this.addItem(902, 7, EnemyType.Enemy, "");
        this.addItem(903, 8, EnemyType.Enemy, "");
        // Camp
        this.addItem(904, 5, EnemyType.Enemy, "");
        this.addItem(905, 6, EnemyType.Enemy, "");
        this.addItem(906, 7, EnemyType.Enemy, "");
        this.addItem(907, 8, EnemyType.Enemy, "");

        // Normal Champion
        this.addItem(908, 3, EnemyType.EnchantedEnemy, "");
        this.addItem(909, 5, EnemyType.EnchantedEnemy, "");
        this.addItem(910, 6, EnemyType.EnchantedEnemy, "");
        this.addItem(911, 7, EnemyType.EnchantedEnemy, "");
        this.addItem(912, 8, EnemyType.EnchantedEnemy, "");
        // Camp Champion
        this.addItem(913, 5, EnemyType.EnchantedEnemy, "");
        this.addItem(914, 6, EnemyType.EnchantedEnemy, "");
        this.addItem(915, 7, EnemyType.EnchantedEnemy, "");
        this.addItem(916, 8, EnemyType.EnchantedEnemy, "");

        // Normal Miniboss
        this.addItem(917, 3, EnemyType.MiniBoss, "");
        this.addItem(918, 5, EnemyType.MiniBoss, "");
        this.addItem(919, 6, EnemyType.MiniBoss, "");
        this.addItem(920, 7, EnemyType.MiniBoss, "");
        this.addItem(921, 8, EnemyType.MiniBoss, "");
        // Camp Miniboss
        this.addItem(922, 5, EnemyType.MiniBoss, "");
        this.addItem(923, 6, EnemyType.MiniBoss, "");
        this.addItem(924, 7, EnemyType.MiniBoss, "");
        this.addItem(925, 8, EnemyType.MiniBoss, "");
        //#endregion

        //#region Mage
        // Normal
        this.addItem(926, 3, EnemyType.Enemy, "");
        this.addItem(927, 5, EnemyType.Enemy, "");
        this.addItem(928, 6, EnemyType.Enemy, "");
        this.addItem(929, 7, EnemyType.Enemy, "");
        this.addItem(930, 8, EnemyType.Enemy, "");
        // Camp
        this.addItem(931, 5, EnemyType.Enemy, "");
        this.addItem(932, 6, EnemyType.Enemy, "");
        this.addItem(933, 7, EnemyType.Enemy, "");
        this.addItem(934, 8, EnemyType.Enemy, "");

        // Normal Champion
        this.addItem(935, 3, EnemyType.EnchantedEnemy, "");
        this.addItem(936, 5, EnemyType.EnchantedEnemy, "");
        this.addItem(937, 6, EnemyType.EnchantedEnemy, "");
        this.addItem(938, 7, EnemyType.EnchantedEnemy, "");
        this.addItem(939, 8, EnemyType.EnchantedEnemy, "");
        // Camp Champion
        this.addItem(940, 5, EnemyType.EnchantedEnemy, "");
        this.addItem(941, 6, EnemyType.EnchantedEnemy, "");
        this.addItem(942, 7, EnemyType.EnchantedEnemy, "");
        this.addItem(943, 8, EnemyType.EnchantedEnemy, "");

        // Normal Miniboss
        this.addItem(944, 3, EnemyType.MiniBoss, "");
        this.addItem(945, 5, EnemyType.MiniBoss, "");
        this.addItem(946, 6, EnemyType.MiniBoss, "");
        this.addItem(947, 7, EnemyType.MiniBoss, "");
        this.addItem(948, 8, EnemyType.MiniBoss, "");
        // Camp Miniboss
        this.addItem(949, 5, EnemyType.MiniBoss, "");
        this.addItem(950, 6, EnemyType.MiniBoss, "");
        this.addItem(951, 7, EnemyType.MiniBoss, "");
        this.addItem(952, 8, EnemyType.MiniBoss, "");

        // Normal Boss
        this.addItem(953, 3, EnemyType.Boss, "");
        this.addItem(954, 5, EnemyType.Boss, "");
        this.addItem(955, 6, EnemyType.Boss, "");
        this.addItem(956, 7, EnemyType.Boss, "");
        this.addItem(957, 8, EnemyType.Boss, "");
        // Camp Boss
        this.addItem(958, 5, EnemyType.Boss, "");
        this.addItem(959, 6, EnemyType.Boss, "");
        this.addItem(960, 7, EnemyType.Boss, "");
        this.addItem(961, 8, EnemyType.Boss, "");

        // Boss summon
        this.addItem(962, 3, EnemyType.Enemy, "");
        //#endregion

        //#region Tank
        // Normal Champion
        this.addItem(963, 3, EnemyType.EnchantedEnemy, "");
        this.addItem(964, 5, EnemyType.EnchantedEnemy, "");
        this.addItem(965, 6, EnemyType.EnchantedEnemy, "");
        this.addItem(966, 7, EnemyType.EnchantedEnemy, "");
        this.addItem(967, 8, EnemyType.EnchantedEnemy, "");
        // Camp Champion
        this.addItem(968, 5, EnemyType.EnchantedEnemy, "");
        this.addItem(969, 6, EnemyType.EnchantedEnemy, "");
        this.addItem(970, 7, EnemyType.EnchantedEnemy, "");
        this.addItem(971, 8, EnemyType.EnchantedEnemy, "");

        // Normal Miniboss
        this.addItem(972, 3, EnemyType.MiniBoss, "");
        this.addItem(973, 5, EnemyType.MiniBoss, "");
        this.addItem(974, 6, EnemyType.MiniBoss, "");
        this.addItem(975, 7, EnemyType.MiniBoss, "");
        this.addItem(976, 8, EnemyType.MiniBoss, "");
        // Camp Miniboss
        this.addItem(977, 5, EnemyType.MiniBoss, "");
        this.addItem(978, 6, EnemyType.MiniBoss, "");
        this.addItem(979, 7, EnemyType.MiniBoss, "");
        this.addItem(980, 8, EnemyType.MiniBoss, "");
        //#endregion

        //#region Balista
        // Normal Boss
        this.addItem(981, 3, EnemyType.Boss, "");
        this.addItem(982, 5, EnemyType.Boss, "");
        this.addItem(983, 6, EnemyType.Boss, "");
        this.addItem(984, 7, EnemyType.Boss, "");
        this.addItem(985, 8, EnemyType.Boss, "");
        // Camp Boss
        this.addItem(986, 5, EnemyType.Boss, "");
        this.addItem(987, 6, EnemyType.Boss, "");
        this.addItem(988, 7, EnemyType.Boss, "");
        this.addItem(989, 8, EnemyType.Boss, "");
        //#endregion

        //#region Overseer
        // Normal Boss
        this.addItem(990, 3, EnemyType.Boss, "");
        this.addItem(991, 5, EnemyType.Boss, "");
        this.addItem(992, 6, EnemyType.Boss, "");
        this.addItem(993, 7, EnemyType.Boss, "");
        this.addItem(994, 8, EnemyType.Boss, "");
        // Camp Boss
        this.addItem(995, 5, EnemyType.Boss, "");
        this.addItem(996, 6, EnemyType.Boss, "");
        this.addItem(997, 7, EnemyType.Boss, "");
        this.addItem(998, 8, EnemyType.Boss, "");
        //#endregion

        //#region Shadowmask
        this.addItem(999, 3, EnemyType.Boss, "");
        //#endregion
        
        //#region Veteran
        //Rat
        this.addItem(1004, 3, EnemyType.Enemy, "");
        // Woodgatherer
        this.addItem(1005, 3, EnemyType.Enemy, "");
        // Scavenger
        this.addItem(1006, 3, EnemyType.Enemy, "");
        // Thief
        this.addItem(1007, 3, EnemyType.MediumEnemy, "");
        this.addItem(1008, 3, EnemyType.EnchantedEnemy, "");
        this.addItem(1009, 3, EnemyType.MiniBoss, "");
        // Archer
        this.addItem(1010, 3, EnemyType.MediumEnemy, "");
        this.addItem(1011, 3, EnemyType.EnchantedEnemy, "");
        this.addItem(1012, 3, EnemyType.MiniBoss, "");
        // Mage
        this.addItem(1013, 3, EnemyType.Enemy, "");
        this.addItem(1014, 3, EnemyType.MediumEnemy, "");
        this.addItem(1015, 3, EnemyType.EnchantedEnemy, "");
        this.addItem(1016, 3, EnemyType.MiniBoss, "");
        // Healer
        this.addItem(1017, 3, EnemyType.Enemy, "");
        this.addItem(1018, 3, EnemyType.MediumEnemy, "");
        this.addItem(1019, 3, EnemyType.EnchantedEnemy, "");
        // Tank
        this.addItem(1020, 3, EnemyType.Enemy, "");
        this.addItem(1021, 3, EnemyType.MediumEnemy, "");
        this.addItem(1022, 3, EnemyType.EnchantedEnemy, "");
        this.addItem(1023, 3, EnemyType.MiniBoss, "");
        // Mortar
        this.addItem(1024, 3, EnemyType.Enemy, "");
        this.addItem(1025, 3, EnemyType.MediumEnemy, "");
        this.addItem(1026, 3, EnemyType.EnchantedEnemy, "");
        //#endregion
        
        //#region World
        // Woodgatherer
        this.addItem(1030, 1, EnemyType.Enemy, "");
        this.addItem(1031, 2, EnemyType.Enemy, "");
        this.addItem(1032, 3, EnemyType.Enemy, "");
        // Thief
        this.addItem(1033, 1, EnemyType.Enemy, "");
        this.addItem(1034, 2, EnemyType.Enemy, "");
        this.addItem(1035, 2, EnemyType.MiniBoss, "");
        this.addItem(1036, 2, EnemyType.Boss, "");
        this.addItem(1037, 3, EnemyType.Enemy, "");
        this.addItem(1038, 3, EnemyType.MiniBoss, "");
        this.addItem(1039, 3, EnemyType.MediumEnemy, "");
        this.addItem(1040, 3, EnemyType.Boss, "");
        // Archer
        this.addItem(1041, 1, EnemyType.Enemy, "");
        this.addItem(1042, 2, EnemyType.Enemy, "");
        this.addItem(1043, 2, EnemyType.MiniBoss, "");
        this.addItem(1044, 2, EnemyType.Boss, "");
        this.addItem(1045, 3, EnemyType.Enemy, "");
        this.addItem(1046, 3, EnemyType.MiniBoss, "");
        this.addItem(1047, 3, EnemyType.MediumEnemy, "");
        this.addItem(1048, 3, EnemyType.Boss, "");
        // Healer
        this.addItem(1049, 1, EnemyType.Enemy, "");
        this.addItem(1050, 2, EnemyType.Enemy, "");
        this.addItem(1051, 3, EnemyType.Enemy, "");
        this.addItem(1052, 3, EnemyType.MiniBoss, "");
        this.addItem(1053, 3, EnemyType.MediumEnemy, "");
        this.addItem(1054, 3, EnemyType.Boss, "");
        // Mage
        this.addItem(1055, 1, EnemyType.Enemy, "");
        this.addItem(1056, 2, EnemyType.Enemy, "");
        this.addItem(1057, 2, EnemyType.MiniBoss, "");
        this.addItem(1058, 2, EnemyType.Boss, "");
        this.addItem(1059, 3, EnemyType.Enemy, "");
        this.addItem(1060, 3, EnemyType.MiniBoss, "");
        this.addItem(1061, 3, EnemyType.MediumEnemy, "");
        this.addItem(1062, 3, EnemyType.Boss, "");
        // Totem spells
        this.addItem(1063, 2, EnemyType.Enemy, "");
        this.addItem(1064, 2, EnemyType.Enemy, "");
        this.addItem(1065, 2, EnemyType.Enemy, "");
        this.addItem(1066, 3, EnemyType.Enemy, "");
        this.addItem(1067, 3, EnemyType.Enemy, "");
        this.addItem(1068, 3, EnemyType.Enemy, "");
        // Foulrat
        this.addItem(1069, 2, EnemyType.Enemy, "");
        this.addItem(1070, 3, EnemyType.Enemy, "");
        this.addItem(1071, 3, EnemyType.MediumEnemy, "");
        // Scavenger tutorial
        this.addItem(1072, 1, EnemyType.Enemy, "");
        this.addItem(1073, 1, EnemyType.Enemy, "");
        // Scavenger
        this.addItem(1074, 2, EnemyType.Enemy, "");
        this.addItem(1075, 3, EnemyType.Enemy, "");
        this.addItem(1076, 3, EnemyType.MediumEnemy, "");
        // Tank
        this.addItem(1077, 1, EnemyType.Enemy, "");
        this.addItem(1078, 2, EnemyType.Enemy, "");
        this.addItem(1079, 2, EnemyType.MiniBoss, "");
        this.addItem(1080, 2, EnemyType.Boss, "");
        this.addItem(1081, 3, EnemyType.Enemy, "");
        this.addItem(1082, 3, EnemyType.MiniBoss, "");
        this.addItem(1083, 3, EnemyType.Boss, "");
        this.addItem(1084, 3, EnemyType.MediumEnemy, "");
        // Mortar
        this.addItem(1085, 2, EnemyType.Enemy, "");
        this.addItem(1086, 3, EnemyType.Enemy, "");
        this.addItem(1087, 3, EnemyType.MediumEnemy, "");
        // Balista
        this.addItem(1088, 2, EnemyType.Enemy, "");
        this.addItem(1089, 2, EnemyType.Enemy, "");
        this.addItem(1090, 3, EnemyType.Enemy, "");
        this.addItem(1091, 3, EnemyType.MediumEnemy, "");
        // Other
        this.addItem(1092, 3, EnemyType.Boss, ""); // lumberjack boss
        this.addItem(1093, 3, EnemyType.Boss, ""); // gibson boss
        this.addItem(1094, 3, EnemyType.Enemy, ""); // gibson stooge
        this.addItem(1095, 3, EnemyType.Enemy, ""); // heretic overseer
        //#endregion
        //#endregion
        
        // TODO
        //#region Morgana

        //#endregion

        //#region Demon
        //this.addItem(2038, 4, EnemyType.Enemy, "");
        //#endregion

        //this.addItem(1466, 4, EnemyType.Enemy, "UNDEADARCHER4");
        //#endregion
        */
    
        //#region Event Enemies
        //#region EASTER
        // Chests
        this.addItem(716, 2, EnemyType.Events, "EVENTEASTERCHEST2");
        this.addItem(717, 3, EnemyType.Events, "EVENTEASTERCHEST2");
        this.addItem(718, 4, EnemyType.Events, "EVENTEASTERCHEST2");
        this.addItem(719, 5, EnemyType.Events, "EVENTEASTERCHEST2");
        this.addItem(720, 6, EnemyType.Events, "EVENTEASTERCHEST2");
        this.addItem(721, 7, EnemyType.Events, "EVENTEASTERCHEST2");
        this.addItem(722, 8, EnemyType.Events, "EVENTEASTERCHEST2");

        // Enemies
        this.addItem(733, 2, EnemyType.Events, "EVENTEASTERCHEST1");
        this.addItem(734, 3, EnemyType.Events, "EVENTEASTERCHEST1");
        this.addItem(735, 4, EnemyType.Events, "EVENTEASTERCHEST1");
        this.addItem(736, 5, EnemyType.Events, "EVENTEASTERCHEST1");
        this.addItem(737, 6, EnemyType.Events, "EVENTEASTERCHEST1");
        //#endregion
 
        //#endregion
    }
}