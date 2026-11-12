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

/* ---------------- 时钟必须先钉死 ---------------- */

// Date.now 必须在 require main 之前接管：platform.now() 内部有单调递增保护
// （`if (t < lastNow) t = lastNow`），它在模块加载时就把 lastNow 设成了真实时间。
// 之后再改 Date.now 也没用——返回值会被 lastNow 顶回去，于是每局 seed 都不同。
var realNow = Date.now;
var fixedNow = 1793000000000;
Date.now = function () { return fixedNow; };

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

// 第三个随机源：rng.js 的全局实例在**模块加载时**就用 Date.now() 播种（同文件顶部已接管），
// 但那是在 require 串里更早发生的，保险起见显式重播一次，让战斗掷骰也钉死。
require("../js/game/rng").reseed(20261110);

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
  if (process.env.TM_TRACE) {
    console.log("T" + steps + " " + sig + " ether=" + getState().player.ether +
      " hunger=" + getState().player.hunger + " sanity=" + getState().player.sanity +
      " relics=" + getState().run.relics.length + " enh=" + getState().run.enhancements.length +
      " seed=" + getState().run.seed + " eid=" + (getState().run.battle ? getState().run.battle.enemyId : "-") +
      " runs=" + getState().progress.runsStarted);
  }
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
Date.now = realNow;

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
    enemyCharge: 0, phase: 1, phaseBreak: false, over: false, result: null, logs: []
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
// 第 3 回合只写预告，不连击：玩家只吃 10 点基础伤害
ok("虫群第 3 回合先预告、不连击",
  !!(bSwarm.telegraph && bSwarm.telegraph.kind === "swarm") && st4.player.hp === 90,
  "玩家 " + st4.player.hp);
stateApi.battleAction(st4, "precise");
// 第 4 回合才真的连击：10 + round(10*0.55)=6 → 16，90-16=74
ok("预告后一回合虫群连击两次", st4.player.hp === 74, "玩家 " + st4.player.hp);

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

// 窄屏越界用「命中区坐标」judge，不用截图：headless 截图在 dpr 缩放下会裁边，
// 看着像越界其实没有（反向也会骗人）。控件矩形是布局的真相。
var codexModalT = require("../js/game/modals/codex");
var screenApiN = require("../js/core/screen");
var uiApiN = require("../js/core/ui");
function codexOverflow(w, h) {
  var scr = screenApiN.createScreen({
    screenWidth: w, screenHeight: h, windowWidth: w, windowHeight: h,
    pixelRatio: 2, safeArea: { top: Math.round(h * 0.055), left: 0, right: w, bottom: h }
  });
  var st = stateApi.createDefaultState(Date.now());
  var ei2;
  for (ei2 = 0; ei2 < enemiesApi2.ENEMIES.length; ei2 += 1) {
    st.progress.codex.enemies[enemiesApi2.ENEMIES[ei2].id] = { seen: 1, defeats: 1 };
  }
  uiApiN.beginFrame(scr, 0);
  codexModalT.render(stubCtx().ctx, scr, st);
  return uiApiN.getHits().filter(function (hit) {
    var r = hit.rect;
    return r.x < -0.5 || r.y < -0.5 || r.x + r.w > w + 0.5 || r.y + r.h > h + 0.5;
  }).map(function (hit) { return hit.id; });
}
var codexNarrow375 = codexOverflow(375, 667);
var codexNarrow320 = codexOverflow(320, 700);
ok("图鉴控件在 375 宽屏内", codexNarrow375.length === 0, codexNarrow375.join(","));
ok("图鉴控件在 320 窄屏内", codexNarrow320.length === 0, codexNarrow320.join(","));

// 负 items 是「交出去的道具」：存货不够必须选不了，够就得真扣掉。
// 之前只有 2 条事件用这个字段，新增的「灰市」是第三条——顺手钉住语义。
var stGive = stateApi.createDefaultState(Date.now());
stateApi.startRun(stGive, Date.now());
stGive.run.eventId = "ashMarket";
stGive.player.inventory.potion = 0;
var ashEvent = require("../js/game/data/events").getById("ashMarket");
var sellChoice = ashEvent.choices[1];
ok("没有药剂时「卖一瓶药剂」不可选", stateApi.canChooseEventOption(stGive, sellChoice) === false);
stGive.player.inventory.potion = 1;
ok("有药剂时「卖一瓶药剂」可选", stateApi.canChooseEventOption(stGive, sellChoice) === true);
var goldBefore = stGive.player.gold;
stateApi.chooseEventOption(stGive, 1);
ok("交付道具扣除存货并结算收益",
  stGive.player.inventory.potion === 0 && stGive.player.gold === goldBefore + 3,
  "potion=" + stGive.player.inventory.potion + " gold=" + stGive.player.gold);

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
ok("敌人 40 个（28 普通 / 7 精英 / 5 Boss）",
  normalCount === 28 && eliteCount === 7 && bossCount === 5,
  normalCount + "/" + eliteCount + "/" + bossCount);
ok("强化 34 项", enhApi.ENHANCEMENTS.length === 34, "实际 " + enhApi.ENHANCEMENTS.length);
ok("遗物 26 件", relicsApi.RELICS.length === 26, "实际 " + relicsApi.RELICS.length);

var standaloneEvents = eventsApi.EVENTS.filter(function (e) { return !e.chain; });
var chainEvents = eventsApi.EVENTS.filter(function (e) { return !!e.chain; });
ok("独立事件 40 个", standaloneEvents.length === 40, "实际 " + standaloneEvents.length);
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

section("内容分布护栏");

// 早期池子太薄，一局前十层会把同一只怪遇见三遍。
// 玩家抱怨的「内容少」，通常是「重复得太早」，不是「总数不够」。
var earlyPool1 = enemiesApi.poolFor("normal", 1);
var earlyPool2 = enemiesApi.poolFor("normal", 2);
ok("第 1 层普通怪池 ≥ 6 只", earlyPool1.length >= 6, "实际 " + earlyPool1.length);
ok("第 2 层普通怪池 ≥ 11 只", earlyPool2.length >= 11, "实际 " + earlyPool2.length);

// 主题专属：某套车厢一只专属怪、一条专属事件都没有，主题就只剩「换了个背景色」
var themesApiD = require("../js/game/data/themes");
var themeIdsAll = themesApiD.ids();
var themeEnemyCount = {};
var themeEventCount = {};
themeIdsAll.forEach(function (tid) {
  themeEnemyCount[tid] = 0;
  themeEventCount[tid] = 0;
});
enemiesApi.ENEMIES.forEach(function (enemy) {
  (enemy.themes || []).forEach(function (tid) {
    if (themeEnemyCount[tid] !== undefined) themeEnemyCount[tid] += 1;
  });
});
eventsApi.EVENTS.forEach(function (event) {
  (event.themes || []).forEach(function (tid) {
    if (themeEventCount[tid] !== undefined) themeEventCount[tid] += 1;
  });
});
ok("三套主题各有 ≥3 只专属敌人",
  themeIdsAll.every(function (tid) { return themeEnemyCount[tid] >= 3; }),
  JSON.stringify(themeEnemyCount));
ok("三套主题各有 ≥2 条专属事件",
  themeIdsAll.every(function (tid) { return themeEventCount[tid] >= 2; }),
  JSON.stringify(themeEventCount));

// 数值夹紧：内容扩充最容易出的事故是「200 血的普通怪」或「30 伤的精英」，
// 那不是难，是错位——玩家会以为游戏算错了。这里只卡区间，不做平衡计算。
var STAT_BANDS = {
  normal: { hp: [22, 52], dmg: [5, 17] },
  elite: { hp: [60, 105], dmg: [8, 20] },
  boss: { hp: [100, 140], dmg: [10, 22] }
};
var statBad = [];
var idSeen = {};
var idDup = [];
enemiesApi.ENEMIES.forEach(function (enemy) {
  if (idSeen[enemy.id]) idDup.push(enemy.id);
  idSeen[enemy.id] = true;
  var band = STAT_BANDS[enemy.kind];
  if (!band) { statBad.push(enemy.id + ":未知 kind"); return; }
  var hpRange = enemy.hp || enemy.hpRange || [];
  if (hpRange.length !== 2 || hpRange[0] < band.hp[0] || hpRange[1] > band.hp[1]) {
    statBad.push(enemy.id + ":hp " + hpRange.join("-"));
  }
  var dr = enemy.damageRange || [];
  if (dr.length !== 2 || dr[0] < band.dmg[0] || dr[1] > band.dmg[1] || dr[0] > dr[1]) {
    statBad.push(enemy.id + ":dmg " + dr.join("-"));
  }
  if (!enemy.intro) statBad.push(enemy.id + ":缺 intro");
});
ok("敌人 id 不重复", idDup.length === 0, idDup.join(","));
ok("敌人数值都落在所属档位的区间内", statBad.length === 0, statBad.join(","));

