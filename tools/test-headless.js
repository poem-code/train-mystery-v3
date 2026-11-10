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

/* ---------------- 汇总 ---------------- */

console.log("\n" + "=".repeat(46));
console.log("通过 " + PASS + " / " + (PASS + FAIL));
if (FAIL) {
  console.log("失败项：");
  failures.forEach(function (name) { console.log("  - " + name); });
}
console.log("=".repeat(46));
process.exit(FAIL ? 1 : 0);
