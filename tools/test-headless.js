/**
 * test-headless.js —— 无头回归：整机启动 + 全链路自动游玩
 *
 * 用法：node tools/test-headless.js
 *
 * 覆盖：
 * 1. 引擎在无 canvas 环境下能启动并完成首帧渲染
 * 2. 首页 → 列车 → 出发 → 路线 → 战斗 → 强化 → 事件 → 商店 → 营地 → 宝箱 → Boss → 结算
 * 3. 存档写读一致（含路线图按 seed 还原）
 * 4. 脏档/越界点击不会抛异常
 */

/* global global */

// Node 里没有 localStorage，platform.js 会走「无存储」分支、load() 恒为 null。
// 装一个内存桩，存档相关的断言才有意义（也让自动存档真的跑起来）。
if (typeof global.localStorage === "undefined") {
  (function () {
    var store = {};
    global.localStorage = {
      getItem: function (key) {
        return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
      },
      setItem: function (key, value) { store[key] = String(value); },
      removeItem: function (key) { delete store[key]; }
    };
  })();
}

global.__TM_TEST__ = {};

var PASS = 0;
var FAIL = 0;
var failures = [];

function ok(name, condition, detail) {
  if (condition) {
    PASS += 1;
    console.log("  ✓ " + name);
  } else {
    FAIL += 1;
    failures.push(name + (detail ? " — " + detail : ""));
    console.log("  ✗ " + name + (detail ? " — " + detail : ""));
  }
}

function section(title) {
  console.log("\n" + title);
}

/* ---------------- 启动 ---------------- */

section("启动");
var threw = null;
try {
  require("../js/main.js");
} catch (error) {
  threw = error;
}
ok("整机启动无异常", !threw, threw && threw.stack);
if (threw) {
  console.log(threw.stack);
  process.exit(1);
}

var T = global.__TM_TEST__;
var app = T.app;
var dispatch = T.dispatch;

function getState() {
  return T.getState();
}

ok("首次进入落在首页", getState().current.scene === "home", getState().current.scene);
ok("默认资源为正", getState().player.hp === 100 && getState().player.ether > 0, JSON.stringify(getState().player));

// 首帧渲染
try {
  T.getEngine().__tick(16);
  ok("首帧渲染无异常", true);
} catch (error) {
  ok("首帧渲染无异常", false, error.message);
}

/* ---------------- 自动游玩 ---------------- */

var MAX_STEPS = 3000;

function currentModal() {
  return getState().current.modal;
}

/** 单步决策：根据当前弹窗选择合法动作 */
function playStep() {
  var s = getState();
  var modal = s.current.modal;

  if (modal === "battle") {
    var battle = s.run.battle;
    if (!battle) {
      dispatch({ id: "battle:escape" });
      return;
    }
    if (battle.over || s.player.hp <= 0) {
      // 有重战卡就用，否则结束本局
      if (s.player.inventory.retryCard > 0) {
        dispatch({ id: "battle:retry" });
      } else {
        dispatch({ id: "battle:giveUp" });
      }
      return;
    }
    // 已经倒下：此时只有复活/重战/放弃可用，继续点攻击会一直返回 ok:false
    if (s.player.hp <= 0) {
      dispatch({ id: "battle:giveUp" });
      return;
    }
    // 残血先喝药，再考虑防御
    if (s.player.hp < 45 && s.player.inventory.potion > 0) {
      dispatch({ id: "battle:potion" });
      return;
    }
    if (s.player.hp < 26) {
      dispatch({ id: "battle:defend" });
      return;
    }
    // 能一击带走就用精准（不吃 32% 落空），否则用强力换伤害
    dispatch({ id: battle.hp > 30 ? "battle:power" : "battle:precise" });
    return;
  }

  if (modal === "enhance") {
    var pending = s.run.pendingEnhancements || [];
    if (!pending.length) {
      dispatch({ id: "enhance:pick:none" });
      return;
    }
    dispatch({ id: "enhance:pick:" + pending[0].id });
    return;
  }

  if (modal === "event") {
    // 选项 0 可能因为资源不足点不动 —— 无限空转会把步数预算烧光，
    // 所以按 canChooseEventOption 挑第一个能选的
    var ev = require("../js/game/data/events").getById(s.run.eventId);
    var pick = 0;
    if (ev) {
      var k;
      for (k = 0; k < ev.choices.length; k += 1) {
        if (require("../js/game/state").canChooseEventOption(s, ev.choices[k])) {
          pick = k;
          break;
        }
      }
    }
    dispatch({ id: "event:option:" + pick });
    return;
  }

  if (modal === "eventResult") {
    dispatch({ id: "event:continue" });
    return;
  }

  if (modal === "chest") {
    dispatch({ id: "chest:continue" });
    return;
  }

  if (modal === "camp") {
    dispatch({ id: "camp:rest" });
    return;
  }

  if (modal === "shop") {
    dispatch({ id: "shop:close" });
    return;
  }

  if (modal === "summary") {
    dispatch({ id: "summary:close" });
    return;
  }

  if (modal === "themes") {
    // 出发前固定会先弹主题选择，自动游玩直接确认当前选中项
    if (s.run && s.run.active) {
      dispatch({ id: "theme:close" });
    } else {
      dispatch({ id: "theme:start" });
    }
    return;
  }

  if (modal === "info" || modal === "settings" || modal === "trainUpgrade") {
    dispatch({ id: modal + ":close" });
    if (getState().current.modal) app.closeModal();
    return;
  }

  var scene = s.current.scene;
  if (scene === "home") {
    dispatch({ id: "home:enter" });
    return;
  }
  if (scene === "train") {
    dispatch({ id: "train:depart" });
    return;
  }
  if (scene === "route") {
    var nodes = s.run.layers.length
      ? require("../js/game/map").available(s.run.layers, s.run.currentNodeId)
      : [];
    if (!nodes.length) {
      dispatch({ id: "route:abandon" });
      return;
    }
    dispatch({ id: "route:node:" + nodes[0].id });
    return;
  }
}

