/**
 * modals/themes.js —— 车厢主题选择
 *
 * 出发前决定：选哪节车厢，就接受哪套规则。
 * 规则一旦出发就不能改（中途改会被利用成「快死了切霜封减伤」），
 * 所以这里只在 run 未开始时允许切换；局内打开时只做展示。
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");
var themesApi = require("../data/themes");

var P = draw.PALETTE;

function cardHeight(screen) {
  return screen.px(104);
}

function render(ctx, screen, state) {
  var s = screen.s;
  var runActive = !!(state.run && state.run.active);
  var current = stateApi.selectedThemeId(state);

  var panel = common.modalPanel(screen, screen.px(512));
  draw.panel(ctx, panel, {
    radius: Math.round(16 * s),
    fillTop: "#1F3140",
    fillBottom: "#101C25",
    strokeColor: "rgba(224,177,92,0.40)"
  });

  var pad = screen.px(16);
  var y = common.modalTitle(ctx, screen, panel, "车厢主题",
    runActive ? "本局已锁定，下一局生效" : "选一节车厢，接受它的规矩");

  var list = themesApi.THEMES;
  var cards = screen.col({
    x: panel.x + pad,
    y: y,
    w: panel.w - pad * 2,
    h: cardHeight(screen) * list.length + screen.px(10) * (list.length - 1)
  }, list.length, screen.px(10));

  list.forEach(function (theme, i) {
    var rect = cards[i];
    var unlocked = stateApi.themeUnlocked(state, theme.id);
    var isSelected = theme.id === current;
    var cost = themesApi.unlockCostOf(theme.id);
    var affordable = state.player.ether >= cost;

    draw.panel(ctx, rect, isSelected
      ? {
        radius: Math.round(12 * s),
        fillTop: "rgba(224,177,92,0.18)",
        fillBottom: "rgba(224,177,92,0.05)",
        strokeColor: theme.accent
      }
      : {
        radius: Math.round(12 * s),
        fill: "#14232E",
        strokeColor: "rgba(120,150,170,0.28)"
      });

    // 左侧色条：主题的识别色，和背景光晕同源
    ctx.save();
    ctx.fillStyle = unlocked ? theme.accent : "rgba(120,150,170,0.35)";
    ctx.fillRect(rect.x, rect.y + screen.px(12), screen.px(3), rect.h - screen.px(24));
    ctx.restore();

    var tx = rect.x + screen.px(14);
    var title = theme.name + (unlocked ? "" : " · 未解锁");
    draw.text(ctx, title, tx, rect.y + screen.px(10), {
      size: screen.fz(14),
      bold: true,
      color: isSelected ? theme.accent : unlocked ? P.ink : P.inkDim
    });
    draw.text(ctx, theme.subtitle, rect.x + rect.w - screen.px(12), rect.y + screen.px(12), {
      size: screen.fz(10),
      align: "right",
      color: P.inkFaint
    });
    draw.text(ctx, theme.rules.join(" · "), tx, rect.y + screen.px(32), {
      size: screen.fz(10),
      color: P.inkDim,
      wrap: rect.w - screen.px(30),
      lineHeight: screen.px(15)
    });

    // 右下角状态：已选 / 可切换 / 价格
    var statusText;
    if (isSelected) {
      statusText = "当前";
    } else if (!unlocked) {
      statusText = cost + " 以太解锁";
    } else {
      statusText = "点击切换";
    }
    draw.text(ctx, statusText, rect.x + rect.w - screen.px(12), rect.y + rect.h - screen.px(24), {
      size: screen.fz(10),
      align: "right",
      color: !unlocked && !affordable ? P.red : isSelected ? P.gold : P.inkFaint
    });

    var hitId = !unlocked ? "theme:unlock:" + theme.id : "theme:select:" + theme.id;
    if (runActive && !unlocked) hitId = null;   // 局内不让花以太，避免误触
    if (hitId) {
      ui.pushHit({ id: hitId, rect: rect, meta: { themeId: theme.id }, kind: "theme" });
    }
  });

  var footerY = panel.y + panel.h - pad - screen.px(42);
  var canStart = !runActive;
  ui.button(ctx, {
    id: canStart ? "theme:start" : "theme:close",
    rect: { x: panel.x + pad, y: footerY, w: panel.w - pad * 2, h: screen.px(42) },
    label: canStart ? "登上这节车厢" : "返回路线图",
    style: canStart ? "primary" : "ghost",
    size: screen.fz(15)
  });

  if (!canStart) {
    draw.text(ctx, "改变主意请在下一局出发前切换。", panel.x + panel.w / 2, footerY - screen.px(16), {
      size: screen.fz(10),
      align: "center",
      color: P.inkFaint
    });
  }
}

function onAction(action, state, app) {
  var id = action.id;

  if (id.indexOf("theme:select:") === 0) {
    var pick = id.slice("theme:select:".length);
    var r1 = stateApi.selectTheme(state, pick);
    if (r1.ok) {
      if (app.sound) app.sound("step", 0.6);
      app.commit();
    } else {
      if (app.sound) app.sound("alert", 0.4);
      app.toast(r1.reason === "locked" ? "这节车厢还没接通" : "切换失败");
    }
    return true;
  }

  if (id.indexOf("theme:unlock:") === 0) {
    var want = id.slice("theme:unlock:".length);
    var r2 = stateApi.unlockTheme(state, want);
    if (r2.ok) {
      if (app.sound) app.sound("coin", 0.7);
      app.commit();
      app.toast("已接通「" + themesApi.getById(want).name + "」");
    } else {
      if (app.sound) app.sound("alert", 0.5);
      app.toast(r2.reason === "poor" ? "以太不足" : "无法解锁");
    }
    return true;
  }

  if (id === "theme:start") {
    if (state.run && state.run.active) {
      app.toast("先结束当前探索");
      return true;
    }
    if (app.sound) app.sound("step", 0.85);
    stateApi.startRun(state, app.now());
    app.commit();
    app.go("route");
    return true;
  }

  if (id === "theme:close") {
    app.closeModal();
    return true;
  }

  return false;
}

module.exports = {
  render: render,
  onAction: onAction
};
