/**
 * modals/enhance.js —— 3 选 1 强化
 *
 * 候选由 state.openEnhance 生成并写入 run.pendingEnhancements（只存 id + 文案，可序列化）。
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");

var P = draw.PALETTE;

function render(ctx, screen, state) {
  var s = screen.s;
  var run = state.run;
  var pending = (run && run.pendingEnhancements) || [];
  var panel = common.modalPanel(screen, screen.px(370));
  draw.panel(ctx, panel, {
    radius: Math.round(16 * s),
    fillTop: "#1E3746",
    fillBottom: "#101E27",
    strokeColor: "rgba(79,192,176,0.45)"
  });

  var y = common.modalTitle(ctx, screen, panel, "选择强化", "本局生效，结束后清空");
  var pad = screen.px(16);
  var listTop = y + screen.px(8);
  var listH = panel.y + panel.h - pad - listTop;
  var count = Math.max(1, pending.length);
  var cardH = Math.min(screen.px(78), (listH - screen.px(8) * (count - 1)) / count);
  var rows = [];
  var k;
  for (k = 0; k < count; k += 1) {
    rows.push({ x: panel.x + pad, y: listTop + k * (cardH + screen.px(8)), w: panel.w - pad * 2, h: cardH });
  }

  var i;
  for (i = 0; i < pending.length; i += 1) {
    var item = pending[i];
    ui.card(ctx, {
      id: "enhance:pick:" + item.id,
      rect: rows[i],
      title: item.name,
      body: item.desc,
      badge: item.tag || "强化",
      badgeColor: "rgba(79,192,176,0.16)",
      badgeTextColor: P.teal,
      highlight: i === 0,
      titleSize: screen.fz(15),
      bodySize: screen.fz(11)
    });
  }

  if (!pending.length) {
    draw.text(ctx, "没有可选的强化", panel.x + panel.w / 2, panel.y + panel.h / 2, {
      size: screen.fz(13),
      align: "center",
      color: P.inkDim
    });
  }
}

function onAction(action, state, app) {
  if (action.id.indexOf("enhance:pick:") === 0) {
    var id = action.id.slice("enhance:pick:".length);
    var result = stateApi.chooseEnhancement(state, id);
    if (result.ok) {
      if (app.sound) app.sound("select", 0.8);
      app.toast("获得强化：" + result.enhancement.name);
    } else if (app.sound) {
      app.sound("alert", 0.5);
    }
    app.commit();
    return true;
  }
  return false;
}

module.exports = {
  render: render,
  onAction: onAction
};