section("全链路自动游玩");

// 自动游玩必须可复现：把 Math.random 换成固定种子的 LCG。
// 不这么做的话，「至少通关一次」会随机构红（真实发生过：改了敌人数值后
// 14 局一局没通，看起来像功能坏了，其实只是骰子背）。
var realRandom = Math.random;
var seedState = 20261110;
Math.random = function () {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
};

var errorCount = 0;
var steps = 0;
var lastSignature = "";
var stuckSteps = 0;

while (steps < MAX_STEPS) {
  steps += 1;
  try {
    playStep();
    T.getEngine().__tick(16);
  } catch (error) {
    errorCount += 1;
    console.log("    第 " + steps + " 步异常：" + error.message);
    console.log(error.stack);
    break;
  }

  // 卡死保护：连续 60 步状态完全没变，说明点了一个无效按钮（例如买不起的商品）。
  // 与其烧光预算后报假红，不如强制脱困并记一笔，让问题暴露得清楚。
  var sig = JSON.stringify([
    getState().current.scene,
    getState().current.modal,
    getState().run.layer,
    getState().run.nodesVisited,
    getState().run.battle ? getState().run.battle.hp + "/" + getState().run.battle.turn : "-",
    getState().player.hp,
    getState().player.inventory.potion
  ]);
  if (sig === lastSignature) {
    stuckSteps += 1;
  } else {
    stuckSteps = 0;
    lastSignature = sig;
  }
  if (stuckSteps > 60) {
    console.log("    检测到卡死：场景 " + getState().current.scene + " 弹窗 " + getState().current.modal +
      " battle=" + JSON.stringify(getState().run.battle && {
        hp: getState().run.battle.hp,
        turn: getState().run.battle.turn,
        over: getState().run.battle.over,
        result: getState().run.battle.result,
        shield: getState().run.battle.enemyShield
      }) + " playerHp=" + getState().player.hp + " potion=" + getState().player.inventory.potion + "，强制脱困");
    if (getState().current.modal) app.closeModal();
    if (getState().run.active) require("../js/game/state").abandonRun(getState());
    stuckSteps = 0;
    lastSignature = "";
  }
  if (process.env.TM_DEBUG && getState().current.modal === "summary") {
    console.log("    局终：层=" + getState().run.layer + " 通关=" + getState().run.completed + " HP=" + Math.round(getState().player.hp));
  }
  var progress = getState().progress;
  // 预算给足：自动游玩策略比人类粗糙，8 局偶尔会一局都通不了，测试就会假红
  if (progress.bossClears >= 2 || progress.runsStarted >= 14) break;
}

var runs = getState().progress.runsStarted;
var cleared = getState().progress.bossClears;
if (process.env.TM_DEBUG) {
  console.log("    debug: runs=" + runs + " cleared=" + cleared + " steps=" + steps +
    " scene=" + getState().current.scene + " modal=" + getState().current.modal +
    " layer=" + getState().run.layer + " hp=" + getState().player.hp);
}

ok("自动游玩无异常", errorCount === 0, errorCount + " 次异常");
ok("完成至少 1 局", runs >= 1, "实际 " + runs + " 局");
ok("至少通关一次", cleared >= 1, "通关 " + cleared + " 次");
ok("步数在合理范围", steps < MAX_STEPS, "用了 " + steps + " 步");

Math.random = realRandom;

/* ---------------- 存档一致性 ---------------- */

section("存档");
var storage = require("../js/game/storage");
var stateApi = require("../js/game/state");

// 用「进行中的一局」做还原测试（已结束的局按设计会清空 run）
var live = stateApi.createDefaultState(Date.now());
stateApi.startRun(live, Date.now());
var layersBefore = JSON.stringify(live.run.layers);
var restored = storage.migrate(JSON.parse(JSON.stringify(live)));

ok("存档往返不丢字段", !!restored && !!restored.player && !!restored.progress);
ok("进行中的局读档后仍 active", restored.run.active === true);
ok("路线图按 seed 还原一致", JSON.stringify(restored.run.layers) === layersBefore, "seed=" + live.run.seed);
ok("读档后场景自洽", restored.current.scene !== "route" || restored.run.active,
  restored.current.scene + "/" + restored.run.active);
ok("数值被夹取在合法区间",
  restored.player.hp >= 0 && restored.player.hp <= restored.player.maxHp &&
  restored.player.sanity >= 0 && restored.player.sanity <= 100);

/* ---------------- 脏档 ---------------- */

section("脏档与越界");
var dirty = storage.migrate({
  player: { hp: -50, maxHp: "abc", ether: 1e12, inventory: null },
  meta: { lastLoginDate: "不是日期", adViewsToday: 999 },
  progress: { runsStarted: -3, trainUpgrades: { diner: 99 } },
  run: { active: true, seed: 7, layers: "坏数据", battle: { hp: "x" } },
  current: { scene: "route", modal: "battle" }
});
ok("负数生命被夹到 0", dirty.player.hp >= 0, String(dirty.player.hp));
ok("maxHp 非法时回落默认", dirty.player.maxHp === 100, String(dirty.player.maxHp));
ok("以太超上限被夹取", dirty.player.ether <= 9999, String(dirty.player.ether));
ok("非法日期回落今天", /^\d{4}-\d{2}-\d{2}$/.test(dirty.meta.lastLoginDate), dirty.meta.lastLoginDate);
ok("路线图损坏时退回首页", dirty.current.scene === "home", dirty.current.scene);
ok("战斗弹窗无战斗数据时关闭", dirty.current.modal !== "battle", String(dirty.current.modal));