section("新特性行为");

var sw1 = freshRun();
var bWeaver = makeBattle(sw1, { trait: "weaver", turn: 3, damageRange: [10, 10] });
stateApi.enemyTurn(sw1);
ok("织网第 3 回合只预告，还没缠上",
  bWeaver.webbed !== true && !!(bWeaver.telegraph && bWeaver.telegraph.kind === "weave"));
stateApi.enemyTurn(sw1);
ok("预告后一回合网才落下", bWeaver.webbed === true);

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

/* ---------------- 战斗预告 ---------------- */

section("战斗预告");

// 蓄势：预告提前一整个玩家回合，当期不当场加重
var tp1 = freshRun();
var bTele = makeBattle(tp1, { boss: true, turn: 3, damageRange: [10, 10], hp: 500, maxHp: 500 });
stateApi.enemyTurn(tp1);
ok("蓄势在第 3 回合只写预告，不当场加重",
  !!(bTele.telegraph && bTele.telegraph.kind === "charge") && bTele.enemyCharge === 1 && tp1.player.hp === 90,
  "玩家 " + tp1.player.hp + " 层 " + bTele.enemyCharge);
ok("预告里的加成就等于真实加成",
  bTele.telegraph.detail === "下一击 +8", bTele.telegraph.detail);

// 第 4 回合兑现：10 + 8 = 18（boss 偶数回合补的 8 点护盾不参与这次伤害）
stateApi.enemyTurn(tp1);
ok("预告后一回合打出重击 +8", tp1.player.hp === 72, "玩家 " + tp1.player.hp);
ok("兑现后预告与层数都清空", bTele.telegraph === null && bTele.enemyCharge === 0);
ok("兑现时给表现层留下重击标记", bTele.lastChargedHit === true);

// 没有这类招式的敌人：同一回合既不该有预告，也不该留标记
var tp2 = freshRun();
var bPlain = makeBattle(tp2, { trait: "none", turn: 3, damageRange: [10, 10], hp: 500, maxHp: 500 });
stateApi.enemyTurn(tp2);
ok("普通敌人没有预告，也不留重击标记",
  bPlain.telegraph === null && bPlain.lastChargedHit === false && tp2.player.hp === 90);

// 预告只是提示，不许偷偷改变玩家的输出
var tp3 = freshRun();
var bMix = makeBattle(tp3, { boss: true, turn: 3, damageRange: [0, 0], hp: 500, maxHp: 500 });
stateApi.enemyTurn(tp3);
var hpAfterTele = bMix.hp;
ok("有预告的回合玩家照常输出",
  (function () {
    stateApi.battleAction(tp3, "precise");
    return hpAfterTele - bMix.hp === 20;
  })(), "打掉 " + (hpAfterTele - bMix.hp));

// 存档往返：预告是「下回合要干什么」，读档后凭空消失等于玩家白挨一下
var tp4 = freshRun();
makeBattle(tp4, { boss: true, turn: 3, damageRange: [10, 10], hp: 500, maxHp: 500 });
stateApi.enemyTurn(tp4);
var savedTele = storage.sanitizeRun(JSON.parse(JSON.stringify(tp4.run)));
ok("预告能存档往返",
  !!(savedTele.battle && savedTele.battle.telegraph
    && savedTele.battle.telegraph.kind === "charge"
    && savedTele.battle.telegraph.detail === "下一击 +8"),
  JSON.stringify(savedTele.battle && savedTele.battle.telegraph));

var dirtyTele = JSON.parse(JSON.stringify(tp4.run));
dirtyTele.battle.telegraph = { kind: "boom", label: "炸", detail: "任意文本" };
ok("非法预告 kind 被丢弃", storage.sanitizeRun(dirtyTele).battle.telegraph === null);

var longTele = JSON.parse(JSON.stringify(tp4.run));
longTele.battle.telegraph = { kind: "weave", label: "很长很长的标签名字", detail: "x" };
var clampedTele = storage.sanitizeRun(longTele).battle.telegraph;
ok("预告文案按长度截断", clampedTele.label.length <= 6 && clampedTele.detail.length <= 20,
  clampedTele.label.length + "/" + clampedTele.detail.length);

section("Boss 换阶段");

// 半血触发：Boss 100 血，打掉 55 点后进入第二形态。damageRange 整体 +3 是
// 「它真的变狠了」的唯一来源，别的地方都不许偷偷改伤害。
var pb1 = freshRun();
var bPhase = makeBattle(pb1, { boss: true, hp: 100, maxHp: 100, damageRange: [10, 10] });
bPhase.hp = 56; // 下一击 20 点 → 36，跌破半血
stateApi.battleAction(pb1, "precise");
ok("Boss 跌破半血进入第二阶段", bPhase.phase === 2, "phase=" + bPhase.phase);
ok("第二阶段伤害区间整体 +3",
  bPhase.damageRange[0] === 13 && bPhase.damageRange[1] === 13,
  bPhase.damageRange.join("-"));
ok("换阶段会写下日志",
  bPhase.logs.some(function (t) { return t.indexOf("第二层") >= 0; }),
  bPhase.logs[0]);

// 给缓冲：那一回合它不还手，但立起护盾。缺了这一回合，玩家体感就是
// 「快赢了突然被打死」——同一件事的两种味道，差别全在这里。
var pb2 = freshRun();
var bBreak = makeBattle(pb2, {
  boss: true, hp: 30, maxHp: 100, damageRange: [10, 10], boss_: true
});
stateApi.battleAction(pb2, "precise"); // 20 点 → 10，触发换阶段
ok("换阶段那回合敌人不出手（玩家不掉血）", pb2.player.hp === 100, "玩家 " + pb2.player.hp);
ok("换阶段那回合敌人立起护盾", bBreak.enemyShield === 12, "护盾 " + bBreak.enemyShield);
ok("换阶段标记只消费一次", bBreak.phaseBreak === false);

// 旧蓄势必须在换阶段时作废：留着的话，转换后第一下就是毫无预告的重击
var pb3 = freshRun();
var bCharge = makeBattle(pb3, {
  boss: true, hp: 30, maxHp: 100, damageRange: [10, 10], enemyCharge: 2,
  telegraph: { kind: "charge", label: "蓄势", detail: "下一击 +24", log: "" }
});
stateApi.battleAction(pb3, "precise");
ok("换阶段清掉之前攒的蓄势", bCharge.enemyCharge === 0 && bCharge.telegraph === null,
  "charge=" + bCharge.enemyCharge + " tele=" + JSON.stringify(bCharge.telegraph));

// 一击打死不该出现「刚裂开就死」：血条归零时没有第二形态可言
var pb4 = freshRun();
var bKill = makeBattle(pb4, { boss: true, hp: 18, maxHp: 100, damageRange: [10, 10] });
stateApi.battleAction(pb4, "precise");
ok("一击打死的 Boss 不进入第二阶段", bKill.phase === 1, "phase=" + bKill.phase);

// 只有 Boss 会变：普通怪半血只是个数字
var pb5 = freshRun();
var bNormal = makeBattle(pb5, { boss: false, hp: 30, maxHp: 100, damageRange: [10, 10] });
stateApi.battleAction(pb5, "precise");
ok("普通敌人不会换阶段", bNormal.phase === 1 && bNormal.damageRange[0] === 10,
  "phase=" + bNormal.phase + " dmg=" + bNormal.damageRange.join("-"));

// 第二形态的节奏：每 2 回合蓄势（原每 3 回合）。这是「窗口变短」而不是「数字变大」，
// 也是玩家真正会感到压迫的地方
var pb6 = freshRun();
var bCadence = makeBattle(pb6, { boss: true, hp: 100, maxHp: 100, damageRange: [10, 10], phase: 2 });
bCadence.turn = 3;
stateApi.enemyTurn(pb6);
ok("第二阶段在奇数回合不蓄势", bCadence.telegraph === null,
  JSON.stringify(bCadence.telegraph));
bCadence.turn = 4;
stateApi.enemyTurn(pb6);
ok("第二阶段每 2 回合蓄势一次",
  !!bCadence.telegraph && bCadence.telegraph.kind === "charge",
  JSON.stringify(bCadence.telegraph));

