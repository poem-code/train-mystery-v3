/**
 * data/achievements.js —— 成就（纯数据，声明式）
 *
 * 这里只声明「指标 + 目标值」，指标由 state.js 的 computeMetrics 统一计算。
 * 不在数据里写函数的原因和强化/遗物一致：数据要能被遍历、被测试、被面板展示。
 *
 * 奖励只给以太与称号，不给战力——给战力会直接破坏每局的平衡。
 */

var ACHIEVEMENTS = [
  { id: "firstClear", name: "初次穿越", desc: "首次击败关底首领。", metric: "bossClears", target: 1, reward: 80 },
  { id: "clear3", name: "熟门熟路", desc: "累计通关 3 次。", metric: "bossClears", target: 3, reward: 160 },
  { id: "clear8", name: "老乘客", desc: "累计通关 8 次。", metric: "bossClears", target: 8, reward: 320 },
  { id: "reachBoss", name: "抵达尽头", desc: "抵达最深一层。", metric: "bestLayer", target: 8, reward: 100 },
  { id: "relic5", name: "满载而归", desc: "单局携带 5 件遗物。", metric: "maxRelics", target: 5, reward: 140 },
  { id: "enh10", name: "构筑成型", desc: "单局获得 10 项强化。", metric: "maxEnhancements", target: 10, reward: 160 },
  { id: "perfectBoss", name: "毫发无伤", desc: "满生命击败关底首领。", metric: "perfectBossWins", target: 1, reward: 240 },
  { id: "lowSanityClear", name: "精神临界", desc: "精神低于 30 时通关。", metric: "lowSanityClears", target: 1, reward: 220 },
  { id: "noRelicClear", name: "赤手空拳", desc: "不带任何遗物通关。", metric: "noRelicClears", target: 1, reward: 260 },
  { id: "codexHalf", name: "博物学者", desc: "图鉴进度达到 50%。", metric: "codexPercent", target: 50, reward: 200 },
  { id: "codexFull", name: "全知乘客", desc: "图鉴进度达到 100%。", metric: "codexPercent", target: 100, reward: 500 },
  { id: "daily3", name: "每日常客", desc: "完成 3 次每日挑战。", metric: "dailyClears", target: 3, reward: 180 }
];

function getById(id) {
  var i;
  for (i = 0; i < ACHIEVEMENTS.length; i += 1) {
    if (ACHIEVEMENTS[i].id === id) return ACHIEVEMENTS[i];
  }
  return null;
}

module.exports = {
  ACHIEVEMENTS: ACHIEVEMENTS,
  getById: getById
};