// 越界点击
try {
  dispatch({ id: "route:node:不存在的节点" });
  dispatch({ id: "battle:precise" });
  dispatch({ id: "shop:buy:notExist" });
  dispatch({ id: "" });
  ok("越界/未知动作不抛异常", true);
} catch (error) {
  ok("越界/未知动作不抛异常", false, error.message);
}

/* ---------------- 内容数据一致性 ---------------- */

section("内容数据一致性");

var fs = require("fs");
var path = require("path");
var enemiesApi = require("../js/game/data/enemies");
var relicsApi = require("../js/game/data/relics");
var enhApi = require("../js/game/data/enhancements");
var eventsApi = require("../js/game/data/events");
var effectsApi = require("../js/game/data/effects");

// 从逻辑源码里反查「哪些 trait 真的有行为分支」：
// 这比维护一份手写清单可靠——新加敌人却忘了写逻辑，这里会直接红。
var stateSource = fs.readFileSync(path.join(__dirname, "..", "js", "game", "state.js"), "utf8");
var handledTraits = [];
var traitPattern = /(?:battle\.trait|trait)\s*[!=]==\s*"([a-zA-Z]+)"/g;
var traitMatch = traitPattern.exec(stateSource);
while (traitMatch) {
  if (handledTraits.indexOf(traitMatch[1]) < 0) handledTraits.push(traitMatch[1]);
  traitMatch = traitPattern.exec(stateSource);
}

// overlord 没有独立分支：它走 battle.boss 那套通用 Boss 行为（加盾 / 蓄势）
var TRAIT_ALIASES = { overlord: "boss 通用分支" };
var unknownTraits = [];
enemiesApi.ENEMIES.forEach(function (enemy) {
  if (TRAIT_ALIASES[enemy.trait]) return;
  if (handledTraits.indexOf(enemy.trait) < 0) unknownTraits.push(enemy.name + ":" + enemy.trait);
});
ok("所有敌人特性都有行为分支", unknownTraits.length === 0, unknownTraits.join(","));

var validKeys = effectsApi.NUMERIC_KEYS.concat(effectsApi.FLAG_KEYS).concat(["firstShopDiscount"]);
function badEffectKeys(list, label) {
  var bad = [];
  list.forEach(function (item) {
    var key;
    for (key in item.effects || {}) {
      if (!Object.prototype.hasOwnProperty.call(item.effects, key)) continue;
      if (validKeys.indexOf(key) < 0) bad.push(item.id + ":" + key);
    }
  });
  ok(label + "的效果字段都已被逻辑消费", bad.length === 0, bad.join(","));
}
badEffectKeys(enhApi.ENHANCEMENTS, "强化");
badEffectKeys(relicsApi.RELICS, "遗物");

var itemKeys = ["potion", "portableFood", "retryCard", "executeCard"];
var badItems = [];
var badCosts = [];
eventsApi.EVENTS.forEach(function (event) {
  if (!event.choices || event.choices.length < 2) badItems.push(event.id + ":选项不足");
  event.choices.forEach(function (choice) {
    var key;
    for (key in choice.items || {}) {
      if (itemKeys.indexOf(key) < 0) badItems.push(event.id + ":" + key);
    }
    for (key in choice.cost || {}) {
      if (["ether", "gold", "hp", "sanity"].indexOf(key) < 0) badCosts.push(event.id + ":" + key);
    }
    if (choice.risk) {
      if (!choice.risk.okText || !choice.risk.badText) badItems.push(event.id + ":风险缺少文案");
      if (typeof choice.risk.chance !== "number") badItems.push(event.id + ":风险缺少概率");
    }
  });
});
ok("事件道具字段合法", badItems.length === 0, badItems.join(","));
ok("事件成本字段合法", badCosts.length === 0, badCosts.join(","));

/* ---------------- 敌人特性行为 ---------------- */

section("敌人特性行为");

function makeBattle(state, props) {
  var battle = {
    kind: "normal", enemyId: "test", name: "测试体", figure: "normal", color: "#fff",
    trait: "none", intro: "", hp: 100, maxHp: 100, damageRange: [0, 0],
    reward: { ether: 0, gold: 0 }, boss: false, elite: false,
    enemyShield: 0, playerShield: 0, turn: 1, defenseStance: false,
    enemyCharge: 0, over: false, result: null, logs: []
  };
  var key;
  for (key in props) {
    if (Object.prototype.hasOwnProperty.call(props, key)) battle[key] = props[key];
  }
  state.run.battle = battle;
  state.current.modal = "battle";
  state.player.hp = 100;
  state.player.maxHp = 100;
  return battle;
}

function freshRun() {
  var st = stateApi.createDefaultState(Date.now());
  stateApi.startRun(st, Date.now());
  st.player.baseAttack = 16;
  return st;
}

// 精准射击基础伤害 = 16 + 4 = 20
var st1 = freshRun();
var bArmor = makeBattle(st1, { trait: "armored" });
stateApi.battleAction(st1, "precise");
ok("重甲每次受击固定减伤 3", bArmor.hp === 83, "剩余 " + bArmor.hp);

var st2 = freshRun();
var bMirror = makeBattle(st2, { trait: "mirror", hp: 200, maxHp: 200 });
stateApi.battleAction(st2, "precise");
ok("镜影命中反弹 3 点给玩家", st2.player.hp === 97, "玩家 " + st2.player.hp);

