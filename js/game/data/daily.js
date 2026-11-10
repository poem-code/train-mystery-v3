/**
 * data/daily.js —— 每日挑战：限制条件池与日期种子
 *
 * 每日挑战不需要服务端：用日期字符串做种子，同一天所有玩家拿到同一条路线、
 * 同一组限制条件。这是「零后端也能做全服一致性」的标准做法。
 *
 * 每个限制条件都必须被 state.js 读取并真正生效，否则就只是装饰。
 */

var MODIFIERS = [
  {
    id: "frailBody",
    name: "脆弱躯壳",
    desc: "生命上限 -25。",
    maxHpDelta: -25
  },
  {
    id: "harshLand",
    name: "荒芜地带",
    desc: "每次移动额外消耗 3 饱食。",
    hungerPerNodeDelta: 3
  },
  {
    id: "swiftFoes",
    name: "凶暴之敌",
    desc: "敌人伤害 +20%。",
    enemyDamageMul: 1.2
  },
  {
    id: "thinAir",
    name: "稀薄空气",
    desc: "精神消耗翻倍。",
    sanityCostMul: 2
  },
  {
    id: "poorStart",
    name: "身无分文",
    desc: "开局没有以太碎片。",
    startEther: 0
  },
  {
    id: "fewChoices",
    name: "思路受限",
    desc: "每次强化只有 2 个候选。",
    enhanceChoiceDelta: -1
  },
  {
    id: "pricey",
    name: "物价飞涨",
    desc: "商店价格翻倍。",
    shopPriceMul: 2
  }
];

/** FNV-1a 变体：把 YYYY-MM-DD 变成稳定的 32 位种子 */
function seedFromDate(dateKey) {
  var text = String(dateKey || "1970-01-01");
  var hash = 2166136261;
  var i;
  for (i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul ? Math.imul(hash, 16777619) : (hash * 16777619) >>> 0;
  }
  return hash >>> 0;
}

/**
 * 按种子取 3 个互不相同的限制条件。
 * 用「种子做游标 + 步长互质」的确定性洗牌，保证同一天结果完全一致。
 */
function rollModifiers(seed) {
  var pool = MODIFIERS.slice();
  var state = seed >>> 0;
  var picked = [];
  var count = 3;
  var i;
  for (i = 0; i < count && pool.length; i += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    var index = state % pool.length;
    picked.push(pool[index]);
    pool.splice(index, 1);
  }
  return picked;
}

/** 把限制条件合并成一个便于读取的对象（全部给默认值，避免到处判空） */
function combine(modifiers) {
  var out = {
    maxHpDelta: 0,
    hungerPerNodeDelta: 0,
    enemyDamageMul: 1,
    sanityCostMul: 1,
    startEther: null,
    enhanceChoiceDelta: 0,
    shopPriceMul: 1
  };
  var list = modifiers || [];
  var i;
  for (i = 0; i < list.length; i += 1) {
    var m = list[i];
    if (m.maxHpDelta) out.maxHpDelta += m.maxHpDelta;
    if (m.hungerPerNodeDelta) out.hungerPerNodeDelta += m.hungerPerNodeDelta;
    if (m.enemyDamageMul) out.enemyDamageMul *= m.enemyDamageMul;
    if (m.sanityCostMul) out.sanityCostMul *= m.sanityCostMul;
    if (typeof m.startEther === "number") out.startEther = m.startEther;
    if (m.enhanceChoiceDelta) out.enhanceChoiceDelta += m.enhanceChoiceDelta;
    if (m.shopPriceMul) out.shopPriceMul *= m.shopPriceMul;
  }
  return out;
}

module.exports = {
  MODIFIERS: MODIFIERS,
  seedFromDate: seedFromDate,
  rollModifiers: rollModifiers,
  combine: combine
};
