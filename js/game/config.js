/**
 * config.js —— 全局数值与常量（唯一数值来源）
 *
 * 调参只改这里，禁止在场景/逻辑里写魔法数字。
 * 单位约定：毫秒、点、枚。
 */

module.exports = {
  /** 存档结构版本：改动 state 结构必须 +1，并在 storage 里补迁移 */
  schemaVersion: 5,
  storageKey: "train-mystery-v3-save",
  legacyKeys: ["train-mystery-douyin-save-v2", "train-mystery-roguelike-save-v4"],

  /* ---------- 诊断与预算 ---------- */
  perf: {
    /**
     * 绘制指令计数（js/core/metrics.js）。默认开：一帧几百次调用多一层转发，
     * 实测对 renderMs 无可见影响，换来的是「掉帧时能看出是不是画得太多」。
     * 真机上若哪天这一层变贵了，置 false 即可整体关掉，渲染行为不变。
     */
    instrument: true,
    /** 单帧光栅化调用预算（fill/stroke/文字/贴图），测试按它兜底 */
    paintBudget: 400
  },

  /* ---------- 激励视频 ------ */
  rewardedVideoAdUnitId: "REPLACE_WITH_YOUR_AD_UNIT_ID",
  adDailyLimit: 15,
  adReviveHp: 70,

  /* ---------- 三资源上限 ---------- */
  maxHp: 100,
  maxHunger: 100,
  maxSanity: 100,
  maxEther: 9999,
  maxGold: 999,

  /* ---------- 玩家基础战斗 ---------- */
  baseAttack: 16,
  preciseBonus: 4,
  powerBonus: 12,
  powerHitRate: 0.68,
  defendShield: 12,
  defendNextAttackBonus: 5,
  potionHeal: 30,
  /** 每场战斗胜利后的基础回血（容错，不依赖强化） */
  healAfterWin: 4,
  portableFoodRestore: 50,
  dailyFoodRestore: 30,

  /* ---------- 路线与消耗 ---------- */
  /** 单局层数（不含 Boss 层） */
  routeLayers: 8,
  layerMinNodes: 2,
  layerMaxNodes: 4,
  hungerPerNode: 6,
  sanityPerBattle: 5,
  sanityPerRun: 5,
  sanityDangerLine: 20,
  /** 逃跑成本（以太碎片），可被强化免除 */
  escapeCost: 12,

  /* ---------- 局外 ---------- */
  /** 精神恢复装置冷却 */
  sanityRestoreCooldownMs: 3 * 60 * 1000,
  starterEther: 40,
  starterGold: 4,
  dailyFoodByDiner: 6,
  medbayHealBonus: 5,
  engineEtherBonus: 0.15,
  /** 列车升级：单价随等级线性递增 */
  trainUpgrades: {
    diner: { name: "餐车", desc: "每日补给 +6 饱食度", baseEther: 60, baseGold: 1, maxLevel: 5 },
    medbay: { name: "医务室", desc: "回血药剂 +5 治疗量", baseEther: 70, baseGold: 1, maxLevel: 5 },
    engine: { name: "动力室", desc: "结算以太 +15%", baseEther: 80, baseGold: 2, maxLevel: 5 },
    cargo: { name: "货舱", desc: "开局多带道具（药/口粮/重战卡/秒杀卡）", baseEther: 90, baseGold: 2, maxLevel: 5 },
    observatory: { name: "观景台", desc: "解锁每日挑战，每级 +10% 挑战奖励", baseEther: 110, baseGold: 2, maxLevel: 5 }
  },

  /** 货舱按等级发的开局道具：索引 = 等级 */
  cargoGrants: [
    {},
    { potion: 1 },
    { potion: 1, portableFood: 1 },
    { potion: 1, portableFood: 1, retryCard: 1 },
    { potion: 2, portableFood: 1, retryCard: 1 },
    { potion: 2, portableFood: 1, retryCard: 1, executeCard: 1 }
  ],

  /* ---------- 精英词缀 ---------- */
  /** 精英额外血量倍率：词缀加了行为，血量就不该再叠太多 */
  eliteHpMul: 0.9,
  /** 精英基础强化候选数 */
  eliteEnhanceBase: 4,

  /* ---------- 每日挑战 ---------- */
  daily: {
    /** 观景台达到该等级才开放 */
    unlockLevel: 1,
    /** 完成挑战的基础以太 */
    baseReward: 90,
    /** 每层额外以太 */
    rewardPerLayer: 8,
    /** 观景台每级奖励加成 */
    rewardBonusPerLevel: 0.1,
    modifierCount: 3
  },

  /* ---------- 图鉴 ---------- */
  codex: {
    /** 每达到一档进度发一次奖励（百分比） */
    tiers: [25, 50, 75, 100],
    rewardPerTier: 60
  },

  /* ---------- 音频 ---------- */
  audio: {
    sfxBasePath: "assets/audio/",
    bgmBasePath: "assets/audio/",
    bgmVolume: 0.42,
    bgmFadeMs: 600,
    /** 场景 → BGM 曲目 */
    trackByScene: { home: "bgm_home", train: "bgm_home", route: "bgm_route" },
    trackBattle: "bgm_battle",
    trackResult: "bgm_home"
  },

  /* ---------- 首次进入引导 ---------- */
  tutorialCopy: [
    "在分支节点之间选路，路线决定这一局的难度和收益。",
    "战斗有四种行动：精准、强力、防御、道具。强力命中率低但伤害高。",
    "战斗与宝箱会给「强化」，宝箱与精英会给「遗物」，本局结束后清空。"
  ]
};