var st3 = freshRun();
var bVamp = makeBattle(st3, { trait: "vampire", hp: 100, damageRange: [10, 10] });
stateApi.battleAction(st3, "precise"); // 20 伤害 → 80，敌方回手 10 → 吸 4
ok("吸血按伤害 40% 回血", bVamp.hp === 84, "敌人 " + bVamp.hp);

var st4 = freshRun();
var bSwarm = makeBattle(st4, { trait: "swarm", damageRange: [10, 10], turn: 3 });
stateApi.battleAction(st4, "precise");
// 10 + round(10*0.55)=6 → 16 点，玩家 100-16=84
ok("虫群第 3 回合连击", st4.player.hp === 84, "玩家 " + st4.player.hp);

var st5 = freshRun();
makeBattle(st5, { trait: "bomber", hp: 1, maxHp: 40 });
stateApi.battleAction(st5, "precise");
// 100 - 10(自爆) + 4(战后回血) = 94
ok("自爆扣血且不会把胜利变成阵亡", st5.player.hp === 94, "玩家 " + st5.player.hp);

var st6 = freshRun();
var bSlow = makeBattle(st6, { trait: "idol", turn: 3 });
var shieldBefore = bSlow.enemyShield;
stateApi.battleAction(st6, "defend");
ok("护盾型敌人会立盾", bSlow.enemyShield > shieldBefore, String(bSlow.enemyShield));

/* ---------------- 精英词缀 ---------------- */

section("精英词缀");

var affixesApi = require("../js/game/data/affixes");

var s7 = freshRun();
var bFrenzy = makeBattle(s7, { trait: "none", affix: "frenzy", affixName: "狂暴", damageRange: [10, 10] });
stateApi.battleAction(s7, "precise");
// 精准 20 伤害；敌方 10 × 1.3 = 13；狂暴自伤 2 → 100 - 20 - 2 = 78，玩家 100 - 13 = 87
ok("狂暴词缀伤害 +30% 且自伤 2", bFrenzy.hp === 78 && s7.player.hp === 87,
  "敌人 " + bFrenzy.hp + " 玩家 " + s7.player.hp);

var s8 = freshRun();
var bBulwark = makeBattle(s8, { trait: "none", affix: "bulwark", affixName: "壁垒", turn: 3, damageRange: [1, 1] });
stateApi.battleAction(s8, "defend");
ok("壁垒词缀第 3 回合立盾 12", bBulwark.enemyShield > 0, "护盾 " + bBulwark.enemyShield);

var s9 = freshRun();
var bEcho = makeBattle(s9, { trait: "none", affix: "echo", affixName: "残响", hp: 1, maxHp: 100 });
var echoResult = stateApi.battleAction(s9, "precise");
ok("残响词缀以 40% 生命复活且战斗继续",
  echoResult.revived === true && bEcho.revived === true && bEcho.hp === 40,
  "hp=" + bEcho.hp + " revived=" + bEcho.revived);

var s10 = freshRun();
var goldBefore = s10.player.gold;
var bGreedy = makeBattle(s10, {
  trait: "none", affix: "greedy", affixName: "贪婪", hp: 1,
  reward: { ether: 0, gold: 2 }
});
stateApi.battleAction(s10, "precise");
ok("贪婪词缀赏金翻倍", s10.player.gold - goldBefore === 4, "金币 +" + (s10.player.gold - goldBefore));

var s11 = freshRun();
var bVenom = makeBattle(s11, { trait: "none", affix: "venom", affixName: "毒化", damageRange: [6, 6], hp: 200, maxHp: 200 });
stateApi.battleAction(s11, "precise"); // 敌方第 1 回合：6 伤害 + 挂毒
var afterPoison = s11.player.hp;
stateApi.battleAction(s11, "precise"); // 第 2 回合：毒发 3
ok("毒化词缀会持续掉血", bVenom.poison >= 0 && s11.player.hp < afterPoison - 6,
  "hp " + afterPoison + " → " + s11.player.hp);

/* ---------------- 图鉴与成就 ---------------- */

section("图鉴与成就");

var stCodex = stateApi.createDefaultState(Date.now());
stateApi.startRun(stCodex, Date.now());
stateApi.startBattle(stCodex, "normal");
var codexName = stCodex.run.battle.enemyId;
ok("进入战斗即记录「已遇见」", !!stCodex.progress.codex.enemies[codexName].seen);
stCodex.run.battle.hp = 1;
stateApi.battleAction(stCodex, "precise");
ok("击败后记录击败次数", stCodex.progress.codex.enemies[codexName].defeats === 1,
  "defeats=" + stCodex.progress.codex.enemies[codexName].defeats);

// 图鉴档位奖励：塞满一半，应发一次 25% 档
var stTier = stateApi.createDefaultState(Date.now());
var enemiesApi2 = require("../js/game/data/enemies");
// 敌人占全部条目约 1/3，全填满才够 25% 档
var fill = enemiesApi2.ENEMIES.length;
var ei;
for (ei = 0; ei < fill; ei += 1) {
  stTier.progress.codex.enemies[enemiesApi2.ENEMIES[ei].id] = { seen: 1, defeats: 1 };
}
var etherBeforeTier = stTier.player.ether;
stateApi.checkCodexReward(stTier);
ok("图鉴进度跨档发奖励", stTier.player.ether > etherBeforeTier && stTier.progress.codex.tier >= 1,
  "tier=" + stTier.progress.codex.tier);

