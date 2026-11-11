/**
 * data/relicSets.js —— 遗物序列（套装）
 *
 * 为什么要有序列：26 件遗物各自只加一点数值，玩家拿到什么全看运气，
 * 到中后期会觉得「一堆散件、没有方向」。序列把散件按打法归类，
 * 同一序列凑够件数就额外给一次成型奖励——拿遗物从「抽奖」变成「凑牌」。
 *
 * 设计约束：
 * 1. members 只写 id，不复制名字/描述，避免两处文案打架（名字以 relics.js 为准）。
 * 2. tiers 的 need 必须递增且 ≤ members.length，否则永远激活不了。
 * 3. effects 只能用 effects.js 里已声明的键——加新键要同时补行为分支，
 *    否则就是「描述写着 +X，实际没生效」。tests 里有对应断言。
 * 4. 序列奖励只给数值，不给规则型开关：规则型开关（逃跑免费、复活）在
 *    套装里会变成「凑齐就无敌」，代价和取舍都没了。
 */

var RELIC_SETS = [
  {
    id: "arsenal",
    name: "军械序列",
    accent: "gold",
    tagline: "把车厢里所有还能打响的东西都算上。",
    members: [
      "oldMagazine",
      "sniperScope",
      "quickDraw",
      "twinShell",
      "emptyShell",
      "voidLens"
    ],
    tiers: [
      { need: 2, desc: "攻击力 +3", effects: { attackFlat: 3 } },
      { need: 4, desc: "第一击 +6 伤害", effects: { firstStrikeBonus: 6 } },
      { need: 6, desc: "攻击力 +5，对 Boss 伤害 +12%", effects: { attackFlat: 5, bossDamageBonus: 0.12 } }
    ]
  },
  {
    id: "vigil",
    name: "守望序列",
    accent: "purple",
    tagline: "盯住要害，别眨眼。",
    members: [
      "brassCompass",
      "mirrorShard",
      "hunterBadge",
      "mourningBadge"
    ],
    tiers: [
      { need: 2, desc: "精准暴击率 +6%", effects: { critChance: 0.06 } },
      { need: 3, desc: "暴击率 +6%，精英战多 1 个强化候选", effects: { critChance: 0.06, extraEliteEnhanceChoice: 1 } },
      { need: 4, desc: "暴击率 +10%，对 Boss 伤害 +10%", effects: { critChance: 0.1, bossDamageBonus: 0.1 } }
    ]
  },
  {
    id: "warden",
    name: "守护序列",
    accent: "teal",
    tagline: "活着走到终点，比赢下每一场都难。",
    members: [
      "calmChip",
      "emergencyNeedle",
      "steelCharm",
      "ironHeart",
      "thinBlanket",
      "trenchPlate",
      "bloodOath",
      "boneLantern"
    ],
    tiers: [
      { need: 2, desc: "生命上限 +6", effects: { maxHpBonus: 6 } },
      { need: 4, desc: "防御时护盾 +6", effects: { defendShieldBonus: 6 } },
      { need: 6, desc: "低精神受伤再 -10%", effects: { lowSanityDamageReduction: 0.1 } },
      { need: 8, desc: "生命上限 +12，战后回 6 生命", effects: { maxHpBonus: 12, healAfterBattle: 6 } }
    ]
  },
  {
    id: "scavenger",
    name: "拾荒序列",
    accent: "green",
    tagline: "别人看见垃圾，你看见下一顿饭。",
    members: [
      "rationBox",
      "echoCore",
      "supplyPlate",
      "brassKey",
      "boneDice",
      "foldedMap",
      "warmBrick",
      "widowCoin"
    ],
    tiers: [
      { need: 2, desc: "每场战斗额外 1 金币", effects: { battleBonusGold: 1 } },
      { need: 4, desc: "事件收益 +15%", effects: { eventRewardBoost: 0.15 } },
      { need: 6, desc: "节点饱食消耗 -1", effects: { hungerCostDelta: -1 } },
      { need: 8, desc: "战斗金币再 +3，事件收益再 +15%", effects: { battleBonusGold: 3, eventRewardBoost: 0.15 } }
    ]
  }
];

function getById(id) {
  var i;
  for (i = 0; i < RELIC_SETS.length; i += 1) {
    if (RELIC_SETS[i].id === id) return RELIC_SETS[i];
  }
  return null;
}

/** 某件遗物属于哪个序列；不属于任何序列返回 null */
function forRelic(relicId) {
  var i;
  var j;
  for (i = 0; i < RELIC_SETS.length; i += 1) {
    for (j = 0; j < RELIC_SETS[i].members.length; j += 1) {
      if (RELIC_SETS[i].members[j] === relicId) return RELIC_SETS[i];
    }
  }
  return null;
}

module.exports = {
  RELIC_SETS: RELIC_SETS,
  getById: getById,
  forRelic: forRelic
};
