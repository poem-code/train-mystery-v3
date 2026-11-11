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

function render(ctx, screen, state, animator) {
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
  var nameMaxW = innerW;
  if (battle.affixName) {
    var badge = "词缀 · " + battle.affixName;
    var bw = draw.measure(ctx, badge, screen.fz(9), true) + screen.px(14);
    nameMaxW = innerW - bw - screen.px(8);
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
  cursor += screen.px(30);

  // 敌人血条
  var hpRect = { x: left, y: cursor, w: innerW, h: screen.px(9) };
  draw.bar(ctx, hpRect, battle.hp / battle.maxHp, {
    color: battle.boss ? P.red : "#C8664F",
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

  // 受击后坐力：被打中时敌人往后一顿再弹回（用补间进度驱动，不额外存状态）
  var recoil = animator.progress("battlefx");
  var kick = recoil < 1 ? (1 - recoil) * screen.px(9) : 0;
  var enemySize = battle.boss ? screen.px(104) : screen.px(80);
  draw.figure(ctx, enemyX + kick, stageCenter, enemySize, battle.figure, battle.color, battle.trait);
  draw.figure(ctx, heroX, stageCenter, screen.px(48), "hero", P.teal, "hero");

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
  ui.button(ctx, {
    id: "battle:defend",
    rect: row2[0],
    label: "防御架势",
    sub: "+12 护盾 · 下击 +5",
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
      if (app.animator) app.animator.start("battlefx", 400);
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
  var playerHpBefore = state.player.hp;
  var result = stateApi.battleAction(state, command) || {};

  // 出手音：不同行动给不同音色，让玩家闭着眼也能听出自己在干什么
  if (app.sound) {
    if (command === "defend") app.sound("shield", 0.7);
    else if (command === "potion") app.sound("heal", 0.7);
    else if (command === "execute") app.sound("crit", 0.95);
    else if (command === "escape") app.sound("select", 0.7);
    else app.sound("bow", 0.6);
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
    if (fx) {
      fx.float(hero.x + px(14), hero.y, "-" + took, {
        color: "#FF8B7A",
        size: px(took >= 18 ? 22 : 18),
        rise: px(40)
      });
      fx.burst(hero.x, hero.y + px(6), { count: 9, color: "#D8574A", speed: 150, life: 380, size: px(2.6) });
      fx.shake(px(3), 130);
    }
    if (app.sound) app.sound("hit", 0.45);
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
