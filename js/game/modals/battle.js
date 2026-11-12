/**
 * modals/battle.js —— 回合战斗
 *
 * 四种行动：精准（稳）/ 强力（高伤低命中）/ 防御（护盾+下一击加成）/ 道具
 * 死亡时：重战卡 → 激励视频复活 → 结束本局
 *
 * 布局从上到下：类型标签 → 敌人名 → 敌人血条 → 双方面板 → 战斗日志（自适应撑满）→ 行动按钮（贴底）
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");
var config = require("../config");
var materialsApi = require("../data/materials");

var P = draw.PALETTE;

/**
 * 恒等缓动。
 * animator.progress 默认套 easeOutCubic，出手动作是按「真实时间比例」分段的
 * （强力射击前 35% 后仰、后 65% 前扑），用默认缓动会把后仰压成几十毫秒，
 * 画面上直接消失。这里显式要线性，包络自己用 sin 做。
 */
function linearEase(t) { return t; }

/**
 * 把 #RRGGBB 转成带透明度的 rgba 串。
 *
 * 不能靠 ctx.globalAlpha 做半透明：draw.figure 内部走 figFill，那里会把
 * globalAlpha 覆盖成 0.94，外层设的透明度会被无声地吃掉。所以透明度必须
 * 落在颜色字符串里。颜色不合法时退回中性灰，画面上最多是「影子颜色不对」，
 * 不会整帧抛错。
 */
