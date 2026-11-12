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
    intro: "Boss：每 2 回合加盾 8 点，每 3 回合蓄势重击。",
    /**
     * 第二形态：双影。
     *
     * 它是五个 Boss 里唯一「变多」的那个，所以机制也必须是数量：一回合打两段。
     * 两段的单段伤害只有 55%，总和几乎不变——换的不是数值而是「防御架势只挡得住
     * 第一段」这件事。玩家蹲一回合换来的免伤，在它面前只剩一半。
     */
    phase2: {
      label: "双影",
      // hint 写在「打之前」：它不剧透，只让玩家在开战前多看一眼影子。
      // 剧透会把惊喜变成说明书，完全不提又会让崩开显得凭空出现——
      // 埋一个可以被忽略、也可以在事后想起来的细节，是这两者之间唯一的位置。
      // callback 是它在半血那一下的兑现：同一幅画面的第二拍，不是复读 hint，
      // 也不是解释机制（机制在 tip 里）。
      hint: "它站在灯下的角度不太对——影子比身体多出一层。",
      callback: "你终于看清了——它从来都不是一个。",
      line: "它从正中裂开，第二个影子站了起来。",
      tip: "每回合两段攻击，防御架势只挡得住第一段。",
      dmgAdd: 1,
      shield: 10,
      cadence: 2,
      hits: 2,
      hitScale: 0.55
    }
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
    intro: "Boss：检票的节奏越来越快，蓄势重击一次比一次狠。",
    /**
     * 第二形态：查票。
     *
     * 车长的本职是核对——第二形态就把「核对」从检票挪到你的动作上：
     * 连续两回合用同一招，这一击伤害 +45%。它惩罚的是重复，不是某个具体招式，
     * 所以四个行动都不吃亏，吃亏的是「一直按同一个按钮」。
     */
    phase2: {
      label: "查票",
      hint: "它手里捏着一沓票根，每一张都写着同一个名字。",
      callback: "那沓票根上记的，是你每一次出手。",
      line: "它把票根翻过来，开始照着你上一回合念。",
      tip: "重复上回合的同一招，这一击伤害 +45%。",
      dmgAdd: 1,
      shield: 12,
      cadence: 2,
      repeatPunish: 0.45
    }
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
    intro: "Boss：整节锅炉都是它的躯壳，每次受击都要先啃穿一层铁。",
    /**
     * 第二形态：过载。
     *
     * 它把炉门顶开，把自己也点了——出手重 30%，但每回合自损 5 点。
     * 这是唯一一个「变强同时变脆」的形态：玩家不用变强，只要拖住。
     * 换阶段护盾也给得最少（8），因为它的第二形态本来就该是「赶紧的」。
     */
    phase2: {
      label: "过载",
      hint: "炉温还在往上走，铁皮已经开始发红发亮。",
      callback: "铁皮红得发亮——原来那不是灯光。",
      line: "炉门被顶开，火从它的缝里烧出来——它也烧起来了。",
      tip: "出手重 30%，但它每回合自损 5 点生命。",
      dmgAdd: 0,
      shield: 8,
      cadence: 2,
      dmgMul: 1.3,
      selfBleed: 5
    }
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
    intro: "Boss：它每一次扳道都赌上整列车的方向，出手轻重毫无规律。",
    /**
     * 第二形态：脱轨。
     *
     * 赌徒特性本来就在掷骰，第二形态让它多掷一次：35% 概率追加一段 55% 的伤害。
     * 期望伤害只涨 19%，但方差很大——玩家算不准还剩几回合能扛，
     * 这正是扳道工该给人的感觉：不是更疼，是更没底。
     */
    phase2: {
      label: "脱轨",
      hint: "它的手一直搭在扳道上，指节在抖。",
      callback: "那只手一直按着扳道，现在终于扳下去了。",
      line: "它把道岔扳到底，铁轨的摩擦声失去了规律。",
      tip: "每次出手有 35% 概率再扳一次道，追加一击。",
      dmgAdd: 1,
      shield: 10,
      cadence: 2,
      extraChance: 0.35,
      extraScale: 0.55
    }
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
    intro: "Boss：从第一站就在车上，一直在等一个愿意让它住下的人。",
    /**
     * 第二形态：换宿主。
     *
     * 它不再站在对面，而是钻进来。所以这一段没有护盾可以挡：每回合穿盾扣 3 点，
     * 你喝下的药剂只回一半。它的护盾给得也最少（6）——它已经不在外面了，
     * 外面那层壳没有意义。玩家能做的只有一件事：在血被抽干之前把它打死。
     */
    phase2: {
      label: "换宿主",
      hint: "它看着你，眼神像在找一个能住进去的地方。",
      callback: "那双眼睛一直在找一个能住得进去的地方。",
      line: "它不再站在你对面——它钻了进来。",
      tip: "每回合穿盾掉 3 点，回血药剂只回一半。",
      dmgAdd: 1,
      shield: 6,
      cadence: 3,
      dotOnPlayer: 3,
      healCut: 0.5
    }
  },

  /* ---------------- 普通 · 第三批 ---------------- */
  // 这一批的重点不是「更多」，而是「更早」：低层数池子里原本只有 4 只普通怪，
  // 一局前十层会遇到三遍同一个。新增里 4 只 layerMin ≤ 2，把早期重复率压下去。
  // 另外锈蚀主题原本一只专属敌人都没有（全靠无标签通用怪），这批补了 4 只。
  {
    id: "couplerHusk",
    material: "metal",
    themes: ["rust"],
    name: "车钩空壳",
    kind: "normal",
    trait: "armored",
    figure: "normal",
    color: "#B08A62",
    hpRange: [36, 44],
    damageRange: [7, 11],
    reward: { ether: 22, gold: 1 },
    layerMin: 1,
    intro: "焊了三层铁皮，每次受击少掉 3 点伤害。"
  },
  {
    id: "lamplessPorter",
    material: "cloth",
    themes: ["rust"],
    name: "无灯的脚夫",
    kind: "normal",
    trait: "wisp",
    figure: "normal",
    color: "#7E8B96",
    hpRange: [28, 34],
    damageRange: [6, 10],
    reward: { ether: 21, gold: 0 },
    layerMin: 1,
    intro: "提着没点亮的灯，奇数回合吸收残光恢复生命。"
  },
  {
    id: "sootBeggar",
    material: "flesh",
    themes: ["rust"],
    name: "煤灰乞者",
    kind: "normal",
    trait: "vampire",
    figure: "normal",
    color: "#8C6B5F",
    hpRange: [30, 38],
    damageRange: [8, 13],
    reward: { ether: 23, gold: 0 },
    layerMin: 2,
    intro: "它打出的伤害有四成会变成自己的生命。"
  },
  {
    id: "frostLatch",
    material: "metal",
    themes: ["frost"],
    name: "冻锁构体",
    kind: "normal",
    trait: "idol",
    figure: "normal",
    color: "#8FB2C4",
    hpRange: [40, 48],
    damageRange: [6, 10],
    reward: { ether: 23, gold: 1 },
    layerMin: 2,
    intro: "每 3 回合把门闩焊死，获得 10 点护盾。"
  },
  {
    id: "shiverChoir",
    material: "cloth",
    themes: ["frost"],
    name: "战栗唱诗班",
    kind: "normal",
    trait: "swarm",
    figure: "normal",
    color: "#9FB6CE",
    hpRange: [26, 32],
    damageRange: [6, 10],
    reward: { ether: 24, gold: 0 },
    layerMin: 3,
    intro: "第 3 回合齐声尖啸，一回合连击两次。"
  },
  {
    id: "emberBellows",
    material: "void",
    themes: ["ember"],
    name: "鼓风余烬",
    kind: "normal",
    trait: "bomber",
    figure: "normal",
    color: "#C87A5A",
    hpRange: [22, 28],
    damageRange: [10, 15],
    reward: { ether: 25, gold: 0 },
    layerMin: 3,
    intro: "血很薄，但崩解时会炸你 10 点——不会致死。"
  },
  {
    id: "railSpider",
    material: "cloth",
    themes: ["rust"],
    name: "轨枕蛛",
    kind: "normal",
    trait: "weaver",
    figure: "normal",
    color: "#A08672",
    hpRange: [34, 42],
    damageRange: [7, 12],
    reward: { ether: 25, gold: 0 },
    layerMin: 4,
    intro: "每 3 回合吐丝，你的下一击会被拖慢。"
  },
  {
    id: "glacierTick",
    material: "flesh",
    themes: ["frost"],
    name: "霜蛰",
    kind: "normal",
    trait: "assassin",
    figure: "normal",
    color: "#7FA6A0",
    hpRange: [32, 40],
    damageRange: [10, 15],
    reward: { ether: 26, gold: 0 },
    layerMin: 5,
    intro: "会蓄势加重下一击，也有机会偏开你的强力射击。"
  },
  {
    id: "cinderMason",
    material: "metal",
    themes: ["ember"],
    name: "焦砖匠",
    kind: "normal",
    trait: "enrage",
    figure: "normal",
    color: "#A9705B",
    hpRange: [42, 50],
    damageRange: [8, 12],
    reward: { ether: 26, gold: 1 },
    layerMin: 5,
    intro: "半血之后攻势骤然变猛，伤害提升 45%。"
  },

  /* ---------------- 精英 · 第三批 ---------------- */
  {
    id: "doubleHeader",
    material: "metal",
    themes: ["rust"],
    name: "双头车首",
    kind: "elite",
    trait: "gambler",
    figure: "elite",
    color: "#C0A16A",
    hp: [88, 98],
    damageRange: [9, 16],
    reward: { ether: 80, gold: 3 },
    layerMin: 6,
    intro: "精英：两个车头朝相反方向使劲，每一击的轻重都在 50%—170% 之间赌一把。"
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
