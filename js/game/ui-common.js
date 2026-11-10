/**
 * ui-common.js —— 游戏内共用视觉片段（HUD、标题栏、日志、资源条）
 *
 * 只做「画」，不做状态修改；所有可点元素通过 ui.pushHit 注册动作 id。
 */

var draw = require("../core/draw");
var ui = require("../core/ui");

var P = draw.PALETTE;

/** 顶部：标题 + 返回/设置按钮 */
function header(ctx, screen, title, subtitle, right) {
  var r = screen.header();
  var s = screen.s;
  draw.text(ctx, title, r.x, r.y + screen.px(2), {
    size: screen.fz(21),
    bold: true,
    color: P.ink
  });
  if (subtitle) {
    draw.text(ctx, subtitle, r.x, r.y + screen.px(30), {
      size: screen.fz(11),
      color: P.inkFaint
    });
  }
  if (right && right.label) {
    var w = Math.round(60 * s);
    var btn = { x: r.x + r.w - w, y: r.y + screen.px(4), w: w, h: Math.round(28 * s) };
    ui.button(ctx, {
      id: right.id,
      rect: btn,
      label: right.label,
      style: "ghost",
      size: screen.fz(12)
    });
  }
  return r;
}

/** 三资源条 + 货币（紧凑一行，占两行高度） */
function resourceBar(ctx, screen, state, rect) {
  var s = screen.s;
  var h = Math.round(10 * s);
  var labW = Math.round(26 * s);
  var rows = screen.col(rect, 3, Math.round(7 * s));
  var p = state.player;

  var items = [
    { label: "生命", value: p.hp, max: p.maxHp, color: "#D8574A" },
    { label: "饱食", value: p.hunger, max: 100, color: "#E0B15C" },
    { label: "精神", value: p.sanity, max: 100, color: "#4FC0B0" }
  ];

  var i;
  for (i = 0; i < items.length; i += 1) {
    var row = rows[i];
    var item = items[i];
    draw.text(ctx, item.label, row.x, row.y + row.h / 2 - screen.fz(9) * 0.7, {
      size: screen.fz(9),
      color: P.inkFaint
    });
    var barRect = {
      x: row.x + labW,
      y: row.y + (row.h - h) / 2,
      w: row.w - labW - Math.round(46 * s),
      h: h
    };
    draw.bar(ctx, barRect, item.value / item.max, {
      color: item.color,
      track: "rgba(255,255,255,0.09)"
    });
    draw.text(ctx, Math.round(item.value) + "/" + Math.round(item.max), row.x + row.w, row.y + row.h / 2 - screen.fz(9) * 0.7, {
      size: screen.fz(9),
      color: P.inkDim,
      align: "right"
    });
  }

  // 货币行
  var moneyY = rect.y + rect.h + Math.round(6 * s);
  draw.text(ctx, "以太 " + Math.round(p.ether) + "   金币 " + Math.round(p.gold), rect.x, moneyY, {
    size: screen.fz(11),
    color: P.gold,
    bold: true
  });
  return moneyY;
}

/** 道具栏：4 个格子，可点 */
function inventoryBar(ctx, screen, state, rect, opts) {
  var s = screen.s;
  var cells = screen.row(rect, 4, Math.round(8 * s));
  var itemsApi = require("./data/items");
  var order = ["portableFood", "potion", "retryCard", "executeCard"];
  var enabled = opts && opts.enabled;
  var i;
  for (i = 0; i < order.length; i += 1) {
    var key = order[i];
    var def = itemsApi.ITEMS[key];
    var count = state.player.inventory[key] || 0;
    var cell = cells[i];
    var usable = enabled && count > 0;
    ui.button(ctx, {
      id: "item:" + key,
      rect: cell,
      label: def.name.slice(0, 2) + " ×" + count,
      style: usable ? "ghost" : "ghost",
      disabled: !usable,
      size: screen.fz(11)
    });
  }
}

/** 日志区：最近 3 条 */
function logPanel(ctx, screen, state, rect) {
  var s = screen.s;
  draw.panel(ctx, rect, { radius: Math.round(10 * s), fillTop: "#111F29", fillBottom: "#0C1820" });
  var pad = Math.round(10 * s);
  var y = rect.y + pad;
  var logs = state.logs.slice(0, 3);
  var i;
  for (i = 0; i < logs.length; i += 1) {
    var alpha = 1 - i * 0.28;
    var line = "[" + logs[i].title + "] " + logs[i].text;
    var used = draw.text(ctx, line, rect.x + pad, y, {
      size: screen.fz(10),
      color: P.inkDim,
      wrap: rect.w - pad * 2,
      lineHeight: Math.round(13 * s),
      alpha: alpha
    });
    y += used + Math.round(4 * s);
    if (y > rect.y + rect.h - Math.round(12 * s)) break;
  }
}

/** 节点圆标：类型色圆 + 单字 */
function nodeMark(ctx, screen, nodeDef, cx, cy, radius, opts) {
  var o = opts || {};
  var s = screen.s;
  ctx.save();
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;

  if (o.glow) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius + Math.round(5 * s), 0, Math.PI * 2);
    ctx.fillStyle = "rgba(224,177,92,0.22)";
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = o.fill || "#132633";
  ctx.fill();
  ctx.lineWidth = o.selected ? Math.round(2.5 * s) : Math.round(1.6 * s);
  ctx.strokeStyle = o.stroke || nodeDef.color;
  ctx.stroke();

  // 图标用几何图形，不用「战/精/商」这类首字：字形在不同机型上字重不一，且与界面脱节
  draw.nodeGlyph(ctx, cx, cy, radius * 0.62, nodeDef.glyph, o.labelColor || nodeDef.color);
  ctx.restore();
}

/** 小标题 + 分割线 */
function sectionTitle(ctx, screen, label, x, y, width) {
  return ui.section(ctx, label, x, y, width);
}

/** 空态提示 */
function empty(ctx, screen, text, rect) {
  draw.text(ctx, text, rect.x + rect.w / 2, rect.y + rect.h / 2, {
    size: screen.fz(12),
    color: P.inkFaint,
    align: "center"
  });
}

/** 弹窗信封：返回面板矩形（居中、留边、不超屏） */
function modalPanel(screen, heightPx) {
  var maxH = screen.height - screen.safeTop - screen.safeBottom - screen.px(36);
  var h = Math.min(maxH, heightPx || screen.px(460));
  var w = screen.width - screen.pad * 2;
  return { x: screen.pad, y: (screen.height - h) / 2, w: w, h: h };
}

/** 弹窗内的标题区，返回内容起始 y */
function modalTitle(ctx, screen, panel, title, subtitle) {
  var s = screen.s;
  var pad = screen.px(16);
  draw.text(ctx, title, panel.x + pad, panel.y + pad, {
    size: screen.fz(18),
    bold: true,
    color: P.ink
  });
  var y = panel.y + pad + screen.px(28);
  if (subtitle) {
    draw.text(ctx, subtitle, panel.x + pad, y, {
      size: screen.fz(11),
      color: P.inkFaint
    });
    y += screen.px(18);
  }
  return y;
}

module.exports = {
  header: header,
  resourceBar: resourceBar,
  inventoryBar: inventoryBar,
  logPanel: logPanel,
  nodeMark: nodeMark,
  sectionTitle: sectionTitle,
  empty: empty,
  modalPanel: modalPanel,
  modalTitle: modalTitle
};
