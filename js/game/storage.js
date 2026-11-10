/**
 * storage.js —— 存档：版本迁移 + 白名单深合并 + 数值夹取
 *
 * 三条硬约束：
 * 1. 读档绝不能让脏数据进运行时：类型不符回退默认值，数值全部 clamp。
 * 2. 场景与数据必须自洽：route 场景没有地图就退回主城；battle 弹窗没有战斗就关掉。
 * 3. 存档里不存函数、不存循环引用（强化/遗物只存 id + 展示字段）。
 */

var config = require("./config");
var stateApi = require("./state");
var platform = require("../platform/platform");

var SCENES = { home: 1, train: 1, route: 1 };
var MODALS = {
  battle: 1, event: 1, eventResult: 1, enhance: 1, shop: 1,
  camp: 1, chest: 1, summary: 1, info: 1, settings: 1, trainUpgrade: 1, guide: 1,
  codex: 1, daily: 1
};

function toInt(value, min, max, fallback) {
  var n = Number(value);
  if (!isFinite(n)) return typeof fallback === "number" ? fallback : min;
  return Math.round(Math.max(min, Math.min(max, n)));
}

function readRaw(key) {
  var raw;
  try {
    raw = platform.readStorage(key);
  } catch (error) {
    return null;
  }
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }
  return raw;
}

function read() {
  var current = readRaw(config.storageKey);
  if (current) return current;
  var legacy = config.legacyKeys || [];
  var i;
  for (i = 0; i < legacy.length; i += 1) {
    var old = readRaw(legacy[i]);
    if (old) return old;
  }
  return null;
}

function clampPlayer(raw, base) {
  var p = raw || {};
  var inv = p.inventory || {};
  var maxHp = toInt(p.maxHp, 20, 500, config.maxHp);
  return {
    hp: toInt(p.hp, 0, maxHp, maxHp),
    maxHp: maxHp,
    hunger: toInt(p.hunger, 0, config.maxHunger, config.maxHunger),
    sanity: toInt(p.sanity, 0, config.maxSanity, config.maxSanity),
    ether: toInt(p.ether, 0, config.maxEther, config.starterEther),
    gold: toInt(p.gold, 0, config.maxGold, config.starterGold),
    baseAttack: toInt(p.baseAttack, 1, 999, config.baseAttack),
    inventory: {
      portableFood: toInt(inv.portableFood, 0, 99, 0),
      potion: toInt(inv.potion, 0, 99, 0),
      retryCard: toInt(inv.retryCard, 0, 99, 0),
      executeCard: toInt(inv.executeCard, 0, 99, 0)
    }
  };
}

function clampMeta(raw) {
  var m = raw || {};
  var pattern = /^\d{4}-\d{2}-\d{2}$/;
  var today = stateApi.formatDateKey(Date.now());
  return {
    createdAt: toInt(m.createdAt, 0, 9999999999999, Date.now()),
    lastLoginDate: pattern.test(m.lastLoginDate) ? m.lastLoginDate : today,
    loginStreak: toInt(m.loginStreak, 1, 9999, 1),
    lastFreeFoodDate: pattern.test(m.lastFreeFoodDate || "") ? m.lastFreeFoodDate : null,
    lastSanityRestoreAt: toInt(m.lastSanityRestoreAt, 0, 9999999999999, 0),
    adViewDate: pattern.test(m.adViewDate) ? m.adViewDate : today,
    adViewsToday: toInt(m.adViewsToday, 0, config.adDailyLimit, 0),
    tutorialSeen: m.tutorialSeen === true,
    totalPlayMs: toInt(m.totalPlayMs, 0, 9999999999999, 0),
    // 老存档只有 soundOn：映射到 sfxOn，BGM 默认开
    soundOn: m.soundOn !== false,
    bgmOn: m.bgmOn !== false,
    sfxOn: m.sfxOn !== undefined ? m.sfxOn !== false : m.soundOn !== false,
    vibrationOn: m.vibrationOn !== false
  };
}

/** 只保留「id → 数值」的映射，长度有上限，防止脏档撑爆存档体积 */
function sanitizeIdMap(raw, limit) {
  var out = {};
  if (!raw || typeof raw !== "object") return out;
  var count = 0;
  var key;
  for (key in raw) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    if (count >= limit) break;
    if (typeof key !== "string" || key.length > 40) continue;
    out[key] = 1;
    count += 1;
  }
  return out;
}

/** 敌人图鉴多一层「击败次数」 */
function sanitizeEnemyCodex(raw, limit) {
  var out = {};
  if (!raw || typeof raw !== "object") return out;
  var count = 0;
  var key;
  for (key in raw) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    if (count >= limit) break;
    if (typeof key !== "string" || key.length > 40) continue;
    var entry = raw[key];
    out[key] = {
      seen: entry && entry.seen === 0 ? 0 : 1,
      defeats: toInt(entry && entry.defeats, 0, 99999, 0)
    };
    count += 1;
  }
  return out;
}

