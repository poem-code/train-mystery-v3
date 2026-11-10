/**
 * data/enhancements.js —— 局内强化池（3 选 1，本局结束清空）
 *
 * 与遗物的区别：强化更常见、数值更小、可以重复叠（同类效果累加）。
 */

var ENHANCEMENTS = [
  { id: "atk3", name: "火力校准", desc: "攻击力 +3。", tag: "攻击", effects: { attackFlat: 3 } },
  { id: "atk5", name: "强化膛线", desc: "攻击力 +5，但节点饱食消耗 +1。", tag: "攻击", effects: { attackFlat: 5, hungerCostDelta: 1 } },
  { id: "shield8", name: "防御站姿", desc: "每场战斗首回合护盾 +8。", tag: "防御", effects: { firstTurnShield: 8 } },
  { id: "healAfterBattle", name: "战后包扎", desc: "每场战斗后恢复 10 生命。", tag: "续航", effects: { healAfterBattle: 10 } },
  { id: "lessHunger", name: "节律呼吸", desc: "节点移动的饱食消耗 -2。", tag: "续航", effects: { hungerCostDelta: -2 } },
  { id: "lowSanityAtk", name: "紧绷意志", desc: "精神值低于 50 时，伤害 +40%。", tag: "攻击", effects: { lowSanityBonus: 0.4 } },
  { id: "freeEscape", name: "快速撤离", desc: "逃跑不再扣除以太碎片。", tag: "机动", effects: { escapeFree: true } },
  { id: "potionBoost", name: "急救强化", desc: "回血药剂效果 +15。", tag: "续航", effects: { potionBonus: 15 } },
  { id: "eventBoost", name: "冒险嗅觉", desc: "事件奖励提高 25%。", tag: "收益", effects: { eventRewardBoost: 0.25 } },
  { id: "campBonus", name: "安稳睡眠", desc: "营地休息额外恢复 8 生命。", tag: "续航", effects: { campHealBonus: 8 } },
  { id: "bossHunter", name: "裂隙猎手", desc: "对 Boss 伤害 +20%。", tag: "攻击", effects: { bossDamageBonus: 0.2 } },
  { id: "steadyMind", name: "心智稳定", desc: "每经过 3 个节点恢复 6 精神值。", tag: "精神", effects: { restoreSanityEveryThree: 6 } },
  { id: "goldGain", name: "稀有折现", desc: "每场战斗额外获得 1 金币。", tag: "收益", effects: { battleBonusGold: 1 } },
  { id: "calmDown", name: "静息训练", desc: "低精神时受到的伤害 -15%。", tag: "防御", effects: { lowSanityDamageReduction: 0.15 } },
  { id: "vitality", name: "充沛体力", desc: "生命上限 +10，并立即回 10 生命。", tag: "续航", effects: { maxHpBonus: 10 } },

  /* ---------- 扩充词条：给 3 选 1 提供真正的取舍 ---------- */
  { id: "openingShot", name: "先手一箭", desc: "攻击力 +2，每场战斗首回合护盾 +6。", tag: "攻击", effects: { attackFlat: 2, firstTurnShield: 6 } },
  { id: "ironSkin", name: "铁皮护心", desc: "生命上限 +14。", tag: "防御", effects: { maxHpBonus: 14 } },
  { id: "scavenger", name: "拾荒本能", desc: "每场战斗额外 1 金币，事件收益 +10%。", tag: "收益", effects: { battleBonusGold: 1, eventRewardBoost: 0.1 } },
  { id: "fieldMedic", name: "战地急救", desc: "回血药剂效果 +20。", tag: "续航", effects: { potionBonus: 20 } },
  { id: "ironWill", name: "铁意志", desc: "精神低于 50 时伤害 +25%。", tag: "攻击", effects: { lowSanityBonus: 0.25 } },
  { id: "calmSight", name: "静观", desc: "低精神时受到的伤害 -20%。", tag: "防御", effects: { lowSanityDamageReduction: 0.2 } },
  { id: "marrow", name: "骨髓代谢", desc: "每场战斗后回 6 生命，每 2 节点回 6 饱食。", tag: "续航", effects: { healAfterBattle: 6, foodRecoveryEveryTwo: 6 } },
  { id: "nightRun", name: "夜行", desc: "节点移动的饱食消耗 -3。", tag: "机动", effects: { hungerCostDelta: -3 } },
  { id: "riftLens", name: "裂隙透镜", desc: "对 Boss 伤害 +25%。", tag: "攻击", effects: { bossDamageBonus: 0.25 } }
];

function getById(id) {
  var i;
  for (i = 0; i < ENHANCEMENTS.length; i += 1) {
    if (ENHANCEMENTS[i].id === id) return ENHANCEMENTS[i];
  }
  return null;
}

/**
 * 抽 count 个不重复候选。
 * pickRandom / shuffle 由调用方注入，保持本模块无状态。
 */
function draw(shuffle, count) {
  return shuffle(ENHANCEMENTS.slice()).slice(0, count);
}

module.exports = {
  ENHANCEMENTS: ENHANCEMENTS,
  getById: getById,
  draw: draw
};
