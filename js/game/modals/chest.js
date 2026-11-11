/**
 * modals/chest.js —— 宝箱：先展示获得的遗物，确认后再进强化
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");
var relicsApi = require("../data/relics");
var relicSetsApi = require("../data/relicSets");

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
    var descTop = cy + screen.px(84);
    // draw.text 返回的是「这段文字占的高度」，不是下一个 y，别直接当坐标用
    var descHeight = draw.text(ctx, relic.desc, panel.x + pad, descTop, {
      size: screen.fz(12),
      color: P.inkDim,
      wrap: panel.w - pad * 2,
      lineHeight: screen.px(20)
    });

    // 序列进度：拿到第 N 件时正好能凑齐下一档，是这一格最该说的事，
    // 但要在「收下」之前说，否则玩家事后才知道自己刚凑齐了套装。
    var set = relicSetsApi.forRelic(relic.id);
    if (set) {
      var ownedCount = 0;
      var dup = false;
      var k;
      for (k = 0; k < run.relics.length; k += 1) {
        if (set.members.indexOf(run.relics[k].id) >= 0) ownedCount += 1;
        if (run.relics[k].id === relic.id) dup = true;
      }
      var after = dup ? ownedCount : ownedCount + 1;
      var granted = (run.setActive && run.setActive[set.id]) || 0;
      var next = granted < set.tiers.length ? set.tiers[granted] : null;
      var willUnlock = !dup && next && after >= next.need;
      var accent = P[set.accent] || P.teal;
      var setY = descTop + descHeight + screen.px(12);
      draw.text(ctx, set.name + "  " + after + " / " + set.members.length, cx, setY, {
        size: screen.fz(11),
        align: "center",
        bold: true,
        color: accent
      });
      var tip = willUnlock
        ? "本次凑齐 " + next.need + " 件：" + next.desc
        : (dup ? "已拥有，折算为资源" : (next ? "下一档 " + next.need + " 件：" + next.desc : "档位已全部达成"));
      draw.text(ctx, tip, cx, setY + screen.px(18), {
        size: screen.fz(10),
        align: "center",
        color: willUnlock ? P.gold : P.inkFaint,
        wrap: panel.w - pad * 2
      });
    }
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