function fadeColor(hex, alpha) {
  var h = typeof hex === "string" && hex.charAt(0) === "#" ? hex.slice(1) : "";
  if (h.length !== 6) return "rgba(160,170,178," + alpha + ")";
  var r = parseInt(h.slice(0, 2), 16);
  var g = parseInt(h.slice(2, 4), 16);
  var b = parseInt(h.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "rgba(160,170,178," + alpha + ")";
  return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
}

/**
 * 最近一次渲染的坐标缓存。
 * onAction 拿不到 screen，特效需要知道「敌人在哪」才能把飘字打对位置，
 * 所以由 render 每帧写入，onAction 读取。屏幕尺寸变化时 render 会立刻刷新。
 */
var layout = { ex: 0, ey: 0, hx: 0, hy: 0, scale: 1 };

function actionLabel(kind) {
  if (kind === "elite") return "精英战斗";
  if (kind === "boss") return "BOSS 战";
  return "遭遇战";
}

function render(ctx, screen, state, animator, clock) {
  var s = screen.s;
  var run = state.run;
  var battle = run && run.battle;
  var r = common.modalPanel(screen, screen.px(560));

  if (!battle) {
    draw.panel(ctx, r, {});
    draw.text(ctx, "战斗已结束", screen.width / 2, r.y + r.h / 2, {
      size: screen.fz(14),
      align: "center",
      color: P.inkDim
    });
    return;
  }

  draw.panel(ctx, r, {
    radius: Math.round(16 * s),
    fillTop: "#1A2E3A",
    fillBottom: "#0C1922",
    strokeColor: battle.boss ? "rgba(216,87,74,0.55)" : "rgba(42,74,92,0.9)"
  });

  var pad = screen.px(14);
  var left = r.x + pad;
  var right = r.x + r.w - pad;
  var innerW = r.w - pad * 2;
  var cursor = r.y + pad;

  /**
   * Boss 登场卡：整块面板先换成一张「这是谁」，画完直接返回。
   *
   * 不做成叠在战斗界面上的浮层：叠层会让玩家以为可以边看卡边点按钮，
   * 而此刻那四个行动按钮都还没有意义——牌还没发，先问怎么出是荒谬的。
   */
  if (battle.introOpen && !battle.over && state.player.hp > 0) {
    renderBossIntro(ctx, screen, r, battle, clock);
    return;
  }

  // 类型 + 材质 + 回合
  // 材质放在这一行而不是另起一行：它是「说明这刀打上去是什么手感」的注脚，
  // 不该占用垂直空间（战斗面板的每一像素都要留给日志）
  draw.text(ctx, actionLabel(battle.kind) + " · " + materialsApi.nameOf(battle.material), left, cursor, {
    size: screen.fz(10),
    bold: true,
    color: battle.boss ? "#FF8B7A" : battle.elite ? "#E88A7D" : P.inkFaint
  });
  draw.text(ctx, "第 " + battle.turn + " 回合", right, cursor, {
    size: screen.fz(11),
    align: "right",
    color: P.inkFaint
  });
  cursor += screen.px(15);

  // 敌人名 + 词缀徽标（精英必须在打之前就能看出「他有什么毛病」）
  // 第二形态的形态名徽标也在这里先算宽度：名字是先画的，徽标是后画的，
  // 不把这几十像素让出来，窄屏上长名字会钻到徽标底下被盖掉。
  var phaseLabelTxt = battle.boss && battle.phase >= 2 ? (battle.phaseLabel || "第二阶段") : null;
  var phaseChipW = phaseLabelTxt
    ? draw.measure(ctx, phaseLabelTxt, screen.fz(9), true) + screen.px(12) : 0;
  var nameMaxW = innerW;
  var affixChipW = 0;
  if (phaseChipW) nameMaxW -= phaseChipW + screen.px(8);
  if (battle.affixName) {
    var badge = "词缀 · " + battle.affixName;
    var bw = draw.measure(ctx, badge, screen.fz(9), true) + screen.px(14);
    affixChipW = bw;
    nameMaxW -= bw + screen.px(8);
    var chip = { x: right - bw, y: cursor + screen.px(5), w: bw, h: screen.px(17) };
    draw.fillRR(ctx, chip, "rgba(224,177,92,0.18)", screen.px(9));
    draw.text(ctx, badge, chip.x + bw / 2, chip.y + screen.px(3), {
      size: screen.fz(9),
      align: "center",
      bold: true,
      color: P.gold
    });
  }
  draw.text(ctx, battle.name, left, cursor, {
    size: screen.fz(20),
    bold: true,
    color: P.ink,
    maxWidth: nameMaxW
  });
  /**
   * Boss 第二形态的标记。
   * 用徽标而不是「名字（第二阶段）」：名字改动会让玩家怀疑换了个敌人，
   * 而事实是同一个东西裂开了。徽标只加后缀信息，不重命名。
   *
   * 徽标文案跟着形态走：「双影」「查票」「过载」比统一写「第二阶段」有用得多——
   * 五个 Boss 的第二形态各不相同，统一文案等于告诉玩家「又是一样的」。
   * 老存档没有 phaseLabel 时退回通用文案，不会出现空徽标。
   */
  if (phaseLabelTxt) {
    var pw = phaseChipW;
    // 词缀徽标也在这一行：两个都贴右边会叠成一团，形态名要往左让出词缀的位置
    var pchip = {
      x: right - pw - affixChipW - (affixChipW ? screen.px(6) : 0),
      y: cursor + screen.px(9), w: pw, h: screen.px(16)
    };
    draw.fillRR(ctx, pchip, "rgba(255,90,68,0.20)", screen.px(8));
    draw.text(ctx, phaseLabelTxt, pchip.x + pw / 2, pchip.y + screen.px(3), {
      size: screen.fz(9),
      align: "center",
      bold: true,
      color: "#FF7A66"
    });
  }
  cursor += screen.px(30);

  // 敌人血条
  var hpRect = { x: left, y: cursor, w: innerW, h: screen.px(9) };
  draw.bar(ctx, hpRect, battle.hp / battle.maxHp, {
    // 二形态换色：同一个血条，玩家扫一眼就知道「这不是刚才那个东西了」
    color: battle.boss ? (battle.phase >= 2 ? "#FF5A44" : P.red) : "#C8664F",
    track: "rgba(255,255,255,0.10)"
  });
  cursor += hpRect.h + screen.px(4);
  draw.text(ctx, Math.max(0, Math.round(battle.hp)) + " / " + battle.maxHp, left, cursor, {
    size: screen.fz(10),
    color: P.inkDim
  });
  if (battle.enemyShield > 0) {
    draw.text(ctx, "护盾 " + battle.enemyShield, right, cursor, {
      size: screen.fz(10),
      align: "right",
      color: P.teal
    });
  }
  cursor += screen.px(18);

  // 舞台：敌人（右）+ 玩家（左）
  var stageCenter = cursor + screen.px(56);
  var enemyX = r.x + r.w * 0.68;
  var heroX = left + screen.px(20);

  /**
   * 待机与打击动画。三个 key 各管一件事：
   *   enemyHit  —— 敌人挨打的挤压 + 后坐（同一个 key 驱动位移与形变，才同步）
   *   enemyLunge —— 敌人扑咬时向玩家方向冲出去
   *   heroHurt  —— 玩家挨打时向左一顿
   */
  /**
   * 下回合预告。这是「敌人在憋什么」的唯一来源——界面不许自己再猜一遍，
   * 否则状态与画面迟早对不上。
   */
  var tele = battle.telegraph || null;

  var recoil = animator.progress("enemyHit");
  var kick = recoil < 1 ? (1 - recoil) * screen.px(9) : 0;
  var enemySize = battle.boss ? screen.px(104) : screen.px(80);

  /**
   * 待机呼吸：相位完全由 clock 推出，界面不存任何动画状态。
   * 敌人与玩家相位错开约 0.6 拍——同频起伏会让两个剪影看起来像连在一起。
   * 幅度只有 2px 左右：这是「活的」暗示，不是蹦迪，超过 4px 就会显得滑稽。
   *
   * 血量会改呼吸：残血时呼吸变快变深（喘），濒死再叠一层高频颤抖。
   * 「快死了」因此写在身体上，而不是只写在血条长度上——血条只能告诉你还剩多少，
   * 剪影才能告诉你「它快撑不住了」。
   */
  var breatheT = (typeof clock === "number" ? clock : 0) / 1000;
  var enemyHpRatio = Math.max(0, Math.min(1, battle.hp / (battle.maxHp || 1)));
  var heroHpRatio = Math.max(0, Math.min(1, state.player.hp / (state.player.maxHp || 1)));
  var enemyPanting = enemyHpRatio < 0.32 ? 1 : 0;
  var enemyDying = enemyHpRatio < 0.12 ? 1 : 0;
  var heroPanting = heroHpRatio < 0.32 ? 1 : 0;

  // 喘息 = 周期缩短 + 幅度加大；两者都只改节奏，不改任何玩法数值
  // 第二形态再压一档：没到残血的 Boss 也已经在急促换气，这是「它认真了」的信号
  var phaseRate = battle.phase >= 2 ? 1.25 : 1;
  var enemyBreath = Math.sin(breatheT * Math.PI * 2 / (2.6 / (1 + 0.7 * enemyPanting) / phaseRate));
  var heroBreath = Math.sin(breatheT * Math.PI * 2 / (2.6 / (1 + 0.7 * heroPanting)) + Math.PI * 0.6);
  var enemyAmp = 2.2 * (1 + 0.55 * enemyPanting);
  var heroAmp = 1.6 * (1 + 0.55 * heroPanting);
  // 濒死颤抖只能由 clock 推出：用 Math.random 会让同一毫秒的两次渲染长得不一样，
  // 脏渲染会一直以为「有变化」，等于把节流关掉
  var tremble = enemyDying ? Math.sin(breatheT * Math.PI * 2 / 0.18) : 0;

  // 受击挤压帧：p 从 0 走到 1，挤压量取 (1-p)；没在跑时 p === 1，挤压为 0
  var hitP = animator.progress("enemyHit");
  var squash = hitP < 1 ? 1 - hitP : 0;
  // 敌人扑咬：朝玩家方向冲一下再收回（正弦包络，冲出去和收回来一样快）
  var lungeP = animator.progress("enemyLunge");
  var lunge = lungeP < 1 ? Math.sin(lungeP * Math.PI) : 0;
  var hurtP = animator.progress("heroHurt");
  var hurt = hurtP < 1 ? 1 - hurtP : 0;

  /**
   * 蓄势姿态：缩成一团、略微后仰。用 clock 做 0.9 秒一次的紧促脉动，
   * 频率比呼吸快——「憋着劲」和「在呼吸」是两种节奏，玩家不看文字也分得出来。
   * 幅度压得很小：这里要传达的是紧张感，不是把敌人画成一个弹簧。
   */
  var charging = tele && tele.kind === "charge" ? 1 : 0;
  var chargePulse = charging
    ? 0.5 + 0.5 * Math.sin(breatheT * Math.PI * 2 / 0.9)
    : 0;
  var gathering = tele && tele.kind === "swarm" ? 1 : 0;
  /**
   * 裂开的一瞬：横向撑开、纵向压扁，再收回去。
   * 只有 420ms，但它是「外壳崩开」在剪影上的唯一证据——
   * 光靠闪白和飘字，剪影不动的话这一下仍然像是界面在闪，而不是它在裂。
   */
  var breakP = animator.progress("bossPhase", linearEase);
  var breaking = breakP < 1 ? Math.sin(breakP * Math.PI) : 0;

  /**
   * 玩家出手动作。此前点按钮只有飘字在动，剪影始终像雕塑——
   * 「我正在做什么」必须由身体说出来，否则四个行动在视觉上完全一样。
   *
   * 幅度都压得很小（最大 9px）：这是回合结算后的一瞬间，不是动作游戏。
   * 四个 key 分别对应四种行动，闭着眼听音色、睁着眼看姿态，指向同一件事。
   */
  var shootP = animator.progress("heroShoot", linearEase);
  var powerP = animator.progress("heroPower", linearEase);
  var guardP = animator.progress("heroGuard", linearEase);
  var drinkP = animator.progress("heroDrink", linearEase);
  var lean = 0;
  var tilt = 0;
  var actSx = 0;
  var actSy = 0;
  var actBob = 0;

  if (shootP < 1) {
    // 精准：小幅前倾，收肩。稳，所以动作也稳
    var se = Math.sin(shootP * Math.PI);
    lean += screen.px(4) * se;
    // 倾角才是「在用劲」的主信号，位移只是让重心跟着挪一点
    tilt += 0.09 * se;
    actSx -= 0.05 * se;
    actSy += 0.04 * se;
  }
  if (powerP < 1) {
    // 强力：前 35% 后仰拉满，后 65% 整个人扑出去。
    // 拉得越狠打得越重——动作本身就在解释「低命中换高伤害」
    var pe = powerP < 0.35
      ? -Math.sin(powerP / 0.35 * Math.PI / 2) * 0.9
      : Math.sin((powerP - 0.35) / 0.65 * Math.PI);
    lean += screen.px(9) * pe;
    tilt += 0.16 * pe;
    actSx -= 0.09 * Math.abs(pe);
    actSy += 0.06 * Math.abs(pe);
  }
  if (guardP < 1) {
    // 防御：蹲下去，横向撑开。缩得比站着矮，才像「架住了」
    var ge = Math.sin(guardP * Math.PI);
    actSy -= 0.18 * ge;
    actSx += 0.13 * ge;
    tilt -= 0.03 * ge;
  }
  if (drinkP < 1) {
    var de = Math.sin(drinkP * Math.PI);
    actBob -= screen.px(4) * de;
    actSy += 0.04 * de;
    tilt -= 0.05 * de;
  }
  // 挨打时出手姿态让位：正被顶退的那一帧，「我举着弓」比「我被打中」次要
  var actW = 1 - hurt;

  /**
   * 双影：第二形态真的有两个影子，剪影就必须是两个。
   *
   * 只画一个半透明副本会被读成「重影 / 渲染叠了一层」，所以三个信号必须同时给：
   * 落后半个身位、呼吸相位错开、颜色更暗。玩家看到的是「那边还站着一个」，
   * 而不是「画面糊了」——这一段没有任何数值含义，只是让两段攻击有视觉依据。
   */
  if (battle.phaseHits > 1) {
    var twinBreath = Math.sin(breatheT * Math.PI * 2 / (2.6 / phaseRate) + Math.PI * 0.85);
    // 偏移量取敌人身宽的六成：再小两具剪影就糊成一团，玩家读到的是「渲染重影」
    // 而不是「那边还站着一个」；再大就会压到玩家的血条上。
    // 抬高 6px 是透视：站得远的那个，脚底在画面上更高一点。
    draw.figure(ctx, enemyX - enemySize * 0.6 + tremble * screen.px(0.7),
      stageCenter - screen.px(6), enemySize * 0.8,
      battle.figure, fadeColor(battle.color, 0.38), battle.trait, {
        bob: -screen.px(enemyAmp) * twinBreath + tremble * screen.px(0.5),
        rot: -0.05 * charging + 0.05 * enemyDying,
        sx: 1 + 0.03 * gathering - 0.03 * enemyDying,
        sy: 1 - 0.02 * gathering - 0.05 * enemyDying
      });
  }

  draw.figure(ctx, enemyX + kick - lunge * screen.px(26) + charging * screen.px(4) + tremble * screen.px(1.2) - enemyDying * screen.px(2),
    stageCenter, enemySize,
    battle.figure, battle.color, battle.trait, {
      bob: -screen.px(enemyAmp) * enemyBreath + tremble * screen.px(0.6)
        - charging * screen.px(1.2) * chargePulse,
      rot: 0.04 * charging + 0.05 * enemyDying,
      sx: 1 + 0.14 * squash + 0.06 * lunge - 0.07 * charging + 0.02 * chargePulse * charging
        + 0.03 * gathering - 0.03 * enemyDying + 0.18 * breaking,
      sy: 1 - 0.12 * squash - 0.04 * lunge + 0.06 * charging - 0.02 * chargePulse * charging
        - 0.02 * gathering - 0.06 * enemyDying - 0.11 * breaking
    });
  draw.figure(ctx, heroX - hurt * screen.px(5) + lean * actW, stageCenter, screen.px(48),
    "hero", P.teal, "hero", {
      bob: -screen.px(heroAmp) * heroBreath + actBob * actW,
      rot: tilt * actW,
      sx: 1 + 0.10 * hurt + actSx * actW,
      sy: 1 - 0.09 * hurt + actSy * actW
    });

  if (tele) {
    drawTelegraph(ctx, screen, enemyX, stageCenter, enemySize, tele, breatheT);
  }

  layout.ex = enemyX;
  layout.ey = stageCenter - enemySize * 0.1;
  layout.hx = heroX;
  layout.hy = stageCenter - screen.px(30);
  layout.scale = s;

  // 玩家血量（右侧对齐在玩家剪影旁）
  var phpRect = { x: left + screen.px(46), y: stageCenter + screen.px(16), w: innerW * 0.5, h: screen.px(8) };
  draw.bar(ctx, phpRect, state.player.hp / state.player.maxHp, {
    color: "#5FB87A",
    track: "rgba(255,255,255,0.10)"
  });
  draw.text(ctx, "你 " + Math.round(state.player.hp) + " / " + state.player.maxHp, phpRect.x, phpRect.y + phpRect.h + screen.px(3), {
    size: screen.fz(10),
    color: P.inkDim
  });
  if (battle.playerShield > 0) {
    draw.text(ctx, "护盾 " + battle.playerShield, phpRect.x + phpRect.w, phpRect.y + phpRect.h + screen.px(3), {
      size: screen.fz(10),
      align: "right",
      color: P.teal
    });
  }

  // 行动区贴底
  var actionsTop = r.y + r.h - screen.px(174);

  // 战斗日志：撑满中间剩余空间
  var logTop = stageCenter + screen.px(48);
  var logH = Math.max(screen.px(56), actionsTop - logTop - screen.px(12));
  var logRect = { x: left, y: logTop, w: innerW, h: logH };
  ctx.save();
  ctx.globalAlpha = 0.85;
  draw.fillRR(ctx, logRect, "rgba(0,0,0,0.24)", Math.round(8 * s));
  ctx.restore();

  var lineH = screen.px(15);
  var maxLines = Math.max(1, Math.floor((logH - screen.px(10)) / lineH));
  var logs = battle.logs.slice(0, maxLines);
  var i;
  for (i = 0; i < logs.length; i += 1) {
    draw.text(ctx, logs[i], logRect.x + screen.px(8), logRect.y + screen.px(6) + i * lineH, {
      size: screen.fz(10),
      color: i === 0 ? P.ink : P.inkSoft || P.inkDim,
      maxWidth: logRect.w - screen.px(16),
      alpha: 1 - i * 0.16
    });
  }

  if (battle.over || state.player.hp <= 0) {
    renderDeath(ctx, screen, state, r, actionsTop);
    return;
  }

  // 三个横向行、每行 2—3 个按钮
  var rowH = (screen.px(174) - screen.px(16)) / 3;
  var rows = [
    { x: left, y: actionsTop, w: innerW, h: rowH },
    { x: left, y: actionsTop + rowH + screen.px(8), w: innerW, h: rowH },
    { x: left, y: actionsTop + (rowH + screen.px(8)) * 2, w: innerW, h: rowH }
  ];
  var row1 = screen.row(rows[0], 2, screen.px(8));
  var row2 = screen.row(rows[1], 2, screen.px(8));
  var row3 = screen.row(rows[2], 3, screen.px(8));

  ui.button(ctx, {
    id: "battle:precise",
    rect: row1[0],
    label: "精准射击",
    sub: "稳定命中",
    style: "primary",
    size: screen.fz(15)
  });
  ui.button(ctx, {
    id: "battle:power",
    rect: row1[1],
    label: "强力射击",
    sub: "68% 命中 · 高伤",
    style: "teal",
    size: screen.fz(15)
  });
  /**
   * 防御按钮的「建议」高亮。
   * 预警如果不能落到一个具体动作上，就只是噪音；所以预告重击/连击时，
   * 把唯一能减伤的那个按钮圈出来。描边呼吸而不是换配色：换底色会让按钮
   * 像是变成了另一个按钮，描边只表示「现在选它更划算」。
   */
  var adviseDefend = tele && (tele.kind === "charge" || tele.kind === "swarm");
  if (adviseDefend) {
    var ap = 0.5 + 0.5 * Math.sin(breatheT * Math.PI * 2 / 1.1);
    ctx.save();
    ctx.globalAlpha = 0.30 + 0.50 * ap;
    ctx.strokeStyle = "#F2CD84";
    ctx.lineWidth = Math.max(1, screen.px(1.6));
    draw.rr(ctx, row2[0].x - screen.px(2), row2[0].y - screen.px(2),
      row2[0].w + screen.px(4), row2[0].h + screen.px(4), screen.px(13));
    ctx.stroke();
    ctx.restore();
  }

  ui.button(ctx, {
    id: "battle:defend",
    rect: row2[0],
    label: "防御架势",
    sub: adviseDefend ? "挡下这记预告" : "+12 护盾 · 下击 +5",
    style: "ghost",
    size: screen.fz(15)
  });
  ui.button(ctx, {
    id: "battle:potion",
    rect: row2[1],
    label: "回血药剂 ×" + (state.player.inventory.potion || 0),
    sub: "恢复 30+ 生命",
    style: "ghost",
    disabled: (state.player.inventory.potion || 0) <= 0,
    size: screen.fz(14)
  });
  ui.button(ctx, {
    id: "battle:execute",
    rect: row3[0],
    label: "秒杀卡 ×" + (state.player.inventory.executeCard || 0),
    style: "ghost",
    disabled: (state.player.inventory.executeCard || 0) <= 0,
    size: screen.fz(12)
  });
  ui.button(ctx, {
    id: "battle:escape",
    rect: row3[1],
    label: "撤离 " + (run.effects.escapeFree ? "免费" : "12 以太"),
    style: "ghost",
    size: screen.fz(12)
  });
  ui.button(ctx, {
    id: "battle:info",
    rect: row3[2],
    label: "敌人特性",
    style: "ghost",
    size: screen.fz(12)
  });
}

/**
 * Boss 登场卡。
 *
 * 三件事按顺序发生：先看到「有多大」（剪影），再看到「是谁」（名字），
 * 最后读到「它怎么打」和一句没头没尾的预感。顺序不能反——
 * 先把规则摆在最上面，玩家会把它当说明书扫一眼就点掉。
 *
 * 预感那一行是这张卡真正的价值：它不解释任何机制，只在开战前留下一句话。
 * 半血崩开时，这句话会突然对上号——「原来它刚才说的影子是这个」。
 * 剧透会把惊喜变成说明书，完全不提又会让第二形态显得凭空出现。
 */
function renderBossIntro(ctx, screen, r, battle, clock) {
  var breatheT = (typeof clock === "number" ? clock : 0) / 1000;
  var pad = screen.px(18);
  var left = r.x + pad;
  var innerW = r.w - pad * 2;
  var cx = r.x + r.w / 2;
  // 按钮位置先算出来：下面的「预感」块要贴着它排，先把底边钉住，
  // 剩下多少空间，中间的排版才知道自己有多少余量
  var btnH = screen.px(44);
  var btnTop = r.y + r.h - pad - btnH;

  draw.text(ctx, "关底首领 · " + materialsApi.nameOf(battle.material), left, r.y + pad, {
    size: screen.fz(10),
    bold: true,
    color: "#FF8B7A"
  });

  // 剪影 + 背光。背光用几圈低透明度实心圆叠出来，不用渐变：
  // 低端机上 canvas 渐变每帧重建一次就有可见的卡顿，而这里每一帧都在动。
  //
  // 位置按 figure 的真实比例算：传给它的 cy 是「躯干中心」，不是脚底——
  // 双角顶到 cy - 0.66×size，躯干底在 cy + 0.52×size。不按这个算，
  // 名字就会写进它的胸口里（第一版截图里就是这样）。
  var figSize = screen.px(164);
  var bodyTop = r.y + pad + screen.px(24);
  var figY = bodyTop + figSize * 0.66;
  var bodyBottom = figY + figSize * 0.52;
  var i;
  for (i = 3; i >= 1; i -= 1) {
    ctx.save();
    ctx.globalAlpha = 0.05 * i;
    ctx.fillStyle = "#D8574A";
    ctx.beginPath();
    ctx.arc(cx, figY - figSize * 0.08, figSize * (0.34 + 0.16 * i), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // 呼吸比战斗里慢一档：这里是「它还没动」，不是「它要动了」
  var breath = Math.sin(breatheT * Math.PI * 2 / 3.6);
  draw.figure(ctx, cx, figY, figSize, battle.figure, battle.color, battle.trait, {
    bob: -screen.px(2.6) * breath,
    sx: 1 + 0.012 * breath,
    sy: 1 - 0.010 * breath
  });

  var nameY = bodyBottom + screen.px(24);
  draw.text(ctx, battle.name, cx, nameY, {
    size: screen.fz(26),
    bold: true,
    align: "center",
    color: P.ink,
    maxWidth: innerW
  });

  // 血量与每击：这两条是唯一影响「要不要现在交药」的数字，
  // 放在卡上比放在战斗面板里更有用——玩家在读卡的这几秒才真的在想这件事
  draw.text(ctx,
    "生命 " + battle.maxHp + "　·　每击 " + battle.damageRange[0] + "—" + battle.damageRange[1],
    cx, nameY + screen.px(38), {
      size: screen.fz(10),
      align: "center",
      color: P.inkFaint
    });

  // intro 原文以「Boss：」开头，那是日志里的写法；卡上已经有「关底首领」，
  // 再念一遍就成了「关底首领 / Boss：」的重复
  var introText = String(battle.intro || "").replace(/^Boss：/, "");
  var introY = nameY + screen.px(66);
  var introUsed = draw.text(ctx, introText, cx, introY, {
    size: screen.fz(11),
    align: "center",
    color: P.inkDim,
    wrap: innerW,
    lineHeight: screen.px(17)
  });

  if (battle.introHint) {
    // 预感块贴底，不贴着上一段：它是这张卡最后一句、也是唯一真需要读进去的一句，
    // 跟规则文字挤在一起就变成了脚注。贴在按钮上方，中间那片空才读成「留白」，
    // 而不是「有一块内容加载失败」。上限兜底：极窄屏上两块仍不许叠。
    var hy = Math.max(introY + introUsed + screen.px(16), btnTop - screen.px(112));
    draw.fillRR(ctx, { x: left, y: hy, w: innerW, h: 1 }, "rgba(255,138,106,0.26)", 0);
    draw.text(ctx, "预感", left, hy + screen.px(10), {
      size: screen.fz(9),
      bold: true,
      color: "#F08A6A"
    });
    draw.text(ctx, battle.introHint, left, hy + screen.px(26), {
      size: screen.fz(11),
      color: "#E6B4A4",
      wrap: innerW,
      lineHeight: screen.px(17)
    });
  }

  var pulse = 0.55 + 0.45 * Math.sin(breatheT * Math.PI * 2 / 1.6);
  draw.text(ctx, "轻触任意处继续", cx, btnTop - screen.px(22), {
    size: screen.fz(9),
    align: "center",
    color: P.inkFaint,
    alpha: 0.35 + 0.45 * pulse
  });

  // 整块面板先注册点击，按钮后画：后画的在栈顶，按钮才有按压反馈。
  // 两个 id 相同，所以点在哪儿都是同一件事——「我看完了」。
  ui.pushHit({ id: "battle:intro", rect: r, kind: "card" });
  ui.button(ctx, {
    id: "battle:intro",
    rect: { x: left, y: btnTop, w: innerW, h: btnH },
    label: "迎战",
    style: "primary",
    size: screen.fz(15)
  });
}

function renderDeath(ctx, screen, state, r, top) {
  var pad = screen.px(14);
  var left = r.x + pad;
  var innerW = r.w - pad * 2;

  draw.text(ctx, "你倒下了", r.x + r.w / 2, top, {
    size: screen.fz(21),
    bold: true,
    align: "center",
    color: "#FFB199"
  });
  draw.text(ctx,
    (state.player.inventory.retryCard || 0) > 0
      ? "使用重战卡原地满血复活，或看一次广告复活"
      : "可以看一次激励视频复活，或直接结束本局",
    r.x + r.w / 2, top + screen.px(30), {
      size: screen.fz(11),
      align: "center",
      color: P.inkDim,
      wrap: innerW,
      lineHeight: screen.px(17)
    });

  var btns = screen.col({ x: left, y: top + screen.px(60), w: innerW, h: screen.px(108) }, 3, screen.px(8));

  ui.button(ctx, {
    id: "battle:retry",
    rect: btns[0],
    label: "使用重战卡 ×" + (state.player.inventory.retryCard || 0),
    sub: "满血复活",
    style: "primary",
    disabled: (state.player.inventory.retryCard || 0) <= 0,
    size: screen.fz(14)
  });
  ui.button(ctx, {
    id: "battle:adRevive",
    rect: btns[1],
    label: "看视频复活",
    sub: "恢复 70 生命",
    style: "teal",
    size: screen.fz(14)
  });
  ui.button(ctx, {
    id: "battle:giveUp",
    rect: btns[2],
    label: "结束本局",
    sub: "结算并返回列车",
    style: "ghost",
    size: screen.fz(14)
  });
}

/**
 * 敌人身侧的预告气泡。
 *
 * 为什么不在头顶：头顶那 20px 是血条、血量数字和护盾行占着的地盘，
 * 早期版本把气泡放在头顶，正好压住「护盾 8」，而且窄屏上还会顶到面板右缘。
 * 玩家与敌人之间的空白是面板里唯一一块没被占用的地方，气泡放这儿既能对上
 * 剪影，又不和任何数字抢位置。
 *
 * 只写「下回合真要发生的事」：气泡上的数字就是结算时的数字，对不上比没提示更糟。
 * 颜色按危险类型分，脉动 1.1 秒——比待机呼吸快，余光能捕捉，又不至于读不清字。
 */
function drawTelegraph(ctx, screen, cx, cy, enemySize, tele, t) {
  var color = tele.kind === "weave" ? "#7ED8CB"
    : tele.kind === "swarm" ? "#F0B45C" : "#F08A6A";
  var fs = screen.fz(9);
  var label = tele.label + " · " + tele.detail;
  var padX = screen.px(8);
  var w = Math.min(draw.measure(ctx, label, fs, true) + padX * 2 + screen.px(7), screen.px(150));
  var h = screen.px(20);
  var anchorX = cx - enemySize * 0.5 - screen.px(7);
  var x = anchorX - screen.px(9) - w;
  var y = cy - h / 2 + screen.px(3);
  // 贴着面板左缘时收进来，宁可离剪影远一点，也不能把气泡画到面板外
  var minX = screen.px(12);
  if (x < minX) x = minX;
  var pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 / 1.1);

  draw.fillRR(ctx, { x: x, y: y, w: w, h: h }, "rgba(10,22,30,0.90)", screen.px(7));

  ctx.save();
  ctx.globalAlpha = 0.55 + 0.45 * pulse;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, screen.px(1.2));
  draw.rr(ctx, x, y, w, h, screen.px(7));
  ctx.stroke();

  // 左侧小圆点：与描边同频呼吸，把视线拉过来
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + padX * 0.55, y + h / 2, Math.max(1.5, screen.px(2)), 0, Math.PI * 2);
  ctx.fill();

  // 指向敌人的箭头（气泡右缘 → 剪影），没有它这块牌子就只是飘在空中的一段字
  ctx.beginPath();
  ctx.moveTo(x + w, y + h / 2 - screen.px(4));
  ctx.lineTo(anchorX + screen.px(2), y + h / 2);
  ctx.lineTo(x + w, y + h / 2 + screen.px(4));
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  draw.text(ctx, label, x + padX * 1.05, y + (h - fs * 1.3) / 2, {
    size: fs,
    bold: true,
    color: color,
    maxWidth: w - padX * 1.4
  });
}

