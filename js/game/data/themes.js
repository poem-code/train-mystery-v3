/**
 * data/themes.js —— 车厢主题
 *
 * 主题 = 一组「规则修饰符」+ 一套背景色 + 一份内容权重偏好。
 * 修饰符字段刻意与 daily.combine() 的输出同形，合并逻辑只写一次（state.modsOf）。
 *
 * 纯数据文件：只导出表和查表函数，不放任何玩法计算。
 */

var THEMES = [
  {
    id: "rust",
    name: "锈蚀车厢",
    subtitle: "停在这里的第七年",
    desc: "车厢早该报废了，扶手一碰就掉锈。这里没有额外的规矩，只有一趟最普通的路。",
    unlockCost: 0,
    accent: "#E0B15C",
    glow: "rgba(79,192,176,0.16)",
    beam: "rgba(224,177,92,0.10)",
    rules: [
      "无额外修正",
      "资源消耗与掉落均为标准值"
    ],
    mods: {}
  },
  {
    id: "frost",
    name: "霜封车厢",
    subtitle: "呼吸都会结在窗上",
    desc: "车窗结了厚霜，怪物的关节冻得发僵，可铁皮也冻硬了。冷风一路抽走你的力气，走路格外耗神，得靠更多补给撑着。",
    unlockCost: 150,
    accent: "#8FC4DE",
    glow: "rgba(120,190,220,0.18)",
    beam: "rgba(190,225,245,0.11)",
    rules: [
      "敌人生命 +15%",
      "敌人伤害 -15%",
      "每层额外消耗 1 点饱食",
      "开局额外 20 以太"
    ],
    mods: {
      enemyHpMul: 1.15,
      enemyDamageMul: 0.85,
      hungerPerNodeDelta: 1,
      startEtherBonus: 20
    }
  },
  {
    id: "ember",
    name: "焚炉车厢",
    subtitle: "地板下面就是火",
    desc: "锅炉烧穿了地板，热浪把两边都逼急了：它们出手更狠，但值钱的东西也更多。这里的商店还便宜些，适合攒局外资源。",
    unlockCost: 220,
    accent: "#E58A5C",
    glow: "rgba(226,110,70,0.20)",
    beam: "rgba(238,150,90,0.12)",
    rules: [
      "敌人伤害 +8%",
      "战斗金币 +40%",
      "商店价格 -15%",
      "开局额外 30 以太"
    ],
    mods: {
      enemyDamageMul: 1.08,
      goldMul: 1.4,
      shopPriceMul: 0.85,
      startEtherBonus: 30
    }
  }
];

function getById(id) {
  var i;
  for (i = 0; i < THEMES.length; i += 1) {
    if (THEMES[i].id === id) return THEMES[i];
  }
  return null;
}

function ids() {
  return THEMES.map(function (theme) { return theme.id; });
}

/** 主题未解锁时显示的价格；已解锁返回 0 */
function unlockCostOf(id) {
  var theme = getById(id);
  return theme ? theme.unlockCost : 0;
}

module.exports = {
  THEMES: THEMES,
  getById: getById,
  ids: ids,
  unlockCostOf: unlockCostOf
};
