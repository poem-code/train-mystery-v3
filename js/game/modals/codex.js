/**
 * modals/codex.js —— 永久图鉴（敌人 / 遗物 / 强化 / 成就）
 *
 * 这是「跨局目标感」的落点：玩家每局结束都能看到图鉴往前推了一点。
 * 分页而不是滚动：Canvas 手写滚动条在低端机上容易抖，分页更稳。
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");
var config = require("../config");
var enemiesApi = require("../data/enemies");
var relicsApi = require("../data/relics");
var enhApi = require("../data/enhancements");
var achievementsApi = require("../data/achievements");

var P = draw.PALETTE;

var TABS = [
  { id: "enemies", label: "敌人" },
  { id: "relics", label: "遗物" },
  { id: "enhancements", label: "强化" },
  { id: "achievements", label: "成就" }
];

/** 每页条数：敌人条目多一行特性说明，所以少放一条 */
var PAGE_SIZE = { enemies: 5, relics: 5, enhancements: 6, achievements: 4 };

function tabIndex(tab) {
  var i;
  for (i = 0; i < TABS.length; i += 1) {
    if (TABS[i].id === tab) return i;
  }
  return 0;
}

function buildRows(state, tab) {
  var codex = state.progress.codex;
  var rows = [];
  var i;

  if (tab === "enemies") {
    for (i = 0; i < enemiesApi.ENEMIES.length; i += 1) {
      var enemy = enemiesApi.ENEMIES[i];
      var entry = codex.enemies[enemy.id];
      rows.push({
        id: enemy.id,
        name: entry && entry.seen ? enemy.name : "？？？",
        unlocked: !!(entry && entry.seen),
        desc: entry && entry.seen
          ? (entry.defeats > 0 ? "已击败 " + entry.defeats + " 次" : "已遇见，尚未击败") + " · " + (enemy.intro || "无额外特性")
          : "尚未遇见",
        color: entry && entry.seen ? enemy.color : P.inkFaint
      });
    }
    return rows;
  }

  if (tab === "relics") {
    for (i = 0; i < relicsApi.RELICS.length; i += 1) {
      var relic = relicsApi.RELICS[i];
      var owned = !!codex.relics[relic.id];
      rows.push({
        id: relic.id,
        name: owned ? relic.name : "？？？",
        unlocked: owned,
        desc: owned ? relic.desc : "尚未获得",
        color: owned ? P.teal : P.inkFaint
      });
    }
    return rows;
  }

  if (tab === "enhancements") {
    for (i = 0; i < enhApi.ENHANCEMENTS.length; i += 1) {
      var enh = enhApi.ENHANCEMENTS[i];
      var got = !!codex.enhancements[enh.id];
      rows.push({
        id: enh.id,
        name: got ? enh.name : "？？？",
        unlocked: got,
        desc: got ? enh.desc : "尚未获得",
        color: got ? P.gold : P.inkFaint
      });
    }
    return rows;
  }

  // 成就
  for (i = 0; i < achievementsApi.ACHIEVEMENTS.length; i += 1) {
    var ach = achievementsApi.ACHIEVEMENTS[i];
    var done = !!state.progress.achievements[ach.id];
    rows.push({
      id: ach.id,
      name: ach.name,
      unlocked: done,
      desc: ach.desc + "（" + ach.reward + " 以太）",
      color: done ? P.green : P.inkFaint
    });
  }
  return rows;
}

