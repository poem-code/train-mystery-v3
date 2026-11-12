/**
 * state.js —— 全局状态与纯玩法逻辑（无渲染、无存档、无平台依赖，可直接单测）
 *
 * 分层：
 *   局外（player / meta / progress）  ← 列车主城、每日签到、列车升级
 *   局内（run）                       ← 路线、战斗、事件、强化、遗物、结算
 *
 * 约定：
 * - 所有函数第一个参数是 state，就地修改并返回结果对象。
 * - 函数只改数据，不落盘、不弹窗、不 toast；由 main.js 统一 commit。
 * - 随机：地图用 seed 复现（rng.createRng），战斗用全局 rng。
 */

var config = require("./config");
var mapApi = require("./map");
var rng = require("./rng");
var enemiesApi = require("./data/enemies");
var relicsApi = require("./data/relics");
var relicSetsApi = require("./data/relicSets");
var enhApi = require("./data/enhancements");
var eventsApi = require("./data/events");
var itemsApi = require("./data/items");
var effectsApi = require("./data/effects");
var affixesApi = require("./data/affixes");
var achievementsApi = require("./data/achievements");
var dailyApi = require("./data/daily");
var themesApi = require("./data/themes");

/* ---------------- 基础工具 ---------------- */

function clamp(value, min, max) {
  var n = Number(value);
  if (!isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function pad2(value) {
  var n = Math.floor(Math.abs(Number(value) || 0));
  return n < 10 ? "0" + n : String(n);
}

function formatDateKey(time) {
  var d = new Date(time);
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

/** 解析 YYYY-MM-DD：不能用 new Date(key)，ES 规范按 UTC 解析会退一天 */
function parseDateKey(key) {
  if (typeof key !== "string") return null;
  var parts = key.split("-");
  if (parts.length !== 3) return null;
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  var d = parseInt(parts[2], 10);
  if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return null;
  return new Date(y, m - 1, d);
}

function dayDiff(fromKey, toKey) {
  var from = parseDateKey(fromKey);
  var to = parseDateKey(toKey);
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function makeLog(title, text) {
  return {
    title: String(title).slice(0, 12),
    text: String(text).slice(0, 120),
    id: String(Date.now()) + "-" + Math.random().toString(16).slice(2, 6)
  };
}

function pushLog(state, title, text) {
  state.logs.unshift(makeLog(title, text));
  if (state.logs.length > 20) state.logs = state.logs.slice(0, 20);
}

/* ---------------- 初始状态 ---------------- */

function createRun(seed) {
  return {
    seed: seed,
    active: false,
    completed: false,
    failed: false,
    layers: [],
    currentNodeId: null,
    layer: -1,
    route: [],
    nodesVisited: 0,
    battle: null,
    eventId: null,
    eventChoiceIndex: -1,
    eventResult: null,
    eventFollowUp: null,
    pendingEnhancements: null,
    pendingRelicId: null,
    effects: effectsApi.emptyEffects(),
    relics: [],
    /** 各序列已发放的档位数量：{ setId: 2 } 表示前两档已生效，避免重复叠加 */
    setActive: {},
    enhancements: [],
    recentEvents: [],
    /** 事件链进度：{ chainId: 已完成段数 } */
    chains: {},
    /** 当前正在展示的链事件（仅用于界面标注） */
    eventChain: null,
    /** 每日挑战信息：普通局为 null */
    daily: null,
    /** 本局车厢主题 id（route 场景可切换，只影响本局） */
    theme: "rust",
    stats: {
      battlesWon: 0,
      damageDealt: 0,
      etherGained: 0,
      turns: 0,
      shopsVisited: 0
    }
  };
}

/* ---------------- 修正符（每日条件 + 车厢主题） ---------------- */

/**
 * 把「每日限制」与「车厢主题」合并成一套修正符。
 *
 * 两边的字段形状刻意做成一致（daily.combine 的输出），所以合并只写一次，
 * 消费点也只需要读 run 的合并结果，不用各自判断来源。
 * 加法字段（delta）相加，乘法字段（mul）相乘。
 */
function modsOf(run) {
  var out = {
    maxHpDelta: 0,
    hungerPerNodeDelta: 0,
    enemyDamageMul: 1,
    sanityCostMul: 1,
    enhanceChoiceDelta: 0,
    shopPriceMul: 1,
    enemyHpMul: 1,
    goldMul: 1,
    startEtherBonus: 0
  };

  function merge(m) {
    if (!m) return;
    out.maxHpDelta += m.maxHpDelta || 0;
    out.hungerPerNodeDelta += m.hungerPerNodeDelta || 0;
    out.enemyDamageMul *= m.enemyDamageMul || 1;
    out.sanityCostMul *= m.sanityCostMul || 1;
    out.enhanceChoiceDelta += m.enhanceChoiceDelta || 0;
    out.shopPriceMul *= m.shopPriceMul || 1;
    out.enemyHpMul *= m.enemyHpMul || 1;
    out.goldMul *= m.goldMul || 1;
    out.startEtherBonus += m.startEtherBonus || 0;
  }

  if (run && run.daily) merge(run.daily.combined);
  var theme = run && run.theme ? themesApi.getById(run.theme) : null;
  if (theme) merge(theme.mods);
  return out;
}

/**
 * 主题亲和权重：喜欢的 ×3，明确属于别的主题的 ×0.4，
 * 没打标签的 ×1（通用）。用权重而不是硬过滤——硬过滤会让池子在
 * 低层数下变空，最后还是会 fallback，等于白写。
 */
function themeWeight(list, themeId) {
  if (!list || !list.length || !themeId) return 1;
  return list.indexOf(themeId) >= 0 ? 3 : 0.4;
}

/** 按权重展开成桶再随机取一个，保持与 rng.pick 一致的确定性 */
function weightedPick(list, themeId) {
  var basket = [];
  var i;
  var j;
  for (i = 0; i < list.length; i += 1) {
    var n = Math.round(themeWeight(list[i].themes, themeId) * 4);
    for (j = 0; j < n; j += 1) basket.push(list[i]);
  }
  if (!basket.length) basket = list;
  return rng.pick(basket);
}

/* ---------------- 主题解锁与选择 ---------------- */

function themeUnlocked(state, id) {
  var list = state.progress.themeUnlocked || [];
  return list.indexOf(id) >= 0;
}

function selectedThemeId(state) {
  var id = state.progress.themeSelected;
  if (id && themesApi.getById(id) && themeUnlocked(state, id)) return id;
  return "rust";
}

function themeSummary(state) {
  var unlocked = state.progress.themeUnlocked || [];
  return {
    selected: selectedThemeId(state),
    total: themesApi.THEMES.length,
    unlocked: unlocked.length
  };
}

function selectTheme(state, id) {
  if (!themesApi.getById(id)) return { ok: false, reason: "unknown" };
  if (!themeUnlocked(state, id)) return { ok: false, reason: "locked" };
  // 局内不允许改：换主题会立刻改敌人伤害倍率，
  // 「快死了切霜封」这类操作会把难度设计作废。本局锁定，下一局生效。
  if (state.run && state.run.active) return { ok: false, reason: "inRun" };
  state.progress.themeSelected = id;
  return { ok: true, id: id };
}

function unlockTheme(state, id) {
  var theme = themesApi.getById(id);
  if (!theme) return { ok: false, reason: "unknown" };
  if (themeUnlocked(state, id)) return { ok: false, reason: "owned" };
  if (state.run && state.run.active) return { ok: false, reason: "inRun" };
  if (state.player.ether < theme.unlockCost) return { ok: false, reason: "poor" };
  state.player.ether -= theme.unlockCost;
  state.progress.themeUnlocked.push(id);
  state.progress.themeSelected = id;
  pushLog(state, "解锁", "「" + theme.name + "」已接通，路线图上可以切换了。");
  return { ok: true, id: id, cost: theme.unlockCost };
}

function createDefaultState(now) {
  var time = now || Date.now();
  return {
    schemaVersion: config.schemaVersion,
    player: {
      hp: config.maxHp,
      maxHp: config.maxHp,
      hunger: config.maxHunger,
      sanity: config.maxSanity,
      ether: config.starterEther,
      gold: config.starterGold,
      baseAttack: config.baseAttack,
      inventory: {
        portableFood: 1,
        potion: 2,
        retryCard: 0,
        executeCard: 0
      }
    },
    meta: {
      createdAt: time,
      lastLoginDate: formatDateKey(time),
      loginStreak: 1,
      lastFreeFoodDate: null,
      lastSanityRestoreAt: 0,
      adViewDate: formatDateKey(time),
      adViewsToday: 0,
      tutorialSeen: false,
      totalPlayMs: 0,
      // soundOn 保留：老存档只有这一个开关，读档时映射到 sfxOn
      soundOn: true,
      bgmOn: true,
      sfxOn: true,
      vibrationOn: true
    },
    progress: {
      runsStarted: 0,
      runsCleared: 0,
      bossClears: 0,
      bestLayer: 0,
      totalEther: 0,
      trainUpgrades: { diner: 0, medbay: 0, engine: 0, cargo: 0, observatory: 0 },
      /** 永久图鉴：只存「见过/击败次数」，不存数据表副本 */
      codex: {
        enemies: {},
        relics: {},
        enhancements: {},
        tier: 0
      },
      /** 成就：id → 解锁时间戳 */
      achievements: {},
      /** 跨局累计统计，成就指标从这里来 */
      stats: {
        battlesWon: 0,
        maxRelics: 0,
        maxEnhancements: 0,
        perfectBossWins: 0,
        lowSanityClears: 0,
        noRelicClears: 0
      },
      /** 每日挑战记录 */
      daily: {
        lastDate: null,
        streak: 0,
        clears: 0,
        attempts: 0,
        bestLayer: -1
      },
      /** 已解锁的车厢主题（rust 默认解锁） */
      themeUnlocked: ["rust"],
      themeSelected: "rust"
    },
    current: {
      scene: "home",
      modal: null,
      modalData: null
    },
    run: createRun(1),
    logs: [makeLog("系统", "列车完成检修，新的路线可以出发了。")]
  };
}

/* ---------------- 货币与道具 ---------------- */

function grantCurrency(state, delta) {
  var d = delta || {};
  var before = state.player.ether;
  state.player.ether = clamp(state.player.ether + (d.ether || 0), 0, config.maxEther);
  state.player.gold = clamp(state.player.gold + (d.gold || 0), 0, config.maxGold);
  var gained = state.player.ether - before;
  if (gained > 0) {
    state.progress.totalEther += gained;
    if (state.run && state.run.active) state.run.stats.etherGained += gained;
  }
  return gained;
}

function spendCurrency(state, type, amount) {
  var key = type === "gold" ? "gold" : "ether";
  if (state.player[key] < amount) return false;
  state.player[key] -= amount;
  return true;
}

function grantItems(state, items) {
  if (!items) return;
  var key;
  for (key in items) {
    if (!Object.prototype.hasOwnProperty.call(items, key)) continue;
    if (state.player.inventory[key] === undefined) state.player.inventory[key] = 0;
    state.player.inventory[key] = clamp(state.player.inventory[key] + items[key], 0, 99);
  }
}

/* ---------------- 局外：每日 / 补给 / 升级 ---------------- */

function handleDailyLogin(state, now) {
  var today = formatDateKey(now);
  var changed = false;

  if (state.meta.adViewDate !== today) {
    state.meta.adViewDate = today;
    state.meta.adViewsToday = 0;
  }

  if (state.meta.lastLoginDate !== today) {
    var diff = dayDiff(state.meta.lastLoginDate, today);
    state.meta.loginStreak = diff === 1 ? state.meta.loginStreak + 1 : 1;
    state.meta.lastLoginDate = today;
    pushLog(state, "签到", "连续登录 " + state.meta.loginStreak + " 天。");
    changed = true;

    if (state.meta.loginStreak === 3) {
      grantItems(state, { retryCard: 1 });
      pushLog(state, "签到奖励", "连登 3 天，获得 1 张重战卡。");
    }
    if (state.meta.loginStreak === 7) {
      grantItems(state, { executeCard: 1 });
      pushLog(state, "签到奖励", "连登 7 天，获得 1 张秒杀卡。");
    }
  }
  return changed;
}

function restoreSanity(state, now) {
  var left = config.sanityRestoreCooldownMs - (now - state.meta.lastSanityRestoreAt);
  if (left > 0) {
    return { ok: false, message: "恢复装置冷却中，还需 " + Math.ceil(left / 1000) + " 秒。" };
  }
  state.player.sanity = config.maxSanity;
  state.meta.lastSanityRestoreAt = now;
  pushLog(state, "恢复装置", "精神值已恢复至满值。");
  return { ok: true, message: "精神值已恢复至满值。" };
}

function sanityCooldownLeft(state, now) {
  return Math.max(0, config.sanityRestoreCooldownMs - (now - state.meta.lastSanityRestoreAt));
}

function claimFreeFood(state, now) {
  var today = formatDateKey(now);
  if (state.meta.lastFreeFoodDate === today) {
    return { ok: false, message: "今天的补给已经领过了。" };
  }
  var heal = config.dailyFoodRestore + state.progress.trainUpgrades.diner * config.dailyFoodByDiner;
  state.meta.lastFreeFoodDate = today;
  state.player.hunger = clamp(state.player.hunger + heal, 0, config.maxHunger);
  pushLog(state, "补给站", "领取今日补给，恢复 " + heal + " 饱食度。");
  return { ok: true, message: "恢复 " + heal + " 点饱食度。" };
}

function usePortableFood(state) {
  if (state.player.inventory.portableFood <= 0) {
    return { ok: false, message: "没有便携食物。" };
  }
  state.player.inventory.portableFood -= 1;
  state.player.hunger = clamp(state.player.hunger + config.portableFoodRestore, 0, config.maxHunger);
  pushLog(state, "补给", "你食用了便携食物。");
  return { ok: true, message: "饱食度 +" + config.portableFoodRestore };
}

function upgradeCost(state, partId) {
  var def = config.trainUpgrades[partId];
  if (!def) return null;
  var level = state.progress.trainUpgrades[partId] || 0;
  if (level >= def.maxLevel) return null;
  return {
    ether: def.baseEther + level * Math.round(def.baseEther * 0.6),
    gold: def.baseGold + Math.floor(level / 2)
  };
}

function upgradeTrain(state, partId) {
  var def = config.trainUpgrades[partId];
  var cost = upgradeCost(state, partId);
  if (!def) return { ok: false, message: "未知模块。" };
  if (!cost) return { ok: false, message: def.name + " 已满级。" };
  if (state.player.ether < cost.ether || state.player.gold < cost.gold) {
    return { ok: false, message: "资源不足。" };
  }
  state.player.ether -= cost.ether;
  state.player.gold -= cost.gold;
  state.progress.trainUpgrades[partId] += 1;
  pushLog(state, "列车升级", def.name + " 升至 Lv." + state.progress.trainUpgrades[partId] + "。");
  return { ok: true, message: def.name + " 升级成功。" };
}

/* ---------------- 图鉴（永久解锁） ---------------- */

function codexTotals() {
  return {
    enemies: enemiesApi.ENEMIES.length,
    relics: relicsApi.RELICS.length,
    enhancements: enhApi.ENHANCEMENTS.length
  };
}

/** 进入战斗 / 打开图鉴时记录「见过」 */
function markEnemySeen(state, enemyId) {
  if (!enemyId) return;
  var codex = state.progress.codex;
  if (!codex.enemies[enemyId]) codex.enemies[enemyId] = { seen: 1, defeats: 0 };
}

function markEnemyDefeated(state, enemyId) {
  if (!enemyId) return;
  var codex = state.progress.codex;
  if (!codex.enemies[enemyId]) codex.enemies[enemyId] = { seen: 1, defeats: 0 };
  codex.enemies[enemyId].defeats = clamp(codex.enemies[enemyId].defeats + 1, 0, 99999);
}

function markRelicObtained(state, relicId) {
  if (relicId) state.progress.codex.relics[relicId] = 1;
}

function markEnhancementObtained(state, enhId) {
  if (enhId) state.progress.codex.enhancements[enhId] = 1;
}

function codexSummary(state) {
  var codex = state.progress.codex;
  var totals = codexTotals();
  var enemiesSeen = 0;
  var id;
  for (id in codex.enemies) {
    if (Object.prototype.hasOwnProperty.call(codex.enemies, id) && codex.enemies[id].seen) enemiesSeen += 1;
  }
  var relicCount = 0;
  for (id in codex.relics) {
    if (Object.prototype.hasOwnProperty.call(codex.relics, id) && codex.relics[id]) relicCount += 1;
  }
  var enhCount = 0;
  for (id in codex.enhancements) {
    if (Object.prototype.hasOwnProperty.call(codex.enhancements, id) && codex.enhancements[id]) enhCount += 1;
  }
  var total = totals.enemies + totals.relics + totals.enhancements;
  var unlocked = enemiesSeen + relicCount + enhCount;
  return {
    enemiesSeen: enemiesSeen,
    enemiesTotal: totals.enemies,
    relics: relicCount,
    relicsTotal: totals.relics,
    enhancements: enhCount,
    enhancementsTotal: totals.enhancements,
    unlocked: unlocked,
    total: total,
    percent: total > 0 ? Math.round((unlocked / total) * 100) : 0
  };
}

/**
 * 图鉴进度奖励：每跨过一个档位（25/50/75/100%）发一次以太。
 * 这是把「收集」变成「变强」的桥——没有奖励的图鉴只会被当成说明书。
 */
function checkCodexReward(state) {
  var summary = codexSummary(state);
  var codex = state.progress.codex;
  var tiers = config.codex.tiers;
  var granted = 0;
  while (codex.tier < tiers.length && summary.percent >= tiers[codex.tier]) {
    codex.tier += 1;
    grantCurrency(state, { ether: config.codex.rewardPerTier });
    pushLog(state, "图鉴", "图鉴进度达到 " + tiers[codex.tier - 1] + "%，获得 " + config.codex.rewardPerTier + " 以太。");
    granted += config.codex.rewardPerTier;
  }
  return granted;
}

/* ---------------- 成就 ---------------- */

function computeMetrics(state) {
  var p = state.progress;
  return {
    bossClears: p.bossClears,
    bestLayer: p.bestLayer,
    maxRelics: p.stats.maxRelics,
    maxEnhancements: p.stats.maxEnhancements,
    perfectBossWins: p.stats.perfectBossWins,
    lowSanityClears: p.stats.lowSanityClears,
    noRelicClears: p.stats.noRelicClears,
    codexPercent: codexSummary(state).percent,
    dailyClears: p.daily.clears
  };
}

/**
 * 成就检查：声明式指标比对，解锁即发以太。
 * 返回本次新解锁的成就列表（供界面提示）。
 */
function evaluateAchievements(state) {
  var metrics = computeMetrics(state);
  var unlocked = [];
  var list = achievementsApi.ACHIEVEMENTS;
  var i;
  for (i = 0; i < list.length; i += 1) {
    var item = list[i];
    if (state.progress.achievements[item.id]) continue;
    if (metrics[item.metric] >= item.target) {
      state.progress.achievements[item.id] = Date.now();
      grantCurrency(state, { ether: item.reward });
      pushLog(state, "成就", "解锁「" + item.name + "」，获得 " + item.reward + " 以太。");
      unlocked.push(item);
    }
  }
  return unlocked;
}

/** 已解锁数量，用于主城入口角标 */
function achievementCount(state) {
  var count = 0;
  var id;
  for (id in state.progress.achievements) {
    if (Object.prototype.hasOwnProperty.call(state.progress.achievements, id)) count += 1;
  }
  return count;
}

/* ---------------- 每日挑战 ---------------- */

function dailyUnlocked(state) {
  return (state.progress.trainUpgrades.observatory || 0) >= config.daily.unlockLevel;
}

function dailyInfo(state, now) {
  var dateKey = formatDateKey(now || Date.now());
  var seed = dailyApi.seedFromDate(dateKey);
  var modifiers = dailyApi.rollModifiers(seed);
  var record = state.progress.daily;
  return {
    unlocked: dailyUnlocked(state),
    dateKey: dateKey,
    seed: seed,
    modifiers: modifiers,
    combined: dailyApi.combine(modifiers),
    playedToday: record.lastDate === dateKey,
    streak: record.streak,
    clears: record.clears,
    attempts: record.attempts,
    bestLayer: record.bestLayer
  };
}

/* ---------------- 局内：出发与路线 ---------------- */


/** 只补到「至少这么多」，不会累加：否则开局 - 放弃 - 再开局就能无限刷道具 */
function topUpItems(state, grants) {
  if (!grants) return;
  var key;
  for (key in grants) {
    if (!Object.prototype.hasOwnProperty.call(grants, key)) continue;
    var target = grants[key];
    if ((state.player.inventory[key] || 0) < target) {
      state.player.inventory[key] = target;
    }
  }
}

function snapshotWallet(state) {
  return {
    ether: state.player.ether,
    gold: state.player.gold,
    inventory: JSON.parse(JSON.stringify(state.player.inventory))
  };
}

function restoreWallet(state, wallet) {
  if (!wallet) return;
  state.player.ether = clamp(wallet.ether, 0, config.maxEther);
  state.player.gold = clamp(wallet.gold, 0, config.maxGold);
  var key;
  for (key in wallet.inventory) {
    if (Object.prototype.hasOwnProperty.call(wallet.inventory, key)) {
      state.player.inventory[key] = clamp(wallet.inventory[key], 0, 99);
    }
  }
}

/**
 * 开始一局。
 * mode = "daily" 时按日期种子生成路线与限制条件，并在结束时还原钱包
 * （否则「身无分文」这种条件会真的清空玩家攒下的以太）。
 */
function startRun(state, now, mode) {
  var time = now || Date.now();
  var isDaily = mode === "daily";
  var daily = null;

  if (isDaily) {
    if (!dailyUnlocked(state)) {
      return null;
    }
    var info = dailyInfo(state, time);
    daily = {
      dateKey: info.dateKey,
      seed: info.seed,
      modifierIds: info.modifiers.map(function (m) { return m.id; }),
      modifierNames: info.modifiers.map(function (m) { return m.name; }),
      combined: info.combined,
      wallet: snapshotWallet(state)
    };
    var record = state.progress.daily;
    if (record.lastDate !== info.dateKey) {
      var diff = record.lastDate ? dayDiff(record.lastDate, info.dateKey) : 0;
      record.streak = diff === 1 ? record.streak + 1 : 1;
      record.lastDate = info.dateKey;
    }
    record.attempts += 1;
  }

  state.progress.runsStarted += 1;
  var seed = isDaily
    ? daily.seed
    : ((time ^ (state.progress.runsStarted * 2654435761)) >>> 0);

  var run = createRun(seed);
  run.active = true;
  run.daily = daily;
  // 每日挑战固定走锈蚀车厢：它承诺「同一天全服同一套条件」，
  // 主题会改敌人伤害/血量倍率，让不同玩家比不同难度就失去意义了。
  run.theme = isDaily ? "rust" : selectedThemeId(state);
  run.layers = mapApi.generate(seed);
  state.run = run;
  state.current.scene = "route";
  state.current.modal = null;
  state.current.modalData = null;

  var mods = modsOf(run);
  var themeDef = themesApi.getById(run.theme);

  // 生命上限每局重算：局内强化加的 maxHpBonus 不该带到下一局
  state.player.maxHp = clamp(config.maxHp + mods.maxHpDelta, 40, 500);
  state.player.hp = state.player.maxHp;

  // 出发整备：精神保底 40 再扣本局成本
  // 保底的意义：单机产品不能让玩家卡在「精神太低无法出发」的死锁里
  var sanityCost = Math.round(config.sanityPerRun * mods.sanityCostMul);
  state.player.sanity = clamp(Math.max(state.player.sanity, 40) - sanityCost, 0, config.maxSanity);
  if (state.player.hunger < 50) state.player.hunger = 50;

  // 货舱：保证开局至少有这些道具（top-up 语义，不叠加）
  var cargoLevel = clamp(state.progress.trainUpgrades.cargo || 0, 0, 5);
  topUpItems(state, config.cargoGrants[cargoLevel] || {});

  if (daily && typeof daily.combined.startEther === "number") {
    state.player.ether = daily.combined.startEther;
  }
  if (mods.startEtherBonus > 0) {
    grantCurrency(state, { ether: mods.startEtherBonus });
  }

  if (isDaily) {
    pushLog(state, "每日挑战", dailyLogText(daily));
  } else {
    pushLog(state, "出发", "列车穿过裂隙，" +
      (themeDef && themeDef.id !== "rust" ? "驶入「" + themeDef.name + "」。" : "新的路线图已经展开。"));
  }
  if (themeDef && themeDef.id !== "rust") {
    pushLog(state, "车厢主题", themeDef.rules.join(" · "));
  }
  return state.run;
}

/** 每日挑战的日志文案（单独抽出来，避免开局逻辑里拼字符串） */
function dailyLogText(daily) {
  return "限制条件：" + daily.modifierNames.join(" / ");
}

function startDaily(state, now) {
  var run = startRun(state, now, "daily");
  if (!run) {
    return { ok: false, message: "观景台 Lv." + config.daily.unlockLevel + " 后才能进入每日挑战。" };
  }
  return { ok: true, run: run };
}

function getAvailableNodes(state) {
  if (!state.run || !state.run.active) return [];
  if (state.run.battle || state.run.pendingEnhancements || state.current.modal) return [];
  return mapApi.available(state.run.layers, state.run.currentNodeId);
}

function travelTo(state, nodeId) {
  var run = state.run;
  if (!run || !run.active) return { ok: false };
  if (state.current.modal) return { ok: false };

  var allowed = mapApi.available(run.layers, run.currentNodeId);
  var target = null;
  var i;
  for (i = 0; i < allowed.length; i += 1) {
    if (allowed[i].id === nodeId) target = allowed[i];
  }
  if (!target) return { ok: false };

  // 移动成本
  run.nodesVisited += 1;
  var hungerCost = Math.max(1, config.hungerPerNode + run.effects.hungerCostDelta + modsOf(run).hungerPerNodeDelta);
  state.player.hunger = clamp(state.player.hunger - hungerCost, 0, config.maxHunger);

  if (run.effects.foodRecoveryEveryTwo > 0 && run.nodesVisited % 2 === 0) {
    state.player.hunger = clamp(state.player.hunger + run.effects.foodRecoveryEveryTwo, 0, config.maxHunger);
    pushLog(state, "遗物", "餐车配给箱补充了饱食度。");
  }
  if (run.effects.restoreSanityEveryThree > 0 && run.nodesVisited % 3 === 0) {
    state.player.sanity = clamp(state.player.sanity + run.effects.restoreSanityEveryThree, 0, config.maxSanity);
    pushLog(state, "强化", "心智稳定恢复了精神值。");
  }

  target.visited = true;
  run.currentNodeId = target.id;
  run.layer = target.layer;
  run.route.push(target.type);
  if (target.layer > state.progress.bestLayer) state.progress.bestLayer = target.layer;

  enterNode(state, target);

  // 精神跌破安全线：强制结束（但战斗/事件弹窗优先处理完）
  if (state.player.sanity < config.sanityDangerLine && !state.current.modal) {
    endRun(state, false, "精神值跌破安全线，本次探索被迫终止。");
    return { ok: true, forcedEnd: true };
  }
  return { ok: true, node: target };
}

function enterNode(state, node) {
  if (node.type === "battle") return startBattle(state, "normal");
  if (node.type === "elite") return startBattle(state, "elite");
  if (node.type === "boss") return startBattle(state, "boss");
  if (node.type === "event") return openEvent(state);
  if (node.type === "camp") {
    state.current.modal = "camp";
    return null;
  }
  if (node.type === "shop") {
    state.current.modal = "shop";
    state.run.stats.shopsVisited += 1;
    return null;
  }
  if (node.type === "chest") return openChest(state);
  return null;
}

/* ---------------- 战斗 ---------------- */

function pickEnemy(kind, layer, themeId) {
  if (kind === "boss") {
    // Boss 也从池里随机：三场通关不重样，是重复游玩的最低成本手段
    var bosses = enemiesApi.byKind("boss");
    return weightedPick(bosses.length ? bosses : [enemiesApi.getById("riftWarden")], themeId);
  }
  var pool = enemiesApi.poolFor(kind === "elite" ? "elite" : "normal", layer);
  if (!pool.length) pool = enemiesApi.byKind(kind === "elite" ? "elite" : "normal");
  return weightedPick(pool, themeId);
}

function startBattle(state, kind) {
  var run = state.run;
  var layer = run.layer >= 0 ? run.layer : 0;
  var template = pickEnemy(kind, layer, run.theme);
  var mods = modsOf(run);
  var hpRange = template.kind === "normal" ? template.hpRange : template.hp;
  var hp = rng.int(hpRange[0], hpRange[1]);

  // 精英 = 基础敌人 + 1 个词缀；Boss 本身已有一套独立行为，不再叠词缀
  var affix = kind === "elite" ? affixesApi.rollFor(rng.pick) : null;
  if (affix) hp = Math.max(1, Math.round(hp * config.eliteHpMul));
  // 车厢主题可以整体调血量（霜封更硬、焚炉更狠）
  if (mods.enemyHpMul !== 1) hp = Math.max(1, Math.round(hp * mods.enemyHpMul));

  var sanityCost = Math.round(config.sanityPerBattle * mods.sanityCostMul);
  state.player.sanity = clamp(state.player.sanity - sanityCost, 0, config.maxSanity);
  markEnemySeen(state, template.id);

  run.battle = {
    kind: kind,
    enemyId: template.id,
    name: template.name,
    // 材质只是表现层（打击音色 + 粒子色），存进战斗对象是为了读档后音画不丢
    material: template.material,
    figure: template.figure,
    color: template.color,
    trait: template.trait,
    affix: affix ? affix.id : null,
    affixName: affix ? affix.name : null,
    affixDesc: affix ? affix.desc : null,
    poison: 0,
    revived: false,
    egg: 0,
    webbed: false,
    enraged: false,
    strikeUsed: false,
    lastCrit: false,
    intro: template.intro,
    /**
     * Boss 登场卡。
     *
     * 只有 Boss 才停这一下：普通战斗每局要打十几次，每次都插一屏就是纯摩擦；
     * Boss 一局只有一次，停下来的成本可以忽略，换来的是「这一场不一样」的仪式感。
     * 卡片上还会带一句 phase2.hint——不提任何机制，只是把第二形态的种子提前埋下，
     * 让半血崩开那一刻变成「原来刚才那句话是这个意思」。
     */
    introOpen: template.kind === "boss",
    introHint: template.phase2 && template.phase2.hint ? template.phase2.hint : null,
    hp: hp,
    maxHp: hp,
    damageRange: template.damageRange.slice(),
    reward: { ether: template.reward.ether, gold: template.reward.gold },
    boss: template.kind === "boss",
    elite: template.kind === "elite",
    // 1 = 完整形态，2 = 半血后的第二形态。只有 Boss 会变，其余永远是 1。
    phase: 1,
    // 第二形态的形态名与段数：由 checkBossPhase 按模板的 phase2 写入，
    // UI 与伤害结算都只读这两个字段，不自己去查敌人表
    phaseLabel: null,
    phaseHits: 1,
    // 上一步 / 上上一步动作：第二形态「查票」的判定依据
    lastAction: null,
    prevAction: null,
    phaseBreak: false,
    enemyShield: 0,
    playerShield: run.effects.firstTurnShield,
    turn: 1,
    defenseStance: false,
    enemyCharge: 0,
    // 下回合预告：由敌方回合末尾写入，玩家回合渲染时读。
    // 这是「敌人打算干什么」的唯一真相，UI 不许自己猜。
    telegraph: null,
    lastChargedHit: false,
    over: false,
    result: null,
    logs: [template.intro || "敌人阻断了前路，战斗开始。"]
  };
  state.current.modal = "battle";
  return run.battle;
}

/**
 * 关掉 Boss 登场卡。
 *
 * 它刻意不是一次「战斗行动」：不动回合、不进敌方回合、不掉血。
 * 如果做成行动，玩家在读卡时手抖一下就得白挨一击，而这一击和「读卡」毫无关系。
 * 返回是否真的关掉了一张开着的卡，方便调用方决定要不要播音效。
 */
function dismissBattleIntro(state) {
  var battle = state.run && state.run.battle;
  if (!battle || !battle.introOpen) return false;
  battle.introOpen = false;
  return true;
}

function pushBattleLog(battle, text) {
  if (!battle) return;
  battle.logs.unshift(text);
  if (battle.logs.length > 24) battle.logs = battle.logs.slice(0, 24);
}

function calcPlayerDamage(state, base) {
  var run = state.run;
  var battle = run.battle;
  var damage = base + state.player.baseAttack + run.effects.attackFlat;
  if (battle.defenseStance) damage += config.defendNextAttackBonus;
  if (state.player.sanity < 50) damage = Math.round(damage * (1 + run.effects.lowSanityBonus));
  if (battle.boss) damage = Math.round(damage * (1 + run.effects.bossDamageBonus));

  // 背水一战：生命低于 40% 时反打，和「低精神加成」是两条独立的线，
  // 一个赌血、一个赌精神，逼玩家在两种危险里选一种。
  var lowHpLine = state.player.maxHp * 0.4;
  if (state.player.hp > 0 && state.player.hp < lowHpLine) {
    damage = Math.round(damage * (1 + run.effects.lowHpDamageBonus));
  }

  // 先手加成只吃本场第一击，打完就作废（用 battle.strikeUsed 标记）
  if (!battle.strikeUsed && run.effects.firstStrikeBonus > 0) {
    damage += run.effects.firstStrikeBonus;
  }

  // 织网：被缠住时这一击削弱，打完即解除
  if (battle.webbed) {
    damage = Math.round(damage * 0.65);
    battle.webbed = false;
    pushBattleLog(battle, "缠网拖慢了你的动作，这一击被削弱了。");
  }

  return Math.max(1, damage);
}

function dealEnemyDamage(run, battle, amount) {
  var remaining = Math.max(0, amount);
  if (battle.enemyShield > 0) {
    var absorbed = Math.min(battle.enemyShield, remaining);
    battle.enemyShield -= absorbed;
    remaining -= absorbed;
  }
  // 重甲特性：每次受击固定少掉 3 点，但保底 1 点，避免完全打不动
  if (battle.trait === "armored" && remaining > 0) {
    remaining = Math.max(1, remaining - 3);
  }
  var before = battle.hp;
  battle.hp = clamp(battle.hp - remaining, 0, battle.maxHp);
  var dealt = before - battle.hp;
  run.stats.damageDealt += dealt;
  // 阶段检查挂在这里，因为它是「所有对敌伤害」的唯一收口。
  // 挂到各个攻击分支上就得加五处，漏一处玩家就会遇到打穿半血却没变阶段的 Boss。
  if (dealt > 0) checkBossPhase(battle);
  return { dealt: dealt, absorbed: Math.min(before, amount) - dealt };
}

/**
 * 每个 Boss 的第二形态是一次改名，还是真的换了一套打法？
 *
 * 0.9.3 给所有 Boss 共用一套第二形态（伤害 +3 / 护盾 12 / 节奏变快）。
 * 同一套机制重复五次，第二次就不新鲜了——玩家打到第二个 Boss 就知道
 * 「半血之后它会加盾」，后面三次只是在复述。
 *
 * 所以第二形态的参数从数据层读：模板上带 phase2 就按它来，没带就用旧的那套兜底
 * （旧存档、测试桩、未来新增但没写 phase2 的 Boss 都不会崩）。
 */
function phase2Of(battle) {
  if (!battle || !battle.enemyId) return null;
  var def = enemiesApi.getById(battle.enemyId);
  return def && def.phase2 ? def.phase2 : null;
}

/**
 * Boss 换阶段：血量首次跌破半血时进入第二阶段。
 *
 * 单场 Boss 战原本只是「血更厚的普通怪」——打到最后三分之一的回合和第一回合
 * 长得一模一样，赢的那一刻没有「我把一个东西打崩了」的感觉。
 *
 * 三条设计约束：
 * 1. **换阶段那回合敌人不出手**。变强如果不给缓冲，玩家的体感是「快赢了突然被打死」；
 *    给一回合，同一件事就变成「我把它打崩了，它正在重组」。
 * 2. **旧蓄势作废**。否则转换前攒的层数会在转换后立刻兑现，变成一记毫无预告的重击。
 * 3. **一击致死不触发**。血条直接归零时没有第二阶段可言，否则会画出「刚裂开就死了」。
 */
function checkBossPhase(battle) {
  if (!battle || !battle.boss || battle.over) return false;
  if (battle.phase >= 2) return false;
  if (battle.hp <= 0) return false;
  if (battle.hp > battle.maxHp * 0.5) return false;

  var p2 = phase2Of(battle);
  battle.phase = 2;
  // 形态名落进战斗对象：UI 只读，不许自己按 enemyId 猜
  battle.phaseLabel = (p2 && p2.label) || "第二阶段";
  battle.phaseHits = (p2 && p2.hits > 1) ? Math.round(p2.hits) : 1;
  battle.enemyCharge = 0;
  battle.telegraph = null;
  battle.phaseBreak = true;
  var add = p2 && typeof p2.dmgAdd === "number" ? p2.dmgAdd : 3;
  battle.damageRange = [battle.damageRange[0] + add, battle.damageRange[1] + add];
  // 这里不写日志：dealEnemyDamage 在「命中」那行 push 之前跑，
  // 现在写会变成「崩开 → 命中」，玩家从上往下读就是反的。
  // 交给 enemyTurn 的 phaseBreak 分支，按时间顺序补上。
  return true;
}

/**
 * 敌方回合末尾：写下「下回合会发生什么」，并落到 battle.telegraph 上。
 *
 * 蓄势重击 / 成群连击 / 黏网原本都在同一回合里既宣布又生效，
 * 玩家读到的只是一行事后日志，没有任何可应对的余地。现在它们提前一回合公布，
 * 「搞不懂为什么突然挨这么重」变成「看见了，这回合要不要换防御」。
 * 节奏不变：仍是每 3 回合一次，变的只是公布时机。
 */
function writeTelegraph(battle) {
  if (!battle || battle.over) return null;
  battle.telegraph = null;
  // 第二形态的节奏由形态自己定：双影/查票/脱轨仍是每 2 回合，
  // 换宿主退回 3 回合（它已经在体内持续掉血，再来个高频蓄势就只是加法）。
  var p2 = battle.phase >= 2 ? phase2Of(battle) : null;
  var cadence = battle.phase >= 2 ? ((p2 && p2.cadence) || 2) : 3;
  if (battle.turn % cadence !== 0) return null;

  var t = null;
  if (battle.trait === "assassin" || battle.boss) {
    // 已有层数会一起结算，预告里报的就是真正的加成量，不许写个约数糊弄玩家
    t = {
      kind: "charge",
      label: "蓄势",
      detail: "下一击 +" + (8 * (battle.enemyCharge + 1)),
      log: battle.name + " 伏低身子蓄势，下一击会更重。"
    };
    battle.enemyCharge += 1;
  } else if (battle.trait === "swarm") {
    t = {
      kind: "swarm",
      label: "集结",
      detail: "连击两次",
      log: battle.name + " 发出尖啸，同伴正在聚集。"
    };
  } else if (battle.trait === "weaver") {
    t = {
      kind: "weave",
      label: "吐丝",
      detail: "缠住你",
      log: battle.name + " 开始吐丝结网。"
    };
  }

  battle.telegraph = t;
  if (t) pushBattleLog(battle, t.log);
  return t;
}

function enemyTurn(state) {
  var run = state.run;
  var battle = run.battle;
  if (!battle || battle.over) return;

  /**
   * 换阶段的那一回合：它只顾重组躯壳，不还手，但立起一层护盾。
   *
   * 这一回合是换阶段能被接受的全部原因。直接加难度会让玩家觉得
   * 「我快赢了它突然变强」；空出一回合再变强，读到的就是
   * 「我把它打崩了，它正在爬起来」。护盾是补上这回合少掉的输出压力，
   * 让跳过不成为纯粹的送分。
   */
  if (battle.phaseBreak) {
    var p2b = phase2Of(battle);
    battle.phaseBreak = false;
    battle.enemyShield += p2b && typeof p2b.shield === "number" ? p2b.shield : 12;
    battle.lastEnemyDamage = 0;
    // 日志是倒序显示的（最新在最上），所以先推「规则说明」再推「呼应」再推「崩开」再推「重组」，
    // 玩家从上往下读才是「重组 / 它裂开了 / 那句话对上了 / 这套新打法是什么 / 刚才那一下命中」。
    if (p2b && p2b.tip) pushBattleLog(battle, p2b.tip);
    /**
     * 呼应：登场卡上那句「预感」在这一刻兑现。
     *
     * 它是**先 push 的**，所以在倒序日志里排在「崩开描述」下面一行——
     * 读起来是「它裂开了 / 「那句话对上了」」，事件在前、醒悟在后。
     * 用「」括起来表示这是玩家脑子里的声音，不是战场播报；
     * 不加引号就会读成第三段旁白，和 tip 糊成一片。
     *
     * 只在「当时真的看过那张卡」时才写（`introHint` 存在）：老存档、以及没有
     * phase2 的对手都没有这句铺垫，硬凑一句通用的「你想起了什么」比不写更尴尬。
     */
    if (p2b && p2b.callback && battle.introHint) {
      pushBattleLog(battle, "「" + p2b.callback + "」");
    }
    pushBattleLog(battle, (p2b && p2b.line)
      || (battle.name + " 的外壳崩开，露出里面的第二层——它比刚才更凶了。"));
    pushBattleLog(battle, battle.name + " 停在原地重组躯壳，暂时没有还手。");
    writeTelegraph(battle);
    battle.turn += 1;
    run.stats.turns += 1;
    battle.playerShield = 0;
    return;
  }

  var affix = battle.affix ? affixesApi.getById(battle.affix) : null;
  var dailyMul = modsOf(run).enemyDamageMul;

  if (affix && affix.shieldEvery && battle.turn % affix.shieldEvery === 0) {
    battle.enemyShield += affix.shieldAmount;
    pushBattleLog(battle, battle.name + " 立起壁垒，获得 " + affix.shieldAmount + " 点护盾。");
  }

  if (battle.trait === "idol" && battle.turn % 3 === 0) {
    battle.enemyShield += 10;
    pushBattleLog(battle, battle.name + " 固守姿态，获得 10 点护盾。");
  }
  if (battle.trait === "wisp" && battle.turn % 2 === 1) {
    var heal = Math.min(6, battle.maxHp - battle.hp);
    battle.hp += heal;
    if (heal > 0) pushBattleLog(battle, battle.name + " 吸收残光，恢复 " + heal + " 点生命。");
  }
  if (battle.boss && battle.turn % 2 === 0) {
    battle.enemyShield += 8;
    pushBattleLog(battle, battle.name + " 进入强化姿态，获得 8 点护盾。");
  }
  // 取出上一回合末尾写下的预告（取完即清，避免重复生效）。
  // 预告比效果早整整一个玩家回合——这个回合就是留给玩家的反应窗口。
  var tele = battle.telegraph || null;
  battle.telegraph = null;
  if (battle.trait === "enrage" && !battle.enraged && battle.hp < battle.maxHp * 0.5) {
    battle.enraged = true;
    pushBattleLog(battle, battle.name + " 撕开自己的外壳，攻势骤然变猛。");
  }

  var damage = rng.int(battle.damageRange[0], battle.damageRange[1]);
  // 赌徒：伤害在 50%—170% 之间剧烈浮动，逼你留够血线而不是算平均值
  if (battle.trait === "gambler") {
    damage = Math.round(damage * (0.5 + Math.random() * 1.2));
  }
  if (battle.trait === "enrage" && battle.enraged) damage = Math.round(damage * 1.45);
  if (affix && affix.damageMul) damage = Math.round(damage * affix.damageMul);
  if (dailyMul !== 1) damage = Math.round(damage * dailyMul);
  if (battle.enemyCharge > 0) {
    damage += 8 * battle.enemyCharge;
    battle.enemyCharge = 0;
    // 给表现层一个「这刀是蓄出来的」信号：重击需要比普通反击更重的震动与音色，
    // 否则玩家蓄势预警看了三回合，兑现时和普通挨打没区别，预警就白做了
    battle.lastChargedHit = true;
    pushBattleLog(battle, battle.name + " 释放蓄势重击。");
  } else {
    battle.lastChargedHit = false;
  }
  if (tele && tele.kind === "swarm") {
    damage += Math.round(damage * 0.55);
    pushBattleLog(battle, battle.name + " 成群扑咬，一回合连击两次。");
  }
  // 黏网在「预告后的那一回合」才落下：玩家看到吐丝提示时还有一次机会先防御或抢杀
  if (tele && tele.kind === "weave") {
    battle.webbed = true;
    pushBattleLog(battle, battle.name + " 的黏网罩下来，你的下一击会被拖慢。");
  }
  if (state.player.sanity < 30) {
    var reduction = clamp(run.effects.lowSanityDamageReduction, 0, 0.8);
    damage = Math.round(damage * (1 - reduction));
  }
  /**
   * 第二形态的伤害改装。
   *
   * 三个开关都只在这一处生效（敌方伤害的唯一出口），所以「查票」不可能漏判、
   * 「过载」也不可能在某条分支上忘了乘。加新形态只需要往数据里加字段。
   */
  var p2 = battle.phase >= 2 ? phase2Of(battle) : null;
  if (p2 && p2.dmgMul) damage = Math.round(damage * p2.dmgMul);
  var punished = false;
  if (p2 && p2.repeatPunish && battle.lastAction && battle.lastAction === battle.prevAction) {
    damage = Math.round(damage * (1 + p2.repeatPunish));
    punished = true;
  }

  /**
   * 分段：双影每回合两段、脱轨有概率追加一段。
   *
   * 拆成「段」而不是「一次打死」，是为了让护盾和防御架势按段结算——
   * 一次攻击吃不完的护盾，两段就能吃两遍。所以双影总伤害几乎没涨，
   * 真正变强的部分是「蹲下换来的免伤只剩一半」。
   */
  var segs = [damage];
  var hitCount = 1;
  var si;
  if (p2 && p2.hits > 1) {
    hitCount = Math.round(p2.hits);
    var per = Math.max(1, Math.round(damage * (p2.hitScale || 0.6)));
    segs = [];
    for (si = 0; si < hitCount; si += 1) segs.push(per);
  } else if (p2 && p2.extraChance && Math.random() < p2.extraChance) {
    segs.push(Math.max(1, Math.round(damage * (p2.extraScale || 0.55))));
  }

  // 防御架势只保第一段。多段攻击下「蹲下」挡住的从来只是先到的那一下，
  // 这是双影真正难打的原因，也是它和「伤害 +3」的区别。
  if (battle.defenseStance) {
    battle.defenseStance = false;
    segs[0] = Math.round(segs[0] * 0.6);
  }

  // 迅捷 / 召唤：额外的一次攻击，同样要过护盾，但不吃防御架势的减伤
  var extra = 0;
  if (affix) {
    if (affix.swiftTurn && battle.turn === affix.swiftTurn) {
      extra += Math.round(rng.int(battle.damageRange[0], battle.damageRange[1]) * 0.6);
      pushBattleLog(battle, battle.name + " 抢先出手，连击两次。");
    }
    if (affix.summonTurns && affix.summonTurns.indexOf(battle.turn) >= 0) {
      extra += affix.summonDamage;
      pushBattleLog(battle, "被召来的小体扑上来，额外撕咬 " + affix.summonDamage + " 点。");
    }
  }
  segs[0] += extra;

  var remaining = 0;
  for (si = 0; si < segs.length; si += 1) {
    var seg = segs[si];
    if (battle.playerShield > 0) {
      var absorbed = Math.min(battle.playerShield, seg);
      battle.playerShield -= absorbed;
      seg -= absorbed;
    }
    remaining += seg;
  }

  state.player.hp = clamp(state.player.hp - remaining, 0, state.player.maxHp);
  battle.lastEnemyDamage = remaining;
  // 惩罚必须说出口，否则玩家只会觉得「这一下莫名其妙特别疼」
  if (punished) pushBattleLog(battle, "它认得这个动作——你上一回合也是这么做的。");
  if (hitCount > 1) {
    pushBattleLog(battle, battle.name + " 连击 " + hitCount + " 次，共造成 " + remaining + " 点伤害。");
  } else if (segs.length > 1) {
    pushBattleLog(battle, battle.name + " 补上一记，共造成 " + remaining + " 点伤害。");
  } else {
    pushBattleLog(battle, battle.name + " 反击，造成 " + remaining + " 点伤害。");
  }

  // 换宿主：这一下不打在身上，直接从里面扣——护盾对它无效，
  // 「再蹲一回合」这条最省事的解法被它拿掉了
  if (p2 && p2.dotOnPlayer && state.player.hp > 0) {
    state.player.hp = clamp(state.player.hp - p2.dotOnPlayer, 0, state.player.maxHp);
    battle.lastEnemyDamage = remaining + p2.dotOnPlayer;
    pushBattleLog(battle, "它在你体内翻了个身，穿盾扣掉 " + p2.dotOnPlayer + " 点生命。");
  }

  // 毒化：命中后挂 3 回合中毒，之后每回合额外掉血
  if (affix && affix.poison && remaining > 0) {
    battle.poison = 3;
    pushBattleLog(battle, battle.name + " 的毒液渗入伤口。");
  }

  // 上一口毒结算（不吃护盾，直接掉血）
  if (battle.poison > 0) {
    var dot = 3;
    battle.poison -= 1;
    state.player.hp = clamp(state.player.hp - dot, 0, state.player.maxHp);
    battle.lastEnemyDamage = remaining + dot;
    pushBattleLog(battle, "毒素发作，额外损失 " + dot + " 点生命。");
  }

  // 寄生：命中后挂卵，两回合后孵化。孵化那一下不打折也不吃护盾——
  // 想躲只能在这两回合里结束战斗，这是这条特性唯一给的解。
  if (battle.trait === "parasite" && remaining > 0 && !battle.egg) {
    battle.egg = 2;
    pushBattleLog(battle, battle.name + " 在你身上产下一枚卵。");
  }
  if (battle.egg > 0) {
    battle.egg -= 1;
    if (battle.egg === 0) {
      var hatch = 12;
      state.player.hp = clamp(state.player.hp - hatch, 0, state.player.maxHp);
      battle.hp = clamp(battle.hp + 10, 0, battle.maxHp);
      battle.lastEnemyDamage = remaining + hatch;
      pushBattleLog(battle, "卵孵化了，你损失 " + hatch + " 点生命，" + battle.name + " 吸收了养分。");
    } else {
      pushBattleLog(battle, "体内的卵在蠕动，还有 " + battle.egg + " 回合。");
    }
  }

  // 狂暴：每次出手自伤，但不会把自己打死
  if (affix && affix.selfDamage) {
    battle.hp = Math.max(1, battle.hp - affix.selfDamage);
  }

  // 过载：锅炉反噬。和狂暴词缀同一条思路——它变强的方式是把自己烧掉，
  // 所以玩家的最优解从「扛住」变成「拖住」，多撑一回合就等于多打一下。
  if (p2 && p2.selfBleed) {
    battle.hp = Math.max(1, battle.hp - p2.selfBleed);
    pushBattleLog(battle, "过载的锅炉反噬自身，它损失 " + p2.selfBleed + " 点生命。");
  }

  // 吸血特性：按实际打出的伤害回血，打空（被护盾吃光）就不回
  if (battle.trait === "vampire" && remaining > 0) {
    var drain = Math.min(Math.max(1, Math.round(remaining * 0.4)), battle.maxHp - battle.hp);
    if (drain > 0) {
      battle.hp += drain;
      pushBattleLog(battle, battle.name + " 汲取了 " + drain + " 点生命。");
    }
  }

  if (state.player.hp <= 0) {
    if (run.effects.autoReviveOnce) {
      run.effects.autoReviveOnce = false;
      var reviveHp = 20 + run.effects.reviveHealBonus;
      state.player.hp = clamp(reviveHp, 1, state.player.maxHp);
      pushBattleLog(battle, "应急针剂自动触发，你恢复了 " + state.player.hp + " 点生命。");
      writeTelegraph(battle);
      battle.turn += 1;
      return;
    }
    battle.over = true;
    battle.result = "lose";
    pushBattleLog(battle, "你倒在了裂隙深处。");
    return;
  }

  // 写下下回合的预告。预告在玩家行动之前就写进状态，UI 才画得出来——
  // 有预警的动作才有「应对」可言，没有预警的特殊招式只是突然挨打。
  writeTelegraph(battle);

  battle.turn += 1;
  run.stats.turns += 1;

  // 护盾是一次性吸收：本回合没被打破的部分不结转到下一回合，
  // 否则「防御」可以无限叠盾，战斗永远打不完。
  battle.playerShield = 0;

  // 回合上限兜底：极端构筑下也不允许无限对峙
  if (battle.turn > 40) {
    battle.over = true;
    battle.result = "lose";
    pushBattleLog(battle, "战斗拖得太久，裂隙开始闭合，你被迫撤退。");
    state.player.hp = 1;
    state.run.battle = null;
    state.current.modal = null;
    endRun(state, false, "战斗超时，本次探索被迫终止。");
  }
}

/**
 * 镜影反伤：打中镜面类敌人会反弹固定伤害。
 * 返回是否弹死了玩家（调用方据此结束战斗，不再进敌方回合）。
 */
function applyMirrorReflect(state, battle) {
  if (!battle) return false;
  var reflect = battle.trait === "mirror" ? 3 : 0;
  var affix = battle.affix ? affixesApi.getById(battle.affix) : null;
  if (affix && affix.reflect) reflect += affix.reflect;
  if (reflect <= 0) return false;
  state.player.hp = clamp(state.player.hp - reflect, 0, state.player.maxHp);
  pushBattleLog(battle, battle.name + " 的镜面反弹，你受到 " + reflect + " 点反伤。");
  if (state.player.hp <= 0) {
    battle.over = true;
    battle.result = "lose";
    pushBattleLog(battle, "反伤耗尽了你的体力，你倒下了。");
    return true;
  }
  return false;
}

/**
 * 记下这一步动作，供第二形态的「查票」比对上一回合。
 *
 * 只记真正消耗回合的行动：逃跑、重战卡、看广告复活都不算——
 * 它们不产生回合，也就不该被当成「你又用了一次同一招」。
 */
function markAction(battle, actionId) {
  if (!battle) return;
  battle.prevAction = battle.lastAction || null;
  battle.lastAction = actionId;
}

function battleAction(state, actionId) {
  var run = state.run;
  var battle = run && run.battle;
  if (!battle || battle.over) return { ok: false };
  if (state.player.hp <= 0) return { ok: false };

  // 药剂 / 秒杀卡在各自分支里记：没货的那一次不该算作一次行动
  if (actionId === "precise" || actionId === "power" || actionId === "defend") {
    markAction(battle, actionId);
  }

  if (actionId === "precise") {
    var d1 = calcPlayerDamage(state, config.preciseBonus);
    battle.strikeUsed = true;
    // 暴击只挂在「精准」上：强力本来就是赌命中，再叠暴击会变成赌博的上位替代，
    // 精准反而没人用。让两条路各有各的赌法。
    var critRate = clamp(run.effects.critChance, 0, 0.6);
    var isCrit = critRate > 0 && Math.random() < critRate;
    if (isCrit) {
      d1 = Math.round(d1 * 1.8);
      battle.lastCrit = true;
    } else {
      battle.lastCrit = false;
    }
    var r1 = dealEnemyDamage(run, battle, d1);
    pushBattleLog(battle, isCrit
      ? "精准射击命中要害，造成 " + r1.dealt + " 点暴击伤害。"
      : "精准射击命中，造成 " + r1.dealt + " 点伤害。");
    if (battle.hp <= 0) return winBattle(state);
    if (applyMirrorReflect(state, battle)) return { ok: true, reflected: true };
    enemyTurn(state);
    return { ok: true, crit: isCrit };
  }

  if (actionId === "power") {
    if (Math.random() > config.powerHitRate) {
      pushBattleLog(battle, "强力射击偏离了轨迹。");
      enemyTurn(state);
      return { ok: true, missed: true };
    }
    if (battle.trait === "wolf" && Math.random() < 0.35) {
      pushBattleLog(battle, battle.name + " 敏捷侧闪，躲开了强力射击。");
      enemyTurn(state);
      return { ok: true, dodged: true };
    }
    if (battle.trait === "assassin" && Math.random() < 0.2) {
      pushBattleLog(battle, battle.name + " 借残影偏移身位，削弱了这次进攻。");
      enemyTurn(state);
      return { ok: true, dodged: true };
    }
    var d2 = calcPlayerDamage(state, config.powerBonus);
    battle.strikeUsed = true;
    battle.lastCrit = false;
    var r2 = dealEnemyDamage(run, battle, d2);
    pushBattleLog(battle, "强力射击轰中目标，造成 " + r2.dealt + " 点伤害。");
    if (battle.hp <= 0) return winBattle(state);
    if (applyMirrorReflect(state, battle)) return { ok: true, reflected: true };
    enemyTurn(state);
    return { ok: true };
  }

  if (actionId === "defend") {
    var shieldGain = config.defendShield + run.effects.defendShieldBonus;
    battle.playerShield += shieldGain;
    battle.defenseStance = true;
    pushBattleLog(battle, "你摆出防御架势，获得 " + shieldGain + " 点护盾。");
    enemyTurn(state);
    return { ok: true };
  }

  if (actionId === "potion") {
    if (state.player.inventory.potion <= 0) {
      pushBattleLog(battle, "背包里没有回血药剂。");
      return { ok: false, message: "没有回血药剂。" };
    }
    state.player.inventory.potion -= 1;
    var healAmt = config.potionHeal + run.effects.potionBonus
      + state.progress.trainUpgrades.medbay * config.medbayHealBonus;
    // 换宿主：药还是那瓶药，只是喝下去有一半被它先喝了
    var p2h = battle.phase >= 2 ? phase2Of(battle) : null;
    if (p2h && p2h.healCut) {
      healAmt = Math.max(1, Math.round(healAmt * (1 - p2h.healCut)));
    }
    state.player.hp = clamp(state.player.hp + healAmt, 0, state.player.maxHp);
    pushBattleLog(battle, "你使用回血药剂，恢复 " + healAmt + " 点生命。");
    markAction(battle, "potion");
    enemyTurn(state);
    return { ok: true };
  }

  if (actionId === "execute") {
    if (state.player.inventory.executeCard <= 0) {
      pushBattleLog(battle, "你没有秒杀卡。");
      return { ok: false, message: "没有秒杀卡。" };
    }
    state.player.inventory.executeCard -= 1;
    markAction(battle, "execute");
    if (battle.boss) {
      var dmg = Math.floor(battle.maxHp * 0.5);
      var r3 = dealEnemyDamage(run, battle, dmg);
      pushBattleLog(battle, "秒杀卡对 Boss 造成 " + r3.dealt + " 点重创。");
      if (battle.hp <= 0) return winBattle(state);
      enemyTurn(state);
      return { ok: true };
    }
    dealEnemyDamage(run, battle, battle.hp + battle.enemyShield);
    pushBattleLog(battle, "秒杀卡直接击破了敌人。");
    return winBattle(state);
  }

  if (actionId === "escape") {
    var cost = run.effects.escapeFree ? 0 : config.escapeCost;
    if (state.player.ether < cost) {
      pushBattleLog(battle, "以太碎片不足，无法撤离。");
      return { ok: false, message: "以太不足。" };
    }
    state.player.ether -= cost;
    run.battle = null;
    state.current.modal = null;
    pushLog(state, "撤离", cost > 0 ? "你付出 " + cost + " 以太碎片撤离。" : "你利用强化效果免费撤离。");
    return { ok: true, escaped: true };
  }

  if (actionId === "retry") {
    if (state.player.hp > 0 || state.player.inventory.retryCard <= 0) return { ok: false };
    state.player.inventory.retryCard -= 1;
    state.player.hp = state.player.maxHp;
    battle.over = false;
    battle.result = null;
    pushBattleLog(battle, "重战卡启动，你以满状态重新站稳。");
    return { ok: true, revived: true };
  }

  if (actionId === "adRevive") {
    if (state.player.hp > 0) return { ok: false };
    if (!canWatchAd(state, Date.now())) return { ok: false, message: "今日广告次数已用完。" };
    return { ok: true, needsAd: true };
  }

  return { ok: false };
}

/** 广告复活由 main 在广告回调后调用 */
function applyAdRevive(state) {
  var battle = state.run && state.run.battle;
  if (!battle) return false;
  if (!canWatchAd(state, Date.now())) return false;
  state.meta.adViewsToday += 1;
  state.player.hp = config.adReviveHp;
  battle.over = false;
  battle.result = null;
  pushBattleLog(battle, "激励复活生效，你恢复了 " + config.adReviveHp + " 点生命。");
  return true;
}

function winBattle(state) {
  var run = state.run;
  var battle = run.battle;
  var hpAtWin = state.player.hp;

  // 残响词缀：首次死亡时以 40% 生命复活，战斗继续而不是结算
  var affixDef = battle.affix ? affixesApi.getById(battle.affix) : null;
  if (battle.hp <= 0 && affixDef && affixDef.reviveRatio && !battle.revived) {
    battle.revived = true;
    battle.hp = Math.max(1, Math.round(battle.maxHp * affixDef.reviveRatio));
    battle.over = false;
    battle.result = null;
    pushBattleLog(battle, battle.name + " 的残响让它重新站了起来。");
    return { ok: true, revived: true };
  }

  // 自爆特性：死亡时炸玩家一下，但保底留 1 点血——
  // 「赢了却被打死」在单机 Roguelike 里只会让玩家觉得被耍。
  if (battle.trait === "bomber") {
    state.player.hp = clamp(state.player.hp - 10, 1, state.player.maxHp);
    pushBattleLog(battle, battle.name + " 崩解自爆，余烬灼伤了你。");
  }

  var gold = battle.reward.gold + run.effects.battleBonusGold;
  // 贪婪词缀：赏金翻倍（代价是攻击更狠，在 enemyTurn 里已生效）
  if (affixDef && affixDef.goldMul) gold = Math.round(gold * affixDef.goldMul);
  // 车厢主题（焚炉）整体加金币
  var goldMul = modsOf(run).goldMul;
  if (goldMul !== 1) gold = Math.round(gold * goldMul);
  grantCurrency(state, { ether: battle.reward.ether, gold: gold });
  run.stats.battlesWon += 1;
  pushLog(state, "战斗胜利", "击败 " + battle.name + "，获得 " + battle.reward.ether + " 以太。");

  if (run.effects.healAfterBattle > 0) {
    state.player.hp = clamp(state.player.hp + run.effects.healAfterBattle, 0, state.player.maxHp);
  }
  // 基础容错回血：让非酋玩家也有机会走到 Boss
  state.player.hp = clamp(state.player.hp + config.healAfterWin, 0, state.player.maxHp);

  // 图鉴与跨局统计：击败才记「已击败」，只是遇到只记「见过」
  markEnemyDefeated(state, battle.enemyId);
  checkCodexReward(state);
  state.progress.stats.battlesWon += 1;
  if (battle.boss) run.stats.hpAtBossWin = hpAtWin;

  var wasBoss = battle.boss;
  var wasElite = battle.elite;
  run.battle = null;
  state.current.modal = null;

  if (wasBoss) {
    state.progress.runsCleared += 1;
    state.progress.bossClears += 1;
    endRun(state, true, battle.name + " 倒下了，你带着整局成果返回列车。");
    return { ok: true, battleWon: true, runCleared: true };
  }

  var count = wasElite ? config.eliteEnhanceBase + run.effects.extraEliteEnhanceChoice : 3;
  openEnhance(state, count);
  return { ok: true, battleWon: true };
}

/* ---------------- 强化 / 遗物 ---------------- */

function openEnhance(state, count) {
  var run = state.run;
  var n = count || 3;
  if (run) n += modsOf(run).enhanceChoiceDelta;
  var picks = enhApi.draw(rng.shuffle, clamp(n, 2, 5));
  state.run.pendingEnhancements = picks.map(function (item) {
    return { id: item.id, name: item.name, desc: item.desc, tag: item.tag };
  });
  state.current.modal = "enhance";
}

function chooseEnhancement(state, id) {
  var run = state.run;
  var pending = run.pendingEnhancements || [];
  var found = null;
  var i;
  for (i = 0; i < pending.length; i += 1) {
    if (pending[i].id === id) found = pending[i];
  }
  if (!found) return { ok: false };
  var def = enhApi.getById(id);
  if (def) {
    effectsApi.addEffects(run.effects, def.effects);
    if (def.effects && def.effects.maxHpBonus) {
      state.player.maxHp += def.effects.maxHpBonus;
      state.player.hp = clamp(state.player.hp + def.effects.maxHpBonus, 0, state.player.maxHp);
    }
  }
  run.enhancements.push({ id: found.id, name: found.name, desc: found.desc });
  markEnhancementObtained(state, found.id);
  checkCodexReward(state);
  run.pendingEnhancements = null;
  state.current.modal = null;
  pushLog(state, "强化获得", "你选择了「" + found.name + "」。");
  return { ok: true, enhancement: found };
}

/* ---------------- 遗物序列（套装） ---------------- */

/** 本局已收集的某序列件数 */
function setOwnedCount(run, set) {
  var count = 0;
  var i;
  for (i = 0; i < run.relics.length; i += 1) {
    if (set.members.indexOf(run.relics[i].id) >= 0) count += 1;
  }
  return count;
}

/**
 * 序列进度（只读，给界面用）。
 * granted 是「已经发过奖励的档位数」，不是「当前满足的档位数」——
 * 两者在正常流程里一致，但读档补算前可能不同，界面应显示前者，
 * 否则玩家会看到「已激活」却没拿到属性。
 */
function setProgress(run) {
  var list = [];
  var i;
  var j;
  var sets = relicSetsApi.RELIC_SETS;
  for (i = 0; i < sets.length; i += 1) {
    var set = sets[i];
    var count = run ? setOwnedCount(run, set) : 0;
    var granted = (run && run.setActive && run.setActive[set.id]) || 0;
    var tiers = [];
    for (j = 0; j < set.tiers.length; j += 1) {
      tiers.push({
        need: set.tiers[j].need,
        desc: set.tiers[j].desc,
        active: j < granted
      });
    }
    list.push({
      id: set.id,
      name: set.name,
      accent: set.accent,
      count: count,
      total: set.members.length,
      granted: granted,
      tiers: tiers,
      nextNeed: granted < set.tiers.length ? set.tiers[granted].need : 0
    });
  }
  return list;
}

/**
 * 结算序列奖励：把「新达成但还没发过」的档位补发一次。
 *
 * 幂等：靠 run.setActive 记账，重复调用不会二次加属性。
 * 读档后也调用一次，老存档（没有 setActive 字段）会自动补齐应得的档位。
 */
function applySetBonuses(state) {
  var run = state.run;
  if (!run || !run.active) return [];
  if (!run.setActive) run.setActive = {};
  var activated = [];
  var i;
  var j;
  var sets = relicSetsApi.RELIC_SETS;
  for (i = 0; i < sets.length; i += 1) {
    var set = sets[i];
    var count = setOwnedCount(run, set);
    var granted = run.setActive[set.id] || 0;
    for (j = granted; j < set.tiers.length; j += 1) {
      var tier = set.tiers[j];
      if (count < tier.need) break;
      effectsApi.addEffects(run.effects, tier.effects);
      if (tier.effects && tier.effects.maxHpBonus) {
        state.player.maxHp += tier.effects.maxHpBonus;
        state.player.hp = clamp(state.player.hp + tier.effects.maxHpBonus, 1, state.player.maxHp);
      }
      run.setActive[set.id] = j + 1;
      activated.push({ set: set, tier: tier });
    }
  }
  for (i = 0; i < activated.length; i += 1) {
    pushLog(state, "序列激活",
      "「" + activated[i].set.name + "」第 " + activated[i].tier.need + " 件达成：" + activated[i].tier.desc + "。");
  }
  return activated;
}

/** 读档后补算：老档没有 setActive，或者存档被改乱时用 */
function reconcileSets(state) {
  if (!state.run || !state.run.active) return [];
  if (!state.run.setActive) state.run.setActive = {};
  return applySetBonuses(state);
}

function obtainRelic(state, relic) {
  var run = state.run;
  if (!relic) return null;
  var owned = run.relics.some(function (item) { return item.id === relic.id; });
  if (owned) {
    grantCurrency(state, { ether: 20, gold: 1 });
    pushLog(state, "遗物重复", "已拥有「" + relic.name + "」，折算为资源。");
    return { duplicated: true, relic: relic };
  }
  run.relics.push({ id: relic.id, name: relic.name, desc: relic.desc, rarity: relic.rarity });
  markRelicObtained(state, relic.id);
  checkCodexReward(state);
  effectsApi.addEffects(run.effects, relic.effects);
  if (relic.effects && relic.effects.maxHpBonus) {
    state.player.maxHp += relic.effects.maxHpBonus;
    state.player.hp = state.player.maxHp;
  }
  pushLog(state, "遗物获得", "你获得了「" + relic.name + "」。");
  var sets = applySetBonuses(state);
  return { duplicated: false, relic: relic, sets: sets };
}

function openChest(state) {
  var relic = relicsApi.roll(rng.pick, state.run.relics.map(function (item) { return item.id; }));
  state.run.pendingRelicId = relic ? relic.id : null;
  state.current.modal = "chest";
  return relic;
}

function confirmChest(state) {
  var run = state.run;
  var relic = relicsApi.getById(run.pendingRelicId);
  var result = null;
  if (relic) result = obtainRelic(state, relic);
  run.pendingRelicId = null;
  state.current.modal = null;
  openEnhance(state, 3);
  return result;
}

/* ---------------- 事件 ---------------- */

function openEvent(state) {
  var run = state.run;
  // 链事件优先：到了一层该说的那句台词，先说。说完就记进度，不重复。
  var chainPick = eventsApi.nextChainEvent(run.chains, run.layer, Math.random);
  var event;
  if (chainPick) {
    event = chainPick.event;
    run.chains[chainPick.chain] = chainPick.stage;
    run.eventChain = { id: chainPick.chain, name: chainPick.chainName, stage: chainPick.stage, total: chainPick.total };
    pushLog(state, "线索", "「" + chainPick.chainName + "」第 " + chainPick.stage + " / " + chainPick.total + " 段。");
  } else {
    event = eventsApi.roll(rng.pick, run.layer, run.recentEvents, run.theme);
    run.eventChain = null;
  }
  run.eventId = event.id;
  run.eventResult = null;
  run.eventChoiceIndex = -1;
  run.recentEvents.unshift(event.id);
  if (run.recentEvents.length > 2) run.recentEvents = run.recentEvents.slice(0, 2);
  state.current.modal = "event";
  return event;
}

/** 判断某个选项当前能否选（成本是否够） */
function canChooseEventOption(state, choice) {
  if (!choice) return true;
  // 负数 items 是「交出去的道具」，和 cost 一样要有货才能选，否则等于凭空领奖励
  if (choice.items) {
    var key;
    for (key in choice.items) {
      if (!Object.prototype.hasOwnProperty.call(choice.items, key)) continue;
      if (choice.items[key] < 0 && (state.player.inventory[key] || 0) + choice.items[key] < 0) {
        return false;
      }
    }
  }
  if (!choice.cost) return true;
  var cost = choice.cost;
  if (cost.ether && state.player.ether < cost.ether) return false;
  if (cost.gold && state.player.gold < cost.gold) return false;
  if (cost.hp && state.player.hp <= cost.hp) return false;
  if (cost.sanity && state.player.sanity < cost.sanity) return false;
  return true;
}

function applyEventGain(state, gain) {
  if (!gain) return;
  var boost = 1 + state.run.effects.eventRewardBoost;
  var goldMul = modsOf(state.run).goldMul;
  if (gain.ether) grantCurrency(state, { ether: Math.round(gain.ether * boost) });
  if (gain.gold) grantCurrency(state, { gold: Math.round(gain.gold * goldMul) });
  if (gain.hp) state.player.hp = clamp(state.player.hp + gain.hp, 1, state.player.maxHp);
  if (gain.sanity) state.player.sanity = clamp(state.player.sanity + gain.sanity, 0, config.maxSanity);
  if (gain.hunger) state.player.hunger = clamp(state.player.hunger + gain.hunger, 0, config.maxHunger);
}

/**
 * 选择事件选项：结算成本、收益、风险、后续动作。
 * 返回 { ok, text, followUp: 'enhance'|'relic'|null }
 */
function chooseEventOption(state, index) {
  var run = state.run;
  var event = eventsApi.getById(run.eventId);
  if (!event || !event.choices[index]) return { ok: false };
  var choice = event.choices[index];
  if (!canChooseEventOption(state, choice)) {
    return { ok: false, message: "资源不足，无法选择。" };
  }

  // 成本
  if (choice.cost) {
    if (choice.cost.ether) state.player.ether -= choice.cost.ether;
    if (choice.cost.gold) state.player.gold -= choice.cost.gold;
    if (choice.cost.hp) state.player.hp = clamp(state.player.hp - choice.cost.hp, 1, state.player.maxHp);
    if (choice.cost.sanity) state.player.sanity = clamp(state.player.sanity - choice.cost.sanity, 0, config.maxSanity);
  }

  grantItems(state, choice.items);
  applyEventGain(state, choice.gain);

  var followUp = choice.action || null;
  var text = choice.text || "你做出了选择。";

  if (choice.risk) {
    var success = Math.random() < choice.risk.chance;
    var branch = success ? choice.risk.ok : choice.risk.bad;
    text = success ? (choice.risk.okText || text) : (choice.risk.badText || text);
    if (branch && branch.action) followUp = branch.action;
    if (branch) {
      // 风险分支同样可能给道具（例如售货机卡出来的药剂），之前漏了这一步
      if (branch.items) grantItems(state, branch.items);
      applyEventGain(state, {
        ether: branch.ether,
        gold: branch.gold,
        hp: branch.hp,
        sanity: branch.sanity,
        hunger: branch.hunger
      });
    }
  }

  run.eventResult = text;
  run.eventChoiceIndex = index;
  run.eventFollowUp = followUp;
  pushLog(state, "事件", text);
  state.current.modal = "eventResult";
  return { ok: true, text: text, followUp: followUp };
}

/** 事件结果页「继续」：处理遗留动作（强化/遗物）再关闭 */
function confirmEventResult(state) {
  var run = state.run;
  // 结果页只负责把「选择时算好的后续动作」执行掉，不重算概率
  var followUp = run.eventFollowUp || null;
  run.eventFollowUp = null;
  run.eventId = null;
  run.eventResult = null;
  run.eventChoiceIndex = -1;
  state.current.modal = null;

  if (followUp === "enhance") {
    openEnhance(state, 3);
    return { followUp: "enhance" };
  }
  if (followUp === "relic") {
    var relic = relicsApi.roll(rng.pick, run.relics.map(function (item) { return item.id; }));
    obtainRelic(state, relic);
    return { followUp: "relic", relic: relic };
  }
  return { followUp: null };
}

/* ---------------- 营地 / 商店 ---------------- */

function campRest(state) {
  var heal = 22 + state.run.effects.campHealBonus;
  state.player.hp = clamp(state.player.hp + heal, 0, state.player.maxHp);
  state.player.sanity = clamp(state.player.sanity + 10, 0, config.maxSanity);
  state.player.hunger = clamp(state.player.hunger + 15, 0, config.maxHunger);
  pushLog(state, "营地", "你休息了一会儿，恢复 " + heal + " 生命与 10 精神。");
  state.current.modal = null;
  return { ok: true, message: "恢复 " + heal + " 生命 / 10 精神 / 15 饱食" };
}

function campPrepare(state) {
  pushLog(state, "营地", "你没有休息，完成了一次整备。");
  openEnhance(state, 3);
  return { ok: true };
}

function shopPrice(state, item) {
  var run = state.run;
  if (!run || !run.active) return item.cost;
  var price = item.cost;
  if (typeof run.effects.firstShopDiscount === "number") {
    price = Math.ceil(price * run.effects.firstShopDiscount);
  }
  // 每日条件与主题的价格系数已在 modsOf 里相乘，这里只乘一次
  price = Math.ceil(price * modsOf(run).shopPriceMul);
  return price;
}

function buyItem(state, shopItemId) {
  var shopItem = null;
  var i;
  for (i = 0; i < itemsApi.SHOP_ITEMS.length; i += 1) {
    if (itemsApi.SHOP_ITEMS[i].id === shopItemId) shopItem = itemsApi.SHOP_ITEMS[i];
  }
  if (!shopItem) return { ok: false };
  var price = shopPrice(state, shopItem);
  if (!spendCurrency(state, shopItem.costType, price)) {
    return { ok: false, message: "资源不足。" };
  }
  var grant = {};
  grant[shopItem.itemId] = shopItem.amount;
  grantItems(state, grant);
  if (state.run && state.run.active && typeof state.run.effects.firstShopDiscount === "number") {
    state.run.effects.firstShopDiscount = null;
  }
  pushLog(state, "商店", "购买了 " + (itemsApi.ITEMS[shopItem.itemId] || {}).name + "。");
  return { ok: true, message: "购买成功。" };
}

/* ---------------- 结算 ---------------- */

function computeSummary(state) {
  var run = state.run;
  var engineLevel = state.progress.trainUpgrades.engine;
  var etherBonus = 1 + engineLevel * config.engineEtherBonus;
  var baseReward = run.completed ? 40 + run.layer * 12 : 10 + run.layer * 6;
  // 每日挑战走独立奖励，不吃普通结算，避免「跑一趟挑战拿两份钱」
  var reward = run.daily ? 0 : Math.round(baseReward * etherBonus);
  return {
    cleared: run.completed,
    layer: run.layer,
    nodes: run.nodesVisited,
    battlesWon: run.stats.battlesWon,
    damageDealt: run.stats.damageDealt,
    etherEarned: run.stats.etherGained,
    daily: !!run.daily,
    reward: reward,
    relics: run.relics.slice(),
    enhancements: run.enhancements.slice()
  };
}

function endRun(state, cleared, message) {
  var run = state.run;
  if (!run) return null;
  var summary = computeSummary(state);

  // 跨局统计：成就指标都从这里来（结算时一次性写，避免每帧判断）
  var stats = state.progress.stats;
  stats.maxRelics = Math.max(stats.maxRelics, run.relics.length);
  stats.maxEnhancements = Math.max(stats.maxEnhancements, run.enhancements.length);
  if (cleared) {
    if (run.stats.hpAtBossWin >= state.player.maxHp) stats.perfectBossWins += 1;
    if (state.player.sanity < 30) stats.lowSanityClears += 1;
    if (!run.relics.length) stats.noRelicClears += 1;
  }

  grantCurrency(state, { ether: summary.reward, gold: cleared ? 3 : 0 });

  // 每日挑战：还原钱包（挑战只结算奖励，不动玩家攒下的资产），再单独发挑战奖励
  if (run.daily) {
    var obs = state.progress.trainUpgrades.observatory || 0;
    var dailyReward = 0;
    if (cleared) {
      dailyReward = Math.round((config.daily.baseReward + run.layer * config.daily.rewardPerLayer)
        * (1 + obs * config.daily.rewardBonusPerLevel));
      state.progress.daily.clears += 1;
    }
    if (run.layer > state.progress.daily.bestLayer) state.progress.daily.bestLayer = run.layer;
    restoreWallet(state, run.daily.wallet);
    if (dailyReward > 0) grantCurrency(state, { ether: dailyReward });
    summary.dailyReward = dailyReward;
  }

  run.active = false;
  run.completed = !!cleared;
  run.failed = !cleared;
  run.battle = null;
  run.pendingEnhancements = null;
  run.eventId = null;
  run.eventResult = null;
  state.current.scene = "train";
  state.current.modal = "summary";
  state.current.modalData = { summary: summary, message: message || "" };
  pushLog(state, cleared ? "通关" : "探索终止", message || "");

  // 成就与图鉴放在最后检查：此时 progress 已经是最新值
  summary.unlockedAchievements = evaluateAchievements(state);
  checkCodexReward(state);
  return summary;
}

function abandonRun(state) {
  if (!state.run || !state.run.active) return { ok: false };
  endRun(state, false, "你主动结束了本次探索。");
  return { ok: true };
}

function closeSummary(state) {
  state.current.modal = null;
  state.current.modalData = null;
}

/* ---------------- 广告配额 ---------------- */

function canWatchAd(state, now) {
  var today = formatDateKey(now);
  if (state.meta.adViewDate !== today) {
    state.meta.adViewDate = today;
    state.meta.adViewsToday = 0;
  }
  return state.meta.adViewsToday < config.adDailyLimit;
}

module.exports = {
  // 基础
  createDefaultState: createDefaultState,
  formatDateKey: formatDateKey,
  parseDateKey: parseDateKey,
  clamp: clamp,
  // 局外
  handleDailyLogin: handleDailyLogin,
  restoreSanity: restoreSanity,
  sanityCooldownLeft: sanityCooldownLeft,
  claimFreeFood: claimFreeFood,
  usePortableFood: usePortableFood,
  upgradeCost: upgradeCost,
  upgradeTrain: upgradeTrain,
  grantCurrency: grantCurrency,
  spendCurrency: spendCurrency,
  grantItems: grantItems,
  // 局内
  startRun: startRun,
  getAvailableNodes: getAvailableNodes,
  travelTo: travelTo,
  // 战斗
  startBattle: startBattle,
  dismissBattleIntro: dismissBattleIntro,
  battleAction: battleAction,
  enemyTurn: enemyTurn,
  calcPlayerDamage: calcPlayerDamage,
  applyAdRevive: applyAdRevive,
  // 强化与遗物
  openEnhance: openEnhance,
  chooseEnhancement: chooseEnhancement,
  obtainRelic: obtainRelic,
  setProgress: setProgress,
  applySetBonuses: applySetBonuses,
  reconcileSets: reconcileSets,
  openChest: openChest,
  confirmChest: confirmChest,
  // 事件
  openEvent: openEvent,
  chooseEventOption: chooseEventOption,
  canChooseEventOption: canChooseEventOption,
  confirmEventResult: confirmEventResult,
  // 营地 / 商店
  campRest: campRest,
  campPrepare: campPrepare,
  shopPrice: shopPrice,
  buyItem: buyItem,
  // 结算
  computeSummary: computeSummary,
  endRun: endRun,
  abandonRun: abandonRun,
  closeSummary: closeSummary,
  // 图鉴 / 成就 / 每日挑战
  codexSummary: codexSummary,
  checkCodexReward: checkCodexReward,
  markEnemySeen: markEnemySeen,
  achievementCount: achievementCount,
  evaluateAchievements: evaluateAchievements,
  computeMetrics: computeMetrics,
  dailyInfo: dailyInfo,
  dailyUnlocked: dailyUnlocked,
  startDaily: startDaily,
  // 车厢主题
  modsOf: modsOf,
  themeSummary: themeSummary,
  themeUnlocked: themeUnlocked,
  selectedThemeId: selectedThemeId,
  selectTheme: selectTheme,
  unlockTheme: unlockTheme,
  // 广告
  canWatchAd: canWatchAd,
  pushLog: pushLog,
  makeLog: makeLog
};
