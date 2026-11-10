/**
 * modals/chest.js —— 宝箱：先展示获得的遗物，确认后再进强化
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");
var relicsApi = require("../data/relics");

var P = draw.PALETTE;

function rarityLabel(rarity) {
  if (rarity === "epic") return "史诗";
  if (rarity === "rare") return "稀有";
  return "普通";
}

function rarityColor(rarity) {
  if (rarity === "epic") return P.purple;
  if (rarity === "rare") return P.gold;
  return P.teal;
}

function render(ctx, screen, state) {
  var s = screen.s;
  var run = state.run;
  var relic = relicsApi.getById(run && run.pendingRelicId);
  var panel = common.modalPanel(screen, screen.px(360));
  draw.panel(ctx, panel, {
    radius: Math.round(16 * s),
    fillTop: "#1B3540",
    fillBottom: "#0F1D25",
    strokeColor: "rgba(79,192,176,0.5)"
  });

  var pad = screen.px(18);
  draw.text(ctx, "遗物宝箱", panel.x + pad, panel.y + pad, {
    size: screen.fz(10),
    color: P.teal,
    bold: true
  });

  if (!relic) {
    draw.text(ctx, "箱子是空的。", panel.x + panel.w / 2, panel.y + panel.h / 2, {
      size: screen.fz(14),
      align: "center",
      color: P.inkDim
    });
  } else {
    // 遗物图标
    var cx = panel.x + panel.w / 2;
    var cy = panel.y + screen.px(96);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, screen.px(28), 0, Math.PI * 2);
    ctx.fillStyle = "rgba(79,192,176,0.14)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = rarityColor(relic.rarity);
    ctx.stroke();
    ctx.restore();
    draw.text(ctx, relic.name.slice(0, 1), cx, cy - screen.fz(16) * 0.7, {
      size: screen.fz(22),
      bold: true,
      align: "center",
      color: rarityColor(relic.rarity)
    });

    draw.text(ctx, relic.name, cx, cy + screen.px(38), {
      size: screen.fz(18),
      bold: true,
      align: "center",
      color: P.ink
    });
    draw.text(ctx, rarityLabel(relic.rarity) + "遗物", cx, cy + screen.px(62), {
      size: screen.fz(10),
      align: "center",
      color: rarityColor(relic.rarity)
    });
    draw.text(ctx, relic.desc, panel.x + pad, cy + screen.px(84), {
      size: screen.fz(12),
      color: P.inkDim,
      wrap: panel.w - pad * 2,
      lineHeight: screen.px(20)
    });
  }

  var btn = {
    x: panel.x + pad,
    y: panel.y + panel.h - pad - screen.px(44),
    w: panel.w - pad * 2,
    h: screen.px(44)
  };
  ui.button(ctx, {
    id: "chest:continue",
    rect: btn,
    label: "收下，并选择一次强化",
    style: "primary",
    size: screen.fz(14)
  });
}

function onAction(action, state, app) {
  if (action.id === "chest:continue") {
    if (app.sound) app.sound("coin", 0.8);
    stateApi.confirmChest(state);
    app.commit();
    return true;
  }
  return false;
}

module.exports = {
  render: render,
  onAction: onAction
};
