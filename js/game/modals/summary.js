/**
 * modals/summary.js —— 本局结算
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");
var text = require("../data/text");

var P = draw.PALETTE;

function render(ctx, screen, state) {
  var s = screen.s;
  var data = state.current.modalData || {};
  var summary = data.summary || stateApi.computeSummary(state);
  var panel = common.modalPanel(screen, screen.px(430));
  draw.panel(ctx, panel, {
    radius: Math.round(18 * s),
    fillTop: summary.cleared ? "#2A3B2F" : "#33262A",
    fillBottom: "#101A21",
    strokeColor: summary.cleared ? "rgba(224,177,92,0.6)" : "rgba(216,87,74,0.45)"
  });

  var pad = screen.px(18);
  var cx = panel.x + panel.w / 2;

  draw.text(ctx, summary.cleared ? "通关" : "探索终止", cx, panel.y + pad, {
    size: screen.fz(24),
    bold: true,
    align: "center",
    color: summary.cleared ? P.gold : "#E88A7D"
  });
  draw.text(ctx, data.message || "", cx, panel.y + pad + screen.px(34), {
    size: screen.fz(11),
    align: "center",
    color: P.inkDim,
    wrap: panel.w - pad * 2,
    lineHeight: screen.px(18)
  });

  // 统计格子
  var statsTop = panel.y + pad + screen.px(78);
  var statItems = [
    { label: "到达层数", value: "第 " + (summary.layer + 1) + " 层" },
    { label: "经过节点", value: summary.nodes + " 个" },
    { label: "战斗胜利", value: summary.battlesWon + " 场" },
    { label: "造成伤害", value: summary.damageDealt }
  ];
  var gridRows = screen.col({ x: panel.x + pad, y: statsTop, w: panel.w - pad * 2, h: screen.px(96) }, 2, screen.px(8));
  var i;
  for (i = 0; i < statItems.length; i += 1) {
    var col = i % 2;
    var rowIndex = Math.floor(i / 2);
    var cellW = (panel.w - pad * 2 - screen.px(8)) / 2;
    var rect = {
      x: panel.x + pad + col * (cellW + screen.px(8)),
      y: statsTop + rowIndex * (screen.px(44) + screen.px(8)),
      w: cellW,
      h: screen.px(44)
    };
    draw.fillRR(ctx, rect, "rgba(255,255,255,0.05)", Math.round(10 * s));
    draw.text(ctx, statItems[i].label, rect.x + screen.px(10), rect.y + screen.px(7), {
      size: screen.fz(9),
      color: P.inkFaint
    });
    draw.text(ctx, String(statItems[i].value), rect.x + screen.px(10), rect.y + screen.px(21), {
      size: screen.fz(15),
      bold: true,
      color: P.ink
    });
  }

  // 收获
  var gainTop = statsTop + screen.px(112);
  draw.text(ctx, "本局结算", panel.x + pad, gainTop, {
    size: screen.fz(11),
    color: P.gold,
    bold: true
  });
  draw.text(ctx, "以太 +" + summary.reward + "   遗物 " + summary.relics.length + " 件   强化 " + summary.enhancements.length + " 项", panel.x + pad, gainTop + screen.px(18), {
    size: screen.fz(12),
    color: P.inkDim
  });

  if (summary.relics.length) {
    var names = summary.relics.map(function (item) { return item.name; }).join(" / ");
    draw.text(ctx, names, panel.x + pad, gainTop + screen.px(38), {
      size: screen.fz(10),
      color: P.teal,
      wrap: panel.w - pad * 2,
      lineHeight: screen.px(16)
    });
  }

  // 按钮
  var btns = screen.row({
    x: panel.x + pad,
    y: panel.y + panel.h - pad - screen.px(46),
    w: panel.w - pad * 2,
    h: screen.px(46)
  }, 2, screen.px(10));

  ui.button(ctx, {
    id: "summary:share",
    rect: btns[0],
    label: "分享战绩",
    style: "ghost",
    size: screen.fz(14)
  });
  ui.button(ctx, {
    id: "summary:close",
    rect: btns[1],
    label: "返回列车",
    style: "primary",
    size: screen.fz(14)
  });
}

function onAction(action, state, app) {
  if (action.id === "summary:close") {
    stateApi.closeSummary(state);
    app.go("train");
    app.commit();
    return true;
  }
  if (action.id === "summary:share") {
    var data = state.current.modalData || {};
    var summary = data.summary || {};
    app.share({
      title: summary.cleared ? text.share.cleared : text.share.failed.replace("%d", String((summary.layer || 0) + 1)),
      // 配图与文案同源：通关/阵亡各一张，玩家在会话里看到的图和他刚打出来的结果对得上
      imageUrl: summary.cleared ? text.share.imageCleared : text.share.imageFailed
    });
    return true;
  }
  return false;
}

module.exports = {
  render: render,
  onAction: onAction
};