function render(ctx, screen, state) {
  var s = screen.s;
  var data = state.current.modalData || {};
  var tab = data.tab || "enemies";
  var page = data.page || 0;

  var summary = stateApi.codexSummary(state);
  var panel = common.modalPanel(screen, screen.px(556));
  draw.panel(ctx, panel, {
    radius: Math.round(16 * s),
    fillTop: "#1C2E3A",
    fillBottom: "#101C25",
    strokeColor: "rgba(224,177,92,0.40)"
  });

  var pad = screen.px(16);
  var y = common.modalTitle(ctx, screen, panel, "图鉴",
    "已解锁 " + summary.unlocked + " / " + summary.total + " · " + summary.percent + "% · 每 25% 领一次以太");

  // 进度条
  var barRect = { x: panel.x + pad, y: y - screen.px(6), w: panel.w - pad * 2, h: screen.px(6) };
  draw.bar(ctx, barRect, summary.percent / 100, { color: P.gold, track: "rgba(255,255,255,0.10)" });
  y = barRect.y + barRect.h + screen.px(12);

  // 分页标签
  var tabs = screen.row({ x: panel.x + pad, y: y, w: panel.w - pad * 2, h: screen.px(34) }, 4, screen.px(6));
  var i;
  for (i = 0; i < TABS.length; i += 1) {
    var active = TABS[i].id === tab;
    ui.button(ctx, {
      id: "codex:tab:" + TABS[i].id,
      rect: tabs[i],
      label: TABS[i].label,
      style: active ? "primary" : "ghost",
      size: screen.fz(12)
    });
  }
  y = tabs[0].y + tabs[0].h + screen.px(10);

  // 列表
  var rows = buildRows(state, tab);
  var size = PAGE_SIZE[tab] || 5;
  var totalPages = Math.max(1, Math.ceil(rows.length / size));
  var current = Math.min(page, totalPages - 1);
  var start = current * size;
  var listTop = y;
  var listBottom = panel.y + panel.h - screen.px(96);
  var rowH = Math.min(screen.px(56), Math.max(screen.px(30), (listBottom - listTop) / size));

  for (i = 0; i < size; i += 1) {
    var row = rows[start + i];
    if (!row) break;
    var ry = listTop + i * rowH;
    draw.text(ctx, row.name, panel.x + pad, ry, {
      size: screen.fz(13),
      bold: true,
      color: row.color,
      maxWidth: panel.w - pad * 2
    });
    draw.text(ctx, row.desc, panel.x + pad, ry + screen.px(17), {
      size: screen.fz(10),
      color: row.unlocked ? P.inkDim : P.inkFaint,
      wrap: panel.w - pad * 2,
      lineHeight: screen.px(14),
      alpha: row.unlocked ? 1 : 0.75
    });
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = P.line;
    ctx.fillRect(panel.x + pad, ry + rowH - screen.px(4), panel.w - pad * 2, 1);
    ctx.restore();
  }

  // 分页
  var pager = screen.row({
    x: panel.x + pad,
    y: panel.y + panel.h - screen.px(84),
    w: panel.w - pad * 2,
    h: screen.px(32)
  }, 3, screen.px(6));

  ui.button(ctx, {
    id: "codex:prev",
    rect: pager[0],
    label: "上一页",
    style: "ghost",
    disabled: current <= 0,
    size: screen.fz(11)
  });
  draw.text(ctx, (current + 1) + " / " + totalPages, pager[1].x + pager[1].w / 2, pager[1].y + pager[1].h / 2 - screen.fz(10) * 0.6, {
    size: screen.fz(11),
    align: "center",
    color: P.inkDim
  });
  ui.button(ctx, {
    id: "codex:next",
    rect: pager[2],
    label: "下一页",
    style: "ghost",
    disabled: current >= totalPages - 1,
    size: screen.fz(11)
  });

  ui.button(ctx, {
    id: "codex:close",
    rect: {
      x: panel.x + pad,
      y: panel.y + panel.h - pad - screen.px(42),
      w: panel.w - pad * 2,
      h: screen.px(42)
    },
    label: "关闭",
    style: "ghost",
    size: screen.fz(14)
  });
}

function onAction(action, state, app) {
  var id = action.id;
  var data = state.current.modalData || {};

  if (id === "codex:close") {
    state.current.modal = null;
    state.current.modalData = null;
    app.commit();
    return true;
  }
  if (id.indexOf("codex:tab:") === 0) {
    state.current.modalData = { tab: id.slice("codex:tab:".length), page: 0 };
    if (app.sound) app.sound("select", 0.6);
    app.commit();
    return true;
  }
  if (id === "codex:prev" || id === "codex:next") {
    var page = data.page || 0;
    state.current.modalData = {
      tab: data.tab || "enemies",
      page: Math.max(0, page + (id === "codex:next" ? 1 : -1))
    };
    if (app.sound) app.sound("tap", 0.5);
    app.commit();
    return true;
  }
  return false;
}

module.exports = {
  render: render,
  onAction: onAction,
  TABS: TABS
};
