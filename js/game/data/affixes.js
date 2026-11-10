/**
 * data/affixes.js —— 精英词缀（纯数据）
 *
 * 设计原则：词缀是「数值修饰 + 复用已有战斗分支」，不新写战斗流程。
 * 4 个精英模板 × 8 个词缀 = 32 种精英组合，比单纯堆敌人更省、更耐玩。
 *
 * 每个词缀必须在 state.js 里有真实行为分支，否则就是一个名字与行为不符的空壳。
 * （test-headless 会用正则反查源码，缺分支直接红）
 */

var AFFIXES = [
  {
    id: "frenzy",
    name: "狂暴",
    desc: "伤害 +30%，但每次出手自伤 2 点。",
    color: "#E06A5A",
    damageMul: 1.3,
    selfDamage: 2
  },
  {
    id: "bulwark",
    name: "壁垒",
    desc: "每 3 回合立起 12 点护盾。",
    color: "#4FC0B0",
    shieldEvery: 3,
    shieldAmount: 12
  },
  {
    id: "venom",
    name: "毒化",
    desc: "命中后让你每回合额外损失 3 点生命，持续 3 回合。",
    color: "#7FA84F",
    poison: 3
  },
  {
    id: "summon",
    name: "召唤",
    desc: "首回合与第 4 回合各召来一次扑咬，额外 5 点伤害。",
    color: "#9B7FD4",
    summonTurns: [1, 4],
    summonDamage: 5
  },
  {
    id: "swift",
    name: "迅捷",
    desc: "首回合抢先攻击两次。",
    color: "#E0B15C",
    swiftTurn: 1
  },
  {
    id: "mirrorA",
    name: "镜像",
    desc: "命中时反弹 4 点伤害。",
    color: "#9FC6D4",
    reflect: 4
  },
  {
    id: "greedy",
    name: "贪婪",
    desc: "赏金翻倍，但攻击力 +20%。",
    color: "#E0B15C",
    damageMul: 1.2,
    goldMul: 2
  },
  {
    id: "echo",
    name: "残响",
    desc: "首次死亡时以 40% 生命复活，继续战斗。",
    color: "#C2703E",
    reviveRatio: 0.4
  }
];

function getById(id) {
  var i;
  for (i = 0; i < AFFIXES.length; i += 1) {
    if (AFFIXES[i].id === id) return AFFIXES[i];
  }
  return null;
}

/** Boss 不吃词缀：Boss 本身已经有一套独立行为，再叠词缀会失控 */
function rollFor(pickFn) {
  return pickFn(AFFIXES);
}

module.exports = {
  AFFIXES: AFFIXES,
  getById: getById,
  rollFor: rollFor
};
