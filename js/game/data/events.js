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
  },

  /* ================= 第二批次：独立事件（11 个） =================
   *
   * 这一批侧重「小而具体」的物件：检票剪、行李箱、结冰的水箱……
   * 单次事件的收益不做大，重点是让 8 层路上不重复看到同样的三件事。
   */

  {
    id: "ticketPunch",
    title: "还亮着的检票剪",
    text: "一台老式检票剪悬在扶手上，刀口还带着新剪的痕迹。投币口旁边写着两个字：可用。",
    weight: 11,
    choices: [
      {
        label: "投 1 金币试试",
        hint: "稳定收益",
        cost: { gold: 1 },
        gain: { ether: 30 },
        text: "检票剪剪下一张半透明的票根，票根化作 30 以太碎片。"
      },
      {
        label: "把手伸进刀口",
        hint: "一半概率给强化，一半概率被夹",
        risk: {
          chance: 0.55,
          ok: { action: "enhance" },
          bad: { hp: -14 },
          okText: "刀口落下却剪开了某种束缚，你获得一次额外强化。",
          badText: "刀口夹住了你的手腕，你掉了 14 点生命。"
        }
      }
    ]
  },
  {
    id: "hangingCase",
    title: "挂在行李架上的箱子",
    text: "一只旧皮箱挂在行李架上，锁扣锈死了，箱角有被撬过的痕迹。",
    weight: 11,
    choices: [
      {
        label: "砸开它",
        hint: "可能掉血",
        risk: {
          chance: 0.7,
          ok: { ether: 28, items: { potion: 1 } },
          bad: { hp: -12 },
          okText: "锁扣崩开，里面塞着 28 以太碎片和一支药剂。",
          badText: "箱子弹起的铁片划伤了你的手，你掉了 12 点生命。"
        }
      },
      {
        label: "整个拎走",
        hint: "少一点，但稳",
        gain: { ether: 14 },
        text: "你没打开它，把它交给路过的商人换了 14 以太碎片。"
      }
    ]
  },
  {
    id: "frozenTank",
    title: "结冰的水箱",
    text: "水箱表面结着厚冰，冰层下有东西在缓慢移动，看不出是什么。",
    weight: 10,
    choices: [
      {
        label: "敲碎冰面取水",
        hint: "耗血换资源",
        cost: { hp: 8 },
        gain: { ether: 34 },
        text: "你砸开冰面，从水里捞出一把沉在底下的碎片，共 34 以太。"
      },
      {
        label: "只化一点冰喝",
        hint: "回饱食",
        gain: { hunger: 30 },
        text: "你把冰块捂化，喝了半升冰水，胃里终于有点东西。"
      }
    ]
  },
  {
    id: "cartOfCups",
    title: "无脸乘务员的推车",
    text: "一辆餐车停在过道中央，上面摆满杯子，每一杯都冒着热气。推车后面没有人。",
    weight: 10,
    choices: [
      {
        label: "喝一杯",
        hint: "多半回血，也可能有问题",
        risk: {
          chance: 0.6,
          ok: { hp: 28 },
          bad: { hp: -10 },
          okText: "热汤滑进胃里，你恢复了 28 点生命。",
          badText: "杯底沉着一层锈，你难受地咳了半天，掉了 10 点生命。"
        }
      },
      {
        label: "讨要点心",
        hint: "回饱食",
        gain: { hunger: 24, ether: 10 },
        text: "你拿起一碟压缩饼干，推车底部还散着 10 以太碎片。"
      }
    ]
  },
  {
    id: "stackOfTickets",
    title: "一叠旧车票",
    text: "座位上放着一叠车票，日期全是同一天，终点站写着不同的名字。",
    weight: 10,
    choices: [
      {
        label: "收起来",
        hint: "换金币",
        gain: { gold: 2 },
        text: "你把车票按站名整理好，卖给了收旧票的人，换到 2 金币。"
      },
      {
        label: "拿口粮换一张",
        hint: "交口粮，换以太",
        items: { portableFood: -1 },
        gain: { ether: 30 },
        text: "对方接过口粮，把一张印着「终点」的车票推给你，票根值 30 以太。"
      }
    ]
  },
  {
    id: "ringingPhone",
    title: "车厢尽头的电话",
    text: "墙上的老式电话在响，铃声很轻，像是怕吵醒谁。",
    weight: 9,
    minLayer: 2,
    choices: [
      {
        label: "接起来",
        hint: "精神大幅波动",
        risk: {
          chance: 0.5,
          ok: { sanity: 30 },
          bad: { sanity: -25 },
          okText: "那头是熟悉的声音，只说了句「别回头」，你反而踏实了。",
          badText: "那头只有你自己的呼吸声，一直在重复。"
        }
      },
      {
        label: "拔掉电话线",
        hint: "换以太",
        gain: { ether: 15 },
        text: "你拔掉线，从听筒里倒出几枚细小的以太结晶。"
      }
    ]
  },
  {
    id: "pendulum",
    title: "停在半空的钟摆",
    text: "车厢顶上的钟摆悬在半空，既没有下落，也没有回摆。",
    weight: 9,
    minLayer: 3,
    choices: [
      {
        label: "跟着它数秒",
        hint: "回精神",
        gain: { sanity: 20, ether: 8 },
        text: "你数到六十的时候它终于动了，你的呼吸也跟着稳下来。"
      },
      {
        label: "用手打断它",
        hint: "多半有收获",
        risk: {
          chance: 0.65,
          ok: { gold: 3 },
          bad: { hp: -10 },
          okText: "钟摆碎成一地零件，轴心是 3 枚金币。",
          badText: "钟摆反手抽在你的指骨上，掉了 10 点生命。"
        }
      }
    ]
  },
  {
    id: "seatedCorpse",
    title: "坐着的尸体",
    text: "一位乘客坐得笔直，双手放在膝上，像是在等下一站。他已经很久没有呼吸了。",
    weight: 9,
    minLayer: 3,
    choices: [
      {
        label: "搜他的口袋",
        hint: "多半有收获",
        risk: {
          chance: 0.7,
          ok: { ether: 30, gold: 2 },
          bad: { hp: -15 },
          okText: "口袋里是 30 以太碎片和 2 枚金币，他像是特意留给你的。",
          badText: "你刚碰到他，他的手指扣住了你的手腕，掉了 15 点生命。"
        }
      },
      {
        label: "鞠一躬走开",
        hint: "回精神",
        gain: { sanity: 12 },
        text: "你去下一节车厢前对他点了点头。这个动作让你安心。"
      }
    ]
  },
  {
    id: "leakingValve",
    title: "漏气的阀门",
    text: "一根管子嘶嘶漏着白气，阀门上缠着别人留下的布条。",
    weight: 10,
    choices: [
      {
        label: "把它拧紧",
        hint: "耗精神，换以太",
        cost: { sanity: 10 },
        gain: { ether: 20 },
        text: "你顶住蒸汽把阀门拧死，管事的人塞给你 20 以太碎片。"
      },
      {
        label: "顺手拿走布条",
        hint: "回精神",
        gain: { sanity: 8, hunger: 6 },
        text: "布条上还有余温，你把它垫在座位上，靠着喘了口气。"
      }
    ]
  },
  {
    id: "handprints",
    title: "车窗上的手印",
    text: "整面车窗都是手印，全是从外面按上来的，掌纹很深。",
    weight: 9,
    minLayer: 4,
    choices: [
      {
        label: "把它们擦掉",
        hint: "回精神",
        gain: { sanity: 18 },
        text: "你用手肘一节一节擦过去，擦到最后一扇窗时，外面已经什么都没有了。"
      },
      {
        label: "按上自己的手印",
        hint: "一半概率给强化",
        risk: {
          chance: 0.55,
          ok: { action: "enhance" },
          bad: { hp: -12 },
          okText: "你的掌印亮了一下，某种东西顺着玻璃流进了你的手臂。",
          badText: "玻璃外侧有东西按住了你的手，你掉了 12 点生命。"
        }
      }
    ]
  },
  {
    id: "crateOfVials",
    title: "一整箱药剂",
    text: "货架上放着一整个木箱，里面码着整齐的药剂，标签已经看不清了。",
    weight: 9,
    minLayer: 3,
    choices: [
      {
        label: "全拿走",
        hint: "花钱换两个",
        cost: { ether: 20 },
        items: { potion: 2 },
        text: "你付了 20 以太碎片当「保管费」，把两瓶药剂塞进包里。"
      },
      {
        label: "只拿一支",
        hint: "白拿一支",
        items: { potion: 1 },
        text: "你只拿了一支，剩下的留给下一个路过的人。"
      }
    ]
  },

  /* ================= 三条事件链（每链 3 段） =================
   *
   * 链事件不进随机池（roll 里过滤掉 chain 字段），只由 nextChainEvent 按顺序发。
   * 目的：给单局一点「我还记得上一节车厢」的连续性，但失败/跳过不惩罚。
   */

  /* ---- 链 A：检票员的手册 ---- */
  {
    id: "chainTicket1",
    title: "座位下的半本手册",
    text: "座位缝里卡着半本手册，封面印着「乘务作业规范」，缺了后半册。",
    weight: 0,
    chain: "ticketBook",
    stage: 1,
    minLayer: 2,
    choices: [
      {
        label: "收进包里",
        hint: "换以太",
        gain: { ether: 18 },
        text: "你把手册塞进包里，纸页间掉出 18 枚以太碎片。"
      },
      {
        label: "撕下空白页",
        hint: "回饱食与精神",
        gain: { hunger: 15, sanity: 8 },
        text: "你用空白页卷了点干粮，慢慢嚼着，心情松了些。"
      }
    ]
  },
  {
    id: "chainTicket2",
    title: "拿着手册的查票员",
    text: "一个查票员站在过道中间，手里拿着另外半本手册，正对着你翻。",
    weight: 0,
    chain: "ticketBook",
    stage: 2,
    minLayer: 4,
    choices: [
      {
        label: "把半本递给他",
        hint: "多半换到强化",
        risk: {
          chance: 0.55,
          ok: { action: "enhance" },
          bad: { hp: -20 },
          okText: "两半合在一起，他点点头，教了你一手东西。",
          badText: "他看完后把手册塞回你的胸口，力气大得不像人。"
        }
      },
      {
        label: "说自己在赶时间",
        hint: "花钱过关",
        cost: { gold: 1 },
        gain: { ether: 20 },
        text: "你塞给他 1 枚金币，他侧身让路，还找回 20 以太碎片。"
      }
    ]
  },
  {
    id: "chainTicket3",
    title: "终点车厢的补票窗口",
    text: "车厢尽头开着一个补票窗口，里面的人只要你手上那半本手册。",
    weight: 0,
    chain: "ticketBook",
    stage: 3,
    minLayer: 6,
    choices: [
      {
        label: "用手册补一张全票",
        hint: "换秒杀卡",
        cost: { ether: 30 },
        items: { executeCard: 1 },
        text: "窗口里的人撕下票根递给你——一张能在关键时刻终结一切的票。"
      },
      {
        label: "把手册还回去",
        hint: "大回精神与以太",
        gain: { sanity: 25, ether: 40 },
        text: "你把手册推回去，说了句「路上小心」。他第一次抬起头看你。"
      }
    ]
  },

  /* ---- 链 B：孩子的画 ---- */
  {
    id: "chainDrawing1",
    title: "一张蜡笔画",
    text: "座位上摊着一张蜡笔画：一列车，车窗里有很多小人，颜色涂得很用力。",
    weight: 0,
    chain: "childDrawing",
    stage: 1,
    minLayer: 2,
    choices: [
      {
        label: "收好它",
        hint: "回精神",
        gain: { sanity: 12 },
        text: "你把画折好放进内袋，像是替谁保管一样。"
      },
      {
        label: "折成纸飞机",
        hint: "换以太",
        gain: { ether: 16 },
        text: "纸飞机飞出两节车厢就落了，落地时压着 16 枚以太碎片。"
      }
    ]
  },
  {
    id: "chainDrawing2",
    title: "画里的那节车厢",
    text: "前面那节车厢和画上一模一样，连车窗里小人的位置都对得上。",
    weight: 0,
    chain: "childDrawing",
    stage: 2,
    minLayer: 4,
    choices: [
      {
        label: "走进去",
        hint: "多半给遗物",
        risk: {
          chance: 0.6,
          ok: { action: "relic" },
          bad: { hp: -18 },
          okText: "车厢里空着，座位中央放着一件东西，像是给你留的。",
          badText: "你刚踏进去，所有小人的头同时转了过来。"
        }
      },
      {
        label: "站在门口看",
        hint: "稳一点的收益",
        gain: { ether: 22 },
        text: "你没有进去。车门关上时，缝隙里掉出 22 枚以太碎片。"
      }
    ]
  },
  {
    id: "chainDrawing3",
    title: "在等你的孩子",
    text: "一个孩子坐在长椅上，脚够不到地，正低头玩着手里的蜡笔。",
    weight: 0,
    chain: "childDrawing",
    stage: 3,
    minLayer: 6,
    choices: [
      {
        label: "把画还给他",
        hint: "大回血与精神",
        gain: { hp: 15, sanity: 30 },
        text: "他接过画，认真地说了声谢谢。你觉得身上轻了很多。"
      },
      {
        label: "转身离开",
        hint: "拿以太，掉精神",
        cost: { sanity: 15 },
        gain: { ether: 45 },
        text: "你没敢回头。包里的以太碎片变沉了，脚步也变沉了。"
      }
    ]
  },

  /* ---- 链 C：锅炉的低语 ---- */
  {
    id: "chainBoiler1",
    title: "地板下的敲击声",
    text: "脚下的铁板在响，三下，停一下，再三下。像有人在里面敲门。",
    weight: 0,
    chain: "boilerWhisper",
    stage: 1,
    minLayer: 2,
    choices: [
      {
        label: "也敲三下",
        hint: "多半有收获",
        risk: {
          chance: 0.65,
          ok: { ether: 28 },
          bad: { sanity: -20 },
          okText: "对面回了一串节奏，铁板缝隙里滑出 28 枚以太碎片。",
          badText: "敲击停下后，你听见自己的名字被念了一遍。"
        }
      },
      {
        label: "捂住耳朵走开",
        hint: "回精神",
        gain: { sanity: 10 },
        text: "你走远了两节车厢，声音还在，但已经小到可以忽略。"
      }
    ]
  },
  {
    id: "chainBoiler2",
    title: "锅炉检修口",
    text: "检修口的螺丝被从里面拧松了，盖子虚掩着，往外冒热气。",
    weight: 0,
    chain: "boilerWhisper",
    stage: 2,
    minLayer: 4,
    choices: [
      {
        label: "钻进去",
        hint: "耗血换资源",
        cost: { hp: 10 },
        gain: { ether: 34, gold: 2 },
        text: "热浪灼着你的背，你在炉膛边上摸到 34 以太碎片和 2 枚金币。"
      },
      {
        label: "把盖子关严",
        hint: "回精神",
        gain: { sanity: 12 },
        text: "你拧紧螺丝，声音停了。至少这一节车厢是安静的。"
      }
    ]
  },
  {
    id: "chainBoiler3",
    title: "空着的司炉位",
    text: "锅炉前的凳子空着，铲子还插在煤堆里，炉火却旺得不正常。",
    weight: 0,
    chain: "boilerWhisper",
    stage: 3,
    minLayer: 6,
    choices: [
      {
        label: "坐进那个位置",
        hint: "多半给强化，也可能烫伤",
        risk: {
          chance: 0.55,
          ok: { action: "enhance" },
          bad: { hp: -25 },
          okText: "炉火顺着你的手臂流了一圈，你突然明白了很多事。",
          badText: "火舌从炉口窜出来，你的袖子烧掉了一半。"
        }
      },
      {
        label: "把火压小一点",
        hint: "稳定收益",
        gain: { ether: 40, hunger: 20 },
        text: "你铲了两铲湿煤压住火头，炉边的水壶正好烧开。"
      }
    ]
  }
];