// 存档往返：丢掉 phase 等于把一场打到一半的 Boss 战退回第一形态，
// 伤害区间也跟着回退，玩家辛苦打掉的半管血白打
var pb7 = freshRun();
makeBattle(pb7, {
  boss: true, phase: 2, hp: 40, maxHp: 100, damageRange: [13, 13],
  logs: ["x"]
});
var savedPhase = storage.sanitizeRun(JSON.parse(JSON.stringify(pb7.run)));
ok("第二形态能存档往返",
  savedPhase.battle.phase === 2
    && savedPhase.battle.damageRange[0] === 13,
  "phase=" + savedPhase.battle.phase + " dmg=" + savedPhase.battle.damageRange.join("-"));

var dirtyPhase = JSON.parse(JSON.stringify(pb7.run));
dirtyPhase.battle.phase = 7;
ok("非法阶段值被夹回合法区间",
  storage.sanitizeRun(dirtyPhase).battle.phase === 2,
  "phase=" + storage.sanitizeRun(dirtyPhase).battle.phase);

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

section("遗物序列");

var relicSetsApiT = require("../js/game/data/relicSets");
var relicsApiT = require("../js/game/data/relics");
var effectsApiT = require("../js/game/data/effects");

// 数据完整性：成员必须真实存在、一件遗物只能属于一个序列
var setMemberSeen = {};
var setMemberDup = [];
var setMemberMissing = [];
var setTierBad = [];
var setEffectBad = [];
var legalKeys = effectsApiT.NUMERIC_KEYS.concat(effectsApiT.FLAG_KEYS).concat(["firstShopDiscount"]);
relicSetsApiT.RELIC_SETS.forEach(function (set) {
  var last = 0;
  set.members.forEach(function (id) {
    if (!relicsApiT.getById(id)) setMemberMissing.push(id);
    if (setMemberSeen[id]) setMemberDup.push(id);
    setMemberSeen[id] = set.id;
  });
  set.tiers.forEach(function (tier) {
    if (tier.need <= last || tier.need > set.members.length) setTierBad.push(set.id + ":" + tier.need);
    last = tier.need;
    Object.keys(tier.effects).forEach(function (key) {
      if (legalKeys.indexOf(key) < 0) setEffectBad.push(set.id + "." + key);
    });
  });
});

ok("序列引用的遗物 id 全部存在", setMemberMissing.length === 0, setMemberMissing.join(","));
ok("同一件遗物不会被两个序列同时收录", setMemberDup.length === 0, setMemberDup.join(","));
ok("26 件遗物都有序列归属",
  Object.keys(setMemberSeen).length === relicsApiT.RELICS.length,
  Object.keys(setMemberSeen).length + " / " + relicsApiT.RELICS.length);
ok("序列档位 need 递增且不超过成员数", setTierBad.length === 0, setTierBad.join(","));
ok("序列奖励只使用已声明的效果字段", setEffectBad.length === 0, setEffectBad.join(","));

// 逐件堆积验证：军械序列 2 件 / 4 件各触发一次
var sArs = freshRun();
var arsBase = sArs.run.effects.attackFlat;
stateApi.obtainRelic(sArs, relicsApiT.getById("oldMagazine")); // 攻击 +4
var arsOne = stateApi.obtainRelic(sArs, relicsApiT.getById("quickDraw")); // 2 件 → 攻击 +3
ok("凑到 2 件触发第一档",
  arsOne.sets.length === 1 && sArs.run.setActive.arsenal === 1,
  JSON.stringify(sArs.run.setActive));
ok("第一档攻击 +3 落到 effects",
  sArs.run.effects.attackFlat === arsBase + 4 + 3,
  "实际 " + sArs.run.effects.attackFlat);
ok("第一档给的是攻击而不是先手",
  sArs.run.effects.firstStrikeBonus === 12, "先手 " + sArs.run.effects.firstStrikeBonus);

stateApi.obtainRelic(sArs, relicsApiT.getById("sniperScope")); // 3 件，不发奖
ok("3 件时停在第一档", sArs.run.setActive.arsenal === 1, String(sArs.run.setActive.arsenal));
var arsFour = stateApi.obtainRelic(sArs, relicsApiT.getById("twinShell")); // 4 件 → 先手 +6
ok("凑到 4 件触发第二档",
  arsFour.sets.length === 1 && sArs.run.setActive.arsenal === 2,
  JSON.stringify(sArs.run.setActive));
ok("第二档先手 +6 叠加在原有 12 上",
  sArs.run.effects.firstStrikeBonus === 18, "先手 " + sArs.run.effects.firstStrikeBonus);

// 幂等：重复结算不能二次加属性
var beforeRepeat = sArs.run.effects.attackFlat;
var repeatSets = stateApi.applySetBonuses(sArs);
ok("重复结算序列不再发奖",
  repeatSets.length === 0 && sArs.run.effects.attackFlat === beforeRepeat,
  "攻击 " + sArs.run.effects.attackFlat);

// 生命上限类奖励要同步写进 player.maxHp，否则面板和实际不一致
var sWard = freshRun();
var wardBaseHp = sWard.player.maxHp;
stateApi.obtainRelic(sWard, relicsApiT.getById("calmChip"));
stateApi.obtainRelic(sWard, relicsApiT.getById("steelCharm"));
ok("守护序列 2 件给生命上限 +6",
  sWard.player.maxHp === wardBaseHp + 6 && sWard.run.effects.maxHpBonus === 6,
  "上限 " + sWard.player.maxHp + " / 加成 " + sWard.run.effects.maxHpBonus);

// 进度面板数据
var sProg = freshRun();
stateApi.obtainRelic(sProg, relicsApiT.getById("brassCompass"));
stateApi.obtainRelic(sProg, relicsApiT.getById("mirrorShard"));
var progList = stateApi.setProgress(sProg.run);
var progVigil = null;
var k2;
for (k2 = 0; k2 < progList.length; k2 += 1) {
  if (progList[k2].id === "vigil") progVigil = progList[k2];
}
ok("序列进度按已收集件数统计",
  progVigil && progVigil.count === 2 && progVigil.total === 4,
  progVigil ? progVigil.count + " / " + progVigil.total : "缺 vigil");
ok("序列进度标出已激活档位",
  progVigil && progVigil.granted === 1 && progVigil.tiers[0].active && !progVigil.tiers[1].active,
  progVigil ? JSON.stringify(progVigil.tiers) : "");
ok("下一档需要件数可读出", progVigil && progVigil.nextNeed === 3, progVigil && String(progVigil.nextNeed));

// 老存档补算：有遗物但没有 setActive 记账
var sLegacy = freshRun();
sLegacy.run.relics = [
  { id: "oldMagazine", name: "旧式弹仓", desc: "", rarity: "common" },
  { id: "quickDraw", name: "快枪套", desc: "", rarity: "rare" }
];
sLegacy.run.setActive = {};
var legacyBaseAtk = sLegacy.run.effects.attackFlat;
var legacyActivated = stateApi.reconcileSets(sLegacy);
ok("老档读入后补发应得档位",
  legacyActivated.length === 1 && sLegacy.run.setActive.arsenal === 1,
  JSON.stringify(sLegacy.run.setActive));
ok("补发后属性到位", sLegacy.run.effects.attackFlat === legacyBaseAtk + 3,
  "攻击 " + sLegacy.run.effects.attackFlat);
ok("补算不会重复加属性", (function () {
  var atk = sLegacy.run.effects.attackFlat;
  stateApi.reconcileSets(sLegacy);
  return sLegacy.run.effects.attackFlat === atk;
})());

// 存档白名单：未知序列丢弃、档位数夹取
var sSetSave = freshRun();
sSetSave.run.relics = [
  { id: "calmChip", name: "冷静芯片", desc: "", rarity: "rare" },
  { id: "steelCharm", name: "钢骨护符", desc: "", rarity: "common" }
];
sSetSave.run.setActive = { arsenal: 1, vigil: "3", warden: 99, hacked: 5 };
storage.save(sSetSave);
var sSetBack = storage.load();
ok("未知序列 id 不会进存档",
  sSetBack.run.setActive.hacked === undefined, JSON.stringify(sSetBack.run.setActive));
ok("档位数按该序列上限夹取",
  sSetBack.run.setActive.warden === 4, JSON.stringify(sSetBack.run.setActive));
ok("字符串档位按数字解析", sSetBack.run.setActive.vigil === 3,
  JSON.stringify(sSetBack.run.setActive));
ok("非法档位不会打乱已有序列", sSetBack.run.setActive.arsenal === 1,
  JSON.stringify(sSetBack.run.setActive));

/* ---------------- 打击材质 ---------------- */

section("打击材质");

