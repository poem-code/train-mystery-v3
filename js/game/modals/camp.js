/**
 * modals/camp.js —— 营地：休息 / 整备 二选一
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");

var P = draw.PALETTE;

function render(ctx, screen, state) {
  var s = screen.s;
  var panel = common.modalPanel(screen, screen.px(340));
  draw.panel(ctx, panel, {
    radius: Math.round(16 * s),
    fillTop: "#22342B",
    fillBottom: "#111E1A",
    strokeColor: "rgba(95,184,122,0.5)"
  });

  var pad = screen.px(16);
  draw.text(ctx, "营地", panel.x + pad, panel.y + pad, {
    size: screen.fz(10),
    color: P.green,
    bold: true
  });
  draw.text(ctx, "安全的一夜", panel.x + pad, panel.y + pad + screen.px(16), {
    size: screen.fz(19),
    bold: true,
    color: P.ink
  });
  draw.text(ctx, "你可以在这里恢复状态，或者利用整备时间换取一次强化。", panel.x + pad, panel.y + pad + screen.px(46), {
    size: screen.fz(11),
    color: P.inkDim,
    wrap: panel.w - pad * 2,
    lineHeight: screen.px(19)
  });

  var heal = 22 + (state.run ? state.run.effects.campHealBonus : 0);
  var rows = screen.col({
    x: panel.x + pad,
    y: panel.y + panel.h - pad - screen.px(120),
    w: panel.w - pad * 2,
    h: screen.px(120)
  }, 2, screen.px(10));

  ui.button(ctx, {
    id: "camp:rest",
    rect: rows[0],
    label: "休息",
    sub: "+" + heal + " 生命 / +10 精神 / +15 饱食",
    style: "primary",
    size: screen.fz(15)
  });
  ui.button(ctx, {
    id: "camp:prepare",
    rect: rows[1],
    label: "整备",
    sub: "获得一次强化选择",
    style: "teal",
    size: screen.fz(15)
  });
}

function onAction(action, state, app) {
  if (action.id === "camp:rest") {
    var r = stateApi.campRest(state);
    app.toast(r.message);
    app.commit();
    return true;
  }
  if (action.id === "camp:prepare") {
    stateApi.campPrepare(state);
    app.commit();
    return true;
  }
  return false;
}

module.exports = {
  render: render,
  onAction: onAction
};