/** 按当前屏幕缩放折算像素，保证特效在各机型上比例一致 */
function px(base) {
  return Math.round(base * (layout.scale || 1));
}

function hitPos() {
  return { x: layout.ex || 200, y: layout.ey || 300 };
}

function heroPos() {
  return { x: layout.hx || 60, y: layout.hy || 300 };
}

function onAction(action, state, app) {
  var id = action.id;
  if (id.indexOf("battle:") !== 0) return false;
  var command = id.slice(7);
  var fx = app.fx ? app.fx() : null;

  /**
   * 登场卡还开着：任何战斗动作都先当成「关掉卡片」。
   *
   * 卡上没画按钮，但手指可能落在旧位置（甚至就是上一场战斗「精准射击」那儿）。
   * 若把这一下当行动处理，玩家只是在读字就被白打一回合——这一击和「读卡」毫无关系。
   */
  if (command === "intro"
    || (state.run && state.run.battle && state.run.battle.introOpen)) {
    if (stateApi.dismissBattleIntro(state)) {
      if (app.sound) app.sound("tap", 0.6);
      app.commit();
    }
    return true;
  }

  if (command === "info") {
    app.openInfo("enemy");
    return true;
  }
  if (command === "giveUp") {
    if (app.sound) app.sound("lose", 0.7);
    stateApi.endRun(state, false, "你在战斗中放弃了本次探索。");
    app.commit();
    return true;
  }
  if (command === "adRevive") {
    app.requestAd("revive", function () {
      var ok = stateApi.applyAdRevive(state);
      if (!ok) {
        app.toast("复活失败，请稍后再试");
      } else if (fx) {
        var h = heroPos();
        fx.ring(h.x, h.y, { color: "#7FD69A", to: px(70), life: 460, width: 3 });
        fx.float(h.x, h.y - px(16), "+" + config.adReviveHp, { color: "#7FD69A", size: px(22) });
        fx.flash("rgba(127,214,154,0.30)", 220);
      }
      if (app.sound) app.sound("heal", 0.8);
      app.commit();
      // 旧代码在这里 start("battlefx")，但那颗补间是给「敌人受击」用的，
      // 复活时让敌人无故后坐了一帧。复活只留光效，不动剪影。
    });
    return true;
  }
  if (command === "retry") {
    var rr = stateApi.battleAction(state, "retry");
    if (!rr.ok) {
      app.toast("无法使用重战卡");
    } else {
      if (app.sound) app.sound("heal", 0.9);
      if (fx) {
        var hp = heroPos();
        fx.ring(hp.x, hp.y, { color: "#E0B15C", to: px(80), life: 480, width: 3 });
        fx.burst(hp.x, hp.y, { count: 18, color: "#F2CD84", speed: 190, life: 520 });
        fx.flash("rgba(240,205,132,0.30)", 240);
      }
    }
    app.commit();
    return true;
  }

  var battleBefore = state.run && state.run.battle;
  var enemyHpBefore = battleBefore ? battleBefore.hp : 0;
  var enemyShieldBefore = battleBefore ? battleBefore.enemyShield : 0;
  var phaseBefore = battleBefore ? (battleBefore.phase || 1) : 1;
  var playerHpBefore = state.player.hp;
  var result = stateApi.battleAction(state, command) || {};
  var phaseBroke = !!battleBefore && battleBefore.phase > phaseBefore;

  // 出手音：不同行动给不同音色，让玩家闭着眼也能听出自己在干什么
  if (app.sound) {
    if (command === "defend") app.sound("shield", 0.7);
    else if (command === "potion") app.sound("heal", 0.7);
    else if (command === "execute") app.sound("crit", 0.95);
    else if (command === "escape") app.sound("select", 0.7);
    else app.sound("bow", 0.6);
  }

  // 换阶段是这一回合里最重要的事，压过其它所有反馈：
  // 一闪、一震、一圈裂纹，玩家才知道刚才那一下打出了什么。
  // 音效放在出手音之后，否则会被后面那句 app.sound("bow") 盖掉。
  if (phaseBroke) {
    var bp2 = hitPos();
    if (fx) {
      fx.flash("rgba(255,235,220,0.42)", 260);
      fx.shake(px(7), 300);
      fx.ring(bp2.x, bp2.y, { color: "#FF8B7A", to: px(130), life: 620, width: 3 });
      fx.burst(bp2.x, bp2.y, {
        count: 26, color: "#D8574A", speed: 260, life: 700, size: px(3)
      });
      // 飘字要抬得比伤害数字高得多：伤害数字从 y-8 往上飘 52px，
      // 两个都在同一高度就会撞成一团「第二阶段-16」。
      fx.float(bp2.x, bp2.y - px(58), battleBefore.phaseLabel || "第二阶段", {
        color: "#FF9C86", size: px(20), rise: px(24), bold: true
      });
    }
    if (app.sound) app.sound("crit", 1);
    if (app.animator) app.animator.start("bossPhase", 420);
  }

  // 出手动作：和音色指向同一件事。时长比音效尾巴略长，动作不会在半路僵住。
  // 落空、闪避也照播——「我确实出手了，只是没打中」，这正是需要看见的信息。
  // 行动没成立（没药、没钱）时不播：喝了口空气还做出仰头动作，是在骗玩家。
  if (app.animator && result.ok !== false) {
    if (command === "defend") app.animator.start("heroGuard", 420);
    else if (command === "potion") app.animator.start("heroDrink", 360);
    else if (command === "power" || command === "execute") app.animator.start("heroPower", 420);
    else if (command === "precise") app.animator.start("heroShoot", 240);
  }

  var hp = hitPos();
  var hero = heroPos();

  // 落空 / 闪避：给明确的「没打中」反馈，而不是什么都没有
  if (result.missed) {
    if (fx) {
      fx.float(hp.x, hp.y - px(10), "落空", { color: "#8FA3AE", size: px(17), rise: 34 });
      fx.burst(hp.x, hp.y + px(30), { count: 6, color: "#5B6C77", speed: 90, life: 300, dir: -Math.PI / 2, spread: Math.PI });
    }
  } else if (result.dodged) {
    if (fx) {
      fx.float(hp.x, hp.y - px(10), "闪避", { color: "#9FC6D4", size: px(17), rise: 34 });
      fx.burst(hp.x, hp.y, { count: 8, color: "#9FC6D4", speed: 130, life: 320 });
    }
  } else {
    // 命中伤害 = 血条变化 + 被护盾吃掉的量
    var afterBattle = state.run && state.run.battle;
    var dealt = enemyHpBefore - (afterBattle ? afterBattle.hp : 0);
    if (dealt > 0) {
      // 材质决定「这一刀打的是什么」：铁是冷白火星、肉是暖红血雾、布是土黄碎屑、虚空是紫色残光。
      // 音色与粒子色共用同一个材质字段，玩家的视觉与听觉指向同一件事。
      var spark = materialsApi.getById(battleBefore && battleBefore.material).spark;
      if (fx) {
        var big = dealt >= 20;
        fx.float(hp.x, hp.y - px(8), "-" + dealt, {
          color: big ? "#FF7A66" : "#FFB199",
          size: px(big ? 27 : 21),
          rise: px(52),
          drift: px(6)
        });
        fx.burst(hp.x, hp.y, {
          count: big ? 20 : 12,
          color: spark,
          speed: big ? 240 : 165,
          life: 460,
          size: px(3)
        });
        if (big) {
          fx.ring(hp.x, hp.y, { color: "#F2CD84", to: px(72), life: 380, width: 3 });
          fx.flash("rgba(255,240,210,0.22)", 120);
          fx.shake(px(7), 200);
        } else {
          fx.shake(px(4), 150);
        }
      }
      // 音层由数据决定：普通命中只出材质层，重击叠一层通用低频
      if (app.sound) {
        var layers = materialsApi.layersFor(battleBefore && battleBefore.material, { crit: dealt >= 20 });
        var li;
        for (li = 0; li < layers.length; li += 1) {
          app.sound(layers[li].name, layers[li].volume);
        }
      }
      // 受击帧：重击挤得更狠一点，和飘字/震屏是同一个「大」的判据
      if (app.animator) app.animator.start("enemyHit", dealt >= 20 ? 300 : 230);
    }
    // 打在护盾上：没有血条变化，但要告诉玩家「被挡了」
    if (dealt <= 0 && result.ok && (command === "precise" || command === "power")) {
      if (afterBattle && afterBattle.enemyShield < enemyShieldBefore) {
        if (fx) {
          fx.float(hp.x, hp.y - px(8), "护盾吸收", { color: "#4FC0B0", size: px(16), rise: px(34) });
          fx.burst(hp.x, hp.y, { count: 8, color: "#4FC0B0", speed: 140, life: 340 });
        }
        if (app.sound) app.sound("shield", 0.6);
      }
    }
  }

  // 敌方反击：受伤数字打在玩家身上
  if (state.player.hp < playerHpBefore) {
    var took = playerHpBefore - state.player.hp;
    // 蓄势重击兑现：这回合的反馈必须比普通反击更重，否则前三回合的预警等于白给
    var charged = !!(state.run && state.run.battle && state.run.battle.lastChargedHit);
    if (fx) {
      fx.float(hero.x + px(14), hero.y, "-" + took, {
        color: charged ? "#FF6B55" : "#FF8B7A",
        size: px(charged ? 26 : (took >= 18 ? 22 : 18)),
        rise: px(charged ? 54 : 40)
      });
      if (charged) {
        fx.float(hero.x + px(14), hero.y - px(22), "重击", {
          color: "#F08A6A", size: px(13), rise: px(30)
        });
      }
      fx.burst(hero.x, hero.y + px(6), {
        count: charged ? 16 : 9,
        color: "#D8574A",
        speed: charged ? 210 : 150,
        life: 380,
        size: px(2.6)
      });
      fx.shake(px(charged ? 8 : 3), charged ? 240 : 130);
      if (charged) fx.flash("rgba(240,138,106,0.16)", 150);
    }
    if (app.sound) {
      app.sound("hit", 0.45);
      if (charged) app.sound("crit", 0.6);
    }
    // 敌人扑过来 + 玩家被顶退：两个补间同期跑，才像「它撞了你」而不是「你掉血了」
    // 蓄势重击冲得更远更久，动作本身就说明了「这一下不一样」
    if (app.animator) {
      app.animator.start("enemyLunge", charged ? 420 : 300);
      app.animator.start("heroHurt", charged ? 340 : 240);
    }
  }

  // 防御：给护盾一个可见的形状
  if (command === "defend" && fx) {
    fx.ring(hero.x, hero.y + px(10), { color: "#4FC0B0", to: px(66), life: 420, width: 3 });
    fx.float(hero.x, hero.y - px(8), "护盾 +" + config.defendShield, { color: "#7ED8CB", size: px(16), rise: px(38) });
  }

  // 喝药
  if (command === "potion" && state.player.hp > playerHpBefore) {
    if (fx) {
      var healed = state.player.hp - playerHpBefore;
      fx.float(hero.x + px(10), hero.y - px(8), "+" + healed, { color: "#7FD69A", size: px(20), rise: px(44) });
      fx.ring(hero.x, hero.y + px(10), { color: "#7FD69A", to: px(58), life: 420, width: 2.5 });
      fx.burst(hero.x, hero.y + px(14), { count: 10, color: "#7FD69A", speed: 120, life: 460, gravity: -180, dir: -Math.PI / 2, spread: Math.PI * 0.8 });
    }
  }

  app.vibrate();
  if (result.message) app.toast(result.message);

  if (result.runCleared) {
    if (app.sound) app.sound("win", 1);
    if (fx) {
      fx.flash("rgba(255,245,220,0.55)", 420);
      fx.shake(px(10), 320);
      fx.burst(hp.x, hp.y, { count: 28, color: "#F2CD84", speed: 300, life: 720, size: px(3.4) });
    }
  } else if (state.player.hp <= 0) {
    if (app.sound) app.sound("lose", 0.9);
    if (fx) fx.shake(px(6), 260);
  }

  app.commit();
  return true;
}

module.exports = {
  render: render,
  onAction: onAction
};