var enemiesApiT = require("../js/game/data/enemies");
var materialsApiT = require("../js/game/data/materials");
var audioApiT = require("../js/platform/audio");
var fs = require("fs");
var path = require("path");

var matIds = materialsApiT.ids();
var matMissing = [];
var matBad = [];
var matCount = {};
var sparkBad = [];
matIds.forEach(function (id) { matCount[id] = 0; });
enemiesApiT.ENEMIES.forEach(function (enemy) {
  if (!materialsApiT.isId(enemy.material)) {
    matMissing.push(enemy.id + ":" + enemy.material);
  } else {
    matCount[enemy.material] += 1;
  }
  var spark = materialsApiT.getById(enemy.material).spark;
  if (!/^#[0-9A-Fa-f]{6}$/.test(spark)) sparkBad.push(enemy.id);
});

ok("40 只敌人都声明了合法材质", matMissing.length === 0, matMissing.join(","));
ok("四种材质都有敌人", matIds.every(function (id) { return matCount[id] > 0; }),
  JSON.stringify(matCount));
// 每种材质至少 3 只：只有一个敌人的材质等于没做，玩家一辈子听不到第二遍
ok("每种材质至少 3 只敌人承载",
  matIds.every(function (id) { return matCount[id] >= 3; }), JSON.stringify(matCount));
ok("材质粒子色都是合法 #RRGGBB", sparkBad.length === 0, sparkBad.join(","));

// 音层：普通命中只出材质层；重击叠一层通用低频
var layerBad = [];
matIds.forEach(function (id) {
  var normal = materialsApiT.layersFor(id, { crit: false });
  var crit = materialsApiT.layersFor(id, { crit: true });
  if (normal.length !== 1) layerBad.push(id + ".normal=" + normal.length);
  else if (normal[0].name !== materialsApiT.getById(id).hit) layerBad.push(id + ".normal.name");
  if (crit.length !== 2) layerBad.push(id + ".crit=" + crit.length);
  else if (crit[0].name !== "crit") layerBad.push(id + ".crit.name");
  else if (crit[1].name !== materialsApiT.getById(id).hit) layerBad.push(id + ".crit.layer");
  if (!(normal[0].volume > 0 && normal[0].volume <= 1)) layerBad.push(id + ".vol");
});
ok("材质音层结构正确（普通 1 层 / 重击 2 层）", layerBad.length === 0, layerBad.join(","));

ok("未知材质回退为默认材质",
  materialsApiT.getById("nope") === materialsApiT.getById(materialsApiT.DEFAULT) &&
  materialsApiT.getById(null).id === materialsApiT.DEFAULT &&
  materialsApiT.getById(undefined).id === materialsApiT.DEFAULT);
ok("未知材质的音层也能出声",
  materialsApiT.layersFor("nope", {}).length === 1 &&
  !!materialsApiT.layersFor("nope", {}).length);

// 音效名与资源必须对得上：名字写错只会静默无声，靠这条断言兜住
var soundMissing = [];
var fileMissing = [];
matIds.forEach(function (id) {
  var name = materialsApiT.getById(id).hit;
  if (audioApiT.SOUND_NAMES.indexOf(name) < 0) soundMissing.push(name);
  var file = path.join(__dirname, "..", "assets", "audio", name + ".wav");
  if (!fs.existsSync(file)) fileMissing.push(name + ".wav");
});
ok("材质音效名都在音频清单里", soundMissing.length === 0, soundMissing.join(","));
ok("材质音效文件真实存在", fileMissing.length === 0, fileMissing.join(","));

// 清单与磁盘整体对齐：任何一个名字写错都只会在真机上「静默无声」，测试必须替玩家发现
var allSoundMissing = audioApiT.SOUND_NAMES.filter(function (name) {
  return !fs.existsSync(path.join(__dirname, "..", "assets", "audio", name + ".wav"));
});
ok("音频清单里的每个音效都有 wav 文件", allSoundMissing.length === 0, allSoundMissing.join(","));

// 播放器按需建池：Node 下没有 Audio，播放必须是「无声但不抛」的
var silentAudio = audioApiT.createAudio({ basePath: "assets/audio/" });
var playThrew = null;
try {
  silentAudio.play("hit_metal", 0.6);
  silentAudio.play("crit", 0.8);
  silentAudio.play("nope_not_a_sound", 0.5);
} catch (error) {
  playThrew = error;
}
ok("无音频环境下播放静默降级（含未知名字）", !playThrew, playThrew && playThrew.message);

// 战斗对象必须带上材质，否则读档/换敌人后会全部退回默认音
var matBattleBad = [];
var matTrials = 60;
var mi;
for (mi = 0; mi < matTrials; mi += 1) {
  var stMat = stateApi.createDefaultState(Date.now());
  stateApi.startRun(stMat, Date.now());
  stMat.run.layer = mi % 9;
  var matBattle = stateApi.startBattle(stMat, mi % 5 === 0 ? "elite" : "normal");
  var matTemplate = enemiesApiT.getById(matBattle.enemyId);
  if (!matTemplate || matBattle.material !== matTemplate.material) {
    matBattleBad.push(matBattle.enemyId + ":" + matBattle.material);
  }
}
ok("开局战斗写入敌人材质", matBattleBad.length === 0, matBattleBad.slice(0, 3).join(","));

// 材质是纯表现：换成别的材质，数值必须纹丝不动
function materialDamageProbe(materialId) {
  var stProbe = freshRun();
  var bProbe = makeBattle(stProbe, {
    material: materialId, hp: 100, maxHp: 100, damageRange: [10, 10]
  });
  stateApi.battleAction(stProbe, "precise");
  return { hp: stProbe.player.hp, enemyHp: bProbe.hp };
}
var probeMetal = materialDamageProbe("metal");
var probeVoid = materialDamageProbe("void");
ok("材质不参与数值计算",
  probeMetal.hp === probeVoid.hp && probeMetal.enemyHp === probeVoid.enemyHp,
  JSON.stringify(probeMetal) + " vs " + JSON.stringify(probeVoid));

// 存档：材质字段缺失/被改坏都不能让读档失败
var sMat = freshRun();
var bMat = stateApi.startBattle(sMat, "normal");
var savedEnemyId = bMat.enemyId;
sMat.run.battle.material = "hacked";
storage.save(sMat);
var sMatBack = storage.load();
ok("非法材质按 enemyId 反查回真实材质",
  sMatBack.run.battle.material === enemiesApiT.getById(savedEnemyId).material,
  sMatBack.run.battle.material + " / enemy " + savedEnemyId);

var sMat2 = freshRun();
var bMat2 = stateApi.startBattle(sMat2, "normal");
delete sMat2.run.battle.material;
sMat2.run.battle.enemyId = "doesNotExist";
storage.save(sMat2);
var sMat2Back = storage.load();
ok("材质与 enemyId 都不认识时回退默认",
  sMat2Back.run.battle.material === materialsApiT.DEFAULT, sMat2Back.run.battle.material);

var sMat3 = freshRun();
stateApi.startBattle(sMat3, "normal");
sMat3.run.battle.material = "cloth";
storage.save(sMat3);
var sMat3Back = storage.load();
ok("合法材质原样保留", sMat3Back.run.battle.material === "cloth", sMat3Back.run.battle.material);

/* ---------------- 待机与打击动画 ---------------- */

section("待机与打击动画");

var tweenApiT = require("../js/core/tween");

var tnA = tweenApiT.createAnimator();
ok("空补间器 anyRunning 为假", tnA.anyRunning() === false, String(tnA.anyRunning()));
tnA.start("enemyHit", 200);
ok("启动后 anyRunning 为真", tnA.anyRunning() === true, String(tnA.anyRunning()));
ok("未到期 progress 仍小于 1", tnA.progress("enemyHit") < 1, String(tnA.progress("enemyHit")));
tnA.tick(240);
ok("到期后 anyRunning 归假（否则引擎会一直重绘）", tnA.anyRunning() === false, String(tnA.anyRunning()));
ok("到期后 progress 归一", tnA.progress("enemyHit") === 1, String(tnA.progress("enemyHit")));

// 桩 ctx：只要能记下 translate/arc 的参数就够，渲染正确性靠截图走查
function stubCtx() {
  var rec = { translate: [], scale: [], arc: [], rot: [], texts: [], textPuts: [] };
  var ctx = {
    save: function () {}, restore: function () {}, beginPath: function () {},
    closePath: function () {}, fill: function () {}, stroke: function () {},
    moveTo: function () {}, lineTo: function () {}, rect: function () {},
    fillRect: function () {}, arcTo: function () {}, clip: function () {},
    quadraticCurveTo: function () {},
    measureText: function (t) { return { width: String(t).length * 6 }; },
    fillText: function (t, x, y) {
      rec.texts.push(String(t));
      rec.textPuts.push([String(t), x, y]);
    },
    createLinearGradient: function () {
      return { addColorStop: function () {} };
    },
    ellipse: function (x, y, rx) { rec.arc.push(rx); },
    arc: function (x, y, r) { rec.arc.push(r); },
    translate: function (x, y) { rec.translate.push([x, y]); },
    rotate: function (a) { rec.rot.push(a); },
    scale: function (x, y) { rec.scale.push([x, y]); }
  };
  return { ctx: ctx, rec: rec };
}

var drawApiT = require("../js/core/draw");

/** 影子自己会做一次 scale(1, 0.22) 把圆压成扁椭圆，断言身体形变时要把它排除 */
function bodyScales(rec) {
  return rec.scale.filter(function (s) {
    return !(Math.abs(s[0] - 1) < 1e-9 && Math.abs(s[1] - 0.22) < 1e-9);
  });
}

var poseBase = stubCtx();
drawApiT.figure(poseBase.ctx, 100, 200, 80, "normal", "#fff", null);
var baseTranslate = poseBase.rec.translate.length;
ok("不传 pose 时只画影子、不加身体变换", bodyScales(poseBase.rec).length === 0,
  JSON.stringify(poseBase.rec.scale));

var poseBob = stubCtx();
drawApiT.figure(poseBob.ctx, 100, 200, 80, "normal", "#fff", null, { bob: -10 });
var bobbed = poseBob.rec.translate.filter(function (t) {
  return Math.abs(t[1] - 190) < 0.001 && Math.abs(t[0] - 100) < 0.001;
});
ok("bob 生效：身体按 bob 上移", bobbed.length === 1 && bodyScales(poseBob.rec).length === 1,
  JSON.stringify(poseBob.rec.translate));
// 一次 translate(cx, cy+bob)、一次 translate(-cx, -cy)：绕脚底做形变要多两次平移
ok("形变只多两次平移（不移影子的那份）",
  poseBob.rec.translate.length === baseTranslate + 2,
  poseBob.rec.translate.length + " vs " + baseTranslate);

// rot：倾角是「在用劲」的主信号。平移读起来是「挪了一步」，旋转才是「前倾」
var poseRot = stubCtx();
drawApiT.figure(poseRot.ctx, 100, 200, 80, "normal", "#fff", null, { rot: 0.12 });
ok("rot 生效：绕脚底转一次",
  poseRot.rec.rot.length === 1 && Math.abs(poseRot.rec.rot[0] - 0.12) < 1e-9,
  JSON.stringify(poseRot.rec.rot));
ok("rot 不额外改变平移次数", poseRot.rec.translate.length === baseTranslate + 2,
  poseRot.rec.translate.length + " vs " + baseTranslate);
ok("不传 rot 时不旋转", poseBase.rec.rot.length === 0, JSON.stringify(poseBase.rec.rot));

// 影子：离地越高越小越淡——否则浮空会像贴纸在抖
var shadowRadius = function (rec) {
  // 影子是第一个 arc，半径 = size * 0.32 * k
  return rec.arc[0];
};
ok("离地时影子缩小", shadowRadius(poseBob.rec) < shadowRadius(poseBase.rec),
  shadowRadius(poseBob.rec) + " vs " + shadowRadius(poseBase.rec));
ok("影子不会缩到看不见（下限 0.5 倍）",
  shadowRadius(poseBob.rec) >= 80 * 0.32 * 0.5 - 0.001, String(shadowRadius(poseBob.rec)));

var poseSquash = stubCtx();
drawApiT.figure(poseSquash.ctx, 100, 200, 80, "normal", "#fff", null, { sx: 1.14, sy: 0.88 });
var squashScales = bodyScales(poseSquash.rec);
ok("挤压帧按 sx/sy 缩放", squashScales.length === 1 &&
  Math.abs(squashScales[0][0] - 1.14) < 1e-9 && Math.abs(squashScales[0][1] - 0.88) < 1e-9,
  JSON.stringify(poseSquash.rec.scale));

/* ---- 引擎：只有声明「会动」的视图才持续重绘，且限速 ---- */

var engineT = T.getEngine();
var liveStateT = getState();

function paintsOver(steps, dt) {
  var before = engineT.getPaintCount();
  var i;
  for (i = 0; i < steps; i += 1) engineT.__step(dt);
  return engineT.getPaintCount() - before;
}

// 先回到静态界面。清掉残留的特效/补间/Toast：
// 它们任意一个还活着都会让屏幕持续重绘，量到的就不是「待机节流」了
liveStateT.current.modal = null;
liveStateT.current.scene = "home";
engineT.animator.clear();
engineT.clearToasts();
engineT.fx.clear();
engineT.invalidate();
engineT.__tick(16);
var idlePaints = paintsOver(20, 16);
ok("静态界面不为呼吸重绘", idlePaints === 0, String(idlePaints));

// 进战斗：先手工造一场，别让自动游玩的历史状态干扰
if (!liveStateT.run || !liveStateT.run.active) stateApi.startRun(liveStateT, Date.now());
liveStateT.current.scene = "route";
makeBattle(liveStateT, { trait: "none", damageRange: [0, 0], hp: 999, maxHp: 999 });
engineT.animator.clear();
engineT.clearToasts();
engineT.fx.clear();
engineT.invalidate();
engineT.__tick(16);
var livePaints = paintsOver(20, 16);
// 20 帧 × 16ms = 320ms，节流 80ms 一帧 → 约 4 次；给一帧容差
ok("战斗里按 ~12fps 持续重绘", livePaints >= 3 && livePaints <= 6, String(livePaints));
ok("待机重绘远少于每帧（60fps 会烧电池）", livePaints < 20, String(livePaints));

/* ---- 打击动作由事件触发，且不写任何玩法状态 ---- */

var animT = engineT.animator;
animT.clear();
dispatch({ id: "battle:precise" });
ok("命中触发敌人受击帧", animT.isRunning("enemyHit"), "keys=" + JSON.stringify(Object.keys(animT)));

animT.clear();
var hpBeforeT = liveStateT.player.hp;
dispatch({ id: "battle:defend" });
// damageRange [0,0] 打不动人，换成有伤害的敌人再挨一次
makeBattle(liveStateT, { trait: "none", damageRange: [8, 8], hp: 999, maxHp: 999 });
animT.clear();
dispatch({ id: "battle:precise" });
ok("敌人反击触发扑咬与玩家后退",
  animT.isRunning("enemyLunge") && animT.isRunning("heroHurt"),
  "lunge=" + animT.isRunning("enemyLunge") + " hurt=" + animT.isRunning("heroHurt"));

/* ---- 四种行动各有自己的出手动作 ---- */

// 以前点按钮只有飘字在动，剪影纹丝不动：四个行动在视觉上完全一样
function actKeyFor(id) {
  animT.clear();
  dispatch({ id: id });
  var keys = ["heroShoot", "heroPower", "heroGuard", "heroDrink"];
  var hit = null;
  var ki;
  for (ki = 0; ki < keys.length; ki += 1) {
    if (animT.isRunning(keys[ki])) hit = keys[ki];
  }
  return hit;
}

makeBattle(liveStateT, { trait: "none", damageRange: [4, 4], hp: 9999, maxHp: 9999 });
liveStateT.player.hp = 60;
liveStateT.player.inventory.potion = 3;
ok("精准射击 = 收肩前倾", actKeyFor("battle:precise") === "heroShoot");
ok("强力射击 = 后仰再前扑", actKeyFor("battle:power") === "heroPower");
ok("防御架势 = 蹲下", actKeyFor("battle:defend") === "heroGuard");
ok("喝药 = 上浮", actKeyFor("battle:potion") === "heroDrink");

// 行动没成立时不该有动作：没药还仰头，是在骗玩家
liveStateT.player.inventory.potion = 0;
animT.clear();
dispatch({ id: "battle:potion" });
ok("没药时不播喝药动作", !animT.isRunning("heroDrink"), "key=" + animT.isRunning("heroDrink"));

var snapshotBefore = JSON.stringify(liveStateT.run) + JSON.stringify(liveStateT.player);
var i2;
for (i2 = 0; i2 < 40; i2 += 1) engineT.__step(16);
var snapshotAfter = JSON.stringify(liveStateT.run) + JSON.stringify(liveStateT.player);
ok("播动画不改任何玩法数值", snapshotBefore === snapshotAfter, "状态被改写了");
ok("动画播完补间自动清空", animT.anyRunning() === false, String(animT.anyRunning()));

/* ---- 预告徽标：状态里有，画面上就一定要有 ---- */

var screenApiT = require("../js/core/screen");
var uiApiT = require("../js/core/ui");
var battleModalT = require("../js/game/modals/battle");
var scrT = screenApiT.createScreen({ screenWidth: 375, screenHeight: 667 });

function renderBattleTexts(state) {
  var stub = stubCtx();
  uiApiT.beginFrame(scrT, 0);
  battleModalT.render(stub.ctx, scrT, state, tweenApiT.createAnimator(), 1200);
  return stub.rec;
}

var te1 = freshRun();
makeBattle(te1, {
  boss: true, turn: 4, damageRange: [10, 10], hp: 500, maxHp: 500,
  telegraph: { kind: "charge", label: "蓄势", detail: "下一击 +8", log: "" }
});
var rec1 = renderBattleTexts(te1);
var te1Texts = rec1.texts;
ok("战斗面板画出预告徽标",
  te1Texts.some(function (t2) { return t2.indexOf("蓄势") >= 0; }), JSON.stringify(te1Texts));
ok("预告时防御按钮换成针对性提示",
  te1Texts.some(function (t3) { return t3 === "挡下这记预告"; }), JSON.stringify(te1Texts));

// 徽标是「贴在敌人头顶」的浮层，越界或压到血条都会变成噪音
var badgePut = rec1.textPuts.filter(function (p) { return p[0].indexOf("蓄势") >= 0; })[0];
ok("预告徽标完整落在屏幕内",
  !!badgePut && badgePut[1] >= 0
    && badgePut[1] + String(badgePut[0]).length * 6 <= scrT.width
    && badgePut[2] > 0 && badgePut[2] < scrT.height,
  JSON.stringify(badgePut));

var te2 = freshRun();
makeBattle(te2, { trait: "none", turn: 4, damageRange: [10, 10], hp: 500, maxHp: 500 });
var te2Texts = renderBattleTexts(te2).texts;
ok("没有预告时不画徽标也不改按钮文案",
  !te2Texts.some(function (t4) { return t4.indexOf("蓄势") >= 0 || t4 === "挡下这记预告"; }),
  JSON.stringify(te2Texts));

// 收尾：把战斗结束掉，别把状态留给后面
dispatch({ id: "battle:giveUp" });
liveStateT.current.modal = null;

/* ---- 血量写进姿态：快死了的敌人不该还在匀速呼吸 ---- */

var dp1 = freshRun();
var bDp = makeBattle(dp1, { trait: "none", turn: 2, hp: 100, maxHp: 100, damageRange: [0, 0] });
var dpFullScale = bodyScales(renderBattleTexts(dp1))[0];
bDp.hp = 5;
var dpDyingScale = bodyScales(renderBattleTexts(dp1))[0];
ok("濒死时敌人身体被压低",
  !!dpFullScale && !!dpDyingScale && dpDyingScale[1] < dpFullScale[1] - 0.02,
  (dpFullScale && dpFullScale[1].toFixed(3)) + " → " + (dpDyingScale && dpDyingScale[1].toFixed(3)));

/* ---------------- 第二形态：五个 Boss 五套打法 ---------------- */

section("第二形态各有各的打法");

var enemiesAllT = require("../js/game/data/enemies").ENEMIES;
var bossListT = enemiesAllT.filter(function (e) { return e.kind === "boss"; });
var bossWithPhase2 = bossListT.filter(function (e) { return !!e.phase2; });

ok("每个 Boss 都有自己的第二形态", bossWithPhase2.length === bossListT.length,
  bossWithPhase2.length + "/" + bossListT.length);
ok("形态名互不重复",
  bossWithPhase2.map(function (e) { return e.phase2.label; }).filter(function (v, i, arr) {
    return arr.indexOf(v) === i;
  }).length === bossWithPhase2.length,
  bossWithPhase2.map(function (e) { return e.phase2.label; }).join("/"));
ok("每个形态都有形态名、崩开描述与规则说明（玩家读得到才叫机制）",
  bossWithPhase2.every(function (e) {
    return e.phase2.label && e.phase2.line && e.phase2.tip
      && e.phase2.label.length <= 6 && e.phase2.line.length <= 26 && e.phase2.tip.length <= 34;
  }),
  JSON.stringify(bossWithPhase2.map(function (e) { return e.phase2.label; })));
// 五套机制必须真的不一样：只改数字等于没改，第二次遇到就知道「又是那套」
ok("五个形态的机制字段组合各不相同",
  bossWithPhase2.map(function (e) {
    return Object.keys(e.phase2).sort().join(",");
  }).filter(function (v, i, arr) { return arr.indexOf(v) === i; }).length === bossWithPhase2.length);
ok("普通与精英不带第二形态",
  enemiesAllT.filter(function (e) {
    return e.kind !== "boss" && e.phase2;
  }).length === 0);

// 双影：一回合两段，每段 55%（合计略高于原本的一击，但慢在护盾是按段吃的）
var ph1 = freshRun();
var bTwin = makeBattle(ph1, {
  enemyId: "riftWarden", boss: true, phase: 2, phaseHits: 2, trait: "none",
  hp: 500, maxHp: 500, damageRange: [10, 10]
});
stateApi.enemyTurn(ph1);
ok("双影一回合打两段（10 → 6+6）", ph1.player.hp === 88, "玩家 " + ph1.player.hp);
ok("双影的日志报的是连击次数而不是单次伤害",
  bTwin.logs.some(function (t) { return t.indexOf("连击 2 次") >= 0; }), bTwin.logs[0]);

// 防御架势只保第一段：蹲下换来的免伤在两段面前只剩一半
var ph1b = freshRun();
makeBattle(ph1b, {
  enemyId: "riftWarden", boss: true, phase: 2, phaseHits: 2, trait: "none",
  hp: 500, maxHp: 500, damageRange: [10, 10], defenseStance: true
});
stateApi.enemyTurn(ph1b);
ok("双影面前防御架势只挡第一段（6×0.6 + 6 = 10）", ph1b.player.hp === 90, "玩家 " + ph1b.player.hp);

// 查票：重复上回合同一招 = 伤害 +45%，换招就打回原形
var ph2a = freshRun();
var bTicket = makeBattle(ph2a, {
  enemyId: "facelessConductor", boss: true, phase: 2, trait: "none",
  hp: 500, maxHp: 500, damageRange: [10, 10],
  lastAction: "precise", prevAction: "precise"
});
stateApi.enemyTurn(ph2a);
ok("查票对重复动作加伤 45%（10 → 15）", ph2a.player.hp === 85, "玩家 " + ph2a.player.hp);
ok("查票会把原因说出口", bTicket.logs.some(function (t) { return t.indexOf("认得这个动作") >= 0; }),
  bTicket.logs[0]);

var ph2b = freshRun();
bTicket = makeBattle(ph2b, {
  enemyId: "facelessConductor", boss: true, phase: 2, trait: "none",
  hp: 500, maxHp: 500, damageRange: [10, 10],
  lastAction: "defend", prevAction: "precise"
});
stateApi.enemyTurn(ph2b);
ok("换了招就吃不到查票的惩罚", ph2b.player.hp === 90, "玩家 " + ph2b.player.hp);

// 过载：它变强的方式是把自己烧掉
var ph3 = freshRun();
var bOver = makeBattle(ph3, {
  enemyId: "rustStoker", boss: true, phase: 2, trait: "none",
  hp: 500, maxHp: 500, damageRange: [10, 10]
});
stateApi.enemyTurn(ph3);
ok("过载出手重 30%（10 → 13）", ph3.player.hp === 87, "玩家 " + ph3.player.hp);
ok("过载每回合自损 5 点", bOver.hp === 495, "敌人 " + bOver.hp);
ok("过载的自损不会把它自己耗死", (function () {
  var t5 = freshRun();
  var b = makeBattle(t5, {
    enemyId: "rustStoker", boss: true, phase: 2, trait: "none",
    hp: 4, maxHp: 500, damageRange: [0, 0]
  });
  stateApi.enemyTurn(t5);
  return b.hp === 1;
})());

// 脱轨：35% 概率追加一击，掷骰子这件事必须能被测试钉住
var ph4 = freshRun();
makeBattle(ph4, {
  enemyId: "brokenSwitchman", boss: true, phase: 2, trait: "none",
  hp: 500, maxHp: 500, damageRange: [10, 10]
});
var randBackup = Math.random;
Math.random = function () { return 0; }; // 必中追加
stateApi.enemyTurn(ph4);
Math.random = randBackup;
ok("脱轨命中追加时多打一段（10 + 6）", ph4.player.hp === 84, "玩家 " + ph4.player.hp);

var ph4b = freshRun();
makeBattle(ph4b, {
  enemyId: "brokenSwitchman", boss: true, phase: 2, trait: "none",
  hp: 500, maxHp: 500, damageRange: [10, 10]
});
Math.random = function () { return 0.99; }; // 不追加
stateApi.enemyTurn(ph4b);
Math.random = randBackup;
ok("脱轨没掷中时就是一记普通攻击", ph4b.player.hp === 90, "玩家 " + ph4b.player.hp);

// 换宿主：穿盾 + 药剂减半，两条都是「别拖」的理由
var ph5 = freshRun();
var bHost = makeBattle(ph5, {
  enemyId: "thePassenger", boss: true, phase: 2, trait: "none",
  hp: 500, maxHp: 500, damageRange: [10, 10]
});
stateApi.enemyTurn(ph5);
ok("换宿主每回合穿盾扣 3 点（10 + 3）", ph5.player.hp === 87, "玩家 " + ph5.player.hp);
ok("换宿主的穿盾伤害在日志里单独说明",
  bHost.logs.some(function (t) { return t.indexOf("翻了个身") >= 0; }), bHost.logs[0]);

var ph5b = freshRun();
ph5b.player.hp = 50;
ph5b.player.inventory.potion = 2;
var bHealCut = makeBattle(ph5b, {
  enemyId: "thePassenger", boss: true, phase: 2, trait: "none",
  hp: 500, maxHp: 500, damageRange: [0, 0]
});
ph5b.player.hp = 50;
stateApi.battleAction(ph5b, "potion");
// 药剂 30 → 只回 15，回合末再被穿盾扣 3：50 + 15 - 3 = 62
ok("换宿主时药剂只回一半（30 → 15）", ph5b.player.hp === 62, "玩家 " + ph5b.player.hp);

// 第一形态必须干净：同一只 Boss 在半血前不该带上任何第二形态的机制
var ph6 = freshRun();
makeBattle(ph6, {
  enemyId: "thePassenger", boss: true, phase: 1, trait: "none",
  hp: 500, maxHp: 500, damageRange: [10, 10]
});
stateApi.enemyTurn(ph6);
ok("第一形态不吃第二形态的机制", ph6.player.hp === 90, "玩家 " + ph6.player.hp);

// 兜底：模板上没写 phase2 的对手仍走旧的那套（旧存档 / 未来新增 Boss 不会崩）
var ph7 = freshRun();
var bFallback = makeBattle(ph7, {
  boss: true, hp: 100, maxHp: 100, damageRange: [10, 10]
});
bFallback.hp = 40;
stateApi.battleAction(ph7, "precise");
ok("没有 phase2 数据的 Boss 退回通用形态",
  bFallback.phase === 2 && bFallback.damageRange[0] === 13 && bFallback.phaseLabel === "第二阶段",
  "label=" + bFallback.phaseLabel + " dmg=" + bFallback.damageRange.join("-"));

// 存档往返：形态名与段数丢了，等于读档后偷偷把双影改成单体
var ph8 = freshRun();
makeBattle(ph8, {
  enemyId: "riftWarden", boss: true, phase: 2, phaseHits: 2, phaseLabel: "双影",
  hp: 40, maxHp: 100, damageRange: [13, 13], lastAction: "precise", prevAction: "defend"
});
var savedPh = storage.sanitizeRun(JSON.parse(JSON.stringify(ph8.run)));
ok("形态名与段数能存档往返",
  savedPh.battle.phaseLabel === "双影" && savedPh.battle.phaseHits === 2,
  savedPh.battle.phaseLabel + "/" + savedPh.battle.phaseHits);
ok("动作记录能存档往返（查票读档后仍然记得）",
  savedPh.battle.lastAction === "precise" && savedPh.battle.prevAction === "defend",
  savedPh.battle.lastAction + "/" + savedPh.battle.prevAction);

var dirtyPh = JSON.parse(JSON.stringify(ph8.run));
dirtyPh.battle.lastAction = "hackTheGame";
dirtyPh.battle.phaseHits = 9;
dirtyPh.battle.phaseLabel = "一个特别特别长的形态名";
var cleanPh = storage.sanitizeRun(dirtyPh).battle;
ok("非法动作 id 被清空、段数被夹紧、形态名被截断",
  cleanPh.lastAction === null && cleanPh.phaseHits === 3 && cleanPh.phaseLabel.length <= 6,
  cleanPh.lastAction + "/" + cleanPh.phaseHits + "/" + cleanPh.phaseLabel);

// 表现层：形态名要画出来，双影要真的画出两个剪影
var ph9 = freshRun();
makeBattle(ph9, {
  enemyId: "riftWarden", boss: true, phase: 2, phaseHits: 2, phaseLabel: "双影",
  hp: 60, maxHp: 120, damageRange: [10, 10]
});
var twinRec = renderBattleTexts(ph9);
ok("面板上写的是形态名而不是「第二阶段」",
  twinRec.texts.indexOf("双影") >= 0 && twinRec.texts.indexOf("第二阶段") < 0,
  JSON.stringify(twinRec.texts.slice(0, 8)));

var ph10 = freshRun();
makeBattle(ph10, {
  enemyId: "rustStoker", boss: true, phase: 2, phaseHits: 1, phaseLabel: "过载",
  hp: 60, maxHp: 120, damageRange: [10, 10]
});
// 画面里同时有主角和敌人，绝对值会随布局变；这里只比「多出来那一具剪影」
var singleBodies = bodyScales(renderBattleTexts(ph10)).length;
ok("双影比单段形态多画一具剪影", bodyScales(twinRec).length === singleBodies + 1,
  bodyScales(twinRec).length + " vs " + singleBodies);

var ph11 = freshRun();
makeBattle(ph11, {
  boss: true, phase: 2, hp: 60, maxHp: 120, damageRange: [10, 10]
});
ok("老存档没有形态名时退回通用文案",
  renderBattleTexts(ph11).texts.indexOf("第二阶段") >= 0);

// 窄屏 + 词缀 + 形态名三个徽标挤一行：谁都不许被裁掉、也不许盖住名字
var narrowT = screenApiT.createScreen({ screenWidth: 320, screenHeight: 640 });
var ph12 = freshRun();
makeBattle(ph12, {
  enemyId: "thePassenger", boss: true, phase: 2, phaseHits: 1, phaseLabel: "换宿主",
  hp: 60, maxHp: 120, damageRange: [10, 10],
  affix: "greedy", affixName: "贪婪", affixDesc: "金币翻倍，攻击更狠"
});
var narrowStub = stubCtx();
uiApiT.beginFrame(narrowT, 0);
battleModalT.render(narrowStub.ctx, narrowT, ph12, tweenApiT.createAnimator(), 1200);
var chipPut = narrowStub.rec.textPuts.filter(function (p) { return p[0] === "换宿主"; })[0];
ok("窄屏上形态名徽标不被裁掉",
  !!chipPut && chipPut[1] >= 0 && chipPut[1] + 3 * 6 + 12 <= narrowT.width,
  JSON.stringify(chipPut));
var namePut = narrowStub.rec.textPuts.filter(function (p) { return p[0] === "测试体"; })[0];
ok("形态名徽标不会盖住敌人名字",
  !!namePut && !!chipPut && namePut[1] + Math.min(3, "测试体".length) * 20 <= chipPut[1],
  JSON.stringify(namePut) + " chip=" + JSON.stringify(chipPut));

/* ---------------- Boss 登场卡 ---------------- */

section("Boss 登场卡");

function stubApp() {
  return {
    sound: function () {},
    commit: function () {},
    fx: function () { return null; },
    toast: function () {},
    openInfo: function () {},
    requestAd: function () {}
  };
}

// 走真实的 startBattle，不手搓字段：手搓就测不到「开战时有没有写卡」
var bi1 = freshRun();
stateApi.startBattle(bi1, "boss");
var bossB1 = bi1.run.battle;
ok("Boss 战开局先亮登场卡", bossB1.introOpen === true);
ok("登场卡带一句预感",
  typeof bossB1.introHint === "string" && bossB1.introHint.length > 0,
  String(bossB1.introHint));

var bi2 = freshRun();
stateApi.startBattle(bi2, "normal");
ok("普通战斗不插登场卡", bi2.run.battle.introOpen === false);

// 卡片占满面板：这一帧不应该画任何行动按钮，否则玩家会以为能直接出招
var recIntro = renderBattleTexts(bi1);
ok("卡片上没有战斗行动按钮",
  recIntro.texts.indexOf("精准射击") < 0
  && recIntro.texts.indexOf("防御架势") < 0
  && recIntro.texts.indexOf("秒杀卡") < 0,
  JSON.stringify(recIntro.texts));
ok("卡片上画了敌人名字、预感和「迎战」",
  recIntro.texts.indexOf(bossB1.name) >= 0
  && recIntro.texts.indexOf(bossB1.introHint) >= 0
  && recIntro.texts.indexOf("迎战") >= 0,
  JSON.stringify(recIntro.texts.slice(0, 10)));
ok("卡片去掉了 intro 里的「Boss：」前缀",
  recIntro.texts.filter(function (t) { return t.indexOf("Boss：") === 0; }).length === 0,
  JSON.stringify(recIntro.texts));

// 越界检查用命中区而不是截图：坐标是确定的，截图会随 dpr 与字体渲染漂
var introHit = uiApiT.getHits().filter(function (h) { return h.id === "battle:intro"; })[0];
ok("整块面板都是「关掉卡片」的点击区",
  !!introHit && introHit.rect.w >= scrT.width - scrT.pad * 2 - 1,
  JSON.stringify(introHit && introHit.rect));
var introOut = recIntro.textPuts.filter(function (p) {
  return p[1] < introHit.rect.x - 1
    || p[1] > introHit.rect.x + introHit.rect.w + 1
    || p[2] < introHit.rect.y - 1
    || p[2] > introHit.rect.y + introHit.rect.h + 1;
});
ok("卡片文字全部落在面板内", introOut.length === 0, JSON.stringify(introOut.slice(0, 3)));

// 关掉卡片：不消耗回合、不掉血、不进敌方回合
var hpBeforeIntro = bi1.player.hp;
var turnBeforeIntro = bossB1.turn;
var ehpBeforeIntro = bossB1.hp;
var handledIntro = battleModalT.onAction({ id: "battle:intro" }, bi1, stubApp());
ok("点一下就能关掉卡片", handledIntro === true && bossB1.introOpen === false);
ok("关卡片不消耗回合、不掉血",
  bi1.player.hp === hpBeforeIntro
  && bossB1.turn === turnBeforeIntro
  && bossB1.hp === ehpBeforeIntro
  && bossB1.over === false,
  "hp=" + bi1.player.hp + " turn=" + bossB1.turn);

// 卡片开着时手指落在旧按钮位置：只能关卡，不能替他出招
var bi3 = freshRun();
stateApi.startBattle(bi3, "boss");
var bossB3 = bi3.run.battle;
var hp3 = bi3.player.hp;
battleModalT.onAction({ id: "battle:precise" }, bi3, stubApp());
ok("卡片开着时点到行动按钮只关卡，不替他出招",
  bossB3.introOpen === false
  && bossB3.hp === bossB3.maxHp
  && bossB3.turn === 1
  && bi3.player.hp === hp3,
  "hp=" + bossB3.hp + "/" + bossB3.maxHp + " turn=" + bossB3.turn);

var recAfterIntro = renderBattleTexts(bi1);
ok("卡片关掉后面板恢复行动按钮",
  recAfterIntro.texts.indexOf("精准射击") >= 0
  && recAfterIntro.texts.indexOf("迎战") < 0,
  JSON.stringify(recAfterIntro.texts.slice(0, 8)));

// 存档往返：切后台时卡还开着，读回来必须是同一张卡
var bi4 = freshRun();
stateApi.startBattle(bi4, "boss");
var savedIntro = storage.sanitizeRun(JSON.parse(JSON.stringify(bi4.run)));
ok("登场卡的开合状态与预感能存档往返",
  savedIntro.battle.introOpen === true
  && savedIntro.battle.introHint === bi4.run.battle.introHint,
  String(savedIntro.battle.introHint));

var bi5 = freshRun();
makeBattle(bi5, { boss: true, introOpen: false, introHint: "x" });
var savedIntro2 = storage.sanitizeRun(JSON.parse(JSON.stringify(bi5.run)));
ok("已经看过的卡不会被读档重新打开", savedIntro2.battle.introOpen === false);

// 数据护栏：五个 Boss 的预感必须各不相同，且不许把机制直接写出来
var bossHints = [];
var bossNoHint = [];
enemiesAllT.forEach(function (def) {
  if (def.kind !== "boss") return;
  if (!def.phase2 || !def.phase2.hint) bossNoHint.push(def.id);
  else bossHints.push(def.phase2.hint);
});
ok("每个 Boss 都有预感", enemiesAllT.filter(function (d) { return d.kind === "boss"; }).length === 5
  && bossNoHint.length === 0, JSON.stringify(bossNoHint));
ok("五句预感互不相同", bossHints.length === 5
  && bossHints.filter(function (h, i) { return bossHints.indexOf(h) === i; }).length === 5);
ok("预感不剧透形态名（说破就变成说明书）",
  bossHints.every(function (h) {
    return ["双影", "查票", "过载", "脱轨", "换宿主", "第二阶段", "半血"].every(function (w) {
      return h.indexOf(w) < 0;
    });
  }), JSON.stringify(bossHints));

/* ---------------- 共鸣：落地（登场卡预感的兑现） ---------------- */

section("登场卡的呼应");

var cb1 = freshRun();
var bCb1 = makeBattle(cb1, {
  enemyId: "riftWarden", boss: true, hp: 100, maxHp: 100, damageRange: [10, 10],
  introHint: "它站在灯下的角度不太对——影子比身体多出一层。"
});
bCb1.hp = 40;
stateApi.battleAction(cb1, "precise");

var cbText = "「你终于看清了——它从来都不是一个。」";
var cbLineText = "它从正中裂开，第二个影子站了起来。";
var cbIdx = bCb1.logs.indexOf(cbText);
var cbLineIdx = bCb1.logs.indexOf(cbLineText);
ok("半血崩开时写出呼应句", cbIdx >= 0, JSON.stringify(bCb1.logs.slice(0, 5)));
ok("呼应句紧贴在崩开描述下面一行（事件在前、醒悟在后）",
  cbIdx >= 0 && cbIdx === cbLineIdx + 1,
  "callback=" + cbIdx + " line=" + cbLineIdx);
ok("呼应句不是预感的复读",
  cbText !== bCb1.introHint && bCb1.introHint.length > 0);
ok("呼应句用「」括起来（是玩家脑子里的声音，不是战场播报）",
  cbText.charAt(0) === "「" && cbText.charAt(cbText.length - 1) === "」");

// 没看过登场卡（0.9.4 的老存档打到一半读回来）：没有铺垫，就不该有这句醒悟
var cb2 = freshRun();
var bCb2 = makeBattle(cb2, {
  enemyId: "riftWarden", boss: true, hp: 100, maxHp: 100, damageRange: [10, 10]
});
bCb2.hp = 40;
stateApi.battleAction(cb2, "precise");
ok("没看过登场卡时不写呼应（没有铺垫就没有醒悟）",
  bCb2.phase === 2 && bCb2.logs.indexOf(cbText) < 0,
  JSON.stringify(bCb2.logs.slice(0, 4)));

// 数据护栏：预感与呼应必须成对，且呼应不许写成规则说明
var cbMissingHint = [];
var cbMissing = [];
var cbRuleWords = ["护盾", "伤害 +", "概率", "倍", "回合", "点生命", "%"];
var cbRuleHits = [];
enemiesAllT.forEach(function (def) {
  if (def.kind !== "boss") return;
  var p2 = def.phase2;
  if (!p2) return;
  if (!p2.hint && p2.callback) cbMissingHint.push(def.id);
  if (p2.hint && !p2.callback) cbMissing.push(def.id);
  if (p2.callback) {
    cbRuleWords.forEach(function (w) {
      if (p2.callback.indexOf(w) >= 0) cbRuleHits.push(def.id + ":" + w);
    });
  }
});
ok("有呼应就一定有预感（否则句子没有根）", cbMissingHint.length === 0,
  JSON.stringify(cbMissingHint));
ok("每个 Boss 的预感都有呼应（埋了就该收）", cbMissing.length === 0,
  JSON.stringify(cbMissing));
ok("呼应写得像台词而不是规则说明", cbRuleHits.length === 0,
  JSON.stringify(cbRuleHits));

/* ---------------- 汇总 ---------------- */
console.log("\n" + "=".repeat(46));
console.log("通过 " + PASS + " / " + (PASS + FAIL));
if (FAIL) {
  console.log("失败项：");
  failures.forEach(function (name) { console.log("  - " + name); });
}
console.log("=".repeat(46));
process.exit(FAIL ? 1 : 0);
