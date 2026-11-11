/**
 * data/enemies.js —— 敌人模板
 *
 * 字段：
 * - material: 受击材质（metal / flesh / cloth / void，决定打击音色与粒子色；
 *             纯表现，不参与任何数值。新增敌人必须给，缺省会被测试标记）
 * - themes:   车厢主题权重标签（可选，命中的主题下更容易抽到）
 * - trait:     行为特性（决定 enemyTurn / battleAction 的分支）
 * - figure:    剪影形状（normal / elite / boss）
 * - hpRange:   血量区间（普通怪用，随机取值）
 * - hp:        固定血量（精英 / Boss 用）
 * - damageRange: 单次攻击伤害区间
 * - reward:    击败奖励
 * - layerMin:  从第几层开始可能出现
 * - intro:     首次遭遇的战斗日志文案
 *
 * 扩充新敌人只需往数组里加一条；但如果用了新 trait，
 * 必须同时在 state.js 的 enemyTurn / battleAction 里实现对应行为，
 * 否则它会退化成「白板怪」——名字唬人但什么都不做。
 */

var ENEMIES = [
  /* ---------------- 普通 ---------------- */
  {
    id: "strayHound",
    material: "flesh",
    name: "反击猎犬",
    kind: "normal",
    trait: "wolf",
    figure: "normal",
    color: "#9FB0BA",
    hpRange: [32, 40],
    damageRange: [8, 13],
    reward: { ether: 22, gold: 0 },
    layerMin: 1,
    intro: "受击后会反扑，强力射击有几率被侧闪。"
  },
  {
    id: "guardConstruct",
    material: "metal",
    name: "坚守构体",
    kind: "normal",
    trait: "idol",
    figure: "normal",
    color: "#7C93A0",
    hpRange: [38, 46],
    damageRange: [6, 10],
    reward: { ether: 22, gold: 1 },
    layerMin: 1,
    intro: "每 3 回合立盾 10 点，拖慢你的节奏。"
  },
  {
    id: "shallowWisp",
    material: "cloth",
    themes: ["frost"],
    name: "浅域游魂",
    kind: "normal",
    trait: "wisp",
    figure: "normal",
    color: "#6FA9B8",
    hpRange: [28, 34],
    damageRange: [7, 12],
    reward: { ether: 20, gold: 0 },
    layerMin: 1,
    intro: "奇数回合吸收残光，恢复少量生命。"
  },
  {
    id: "noiseStalker",
    material: "cloth",
    name: "噪响潜伏者",
    kind: "normal",
    trait: "assassin",
    figure: "normal",
    color: "#8C7FA8",
    hpRange: [30, 36],
    damageRange: [9, 14],
    reward: { ether: 23, gold: 0 },
    layerMin: 2,
    intro: "会蓄势，下一击更重。"
  },
  {
    id: "rustScavenger",
    material: "metal",
    name: "锈蚀拾荒者",
    kind: "normal",
    trait: "armored",
    figure: "normal",
    color: "#A88F6A",
    hpRange: [34, 42],
    damageRange: [7, 12],
    reward: { ether: 22, gold: 1 },
    layerMin: 1,
    intro: "裹着废铁甲片，每次受击少掉 3 点血。"
  },
  {
    id: "corpseLamp",
    material: "void",
    themes: ["ember"],
    name: "尸灯",
    kind: "normal",
    trait: "vampire",
    figure: "normal",
    color: "#B7706A",
    hpRange: [30, 38],
    damageRange: [8, 13],
    reward: { ether: 23, gold: 0 },
    layerMin: 2,
    intro: "每次打中你会吸走部分血量补给自己。"
  },
  {
    id: "beetleSwarm",
    material: "flesh",
    name: "甲虫群",
    kind: "normal",
    trait: "swarm",
    figure: "normal",
    color: "#8FA97A",
    hpRange: [26, 32],
    damageRange: [6, 10],
    reward: { ether: 21, gold: 0 },
    layerMin: 2,
    intro: "每 3 回合成群扑咬，一回合打两下。"
  },
  {
    id: "glassEcho",
    material: "metal",
    themes: ["frost"],
    name: "玻璃回响",
    kind: "normal",
    trait: "mirror",
    figure: "normal",
    color: "#86B8C8",
    hpRange: [28, 36],
    damageRange: [8, 12],
    reward: { ether: 23, gold: 0 },
    layerMin: 3,
    intro: "受击时把 3 点伤害反射回你身上。"
  },
  {
    id: "cinderHound",
    material: "flesh",
    themes: ["ember"],
    name: "灰烬猎犬",
    kind: "normal",
    trait: "bomber",
    figure: "normal",
    color: "#C77A4C",
    hpRange: [24, 30],
    damageRange: [9, 14],
    reward: { ether: 24, gold: 0 },
    layerMin: 3,
    intro: "死亡时会炸出一片余烬，扣你 10 点生命。"
  },
  {
    id: "ticketGhost",
    material: "cloth",
    name: "检票幽灵",
    kind: "normal",
    trait: "wisp",
    figure: "normal",
    color: "#7D9BB0",
    hpRange: [30, 36],
    damageRange: [7, 11],
    reward: { ether: 22, gold: 1 },
    layerMin: 3,
    intro: "在残光里不断修补自己。"
  },
  {
    id: "ironMoth",
    material: "metal",
    themes: ["frost"],
    name: "铁翼蛾",
    kind: "normal",
    trait: "armored",
    figure: "normal",
    color: "#B3A98C",
    hpRange: [36, 44],
    damageRange: [8, 13],
    reward: { ether: 23, gold: 0 },
    layerMin: 4,
    intro: "翅膀覆着金属鳞粉，很难打出有效伤害。"
  },
  {
    id: "wailingBride",
    material: "flesh",
    themes: ["frost"],
    name: "哀鸣新娘",
    kind: "normal",
    trait: "vampire",
    figure: "normal",
    color: "#B985A8",
    hpRange: [32, 40],
    damageRange: [9, 14],
    reward: { ether: 25, gold: 1 },
    layerMin: 5,
    intro: "她的哭声会顺着伤口往里渗。"
  },

  /* ---------------- 精英 ---------------- */
  {
    id: "riftHunter",
    material: "void",
    name: "裂隙执猎者",
    kind: "elite",
    trait: "assassin",
    figure: "elite",
    color: "#C98A5E",
    hp: [64, 76],
    damageRange: [11, 17],
    reward: { ether: 38, gold: 2 },
    layerMin: 2,
    intro: "精英：蓄势突袭，会给 4 个强化候选。"
  },
  {
    id: "ironWarden",
    material: "metal",
    name: "铁锈守望",
    kind: "elite",
    trait: "idol",
    figure: "elite",
    color: "#B0A06A",
    hp: [70, 82],
    damageRange: [10, 15],
    reward: { ether: 40, gold: 2 },
    layerMin: 4,
    intro: "精英：护盾频繁，需要高爆发。"
  },
  {
    id: "shardGolem",
    material: "metal",
    name: "碎片魔像",
    kind: "elite",
    trait: "armored",
    figure: "elite",
    color: "#9AA7B5",
    hp: [76, 88],
    damageRange: [11, 16],
    reward: { ether: 42, gold: 2 },
    layerMin: 3,
    intro: "精英：整体由甲片构成，硬碰硬会吃亏。"
  },
  {
    id: "twinEcho",
    material: "void",
    themes: ["frost"],
    name: "双生回响",
    kind: "elite",
    trait: "mirror",
    figure: "elite",
    color: "#8FB0D0",
    hp: [68, 80],
    damageRange: [12, 18],
    reward: { ether: 44, gold: 2 },
    layerMin: 5,
    intro: "精英：每次被击中都会把伤害反射回来。"
  },

  /* ---------------- Boss ---------------- */
  {
    id: "riftWarden",
    material: "void",
    name: "裂隙看守者",
    kind: "boss",
    trait: "overlord",
    figure: "boss",
    color: "#D8574A",
    hp: [112, 112],
    damageRange: [12, 18],
    reward: { ether: 90, gold: 4 },
    layerMin: 99,
    intro: "Boss：每 2 回合加盾 8 点，每 3 回合蓄势重击。"
  },
  {
    id: "facelessConductor",
    material: "void",
    name: "无面车长",
    kind: "boss",
    trait: "overlord",
    figure: "boss",
    color: "#B24B66",
    hp: [118, 118],
    damageRange: [13, 18],
    reward: { ether: 96, gold: 4 },
    layerMin: 99,
    intro: "Boss：检票的节奏越来越快，蓄势重击一次比一次狠。"
  },
  {
    id: "rustStoker",
    material: "metal",
    themes: ["ember"],
    name: "锈血司炉",
    kind: "boss",
    trait: "armored",
    figure: "boss",
    color: "#C2703E",
    hp: [126, 126],
    damageRange: [12, 17],
    reward: { ether: 92, gold: 5 },
    layerMin: 99,
    intro: "Boss：整节锅炉都是它的躯壳，每次受击都要先啃穿一层铁。"
  },

  /* ================= 第二批次：新特性 + 深水区敌人 =================
   *
   * 这一批的设计目的不是「更多名字」，而是给后期（L5—L8）换节奏：
   * 前面几层靠熟悉度就能过，从第 5 层开始要读行为。
   *
   * 新特性说明：
   * - weaver 织网：每 3 回合缠住你，下一击伤害 -35%（不封行动，只削弱）
   * - parasite 寄生：命中后挂卵，2 回合后孵化，扣 12 血并给敌人回 10
   * - enrage 狂化：首次跌破半血时永久加攻 45%（一刀更比一刀狠）
   * - gambler 赌徒：伤害在 50%—170% 之间浮动（平均值不变，方差变大）
   */

  /* ---------------- 普通 · 第二批 ---------------- */
  {
    id: "threadWeaver",
    material: "cloth",
    themes: ["frost"],
    name: "织网蛛",
    kind: "normal",
    trait: "weaver",
    figure: "normal",
    color: "#7E8FA6",
    hpRange: [30, 38],
    damageRange: [7, 11],
    reward: { ether: 24, gold: 0 },
    layerMin: 3,
    intro: "每 3 回合吐网，你下一击的伤害会被拖慢。"
  },
  {
    id: "broodHost",
    material: "flesh",
    name: "育卵客",
    kind: "normal",
    trait: "parasite",
    figure: "normal",
    color: "#A87D8C",
    hpRange: [36, 44],
    damageRange: [7, 11],
    reward: { ether: 25, gold: 0 },
    layerMin: 4,
    intro: "命中后在你体内产卵，两回合后孵化——要么速杀，要么挨一下。"
  },
  {
    id: "frenziedMiner",
    material: "flesh",
    themes: ["ember"],
    name: "狂乱矿工",
    kind: "normal",
    trait: "enrage",
    figure: "normal",
    color: "#B0855F",
    hpRange: [40, 48],
    damageRange: [8, 12],
    reward: { ether: 26, gold: 1 },
    layerMin: 4,
    intro: "血掉到一半会彻底发狂，攻势永久加重。"
  },
  {
    id: "boneGambler",
    material: "flesh",
    name: "骸骨赌徒",
    kind: "normal",
    trait: "gambler",
    figure: "normal",
    color: "#9C8FA0",
    hpRange: [34, 42],
    damageRange: [6, 16],
    reward: { ether: 27, gold: 1 },
    layerMin: 2,
    intro: "出手轻重全凭运气，伤害在五成到一成七之间跳。"
  },
  {
    id: "ashPilgrim",
    material: "cloth",
    themes: ["ember"],
    name: "灰烬朝圣者",
    kind: "normal",
    trait: "wisp",
    figure: "normal",
    color: "#8FA3B5",
    hpRange: [32, 40],
    damageRange: [6, 10],
    reward: { ether: 23, gold: 0 },
    layerMin: 3,
    intro: "每 2 回合的吸收残光，拖得越久它越精神。"
  },
  {
    id: "chainHound",
    material: "flesh",
    name: "锁链猎犬",
    kind: "normal",
    trait: "wolf",
    figure: "normal",
    color: "#96A2AD",
    hpRange: [30, 38],
    damageRange: [9, 14],
    reward: { ether: 25, gold: 0 },
    layerMin: 5,
    intro: "受击必反扑，拖在地上的铁链会跟着扫过来。"
  },
  {
    id: "rustPreacher",
    material: "flesh",
    name: "锈蚀布道者",
    kind: "normal",
    trait: "vampire",
    figure: "normal",
    color: "#A9707A",
    hpRange: [38, 46],
    damageRange: [8, 12],
    reward: { ether: 26, gold: 0 },
    layerMin: 5,
    intro: "打着布道的名义饮血，打空伤害它就吸不到。"
  },

  /* ---------------- 精英 · 第二批 ---------------- */
  {
    id: "weaverMatron",
    material: "cloth",
    themes: ["frost"],
    name: "织巢母体",
    kind: "elite",
    trait: "weaver",
    figure: "elite",
    color: "#6B7E98",
    hp: [84, 94],
    damageRange: [9, 14],
    reward: { ether: 78, gold: 3 },
    layerMin: 6,
    intro: "整节车厢都是它的网。每 3 回合把你按在原地一下。"
  },
  {
    id: "hollowKing",
    material: "void",
    themes: ["ember"],
    name: "空洞之王",
    kind: "elite",
    trait: "enrage",
    figure: "elite",
    color: "#B4626F",
    hp: [90, 100],
    damageRange: [10, 15],
    reward: { ether: 84, gold: 3 },
    layerMin: 7,
    intro: "它空着的王座还在等一个名字。半血之后才是真正的它。"
  },

  /* ---------------- Boss · 第二批 ---------------- */
  {
    id: "brokenSwitchman",
    material: "metal",
    name: "断轨扳道工",
    kind: "boss",
    trait: "gambler",
    figure: "boss",
    color: "#C98A4B",
    hp: [126, 126],
    damageRange: [11, 20],
    reward: { ether: 100, gold: 5 },
    layerMin: 99,
    intro: "Boss：它每一次扳道都赌上整列车的方向，出手轻重毫无规律。"
  },
  {
    id: "thePassenger",
    material: "flesh",
    name: "那位乘客",
    kind: "boss",
    trait: "parasite",
    figure: "boss",
    color: "#9B6E86",
    hp: [124, 124],
    damageRange: [11, 16],
    reward: { ether: 104, gold: 5 },
    layerMin: 99,
    intro: "Boss：从第一站就在车上，一直在等一个愿意让它住下的人。"
  }
];

function byKind(kind) {
  return ENEMIES.filter(function (enemy) {
    return enemy.kind === kind;
  });
}

function getById(id) {
  var i;
  for (i = 0; i < ENEMIES.length; i += 1) {
    if (ENEMIES[i].id === id) return ENEMIES[i];
  }
  return null;
}

/** 按层数筛选可出现的敌人（普通/精英分开取） */
function poolFor(kind, layer) {
  return ENEMIES.filter(function (enemy) {
    return enemy.kind === kind && layer >= (enemy.layerMin || 1);
  });
}

module.exports = {
  ENEMIES: ENEMIES,
  byKind: byKind,
  getById: getById,
  poolFor: poolFor
};
