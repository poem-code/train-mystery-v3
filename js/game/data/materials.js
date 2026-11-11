/**
 * data/materials.js —— 敌人「材质」与受击音效分层
 *
 * 为什么需要这一层：
 * 打一坨铁、打一团肉、打一片布、打一个虚影，如果听感完全一样，
 * 30 个敌人在手感上就退化成同一个靶子。材质字段把「听觉身份」交给数据，
 * 战斗代码只负责按材质取音层，不关心具体是哪个敌人。
 *
 * 约定：
 * - 材质是**纯表现**，不许参与任何数值计算（伤害、减伤、抗性都不行）。
 *   一旦参与数值，它就变成第 5 个属性，玩家得记住 30 个敌人的抗性表。
 * - 音层由「通用层 + 材质层」拼出来，而不是每个敌人各配一条音轨：
 *   4 个材质 × 2 种强度 = 8 条，换成逐敌人配就是 60 条，包体直接爆。
 * - 未知材质一律回退 DEFAULT，读档不会因为字段缺失变哑。
 *
 * 字段：
 * - id / name   内部标识与界面显示名
 * - hit         材质层音效名（对应 assets/audio/<hit>.wav）
 * - spark       受击粒子色（与音色同一个隐喻：铁是冷白、肉是暖红、布是土黄、虚空是紫）
 * - desc        图鉴/说明里的一句话
 */

var DEFAULT = "flesh";

var LIST = [
  {
    id: "metal",
    name: "金属",
    hit: "hit_metal",
    spark: "#DCE8F2",
    desc: "铁皮与齿轮，声音脆、余响长"
  },
  {
    id: "flesh",
    name: "血肉",
    hit: "hit_flesh",
    spark: "#FFB199",
    desc: "湿润的闷响，低频压手"
  },
  {
    id: "cloth",
    name: "丝布",
    hit: "hit_cloth",
    spark: "#CFBB92",
    desc: "干涩的摩擦，像抽在旧帆布上"
  },
  {
    id: "void",
    name: "虚空",
    hit: "hit_void",
    spark: "#B79BE8",
    desc: "声音往下坠，像是被打进了水里"
  }
];

var BY_ID = {};
(function () {
  var i;
  for (i = 0; i < LIST.length; i += 1) BY_ID[LIST[i].id] = LIST[i];
})();

function ids() {
  var out = [];
  var i;
  for (i = 0; i < LIST.length; i += 1) out.push(LIST[i].id);
  return out;
}

function isId(id) {
  return !!(id && BY_ID[id]);
}

/** 未知/缺失一律回退，绝不返回 null——返回 null 会让调用处到处判空 */
function getById(id) {
  return BY_ID[id] || BY_ID[DEFAULT];
}

function nameOf(id) {
  return getById(id).name;
}

/**
 * 受击音层。
 * - 普通命中：材质层单独出声
 * - 重击：通用「crit」打底（低频冲击负责重量）+ 材质层降低音量补质感
 *   反过来（材质层打底）会听不出重击，因为材质音都很短
 *
 * 返回数组而不是单个名字，是为了让调用处直接 for 循环播放，
 * 将来加「破盾层」「属性层」不用再改调用处签名。
 */
function layersFor(id, opts) {
  var material = getById(id);
  var crit = !!(opts && opts.crit);
  if (crit) {
    return [
      { name: "crit", volume: 0.78 },
      { name: material.hit, volume: 0.40 }
    ];
  }
  return [{ name: material.hit, volume: 0.66 }];
}

module.exports = {
  LIST: LIST,
  DEFAULT: DEFAULT,
  ids: ids,
  isId: isId,
  getById: getById,
  nameOf: nameOf,
  layersFor: layersFor
};