function clampProgress(raw) {
  var p = raw || {};
  var up = p.trainUpgrades || {};
  var codex = p.codex || {};
  var stats = p.stats || {};
  var daily = p.daily || {};
  var achievements = {};
  var id;
  for (id in (p.achievements || {})) {
    if (!Object.prototype.hasOwnProperty.call(p.achievements, id)) continue;
    if (typeof id !== "string" || id.length > 40) continue;
    achievements[id] = toInt(p.achievements[id], 0, 9999999999999, Date.now());
  }
  return {
    runsStarted: toInt(p.runsStarted, 0, 999999, 0),
    runsCleared: toInt(p.runsCleared, 0, 999999, 0),
    bossClears: toInt(p.bossClears, 0, 999999, 0),
    bestLayer: toInt(p.bestLayer, 0, 99, 0),
    totalEther: toInt(p.totalEther, 0, 99999999, 0),
    trainUpgrades: {
      diner: toInt(up.diner, 0, 5, 0),
      medbay: toInt(up.medbay, 0, 5, 0),
      engine: toInt(up.engine, 0, 5, 0),
      cargo: toInt(up.cargo, 0, 5, 0),
      observatory: toInt(up.observatory, 0, 5, 0)
    },
    codex: {
      enemies: sanitizeEnemyCodex(codex.enemies, 200),
      relics: sanitizeIdMap(codex.relics, 200),
      enhancements: sanitizeIdMap(codex.enhancements, 200),
      tier: toInt(codex.tier, 0, 4, 0)
    },
    achievements: achievements,
    stats: {
      battlesWon: toInt(stats.battlesWon, 0, 9999999, 0),
      maxRelics: toInt(stats.maxRelics, 0, 99, 0),
      maxEnhancements: toInt(stats.maxEnhancements, 0, 99, 0),
      perfectBossWins: toInt(stats.perfectBossWins, 0, 99999, 0),
      lowSanityClears: toInt(stats.lowSanityClears, 0, 99999, 0),
      noRelicClears: toInt(stats.noRelicClears, 0, 99999, 0)
    },
    daily: {
      lastDate: /^\d{4}-\d{2}-\d{2}$/.test(daily.lastDate || "") ? daily.lastDate : null,
      streak: toInt(daily.streak, 0, 9999, 0),
      clears: toInt(daily.clears, 0, 999999, 0),
      attempts: toInt(daily.attempts, 0, 999999, 0),
      bestLayer: toInt(daily.bestLayer, -1, 99, -1)
    }
  };
}

/** 路线图重建：按 seed 重新生成，再用存档里记录的类型/访问状态覆盖 */
function sanitizeLayers(raw, seed) {
  if (!Array.isArray(raw) || !raw.length) return null;
  var mapApi = require("./map");
  var fresh = mapApi.generate(seed);
  if (fresh.length !== raw.length) return fresh;

  var i;
  var j;
  for (i = 0; i < fresh.length; i += 1) {
    if (!Array.isArray(raw[i]) || raw[i].length !== fresh[i].length) return fresh;
    for (j = 0; j < fresh[i].length; j += 1) {
      var saved = raw[i][j];
      if (!saved || typeof saved !== "object") return fresh;
      // 结构与生成器必须完全一致，否则视为脏档整体重建
      if (saved.id !== fresh[i][j].id) return fresh;
      fresh[i][j].type = typeof saved.type === "string" ? saved.type : fresh[i][j].type;
      fresh[i][j].visited = saved.visited === true;
    }
  }
  return fresh;
}

function clampStrings(list, limit) {
  if (!Array.isArray(list)) return [];
  return list.filter(function (item) {
    return item && typeof item === "object" && typeof item.id === "string";
  }).slice(0, limit).map(function (item) {
    return {
      id: item.id.slice(0, 40),
      name: typeof item.name === "string" ? item.name.slice(0, 20) : "",
      desc: typeof item.desc === "string" ? item.desc.slice(0, 80) : "",
      rarity: typeof item.rarity === "string" ? item.rarity : undefined
    };
  });
}

function sanitizeEffects(raw) {
  var effectsApi = require("./data/effects");
  var base = effectsApi.emptyEffects();
  if (!raw || typeof raw !== "object") return base;
  var key;
  for (key in base) {
    if (!Object.prototype.hasOwnProperty.call(base, key)) continue;
    if (typeof base[key] === "number") {
      base[key] = toInt(raw[key], -999, 9999, 0);
    } else if (typeof base[key] === "boolean") {
      base[key] = raw[key] === true;
    } else {
      base[key] = typeof raw[key] === "number" ? raw[key] : null;
    }
  }
  return base;
}

