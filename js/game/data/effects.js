/**
 * data/effects.js —— 效果字段定义与合并
 *
 * 设计原则：所有强化/遗物都是「往 effects 里加数」，不存函数。
 * 好处：存档可序列化、效果可面板展示、加新词条不用改逻辑。
 */

/** 可累加的数值型效果 */
var NUMERIC_KEYS = [
  "attackFlat",            // 攻击力加成
  "firstTurnShield",       // 每场战斗首回合护盾
  "healAfterBattle",       // 战后回血
  "hungerCostDelta",       // 节点移动饱食消耗增减（负数=减少）
  "lowSanityBonus",        // 低精神伤害加成（比例）
  "potionBonus",           // 药剂额外治疗
  "eventRewardBoost",      // 事件收益加成（比例）
  "campHealBonus",         // 营地额外回血
  "bossDamageBonus",       // 对 Boss 伤害加成（比例）
  "restoreSanityEveryThree", // 每 3 节点回精神
  "battleBonusGold",       // 战斗额外金币
  "foodRecoveryEveryTwo",  // 每 2 节点回饱食
  "lowSanityDamageReduction", // 低精神受伤减免（比例）
  "extraEliteEnhanceChoice",  // 精英额外强化候选
  "maxHpBonus",            // 生命上限加成
  "reviveHealBonus",       // 复活额外血量
  "critChance",            // 精准射击暴击率（0—1，叠加上限在逻辑里夹）
  "defendShieldBonus",     // 防御额外护盾
  "lowHpDamageBonus",      // 生命低于 40% 时的伤害加成（比例）
  "firstStrikeBonus"       // 每场战斗第一击的额外伤害
];

/** 布尔型效果 */
var FLAG_KEYS = [
  "escapeFree",       // 逃跑免以太
  "autoReviveOnce"    // 濒死自动复活一次
];

function emptyEffects() {
  var out = {};
  var i;
  for (i = 0; i < NUMERIC_KEYS.length; i += 1) out[NUMERIC_KEYS[i]] = 0;
  for (i = 0; i < FLAG_KEYS.length; i += 1) out[FLAG_KEYS[i]] = false;
  out.firstShopDiscount = null;
  return out;
}

/** 把 effects 增量叠加到 target（就地修改），返回 target */
function addEffects(target, effects) {
  if (!effects) return target;
  var key;
  for (key in effects) {
    if (!Object.prototype.hasOwnProperty.call(effects, key)) continue;
    var value = effects[key];
    if (value === null || value === undefined) continue;
    if (typeof value === "number") {
      target[key] = (typeof target[key] === "number" ? target[key] : 0) + value;
    } else if (typeof value === "boolean") {
      target[key] = target[key] || value;
    } else {
      // firstShopDiscount 这类一次性配置，取第一次设置的值
      if (target[key] === null || target[key] === undefined) target[key] = value;
    }
  }
  return target;
}

module.exports = {
  NUMERIC_KEYS: NUMERIC_KEYS,
  FLAG_KEYS: FLAG_KEYS,
  emptyEffects: emptyEffects,
  addEffects: addEffects
};
