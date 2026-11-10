/**
 * data/events.js —— 随机事件（数据驱动，无函数，可序列化）
 *
 * 选项结构：
 *   label        按钮文案
 *   hint         副文案（风险提示）
 *   cost         支付成本 { ether, gold, hp, sanity }，不足则该选项置灰
 *   gain         直接收益 { ether, gold, hp, sanity, hunger }
 *   items        道具收益 { potion: 1, ... }
 *   action       "enhance" 给强化 | "relic" 给遗物 | null
 *   risk         概率分支 { chance, ok: {...}, bad: {...}, okText, badText }
 *   text         执行后的结果文案
 *   minLayer     最早出现层数（默认 1）
 *
 * 结算逻辑统一在 state.js 的 applyEventChoice，本文件只描述数据。
 */

var EVENTS = [
  {
    id: "signalBeacon",
    title: "残缺信号塔",
    text: "旧信号塔还在雾中闪烁。稳定校准能换来资源，超频广播也许回报更高——也可能引来不该来的东西。",
    weight: 10,
    choices: [
      {
        label: "稳定校准",
        hint: "稳定收益",
        gain: { ether: 24, gold: 1 },
        text: "你重新点亮了信号塔，收到 24 以太碎片与 1 枚金币。"
      },
      {
        label: "超频广播",
        hint: "一半概率拿强化，一半概率掉血",
        risk: {
          chance: 0.5,
          ok: { action: "enhance" },
          bad: { hp: -16 },
          okText: "广播召来残响能量，你获得一次额外强化选择。",
          badText: "广播惊动了暗影，你损失了 16 点生命值。"
        }
      }
    ]
  },
  {
    id: "sealedCabin",
    title: "封闭车厢",
    text: "一节古旧车厢半埋在裂隙边缘。门后像是有补给，也可能有代价。",
    weight: 10,
    choices: [
      {
        label: "破门搜刮",
        hint: "拿道具，但掉精神",
        items: { potion: 1, portableFood: 1 },
        gain: { sanity: -6 },
        text: "你带走了药剂与便携食物，封闭感让精神值下降了 6 点。"
      },
      {
        label: "谨慎拆解",
        hint: "稳妥小收益",
        gain: { ether: 18, hp: 6 },
        text: "你拆下可用的零件，获得 18 以太碎片并恢复了 6 点生命。"
      }
    ]
  },
  {
    id: "riftMirror",
    title: "裂隙镜面",
    text: "镜面里映出另一个你。它愿意用代价交换成长。",
    weight: 8,
    choices: [
      {
        label: "交出生命换强化",
        hint: "-15 生命换一次强化",
        cost: { hp: 15 },
        action: "enhance",
        text: "你与镜面完成了交易，损失 15 点生命，换来新的强化。"
      },
      {
        label: "保持距离",
        hint: "回精神",
        gain: { sanity: 12 },
        text: "你拒绝了镜面的诱惑，精神值恢复 12 点。"
      }
    ]
  },
  {
    id: "weirdTrader",
    title: "诡异商人",
    text: "披着旧披风的商人坐在断轨边，只接受奇怪的交易方式。",
    weight: 8,
    choices: [
      {
        label: "20 生命换遗物",
        hint: "遗物很稀有",
        cost: { hp: 20 },
        action: "relic",
        text: "你割让了一段生命力，换来一件遗物。"
      },
      {
        label: "2 金币买强化",
        hint: "需要 2 金币",
        cost: { gold: 2 },
        action: "enhance",
        text: "商人收下金币，翻开一张新的强化卡。"
      },
      {
        label: "转身离开",
        hint: "无风险",
        text: "你没有理会他，继续赶路。"
      }
    ]
  },
  {
    id: "supplyCrate",
    title: "废弃补给箱",
    text: "锈蚀的补给箱半开着，里面的东西可能还完好。",
    weight: 12,
    choices: [
      {
        label: "立刻打开",
        hint: "资源更多，但掉精神",
        gain: { ether: 30, sanity: -8 },
        text: "你清空了补给箱，获得 30 以太碎片，翻动尸骸让你精神下降 8 点。"
      },
      {
        label: "小心拆解",
        hint: "资源较少，无风险",
        gain: { ether: 14 },
        text: "你谨慎地取下可用部分，获得 14 以太碎片。"
      }
    ]
  },
  {
    id: "echoCorridor",
    title: "回声走廊",
    text: "走廊尽头的回声比你的脚步慢半拍。深入进去，或许能听到裂隙的秘密。",
    weight: 9,
    choices: [
      {
        label: "深入调查",
        hint: "高风险高收益",
        risk: {
          chance: 0.55,
          ok: { ether: 42, gold: 2 },
          bad: { hp: -18, sanity: -6 },
          okText: "你在回声里找到一处旧仓储，获得 42 以太碎片与 2 枚金币。",
          badText: "回声突然收束，你被压得喘不过气，损失 18 生命与 6 精神。"
        }
      },
      {
        label: "原路离开",
        hint: "无收益",
        text: "你退了出来，什么也没得到，但什么也没失去。"
      }
    ]
  },
  {
    id: "oldDevice",
    title: "旧世界装置",
    text: "一台还在嗡鸣的旧世界装置，面板上的指示灯忽明忽暗。",
    weight: 9,
    choices: [
      {
        label: "强行启动",
        hint: "随机大收益或掉血",
        risk: {
          chance: 0.45,
          ok: { action: "relic" },
          bad: { hp: -14 },
          okText: "装置吐出一件旧时代的遗物，你把它收进背包。",
          badText: "装置短路爆炸，你被碎片划伤，损失 14 点生命。"
        }
      },
      {
        label: "稳定拆解",
        hint: "稳定小收益",
        gain: { ether: 20, gold: 1 },
        text: "你拆下核心部件，换来 20 以太碎片与 1 枚金币。"
      }
    ]
  },
  {
    id: "silentConductor",
    title: "沉默乘务员",
    text: "一位旧制服乘务员站在过道尽头，向你摊开手掌，什么也不说。",
    weight: 7,
    minLayer: 3,
    choices: [
      {
        label: "给他 1 金币",
        hint: "换一次精神恢复",
        cost: { gold: 1 },
        gain: { sanity: 20, hp: 10 },
        text: "他点头收下，替你把车窗擦净。精神恢复 20 点，生命恢复 10 点。"
      },
      {
        label: "什么也不给",
        hint: "他很失望",
        gain: { sanity: -4 },
        text: "你从他身边走过，背后传来一声很轻的叹息。"
      }
    ]
  },
  {
    id: "frozenDiner",
    title: "结霜餐车",
    text: "餐车的窗上结着厚厚的白霜，炉子还温着。热气里有种久违的味道。",
    weight: 11,
    choices: [
      {
        label: "坐下来吃一顿",
        hint: "回满饱食与部分生命",
        gain: { hunger: 40, hp: 12, sanity: 4 },
        text: "你吃完了一整份热食，饱食度与生命都回来了不少。"
      },
      {
        label: "打包带走",
        hint: "换道具，不立刻回血",
        items: { portableFood: 1, potion: 1 },
        text: "你把食物装进背包，留着后面更难受的时候用。"
      }
    ]
  },
  {
    id: "ticketBooth",
    title: "无人售票口",
    text: "售票窗口后面没有人，只有一台还在计数的机器，玻璃上贴着一张褪色的价目表。",
    weight: 10,
    choices: [
      {
        label: "投 20 以太买一张票",
        hint: "换 2 金币",
        cost: { ether: 20 },
        gain: { gold: 2 },
        text: "机器吐出一张旧车票，转手就能当 2 枚金币用。"
      },
      {
        label: "翻找找零槽",
        hint: "小收益，掉精神",
        gain: { ether: 16, sanity: -5 },
        text: "你在找零槽里摸出一把碎币，指尖沾了黏腻的东西。"
      }
    ]
  },
  {
    id: "echoChild",
    title: "回声小孩",
    text: "一个模糊的小孩轮廓站在车厢连接处，指着你背包的方向，又指向更深处。",
    weight: 9,
    minLayer: 2,
    choices: [
      {
        label: "给它一份便携食物",
        hint: "需要 1 份便携食物",
        cost: { hp: 0 },
        items: { portableFood: -1 },
        risk: {
          chance: 0.75,
          ok: { action: "relic" },
          bad: { sanity: -10 },
          okText: "它领着你走到一节暗车厢，指着一件蒙尘的遗物，然后消散了。",
          badText: "它把你引向了死路，回头时它已经不在了，只剩一片刺骨的安静。"
        }
      },
      {
        label: "不理会它",
        hint: "无风险",
        text: "你从它身边走过。它没有跟上来。"
      }
    ]
  },
  {
    id: "rustPiano",
    title: "锈蚀钢琴",
    text: "车厢角落摆着一架锈到走音的钢琴，琴键上落着薄灰。",
    weight: 9,
    choices: [
      {
        label: "弹一首",
        hint: "大概率回精神，小概率引来东西",
        risk: {
          chance: 0.7,
          ok: { sanity: 22 },
          bad: { hp: -14, sanity: 6 },
          okText: "你弹了一首很久以前的曲子，胸口松了一点，精神恢复 22 点。",
          badText: "琴声传得很远。有什么东西顺着声音找到了你，你被拖拽了一下。"
        }
      },
      {
        label: "拆下铜弦",
        hint: "稳定收益",
        gain: { ether: 24 },
        text: "你把还能用的铜弦和铜件拆下来，换了 24 以太碎片。"
      }
    ]
  },
  {
    id: "brokenClock",
    title: "停摆的时钟",
    text: "车厢正中的挂钟停在某个时刻，秒针在同一个位置轻微颤动。",
    weight: 8,
    minLayer: 2,
    choices: [
      {
        label: "校准它",
        hint: "一半概率大幅回血，一半概率掉精神",
        risk: {
          chance: 0.5,
          ok: { hp: 24, sanity: 8 },
          bad: { sanity: -18 },
          okText: "指针重新走动，钟声让你清醒过来，生命回复 24 点。",
          badText: "指针倒着走了几格。你看着自己的手，忽然不确定过了多久。"
        }
      },
      {
        label: "上弦就走",
        hint: "小收益",
        gain: { ether: 15, hunger: 6 },
        text: "你随手上了几圈弦，顺手在钟座下面摸到一点碎币。"
      }
    ]
  },
  {
    id: "bloodCar",
    title: "采血车厢",
    text: "一节挂着红十字的旧车厢，椅子上还留着束带。墙上的告示写着「有偿」。",
    weight: 8,
    minLayer: 3,
    choices: [
      {
        label: "献 18 生命",
        hint: "换金币与强化",
        cost: { hp: 18 },
        gain: { gold: 2 },
        action: "enhance",
        text: "针头冰凉。作为回报，你拿到 2 枚金币和一次强化选择。"
      },
      {
        label: "只取血浆袋",
        hint: "拿道具，掉精神",
        items: { potion: 2 },
        gain: { sanity: -8 },
        text: "你从冷藏柜里拿了两袋血浆，出门时听见背后有轮子滚动的声音。"
      }
    ]
  },
  {
    id: "mirrorPlatform",
    title: "镜面站台",
    text: "站台地面像镜子一样，倒影里的你比你慢了半步，并且一直在看你。",
    weight: 8,
    minLayer: 3,
    choices: [
      {
        label: "和倒影交换",
        hint: "-20 生命换一次强化",
        cost: { hp: 20 },
        action: "enhance",
        text: "你和倒影错身而过，它留下了一点东西，你带走了一次强化。"
      },
      {
        label: "蹲下观察",
        hint: "回精神",
        gain: { sanity: 14, ether: 10 },
        text: "你盯着倒影看了很久，反而冷静下来。精神恢复 14 点。"
      }
    ]
  },
  {
    id: "lanternCrew",
    title: "提灯乘务组",
    text: "三名穿旧制服的乘务员提着灯巡过，灯罩里烧的不是油，是很细的光。",
    weight: 9,
    minLayer: 2,
    choices: [
      {
        label: "交涉（1 金币）",
        hint: "换治疗与饱食",
        cost: { gold: 1 },
        gain: { hp: 18, hunger: 20 },
        text: "为首的乘务员点点头，给你处理了伤口，还塞了一份口粮。"
      },
      {
        label: "抢一盏灯",
        hint: "高风险，高回报",
        risk: {
          chance: 0.4,
          ok: { action: "relic", ether: 20 },
          bad: { hp: -22, sanity: -8 },
          okText: "你夺过一盏灯，灯灭的瞬间掉出一件遗物。",
          badText: "灯没抢到，三盏灯同时转向了你。"
        }
      }
    ]
  },
  {
    id: "cargoHold",
    title: "货舱暗格",
    text: "货舱底板有一块新换过的木板，边缘的钉子还没锈。",
    weight: 10,
    minLayer: 2,
    choices: [
      {
        label: "撬开它",
        hint: "一堆道具，掉精神",
        items: { potion: 1, retryCard: 1 },
        gain: { sanity: -9 },
        text: "暗格里塞着药剂和一张重战卡。你不知道前一个人为什么把它们藏起来。"
      },
      {
        label: "上报列车",
        hint: "换金币",
        gain: { gold: 2, sanity: 4 },
        text: "你标记了位置。列车按规矩给了你 2 枚金币作为奖励。"
      }
    ]
  },
  {
    id: "whisperVent",
    title: "低语通风口",
    text: "通风口里传出很轻的说话声，句式规整，像在念一份名单。",
    weight: 9,
    minLayer: 3,
    choices: [
      {
        label: "凑近听",
        hint: "换以太，掉精神",
        gain: { ether: 40, sanity: -14 },
        text: "你听清了一串坐标，顺着它摸到一处藏起来的以太结晶。"
      },
      {
        label: "塞住它",
        hint: "小回复",
        gain: { sanity: 10, hunger: -6 },
        text: "你用破布把通风口堵上，世界安静了，你也终于能喘口气。"
      }
    ]
  },
  {
    id: "derailWreck",
    title: "脱轨残骸",
    text: "一节脱轨的车厢斜插在裂隙边缘，里面可能还有东西，也可能随时塌下去。",
    weight: 8,
    minLayer: 4,
    choices: [
      {
        label: "钻进去搜",
        hint: "遗物，但很可能重伤",
        risk: {
          chance: 0.55,
          ok: { action: "relic" },
          bad: { hp: -28 },
          okText: "你在残骸深处摸到一件完好的遗物，赶在塌陷前退了出来。",
          badText: "车厢在你身下陷了一截，你被压住，硬拖出来时已经血流不止。"
        }
      },
      {
        label: "绕开",
        hint: "只回一点精神",
        gain: { sanity: 6 },
        text: "你没有靠近，只是绕开了那片阴影。"
      }
    ]
  },
  {
    id: "oldVending",
    title: "旧售货机",
    text: "一台还亮着的售货机，投币口旁边手写着「不保证出货」。",
    weight: 12,
    choices: [
      {
        label: "投 1 金币",
        hint: "随机结果",
        cost: { gold: 1 },
        risk: {
          chance: 0.5,
          ok: { gold: 3 },
          bad: { items: { potion: 1 }, sanity: -4 },
          okText: "机器哗啦啦吐出一把金币，你赚了两枚。",
          badText: "卡了半瓶药剂出来，硬币是被吞掉了。"
        }
      },
      {
        label: "踹两脚就走",
        hint: "无风险，掉精神",
        gain: { sanity: -3, ether: 8 },
        text: "售货机晃了晃，掉出 8 以太的找零。你有点烦躁。"
      }
    ]
  },
  {
    id: "lastSupper",
    title: "最后一顿晚饭",
    text: "餐桌上摆着四套餐具，只有你的那份还热着。对面三张椅子都空着。",
    weight: 7,
    minLayer: 5,
    choices: [
      {
        label: "坐下吃完",
        hint: "大回血，掉饱食",
        gain: { hp: 30, hunger: -20, sanity: 10 },
        text: "你一个人吃完了四个人的份。胃里很沉，心里却轻了些。"
      },
      {
        label: "把餐具收好",
        hint: "回精神，掉饱食",
        gain: { sanity: 18, hunger: -8 },
        text: "你把三套餐具叠好放在一边，像在等谁回来。"
      }
    ]
  }
];


function getById(id) {
  var i;
  for (i = 0; i < EVENTS.length; i += 1) {
    if (EVENTS[i].id === id) return EVENTS[i];
  }
  return null;
}

/** 按层数与权重抽取（排除最近出现过的 id） */
function roll(pickRandom, layer, recentIds) {
  var recent = recentIds || [];
  var pool = [];
  EVENTS.forEach(function (event) {
    if (layer < (event.minLayer || 1)) return;
    if (recent.indexOf(event.id) >= 0) return;
    var weight = event.weight || 10;
    var i;
    for (i = 0; i < weight; i += 1) pool.push(event);
  });
  if (!pool.length) {
    EVENTS.forEach(function (event) {
      if (layer >= (event.minLayer || 1)) pool.push(event);
    });
  }
  return pickRandom(pool) || EVENTS[0];
}

module.exports = {
  EVENTS: EVENTS,
  getById: getById,
  roll: roll
};