function sanitizeBattle(raw) {
  if (!raw || typeof raw !== "object") return null;
  var maxHp = toInt(raw.maxHp, 1, 9999, 1);
  var logs = Array.isArray(raw.logs) ? raw.logs.filter(function (line) {
    return typeof line === "string";
  }).slice(0, 24) : [];
  return {
    kind: raw.kind === "elite" ? "elite" : raw.kind === "boss" ? "boss" : "normal",
    enemyId: typeof raw.enemyId === "string" ? raw.enemyId : "strayHound",
    name: typeof raw.name === "string" ? raw.name.slice(0, 20) : "未知敌人",
    figure: raw.figure === "boss" ? "boss" : raw.figure === "elite" ? "elite" : "normal",
    color: typeof raw.color === "string" ? raw.color : "#9FB0BA",
    trait: typeof raw.trait === "string" ? raw.trait : "normal",
    affix: typeof raw.affix === "string" ? raw.affix.slice(0, 24) : null,
    affixName: typeof raw.affixName === "string" ? raw.affixName.slice(0, 12) : null,
    affixDesc: typeof raw.affixDesc === "string" ? raw.affixDesc.slice(0, 60) : null,
    poison: toInt(raw.poison, 0, 9, 0),
    revived: raw.revived === true,
    intro: typeof raw.intro === "string" ? raw.intro.slice(0, 80) : "",
    hp: toInt(raw.hp, 0, maxHp, maxHp),
    maxHp: maxHp,
    damageRange: Array.isArray(raw.damageRange) && raw.damageRange.length === 2
      ? [toInt(raw.damageRange[0], 1, 99, 5), toInt(raw.damageRange[1], 1, 99, 10)]
      : [5, 10],
    reward: {
      ether: toInt(raw.reward && raw.reward.ether, 0, 999, 0),
      gold: toInt(raw.reward && raw.reward.gold, 0, 99, 0)
    },
    boss: raw.boss === true,
    elite: raw.elite === true,
    enemyShield: toInt(raw.enemyShield, 0, 999, 0),
    playerShield: toInt(raw.playerShield, 0, 999, 0),
    turn: toInt(raw.turn, 1, 999, 1),
    defenseStance: raw.defenseStance === true,
    enemyCharge: toInt(raw.enemyCharge, 0, 9, 0),
    over: raw.over === true,
    result: raw.result === "lose" ? "lose" : null,
    logs: logs.length ? logs : ["战斗继续。"]
  };
}

/**
 * 每日挑战存档：限制条件不信任存档，按 dateKey 重新推导。
 * 这样即使存档被改，也不会造出「自己给自己发奖励」的挑战条件。
 */
function sanitizeDaily(raw) {
  if (!raw || typeof raw !== "object") return null;
  var dailyApi = require("./data/daily");
  var dateKey = typeof raw.dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.dateKey)
    ? raw.dateKey : null;
  if (!dateKey) return null;
  var seed = dailyApi.seedFromDate(dateKey);
  var modifiers = dailyApi.rollModifiers(seed);
  var wallet = raw.wallet && typeof raw.wallet === "object" ? raw.wallet : null;
  return {
    dateKey: dateKey,
    seed: seed,
    modifierIds: modifiers.map(function (m) { return m.id; }),
    modifierNames: modifiers.map(function (m) { return m.name; }),
    combined: dailyApi.combine(modifiers),
    wallet: {
      ether: toInt(wallet && wallet.ether, 0, config.maxEther, 0),
      gold: toInt(wallet && wallet.gold, 0, config.maxGold, 0),
      inventory: (function () {
        var inv = (wallet && wallet.inventory) || {};
        return {
          portableFood: toInt(inv.portableFood, 0, 99, 0),
          potion: toInt(inv.potion, 0, 99, 0),
          retryCard: toInt(inv.retryCard, 0, 99, 0),
          executeCard: toInt(inv.executeCard, 0, 99, 0)
        };
      })()
    }
  };
}