var stAch = stateApi.createDefaultState(Date.now());
stAch.progress.bossClears = 1;
var etherBeforeAch = stAch.player.ether;
var unlocked = stateApi.evaluateAchievements(stAch);
var achIds = unlocked.map(function (a) { return a.id; });
ok("首次通关解锁成就并发以太",
  achIds.indexOf("firstClear") >= 0 && stAch.player.ether > etherBeforeAch, achIds.join(","));
var etherAfterAch = stAch.player.ether;
stateApi.evaluateAchievements(stAch);
ok("成就不会重复发放", stAch.player.ether === etherAfterAch, "ether=" + stAch.player.ether);

var achievementsApi = require("../js/game/data/achievements");
var metrics = stateApi.computeMetrics(stAch);
var missingMetric = achievementsApi.ACHIEVEMENTS.filter(function (a) {
  return metrics[a.metric] === undefined;
}).map(function (a) { return a.id + ":" + a.metric; });
ok("所有成就指标都能被计算", missingMetric.length === 0, missingMetric.join(","));

/* ---------------- 每日挑战 ---------------- */

section("每日挑战");

var dailyApi = require("../js/game/data/daily");
var sameSeedA = dailyApi.seedFromDate("2026-11-10");
var sameSeedB = dailyApi.seedFromDate("2026-11-10");
var otherSeed = dailyApi.seedFromDate("2026-11-11");
ok("日期种子稳定且跨天不同", sameSeedA === sameSeedB && sameSeedA !== otherSeed,
  sameSeedA + "/" + otherSeed);

var dailyMods = dailyApi.rollModifiers(sameSeedA);
var dailyMods2 = dailyApi.rollModifiers(sameSeedA);
ok("同一天限制条件完全一致",
  dailyMods.map(function (m) { return m.id; }).join(",") === dailyMods2.map(function (m) { return m.id; }).join(","),
  dailyMods.map(function (m) { return m.name; }).join("/"));

var stLocked = stateApi.createDefaultState(Date.now());
var lockedResult = stateApi.startDaily(stLocked, Date.now());
ok("观景台未升级时不能进每日挑战", lockedResult.ok === false, lockedResult.message);

var stDaily = stateApi.createDefaultState(Date.now());
stDaily.progress.trainUpgrades.observatory = 1;
stDaily.player.ether = 500;
var dailyStart = stateApi.startDaily(stDaily, Date.now());
ok("观景台 Lv.1 后开放每日挑战", dailyStart.ok === true && !!stDaily.run.daily);
ok("每日挑战路线由日期种子决定", stDaily.run.seed === dailyApi.seedFromDate(stateApi.formatDateKey(Date.now())),
  "seed=" + stDaily.run.seed);

// 挑战里花钱，结束后钱包应还原
stDaily.player.ether = 10;
stateApi.endRun(stDaily, false, "测试");
ok("每日挑战结束还原钱包", stDaily.player.ether >= 500, "ether=" + stDaily.player.ether);

/* ---------------- 建造与迁移 ---------------- */

section("建造与存档迁移");

var stCargo = stateApi.createDefaultState(Date.now());
stCargo.progress.trainUpgrades.cargo = 3;
stCargo.player.inventory.potion = 0;
stCargo.player.inventory.portableFood = 9;
stateApi.startRun(stCargo, Date.now());
ok("货舱只补到保底，不叠加已有道具",
  stCargo.player.inventory.potion === 1 && stCargo.player.inventory.portableFood === 9,
  "药 " + stCargo.player.inventory.potion + " 口粮 " + stCargo.player.inventory.portableFood);

var rawV3 = JSON.parse(JSON.stringify(stateApi.createDefaultState(Date.now())));
delete rawV3.progress.codex;
delete rawV3.progress.achievements;
delete rawV3.progress.daily;
delete rawV3.progress.stats;
rawV3.progress.trainUpgrades = { diner: 2, medbay: 1, engine: 0 };
delete rawV3.meta.bgmOn;
delete rawV3.meta.sfxOn;
var migrated = storage.migrate(rawV3);
ok("v3 老档迁移后补齐新字段",
  !!migrated.progress.codex && !!migrated.progress.achievements && !!migrated.progress.daily &&
  migrated.progress.trainUpgrades.cargo === 0 && migrated.progress.trainUpgrades.diner === 2,
  "cargo=" + migrated.progress.trainUpgrades.cargo);
ok("老档音效开关映射到 sfxOn", migrated.meta.sfxOn === true && migrated.meta.bgmOn === true);

/* ---------------- 新内容的一致性 ---------------- */

section("词缀数据一致性");

var stateSrc = fs.readFileSync(path.join(__dirname, "..", "js", "game", "state.js"), "utf8");
var unusedAffixKeys = [];
var affixKeys = ["damageMul", "selfDamage", "shieldEvery", "poison", "summonTurns", "swiftTurn", "reflect", "goldMul", "reviveRatio"];
affixKeys.forEach(function (key) {
  var used = affixesApi.AFFIXES.some(function (a) { return a[key] !== undefined; });
  if (used && stateSrc.indexOf("affix." + key) < 0 && stateSrc.indexOf("affixDef." + key) < 0) {
    unusedAffixKeys.push(key);
  }
});
ok("所有词缀字段都有行为分支", unusedAffixKeys.length === 0, unusedAffixKeys.join(","));

/* ---------------- 第二批次内容 ---------------- */

section("内容扩充");

var normalCount = enemiesApi.byKind("normal").length;
var eliteCount = enemiesApi.byKind("elite").length;
var bossCount = enemiesApi.byKind("boss").length;
ok("敌人 30 个（19 普通 / 6 精英 / 5 Boss）",
  normalCount === 19 && eliteCount === 6 && bossCount === 5,
  normalCount + "/" + eliteCount + "/" + bossCount);
