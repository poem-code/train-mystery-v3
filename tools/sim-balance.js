/**
 * sim-balance.js —— 批量模拟：不渲染，只跑逻辑，统计通关率与死亡点
 *
 * 用法：node tools/sim-balance.js [局数] [主题] [种子]
 *   例：node tools/sim-balance.js 1000 frost 20261111
 * 输出：通关率、平均到达层、各层死亡率、平均操作步数
 *
 * 种子是可选的，但**做「改前/改后」对比时一定要给**：
 * 同样 1000 局，不固定种子时同一份代码的通关率会在 43%—48.6% 之间跳，
 * 这个噪声比大多数改动本身还大，很容易把随机波动读成「改了有影响」。
 */

var stateApi = require("../js/game/state");
var mapApi = require("../js/game/map");
var rngApi = require("../js/game/rng");

var N = parseInt(process.argv[2], 10) || 300;
// 第二个参数指定车厢主题：node tools/sim-balance.js 300 frost
var THEME = process.argv[3] || "rust";
// 第三个参数：随机种子（可选）。给了就把三个随机源全部钉死，输出可复现
var SEED = parseInt(process.argv[4], 10) || 0;

if (SEED) {
  var randomState = SEED;
  Math.random = function () {
    randomState = (randomState * 1103515245 + 12345) % 2147483648;
    return randomState / 2147483648;
  };
  var fixedNow = 1793000000000;
  Date.now = function () { return fixedNow; };
  // rng 的全局实例在模块加载时就用真实时间播过种了，必须显式重播
  rngApi.reseed(SEED);
}

/** 模拟一个「会看血量的普通玩家」 */
function playRun(state, now) {
  stateApi.startRun(state, now);
  var guard = 0;
  var maxSteps = 800;

  while (state.run.active && guard < maxSteps) {
    guard += 1;
    var s = state;
    var modal = s.current.modal;

    if (modal === "battle") {
      var battle = s.run.battle;
      if (!battle) { state.current.modal = null; continue; }
      if (battle.over || s.player.hp <= 0) {
        if (s.player.inventory.retryCard > 0) {
          stateApi.battleAction(s, "retry");
        } else {
          stateApi.endRun(s, false, "阵亡");
        }
        continue;
      }
      // 策略：血 < 45 喝药；否则血量能撑住就强力，否则防御一回合
      if (s.player.hp < 45 && s.player.inventory.potion > 0) {
        stateApi.battleAction(s, "potion");
        continue;
      }
      var incoming = (battle.damageRange[0] + battle.damageRange[1]) / 2;
      if (s.player.hp <= incoming * 1.2 && battle.hp > 25) {
        stateApi.battleAction(s, "defend");
        continue;
      }
      stateApi.battleAction(s, battle.hp > 30 ? "power" : "precise");
      continue;
    }

    if (modal === "enhance") {
      var pending = s.run.pendingEnhancements || [];
      if (pending.length) {
        // 简单偏好：攻击/续航优先
        var pick = pending[0];
        var i;
        for (i = 0; i < pending.length; i += 1) {
          if (/攻击|续航/.test(pending[i].tag || "")) { pick = pending[i]; break; }
        }
        stateApi.chooseEnhancement(s, pick.id);
      } else {
        s.current.modal = null;
      }
      continue;
    }

    if (modal === "event") {
      // 选第一个能选的选项
      var event = require("../js/game/data/events").getById(s.run.eventId);
      var idx = 0;
      if (event) {
        var j;
        for (j = 0; j < event.choices.length; j += 1) {
          if (stateApi.canChooseEventOption(s, event.choices[j])) { idx = j; break; }
        }
      }
      stateApi.chooseEventOption(s, idx);
      continue;
    }

    if (modal === "eventResult") { stateApi.confirmEventResult(s); continue; }
    if (modal === "chest") { stateApi.confirmChest(s); continue; }
    if (modal === "camp") { stateApi.campRest(s); continue; }
    if (modal === "shop") {
      // 有钱就买药剂
      if (s.player.ether >= 24 && s.player.inventory.potion < 3) {
        stateApi.buyItem(s, "potion");
      }
      s.current.modal = null;
      continue;
    }
    if (modal === "summary") { s.current.modal = null; continue; }

    // 路线：优先营地 > 宝箱 > 商店 > 精英 > 战斗 > 事件
    var options = mapApi.available(s.run.layers, s.run.currentNodeId);
    if (!options.length) { stateApi.endRun(s, false, "无路可走"); continue; }
    var order = { camp: 0, chest: 1, shop: 2, elite: 3, battle: 4, event: 5, boss: 6 };
    options.sort(function (a, b) { return (order[a.type] || 9) - (order[b.type] || 9); });
    stateApi.travelTo(s, options[0].id);
  }

  return {
    cleared: state.run.completed,
    layer: state.run.layer,
    steps: guard
  };
}

var total = {
  runs: 0,
  cleared: 0,
  layerSum: 0,
  deathByLayer: {},
  stepsSum: 0
};

var i;
for (i = 0; i < N; i += 1) {
  var state = stateApi.createDefaultState(Date.now());
  // 每局之间清空局外成长，模拟「首通体验」
  state.player.potion = 2;
  if (THEME !== "rust") {
    state.progress.themeUnlocked.push(THEME);
    state.progress.themeSelected = THEME;
  }
  var result = playRun(state, Date.now() + i * 1000);
  total.runs += 1;
  if (result.cleared) total.cleared += 1;
  total.layerSum += result.layer;
  total.stepsSum += result.steps;
  if (!result.cleared) {
    var key = "L" + (result.layer + 1);
    total.deathByLayer[key] = (total.deathByLayer[key] || 0) + 1;
  }
}

console.log("车厢主题：" + THEME);
console.log("模拟局数：" + total.runs + (SEED ? "（种子 " + SEED + "）" : "（未固定种子，数字有 ±2pp 抖动）"));
console.log("通关率：" + ((total.cleared / total.runs) * 100).toFixed(1) + "%");
console.log("平均到达层：" + (total.layerSum / total.runs).toFixed(2) + " / 9");
console.log("平均操作步数：" + (total.stepsSum / total.runs).toFixed(1));
console.log("各层死亡分布：");
Object.keys(total.deathByLayer).sort(function (a, b) {
  return parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10);
}).forEach(function (key) {
  var count = total.deathByLayer[key];
  var bar = new Array(Math.round(count / total.runs * 60) + 1).join("█");
  console.log("  " + (key + "   ").slice(0, 5) + count + " 局  " + bar);
});
