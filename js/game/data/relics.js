/**
 * data/relics.js —— 遗物池（本局永久被动，稀有）
 *
 * 获取途径：宝箱、精英战、事件交易。
 * 扩充规则：id 唯一，effects 只填需要的键。
 */

var RELICS = [
  {
    id: "oldMagazine",
    name: "旧式弹仓",
    desc: "基础攻击 +4。",
    rarity: "common",
    effects: { attackFlat: 4 }
  },
  {
    id: "rationBox",
    name: "餐车配给箱",
    desc: "每经过 2 个节点恢复 8 饱食度。",
    rarity: "common",
    effects: { foodRecoveryEveryTwo: 8 }
  },
  {
    id: "calmChip",
    name: "冷静芯片",
    desc: "精神值低于 30 时，受到的伤害 -25%。",
    rarity: "rare",
    effects: { lowSanityDamageReduction: 0.25 }
  },
  {
    id: "emergencyNeedle",
    name: "应急针剂",
    desc: "每局首次濒死时自动恢复 20 生命。",
    rarity: "rare",
    effects: { autoReviveOnce: true, reviveHealBonus: 20 }
  },
  {
    id: "echoCore",
    name: "回响核心",
    desc: "事件收益提高 30%。",
    rarity: "common",
    effects: { eventRewardBoost: 0.3 }
  },
  {
    id: "hunterBadge",
    name: "猎影徽记",
    desc: "精英战斗额外多 1 个强化候选。",
    rarity: "rare",
    effects: { extraEliteEnhanceChoice: 1 }
  },
  {
    id: "steelCharm",
    name: "钢骨护符",
    desc: "每场战斗首回合获得 10 点护盾。",
    rarity: "common",
    effects: { firstTurnShield: 10 }
  },
  {
    id: "supplyPlate",
    name: "补给铭牌",
    desc: "路线商店首次购买打 7 折。",
    rarity: "common",
    effects: { firstShopDiscount: 0.7 }
  },
  {
    id: "ironHeart",
    name: "铁质心脏",
    desc: "生命上限 +15，并立即回满。",
    rarity: "epic",
    effects: { maxHpBonus: 15 }
  },
  {
    id: "foldedMap",
    name: "折叠路线图",
    desc: "节点移动的饱食消耗 -2。",
    rarity: "common",
    effects: { hungerCostDelta: -2 }
  },
  {
    id: "brassKey",
    name: "黄铜钥匙",
    desc: "沿途商店首次购买打 6 折。",
    rarity: "common",
    effects: { firstShopDiscount: 0.6 }
  },
  {
    id: "boneDice",
    name: "骨制骰子",
    desc: "每场战斗额外获得 1 枚金币。",
    rarity: "common",
    effects: { battleBonusGold: 1 }
  },
  {
    id: "warmBrick",
    name: "暖砖",
    desc: "每经过 2 个节点恢复 6 饱食度。",
    rarity: "common",
    effects: { foodRecoveryEveryTwo: 6 }
  },
  {
    id: "sniperScope",
    name: "瞄准镜",
    desc: "攻击力 +6，但节点饱食消耗 +1。",
    rarity: "rare",
    effects: { attackFlat: 6, hungerCostDelta: 1 }
  },
  {
    id: "voidLens",
    name: "虚空透镜",
    desc: "对 Boss 造成的伤害 +30%。",
    rarity: "rare",
    effects: { bossDamageBonus: 0.3 }
  },
  {
    id: "thinBlanket",
    name: "薄毯",
    desc: "营地休息额外恢复 12 生命。",
    rarity: "common",
    effects: { campHealBonus: 12 }
  },
  {
    id: "twinShell",
    name: "孪生弹壳",
    desc: "攻击力 +2，精英战额外多 1 个强化候选。",
    rarity: "rare",
    effects: { attackFlat: 2, extraEliteEnhanceChoice: 1 }
  },
  {
    id: "mourningBadge",
    name: "哀悼徽章",
    desc: "每经过 3 个节点恢复 8 精神值。",
    rarity: "rare",
    effects: { restoreSanityEveryThree: 8 }
  }
];

function getById(id) {
  var i;
  for (i = 0; i < RELICS.length; i += 1) {
    if (RELICS[i].id === id) return RELICS[i];
  }
  return null;
}

/** 按稀有度权重随机，排除已拥有 */
function roll(pickRandom, ownedIds) {
  var owned = ownedIds || [];
  var pool = RELICS.filter(function (relic) {
    return owned.indexOf(relic.id) < 0;
  });
  if (!pool.length) return null;
  var weighted = [];
  pool.forEach(function (relic) {
    var weight = relic.rarity === "epic" ? 1 : relic.rarity === "rare" ? 3 : 6;
    var i;
    for (i = 0; i < weight; i += 1) weighted.push(relic);
  });
  return pickRandom(weighted) || pool[0];
}

module.exports = {
  RELICS: RELICS,
  getById: getById,
  roll: roll
};