function sanitizeRun(raw) {
  var base = stateApi.createDefaultState(Date.now()).run;
  if (!raw || typeof raw !== "object" || raw.active !== true) return base;

  var seed = toInt(raw.seed, 1, 4294967295, 1);
  var layers = sanitizeLayers(raw.layers, seed);
  var run = {
    seed: seed,
    active: true,
    completed: false,
    failed: false,
    layers: layers || [],
    currentNodeId: typeof raw.currentNodeId === "string" ? raw.currentNodeId : null,
    layer: toInt(raw.layer, -1, 99, -1),
    route: Array.isArray(raw.route) ? raw.route.filter(function (t) { return typeof t === "string"; }).slice(0, 40) : [],
    nodesVisited: toInt(raw.nodesVisited, 0, 99, 0),
    battle: sanitizeBattle(raw.battle),
    eventId: typeof raw.eventId === "string" ? raw.eventId : null,
    eventChoiceIndex: toInt(raw.eventChoiceIndex, -1, 9, -1),
    eventResult: typeof raw.eventResult === "string" ? raw.eventResult.slice(0, 200) : null,
    eventFollowUp: typeof raw.eventFollowUp === "string" ? raw.eventFollowUp : null,
    pendingEnhancements: Array.isArray(raw.pendingEnhancements) ? clampStrings(raw.pendingEnhancements, 5) : null,
    pendingRelicId: typeof raw.pendingRelicId === "string" ? raw.pendingRelicId : null,
    daily: sanitizeDaily(raw.daily),
    effects: sanitizeEffects(raw.effects),
    relics: clampStrings(raw.relics, 30),
    enhancements: clampStrings(raw.enhancements, 40),
    recentEvents: Array.isArray(raw.recentEvents)
      ? raw.recentEvents.filter(function (id) { return typeof id === "string"; }).slice(0, 3)
      : [],
    stats: {
      battlesWon: toInt(raw.stats && raw.stats.battlesWon, 0, 9999, 0),
      damageDealt: toInt(raw.stats && raw.stats.damageDealt, 0, 999999, 0),
      etherGained: toInt(raw.stats && raw.stats.etherGained, 0, 999999, 0),
      turns: toInt(raw.stats && raw.stats.turns, 0, 9999, 0),
      shopsVisited: toInt(raw.stats && raw.stats.shopsVisited, 0, 999, 0),
      hpAtBossWin: toInt(raw.stats && raw.stats.hpAtBossWin, 0, 9999, 0)
    }
  };

  // 自洽性修补
  var mapApi = require("./map");
  if (!run.layers.length) return base;
  if (run.currentNodeId && !mapApi.findById(run.layers, run.currentNodeId)) {
    run.currentNodeId = null;
    run.layer = -1;
  }
  return run;
}

function sanitizeCurrent(raw, run) {
  var c = raw || {};
  var scene = SCENES[c.scene] ? c.scene : "home";
  var modal = MODALS[c.modal] ? c.modal : null;
  var modalData = c.modalData && typeof c.modalData === "object" ? c.modalData : null;

  if (scene === "route" && (!run || !run.active)) {
    scene = "home";
    modal = null;
  }
  if (modal === "battle" && !(run && run.battle)) modal = null;
  if (modal === "enhance" && !(run && run.pendingEnhancements && run.pendingEnhancements.length)) modal = null;
  if (modal === "event" && !(run && run.eventId)) modal = null;
  if (modal === "eventResult" && !(run && run.eventResult)) modal = null;
  if (modal === "chest" && !(run && run.pendingRelicId)) modal = null;
  if (modal === "summary" && !(modalData && modalData.summary)) modal = null;

  return { scene: scene, modal: modal, modalData: modalData };
}

function sanitizeLogs(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(function (entry) {
    return entry && typeof entry === "object" && typeof entry.title === "string" && typeof entry.text === "string";
  }).slice(0, 20).map(function (entry) {
    return {
      id: typeof entry.id === "string" ? entry.id : String(Math.random()).slice(2),
      title: entry.title.slice(0, 12),
      text: entry.text.slice(0, 120)
    };
  });
}

function migrate(raw) {
  var base = stateApi.createDefaultState(Date.now());
  if (!raw || typeof raw !== "object") return base;

  var run = sanitizeRun(raw.run);
  var merged = {
    schemaVersion: config.schemaVersion,
    player: clampPlayer(raw.player, base.player),
    meta: clampMeta(raw.meta),
    progress: clampProgress(raw.progress),
    run: run,
    current: sanitizeCurrent(raw.current, run),
    logs: sanitizeLogs(raw.logs)
  };
  if (!merged.logs.length) merged.logs = base.logs;
  return merged;
}

function load() {
  var raw = read();
  if (!raw) return null;
  try {
    return migrate(raw);
  } catch (error) {
    return null;
  }
}

function save(data) {
  try {
    data.schemaVersion = config.schemaVersion;
    return platform.writeStorage(config.storageKey, data);
  } catch (error) {
    return false;
  }
}

function clear() {
  platform.removeStorage(config.storageKey);
  (config.legacyKeys || []).forEach(function (key) {
    platform.removeStorage(key);
  });
  return true;
}

module.exports = {
  load: load,
  save: save,
  clear: clear,
  migrate: migrate,
  sanitizeRun: sanitizeRun
};
