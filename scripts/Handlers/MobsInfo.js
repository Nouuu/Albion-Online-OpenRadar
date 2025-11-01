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
        //#region Living Resources - FUSIONNÉ (235 TypeID)
        // Source: MobsInfo.js original + MobsInfo_Enriched.js (corrections terrain)
        // Généré automatiquement le 2025-11-01T19:34:45.532Z
        
        //#region Hide (LivingSkinnable)
                this.addItem(322, 1, 1, "hide");
        this.addItem(323, 3, 1, "hide");
        this.addItem(324, 4, 1, "hide");
        this.addItem(325, 5, 1, "hide");
        this.addItem(326, 6, 1, "hide");
        this.addItem(327, 7, 1, "hide");
        this.addItem(328, 8, 1, "hide");
        this.addItem(330, 1, 1, "hide");
        this.addItem(331, 2, 1, "hide");
        this.addItem(332, 3, 1, "hide");
        this.addItem(333, 4, 1, "hide");
        this.addItem(334, 5, 1, "hide");
        this.addItem(335, 6, 1, "hide");
        this.addItem(336, 7, 1, "hide");
        this.addItem(337, 8, 1, "hide");
        this.addItem(338, 4, 1, "hide");
        this.addItem(339, 5, 1, "hide");
        this.addItem(340, 6, 1, "hide");
        this.addItem(341, 7, 1, "hide");
        this.addItem(342, 8, 1, "hide");
        this.addItem(358, 1, 1, "hide");
        this.addItem(359, 2, 1, "hide");
        this.addItem(360, 2, 1, "hide");
        this.addItem(361, 3, 1, "hide");
        this.addItem(362, 4, 1, "hide");
        this.addItem(363, 5, 1, "hide");
        this.addItem(364, 6, 1, "hide");
        this.addItem(365, 6, 1, "hide");
        this.addItem(366, 7, 1, "hide");
        this.addItem(367, 7, 1, "hide");
        this.addItem(368, 8, 1, "hide");
        this.addItem(369, 8, 1, "hide");
        this.addItem(370, 4, 1, "hide");
        this.addItem(371, 5, 1, "hide");
        this.addItem(372, 6, 1, "hide");
        this.addItem(373, 7, 1, "hide");
        this.addItem(374, 8, 1, "hide");
        this.addItem(375, 1, 1, "hide");
        this.addItem(376, 2, 1, "hide");
        this.addItem(377, 3, 1, "hide");
        this.addItem(378, 4, 1, "hide");
        this.addItem(379, 5, 1, "hide");
        this.addItem(380, 6, 1, "hide");
        this.addItem(381, 7, 1, "hide");
        this.addItem(382, 8, 1, "hide");
        this.addItem(383, 4, 1, "hide");
        this.addItem(384, 5, 1, "hide");
        this.addItem(385, 6, 1, "hide");
        this.addItem(386, 1, 1, "hide");
        this.addItem(387, 2, 1, "hide");
        this.addItem(388, 3, 1, "hide");
        this.addItem(389, 4, 1, "hide");
        this.addItem(390, 5, 1, "hide");
        this.addItem(391, 6, 1, "hide");
        this.addItem(392, 7, 1, "hide");
        this.addItem(393, 7, 1, "hide");
        this.addItem(394, 8, 1, "hide");
        this.addItem(395, 8, 1, "hide");
        this.addItem(396, 4, 1, "hide");
        this.addItem(397, 5, 1, "hide");
        this.addItem(398, 6, 1, "hide");
        this.addItem(399, 7, 1, "hide");
        this.addItem(400, 8, 1, "hide");
        this.addItem(421, 1, 1, "hide");
        this.addItem(423, 3, 1, "hide");
        this.addItem(425, 4, 1, "hide");
        this.addItem(427, 5, 1, "hide");
        this.addItem(475, 3, 1, "hide");
        this.addItem(476, 5, 1, "hide");
        this.addItem(477, 7, 1, "hide");
        this.addItem(493, 4, 1, "hide");
        this.addItem(494, 5, 1, "hide");
        this.addItem(495, 6, 1, "hide");
        this.addItem(496, 7, 1, "hide");
        this.addItem(497, 8, 1, "hide");
        this.addItem(498, 4, 1, "hide");
        this.addItem(499, 5, 1, "hide");
        this.addItem(500, 6, 1, "hide");
        this.addItem(501, 7, 1, "hide");
        this.addItem(502, 8, 1, "hide");
        this.addItem(503, 4, 1, "hide");
        this.addItem(504, 5, 1, "hide");
        this.addItem(505, 6, 1, "hide");
        this.addItem(506, 7, 1, "hide");
        this.addItem(507, 8, 1, "hide");
        //#endregion

        //#region Fiber (LivingHarvestable)
                this.addItem(472, 3, 0, "fiber");
        this.addItem(473, 5, 0, "fiber");
        this.addItem(474, 7, 0, "fiber");
        this.addItem(530, 4, 0, "fiber");
        this.addItem(531, 5, 0, "fiber");
        this.addItem(553, 4, 0, "fiber");
        this.addItem(554, 5, 0, "fiber");
        this.addItem(555, 6, 0, "fiber");
        this.addItem(556, 7, 0, "fiber");
        this.addItem(557, 8, 0, "fiber");
        this.addItem(558, 4, 0, "fiber");
        this.addItem(559, 5, 0, "fiber");
        this.addItem(560, 6, 0, "fiber");
        this.addItem(561, 7, 0, "fiber");
        this.addItem(562, 8, 0, "fiber");
        this.addItem(563, 4, 0, "fiber");
        this.addItem(564, 5, 0, "fiber");
        this.addItem(565, 6, 0, "fiber");
        this.addItem(566, 7, 0, "fiber");
        this.addItem(567, 8, 0, "fiber");
        this.addItem(586, 3, 0, "fiber");
        this.addItem(587, 4, 0, "fiber");
        this.addItem(588, 5, 0, "fiber");
        this.addItem(589, 6, 0, "fiber");
        this.addItem(590, 7, 0, "fiber");
        this.addItem(591, 8, 0, "fiber");
        this.addItem(610, 3, 0, "fiber");
        this.addItem(611, 4, 0, "fiber");
        this.addItem(612, 5, 0, "fiber");
        this.addItem(613, 6, 0, "fiber");
        this.addItem(614, 7, 0, "fiber");
        this.addItem(615, 8, 0, "fiber");
        this.addItem(634, 3, 0, "fiber");
        this.addItem(635, 4, 0, "fiber");
        this.addItem(636, 5, 0, "fiber");
        this.addItem(637, 6, 0, "fiber");
        this.addItem(638, 7, 0, "fiber");
        this.addItem(639, 8, 0, "fiber");
        //#endregion

        //#region Wood (LivingHarvestable)
                this.addItem(483, 3, 0, "Logs");
        this.addItem(484, 3, 0, "Logs");
        this.addItem(485, 5, 0, "Logs");
        this.addItem(486, 5, 0, "Logs");
        this.addItem(487, 7, 0, "Logs");
        this.addItem(508, 4, 0, "Logs");
        this.addItem(509, 5, 0, "Logs");
        this.addItem(510, 6, 0, "Logs");
        this.addItem(511, 7, 0, "Logs");
        this.addItem(512, 8, 0, "Logs");
        this.addItem(513, 4, 0, "Logs");
        this.addItem(514, 5, 0, "Logs");
        this.addItem(515, 6, 0, "Logs");
        this.addItem(516, 7, 0, "Logs");
        this.addItem(517, 8, 0, "Logs");
        this.addItem(518, 4, 0, "Logs");
        this.addItem(519, 5, 0, "Logs");
        this.addItem(520, 6, 0, "Logs");
        this.addItem(521, 7, 0, "Logs");
        this.addItem(522, 8, 0, "Logs");
        this.addItem(568, 3, 0, "Logs");
        this.addItem(569, 4, 0, "Logs");
        this.addItem(570, 5, 0, "Logs");
        this.addItem(571, 6, 0, "Logs");
        this.addItem(572, 7, 0, "Logs");
        this.addItem(573, 8, 0, "Logs");
        this.addItem(592, 3, 0, "Logs");
        this.addItem(593, 4, 0, "Logs");
        this.addItem(594, 5, 0, "Logs");
        this.addItem(595, 6, 0, "Logs");
        this.addItem(596, 7, 0, "Logs");
        this.addItem(597, 8, 0, "Logs");
        this.addItem(616, 3, 0, "Logs");
        this.addItem(617, 4, 0, "Logs");
        this.addItem(618, 5, 0, "Logs");
        this.addItem(619, 6, 0, "Logs");
        this.addItem(620, 7, 0, "Logs");
        this.addItem(621, 8, 0, "Logs");
        //#endregion

        //#region Rock (LivingHarvestable)
                this.addItem(488, 3, 0, "rock");
        this.addItem(489, 3, 0, "rock");
        this.addItem(490, 5, 0, "rock");
        this.addItem(491, 5, 0, "rock");
        this.addItem(492, 7, 0, "rock");
        this.addItem(523, 4, 0, "rock");
        this.addItem(524, 5, 0, "rock");
        this.addItem(525, 6, 0, "rock");
        this.addItem(526, 7, 0, "rock");
        this.addItem(527, 8, 0, "rock");
        this.addItem(528, 4, 0, "rock");
        this.addItem(529, 5, 0, "rock");
        this.addItem(532, 8, 0, "rock");
        this.addItem(533, 4, 0, "rock");
        this.addItem(534, 5, 0, "rock");
        this.addItem(535, 6, 0, "rock");
        this.addItem(536, 7, 0, "rock");
        this.addItem(537, 8, 0, "rock");
        this.addItem(574, 3, 0, "rock");
        this.addItem(575, 4, 0, "rock");
        this.addItem(576, 5, 0, "rock");
        this.addItem(577, 6, 0, "rock");
        this.addItem(578, 7, 0, "rock");
        this.addItem(579, 8, 0, "rock");
        this.addItem(598, 3, 0, "rock");
        this.addItem(599, 4, 0, "rock");
        this.addItem(600, 5, 0, "rock");
        this.addItem(601, 6, 0, "rock");
        this.addItem(602, 7, 0, "rock");
        this.addItem(603, 8, 0, "rock");
        this.addItem(622, 3, 0, "rock");
        this.addItem(623, 4, 0, "rock");
        this.addItem(624, 5, 0, "rock");
        this.addItem(625, 6, 0, "rock");
        this.addItem(626, 7, 0, "rock");
        this.addItem(627, 8, 0, "rock");
        //#endregion

        //#region Ore (LivingHarvestable)
                this.addItem(478, 3, 0, "ore");
        this.addItem(479, 3, 0, "ore");
        this.addItem(480, 5, 0, "ore");
        this.addItem(481, 5, 0, "ore");
        this.addItem(482, 7, 0, "ore");
        this.addItem(538, 4, 0, "ore");
        this.addItem(539, 5, 0, "ore");
        this.addItem(540, 6, 0, "ore");
        this.addItem(541, 7, 0, "ore");
        this.addItem(542, 8, 0, "ore");
        this.addItem(543, 4, 0, "ore");
        this.addItem(544, 5, 0, "ore");
        this.addItem(545, 6, 0, "ore");
        this.addItem(546, 7, 0, "ore");
        this.addItem(547, 8, 0, "ore");
        this.addItem(548, 4, 0, "ore");
        this.addItem(549, 5, 0, "ore");
        this.addItem(550, 6, 0, "ore");
        this.addItem(551, 7, 0, "ore");
        this.addItem(552, 8, 0, "ore");
        this.addItem(580, 3, 0, "ore");
        this.addItem(581, 4, 0, "ore");
        this.addItem(582, 5, 0, "ore");
        this.addItem(583, 6, 0, "ore");
        this.addItem(584, 7, 0, "ore");
        this.addItem(585, 8, 0, "ore");
        this.addItem(604, 3, 0, "ore");
        this.addItem(605, 4, 0, "ore");
        this.addItem(606, 5, 0, "ore");
        this.addItem(607, 6, 0, "ore");
        this.addItem(608, 7, 0, "ore");
        this.addItem(609, 8, 0, "ore");
        this.addItem(628, 3, 0, "ore");
        this.addItem(629, 4, 0, "ore");
        this.addItem(630, 5, 0, "ore");
        this.addItem(631, 6, 0, "ore");
        this.addItem(632, 7, 0, "ore");
        this.addItem(633, 8, 0, "ore");
        //#endregion

        //#endregion Living Resources
    }
}