/** 事件链登记：id → 按顺序排列的段数 */
var CHAINS = {
  ticketBook: { name: "检票员的手册", stages: ["chainTicket1", "chainTicket2", "chainTicket3"] },
  childDrawing: { name: "孩子的画", stages: ["chainDrawing1", "chainDrawing2", "chainDrawing3"] },
  boilerWhisper: { name: "锅炉的低语", stages: ["chainBoiler1", "chainBoiler2", "chainBoiler3"] }
};


function getById(id) {
  var i;
  for (i = 0; i < EVENTS.length; i += 1) {
    if (EVENTS[i].id === id) return EVENTS[i];
  }
  return null;
}

/** 按层数与权重抽取（排除最近出现过的 id；链事件不进随机池） */
function roll(pickRandom, layer, recentIds) {
  var recent = recentIds || [];
  var pool = [];
  EVENTS.forEach(function (event) {
    if (event.chain) return;              // 链事件只能由 nextChainEvent 发
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

/**
 * 事件链推进：返回下一个该出现的链事件，没有则返回 null。
 *
 * - progress: { chainId: 已完成到第几段 }
 * - layer:    当前层，用来卡「第 2 段不该在第 1 层就出现」
 * - random:   注入的 0—1 随机函数（测试里可以传固定值）
 *
 * 故意留 CHAIN_CHANCE 这个概率：事件点不多（一局 2—4 个），
 * 如果一到层数就必发链事件，玩家会觉得「每局都一样」，随机事件的意义就没了。
 */
var CHAIN_CHANCE = 0.6;
var CHAIN_ORDER = ["ticketBook", "childDrawing", "boilerWhisper"];

function nextChainEvent(progress, layer, random) {
  var reached = progress || {};
  var rand = typeof random === "function" ? random : Math.random;
  var candidates = [];
  var i;
  for (i = 0; i < CHAIN_ORDER.length; i += 1) {
    var id = CHAIN_ORDER[i];
    var chain = CHAINS[id];
    if (!chain) continue;
    var done = reached[id] || 0;
    if (done >= chain.stages.length) continue;
    var event = getById(chain.stages[done]);
    if (!event) continue;
    if (layer < (event.minLayer || 1)) continue;
    candidates.push({ chain: id, chainName: chain.name, stage: done + 1, total: chain.stages.length, event: event });
  }
  if (!candidates.length) return null;
  if (rand() > CHAIN_CHANCE) return null;
  var index = Math.floor(rand() * candidates.length) % candidates.length;
  return candidates[index];
}

module.exports = {
  EVENTS: EVENTS,
  CHAINS: CHAINS,
  getById: getById,
  roll: roll,
  nextChainEvent: nextChainEvent
};