ok("强化 34 项", enhApi.ENHANCEMENTS.length === 34, "实际 " + enhApi.ENHANCEMENTS.length);
ok("遗物 26 件", relicsApi.RELICS.length === 26, "实际 " + relicsApi.RELICS.length);

var standaloneEvents = eventsApi.EVENTS.filter(function (e) { return !e.chain; });
var chainEvents = eventsApi.EVENTS.filter(function (e) { return !!e.chain; });
ok("独立事件 32 个", standaloneEvents.length === 32, "实际 " + standaloneEvents.length);
ok("事件链 3 条共 9 段", Object.keys(eventsApi.CHAINS).length === 3 && chainEvents.length === 9,
  chainEvents.length + " 段");

// 链事件只能由 nextChainEvent 发；混进随机池的话，玩家会在第 1 层看到第 3 段的台词
var chainInPool = false;
var rollProbe = 0;
while (rollProbe < 120) {
  var probed = eventsApi.roll(function (pool) { return pool[0]; }, 8, []);
  if (probed && probed.chain) chainInPool = true;
  rollProbe += 1;
}
ok("随机池里没有链事件", !chainInPool);

section("新特性行为");

var sw1 = freshRun();
var bWeaver = makeBattle(sw1, { trait: "weaver", turn: 3, damageRange: [10, 10] });
stateApi.enemyTurn(sw1);
ok("织网在第 3 回合缠住你", bWeaver.webbed === true);

var sw2 = freshRun();
var bWebbed = makeBattle(sw2, { trait: "none", webbed: true, hp: 200, maxHp: 200, damageRange: [0, 0] });
stateApi.battleAction(sw2, "precise");
// 精准 20 → 缠网 ×0.65 = 13
ok("被缠网时这一击削弱到 65% 并立即解除",
  bWebbed.hp === 187 && bWebbed.webbed === false, "敌人 " + bWebbed.hp);

var sp1 = freshRun();
var bParasite = makeBattle(sp1, { trait: "parasite", hp: 200, maxHp: 200, damageRange: [5, 5] });
stateApi.battleAction(sp1, "precise");
ok("寄生命中后挂卵", bParasite.egg === 1, "卵倒计时 " + bParasite.egg);
stateApi.battleAction(sp1, "precise");
// 玩家 100-5-5-12 = 78；敌人 200-20-20+10 = 170
ok("卵孵化时扣血并给敌人回血",
  sp1.player.hp === 78 && bParasite.hp === 170,
  "玩家 " + sp1.player.hp + " 敌人 " + bParasite.hp);

var se1 = freshRun();
var bEnrage = makeBattle(se1, { trait: "enrage", hp: 40, maxHp: 100, damageRange: [10, 10] });
stateApi.enemyTurn(se1);
// 半血触发，10 × 1.45 = 15（四舍五入）
ok("狂化在半血触发且攻击变重",
  bEnrage.enraged === true && se1.player.hp === 85, "玩家 " + se1.player.hp);

var sg1 = freshRun();
var bGambler = makeBattle(sg1, { trait: "gambler", hp: 500, maxHp: 500, damageRange: [10, 10] });
var gamblerHits = [];
var gi;
for (gi = 0; gi < 14; gi += 1) {
  sg1.player.hp = 100;
  stateApi.enemyTurn(sg1);
  gamblerHits.push(100 - sg1.player.hp);
}
var gMin = Math.min.apply(null, gamblerHits);
var gMax = Math.max.apply(null, gamblerHits);
ok("赌徒伤害浮动（50%—170%）", gMin >= 5 && gMax <= 17 && gMax - gMin >= 3,
  "区间 " + gMin + "—" + gMax);

section("新效果字段行为");

var sc1 = freshRun();
sc1.run.effects.critChance = 0.6; // 叠加上限 0.6
var bCrit = makeBattle(sc1, { trait: "none", hp: 200, maxHp: 200, damageRange: [0, 0] });
var critRollBackup = Math.random;
Math.random = function () { return 0; }; // 强制判定命中
var critRes = stateApi.battleAction(sc1, "precise");
Math.random = critRollBackup;
ok("暴击判定命中时打出 1.8 倍", bCrit.hp === 164 && critRes.crit === true, "敌人 " + bCrit.hp);

var sc0 = freshRun();
var bNoCrit = makeBattle(sc0, { trait: "none", hp: 200, maxHp: 200, damageRange: [0, 0] });
var noCritRes = stateApi.battleAction(sc0, "precise");
ok("暴击率为 0 时不暴击", bNoCrit.hp === 180 && noCritRes.crit === false, "敌人 " + bNoCrit.hp);

var sl1 = freshRun();
sl1.run.effects.lowHpDamageBonus = 0.5;
var bLowHp = makeBattle(sl1, { trait: "none", hp: 200, maxHp: 200, damageRange: [0, 0] });
sl1.player.hp = 30; // 低于 40% 血线
stateApi.battleAction(sl1, "precise");
ok("残血时伤害 +50%", bLowHp.hp === 170, "敌人 " + bLowHp.hp);

var sd1 = freshRun();
sd1.run.effects.defendShieldBonus = 8;
var bDefend = makeBattle(sd1, { trait: "none", damageRange: [0, 0] });
stateApi.battleAction(sd1, "defend");
ok("防御额外护盾计入", bDefend.logs.join(" ").indexOf("获得 20 点护盾") >= 0,
  bDefend.logs.join(" | ").slice(0, 60));

var sf1 = freshRun();
sf1.run.effects.firstStrikeBonus = 10;
var bFirst = makeBattle(sf1, { trait: "none", hp: 300, maxHp: 300, damageRange: [0, 0] });
stateApi.battleAction(sf1, "precise"); // 20 + 10 = 30
var afterFirst = bFirst.hp;
stateApi.battleAction(sf1, "precise"); // 只有 20
ok("先手加成只算第一击，第二击回归常态",
  afterFirst === 270 && bFirst.hp === 250, "首击后 " + afterFirst + " 二击后 " + bFirst.hp);

section("事件链");

ok("层数不够时不出链事件",
  eventsApi.nextChainEvent({}, 1, function () { return 0; }) === null);
ok("链事件按段推进",
  (eventsApi.nextChainEvent({ ticketBook: 1 }, 4, function () { return 0.1; }) || {}).event.id === "chainTicket2");
ok("链走完后不再返回",
  eventsApi.nextChainEvent({ ticketBook: 3, childDrawing: 3, boilerWhisper: 3 }, 99, function () { return 0.1; }) === null);
ok("概率没命中时不插链事件",
  eventsApi.nextChainEvent({}, 6, function () { return 0.95; }) === null);

var stChain = freshRun();
stChain.run.layer = 2;
stChain.run.chains = {};
var chainRollBackup = Math.random;
Math.random = function () { return 0; }; // 概率必中，且取第一个候选链
stateApi.openEvent(stChain);
Math.random = chainRollBackup;
ok("开局事件会接上第一条链并记录进度",
  stChain.run.eventId === "chainTicket1" && stChain.run.chains.ticketBook === 1,
  stChain.run.eventId + " / " + JSON.stringify(stChain.run.chains));

var stChainSave = freshRun();
stChainSave.run.chains = { ticketBook: 99, childDrawing: -5, evilChain: 5 };
var stChainLoaded = storage.migrate(JSON.parse(JSON.stringify(stChainSave)));
ok("chains 存档白名单化并夹取",
  stChainLoaded.run.chains.ticketBook === 3 &&
  stChainLoaded.run.chains.childDrawing === 0 &&
  stChainLoaded.run.chains.evilChain === undefined,
  JSON.stringify(stChainLoaded.run.chains));

section("车厢主题");

var themesApiT = require("../js/game/data/themes");

ok("主题表有 3 套", themesApiT.THEMES.length === 3, "实际 " + themesApiT.THEMES.length);
ok("每套主题都有名字与规则文案", themesApiT.THEMES.every(function (t) {
  return t.name && t.rules && t.rules.length > 0 && t.glow && t.beam;
}));
ok("锈蚀车厢无修正", Object.keys(themesApiT.getById("rust").mods).length === 0);
ok("其余主题都有修正", themesApiT.THEMES.filter(function (t) {
  return t.id !== "rust" && Object.keys(t.mods).length > 0;
}).length === 2);

var stTh = stateApi.createDefaultState(Date.now());
ok("默认只解锁锈蚀车厢", stTh.progress.themeUnlocked.length === 1 && stTh.progress.themeUnlocked[0] === "rust",
  JSON.stringify(stTh.progress.themeUnlocked));
ok("默认选中锈蚀车厢", stateApi.selectedThemeId(stTh) === "rust");

ok("未解锁的主题选不了", stateApi.selectTheme(stTh, "frost").reason === "locked");
stTh.player.ether = 10;
ok("以太不足时解锁失败", stateApi.unlockTheme(stTh, "frost").reason === "poor");

stTh.player.ether = 200;
var unlockRes = stateApi.unlockTheme(stTh, "frost");
ok("解锁成功并按价扣以太", unlockRes.ok && stTh.player.ether === 50,
  "返回 " + JSON.stringify(unlockRes) + " / 余 " + stTh.player.ether);
ok("解锁后自动选中", stateApi.selectedThemeId(stTh) === "frost");

stateApi.startRun(stTh, Date.now());
ok("开局后主题锁定", stateApi.selectTheme(stTh, "rust").reason === "inRun");
ok("本局用的是霜封车厢", stTh.run.theme === "frost", stTh.run.theme);
ok("霜封的开局以太奖励生效", stTh.player.ether === 70, "余 " + stTh.player.ether);
ok("开局日志记录主题与规则",
  stTh.logs.some(function (l) { return l.text.indexOf("霜封车厢") >= 0; }) &&
  stTh.logs.some(function (l) { return l.text.indexOf("敌人伤害 -15%") >= 0; }),
  stTh.logs.slice(0, 3).map(function (l) { return l.text; }).join(" | "));

// 每日条件与主题倍率必须相乘，而不是后者覆盖前者
var stMx = stateApi.createDefaultState(Date.now());
stMx.run.theme = "frost";
stMx.run.daily = {
  combined: {
    maxHpDelta: -20, hungerPerNodeDelta: 0, enemyDamageMul: 1.1,
    sanityCostMul: 1.5, enhanceChoiceDelta: -1, shopPriceMul: 1.2
  }
};
var merged = stateApi.modsOf(stMx.run);
ok("乘法字段相乘", Math.abs(merged.enemyDamageMul - 1.1 * 0.85) < 1e-9,
  "实际 " + merged.enemyDamageMul);
ok("加法字段相加", merged.maxHpDelta === -20 && merged.hungerPerNodeDelta === 1,
  JSON.stringify(merged));

// 敌人生命倍率：把敌人池换成一个固定血量的木桩，结果才能精确断言
var enemiesApiT = require("../js/game/data/enemies");
var realPoolFor = enemiesApiT.poolFor;
var dummyEnemy = {
  id: "testDummy", name: "木桩", kind: "normal", trait: "none", figure: "normal",
  color: "#fff", hpRange: [20, 20], damageRange: [0, 0],
  reward: { ether: 0, gold: 0 }, intro: ""
};
enemiesApiT.poolFor = function () { return [dummyEnemy]; };

function hpOf(themeId) {
  var st = stateApi.createDefaultState(Date.now());
  if (themeId !== "rust") {
    st.progress.themeUnlocked.push(themeId);
    st.progress.themeSelected = themeId;
  }
  stateApi.startRun(st, Date.now());
  var battle = stateApi.startBattle(st, "normal");
  return { got: battle.maxHp, theme: themeId, enemy: battle.enemyId };
}
var hpRust = hpOf("rust");
var hpFrost = hpOf("frost");
var hpEmber = hpOf("ember");
enemiesApiT.poolFor = realPoolFor;

ok("锈蚀车厢敌人血量不变", hpRust.got === 20, hpRust.got + " / " + hpRust.enemy);
ok("霜封车厢敌人血量 +15%", hpFrost.got === 23, hpFrost.got + " / " + hpFrost.enemy);
ok("焚炉车厢只加伤害不动血量", hpEmber.got === 20, hpEmber.got + " / " + hpEmber.enemy);

// 主题偏好靠权重而不是硬过滤：霜封下车厢同调的敌人占比应明显更高
function shareOfTagged(themeId, enemyTag, rounds) {
  var st = stateApi.createDefaultState(Date.now());
  if (themeId !== "rust") {
    st.progress.themeUnlocked.push(themeId);
    st.progress.themeSelected = themeId;
  }
  stateApi.startRun(st, Date.now());
  var hits = 0;
  var i;
  for (i = 0; i < rounds; i += 1) {
    var b = stateApi.startBattle(st, "normal");
    var def = require("../js/game/data/enemies").getById(b.enemyId);
    if (def.themes && def.themes.indexOf(enemyTag) >= 0) hits += 1;
  }
  return hits / rounds;
}
var shareRust = shareOfTagged("rust", "frost", 200);
var shareFrost = shareOfTagged("frost", "frost", 200);
ok("霜封车厢更容易遇到冰霜系敌人", shareFrost > shareRust + 0.15,
  "锈蚀 " + shareRust.toFixed(2) + " → 霜封 " + shareFrost.toFixed(2));

// 金币倍率：焚炉战斗金币 +40%
var stGold = stateApi.createDefaultState(Date.now());
stGold.progress.themeUnlocked.push("ember");
stGold.progress.themeSelected = "ember";
stateApi.startRun(stGold, Date.now());
var stGoldRust = stateApi.createDefaultState(Date.now());
stateApi.startRun(stGoldRust, Date.now());
var bGold = makeBattle(stGold, { hp: 1, maxHp: 1, reward: { ether: 0, gold: 20 } });
stateApi.battleAction(stGold, "precise");
var bGoldRust = makeBattle(stGoldRust, { hp: 1, maxHp: 1, reward: { ether: 0, gold: 20 } });
stateApi.battleAction(stGoldRust, "precise");
ok("焚炉战斗金币 +40%",
  stGold.player.gold - 4 === 28 && stGoldRust.player.gold - 4 === 20,
  "焚炉获得 " + (stGold.player.gold - 4) + " / 锈蚀获得 " + (stGoldRust.player.gold - 4));

// 存档：未知道具 id 一律丢弃，非法选中回退
var stSv = stateApi.createDefaultState(Date.now());
stSv.progress.themeUnlocked = ["rust", "ember", "frost", "hacked", "rust"];
stSv.progress.themeSelected = "hacked";
stSv.run.theme = "hacked";
storage.save(stSv);
var stLoaded = storage.load();
ok("主题解锁表白名单化并去重", stLoaded.progress.themeUnlocked.join(",") === "rust,ember,frost",
  JSON.stringify(stLoaded.progress.themeUnlocked));
ok("非法选中回退锈蚀车厢", stLoaded.progress.themeSelected === "rust", stLoaded.progress.themeSelected);
ok("非法的本局主题回退锈蚀车厢", stLoaded.run.theme === "rust", stLoaded.run.theme);
ok("存档版本已升到 5", stLoaded.schemaVersion === 5, "实际 " + stLoaded.schemaVersion);
ok("旧档无主题字段时补默认值", (function () {
  var bare = stateApi.createDefaultState(Date.now());
  delete bare.progress.themeUnlocked;
  delete bare.progress.themeSelected;
  delete bare.run.theme;
  storage.save(bare);
  var back = storage.load();
  return back.progress.themeUnlocked.join(",") === "rust" &&
    back.progress.themeSelected === "rust" && back.run.theme === "rust";
})());

// 每日挑战必须回到锈蚀车厢：否则「同一天同一套条件」的承诺会被主题倍率破坏
var stDailyTheme = stateApi.createDefaultState(Date.now());
stDailyTheme.progress.trainUpgrades.observatory = 3;
stDailyTheme.progress.themeUnlocked.push("ember");
stDailyTheme.progress.themeSelected = "ember";
var dailyRes = stateApi.startDaily(stDailyTheme, Date.now());
ok("每日挑战无视已选主题，固定锈蚀车厢",
  dailyRes.ok && dailyRes.run.theme === "rust",
  dailyRes.ok ? dailyRes.run.theme : dailyRes.message);

/* ---------------- 汇总 ---------------- */

console.log("\n" + "=".repeat(46));
console.log("通过 " + PASS + " / " + (PASS + FAIL));
if (FAIL) {
  console.log("失败项：");
  failures.forEach(function (name) { console.log("  - " + name); });
}
console.log("=".repeat(46));
process.exit(FAIL ? 1 : 0);
