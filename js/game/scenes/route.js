/**
 * scenes/route.js —— 本局路线图（核心决策界面）
 *
 * 视觉：自下而上推进，起点在底部、Boss 在顶部；
 * 交互：只有「可达节点」会被点亮并可点击，其余一律降透明。
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");
var mapApi = require("../map");
var nodesData = require("../data/nodes");
var themesApi = require("../data/themes");

var P = draw.PALETTE;

function layerY(mapRect, layer, total) {
  var step = mapRect.h / (total + 0.6);
  return mapRect.y + mapRect.h - (layer + 1) * step + step * 0.35;
}

function laneX(mapRect, lane, count) {
  if (count <= 1) return mapRect.x + mapRect.w / 2;
  return mapRect.x + (mapRect.w * (lane + 1)) / (count + 1);
}

function render(ctx, screen, state, animator) {
  var s = screen.s;
  var run = state.run;
  var theme = themesApi.getById(run.theme) || themesApi.getById("rust");
  draw.backdrop(ctx, screen, null, { glow: theme.glow, beam: theme.beam });

  common.header(ctx, screen, "路线图",
    theme.name + " · 第 " + (run.layer + 1) + " / " + run.layers.length + " 层 · 已走 " + run.nodesVisited + " 个节点", {
      id: "route:collection",
      label: "构筑"
    });

  var content = screen.content();
  var resRect = { x: content.x, y: content.y, w: content.w, h: screen.px(42) };
  common.resourceBar(ctx, screen, state, resRect);

  var mapRect = {
    x: content.x + screen.px(6),
    y: resRect.y + resRect.h + screen.px(24),
    w: content.w - screen.px(12),
    h: content.h - screen.px(150)
  };

  var available = mapApi.available(run.layers, run.currentNodeId);
  var availIds = {};
  available.forEach(function (node) { availIds[node.id] = true; });

  // 主题小胶囊：局中只做查询（点开看这节车厢的规矩），不能改
  var chip = {
    x: mapRect.x + mapRect.w - screen.px(58),
    y: mapRect.y - screen.px(4),
    w: screen.px(58),
    h: screen.px(20)
  };
  ctx.save();
  draw.rr(ctx, chip.x, chip.y, chip.w, chip.h, screen.px(10));
  ctx.fillStyle = "rgba(20,35,46,0.85)";
  ctx.fill();
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  draw.text(ctx, theme.name, chip.x + chip.w / 2, chip.y + screen.px(6), {
    size: screen.fz(9),
    align: "center",
    color: theme.accent
  });
  ui.pushHit({ id: "route:theme", rect: chip, kind: "chip" });

  // 连线（先画，压在节点下面）
  ctx.save();
  ctx.lineWidth = Math.max(1, screen.px(1.4));
  run.layers.forEach(function (layer) {
    layer.forEach(function (node) {
      var x1 = laneX(mapRect, node.lane, layer.length);
      var y1 = layerY(mapRect, node.layer, run.layers.length);
      node.links.forEach(function (linkId) {
        var target = mapApi.findById(run.layers, linkId);
        if (!target) return;
        var x2 = laneX(mapRect, target.lane, run.layers[target.layer].length);
        var y2 = layerY(mapRect, target.layer, run.layers.length);
        var active = node.visited && (availIds[linkId] || target.visited);
        ctx.strokeStyle = active ? "rgba(224,177,92,0.75)" : "rgba(120,150,170,0.22)";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo((x1 + x2) / 2, (y1 + y2) / 2);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });
    });
  });
  ctx.restore();

  // 节点
  var radius = Math.max(12, Math.min(screen.px(15), mapRect.h / (run.layers.length * 2.6)));
  run.layers.forEach(function (layer) {
    layer.forEach(function (node) {
      var def = nodesData.NODE_TYPES[node.type] || nodesData.NODE_TYPES.battle;
      var cx = laneX(mapRect, node.lane, layer.length);
      var cy = layerY(mapRect, node.layer, run.layers.length);

      if (node.type === "boss") radius = Math.max(16, screen.px(20));

      var isAvailable = !!availIds[node.id];
      var isCurrent = run.currentNodeId === node.id;
      var alpha = node.visited || isCurrent ? 1 : isAvailable ? 1 : 0.42;

      // 可达节点：外发光 + 金色描边 + 上方小箭头，远看也能认出「下一步能点哪」
      if (isAvailable) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius + screen.px(6), 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(224,177,92,0.55)";
        ctx.lineWidth = Math.max(1.5, screen.px(1.6));
        ctx.stroke();
        ctx.restore();
        draw.text(ctx, "▲", cx, cy - radius - screen.px(13), {
          size: screen.fz(8),
          align: "center",
          color: P.gold
        });
      }

      common.nodeMark(ctx, screen, def, cx, cy, node.type === "boss" ? Math.max(16, screen.px(20)) : radius, {
        alpha: alpha,
        selected: isCurrent,
        fill: isCurrent ? "rgba(224,177,92,0.24)" : isAvailable ? "#1D3543" : "#101E28",
        stroke: isAvailable ? "rgba(224,177,92,0.9)" : undefined
      });

      if (isAvailable) {
        ui.pushHit({
          id: "route:node:" + node.id,
          rect: { x: cx - radius - 8, y: cy - radius - 8, w: radius * 2 + 16, h: radius * 2 + 16 },
          meta: { nodeId: node.id },
          kind: "node"
        });
      }
    });
  });

  // 底部：操作与提示
  var bottomY = mapRect.y + mapRect.h + screen.px(10);
  var bottomRect = { x: content.x, y: bottomY, w: content.w, h: screen.px(78) };

  if (available.length) {
    var preview = available.map(function (node) {
      var def = nodesData.NODE_TYPES[node.type];
      return def.label;
    }).join(" / ");
    draw.text(ctx, "选择下一站", content.x, bottomY, {
      size: screen.fz(13),
      bold: true,
      color: P.gold
    });
    draw.text(ctx, "可选：" + preview, content.x, bottomY + screen.px(20), {
      size: screen.fz(11),
      color: P.inkDim
    });
  } else {
    draw.text(ctx, "本段路线已结束", content.x, bottomY, {
      size: screen.fz(13),
      bold: true,
      color: P.inkDim
    });
  }

  var actions = screen.row({
    x: content.x,
    y: bottomRect.y + screen.px(40),
    w: content.w,
    h: screen.px(34)
  }, 2, screen.px(10));
  ui.button(ctx, {
    id: "route:collection",
    rect: actions[0],
    label: "遗物 " + run.relics.length + " · 强化 " + run.enhancements.length,
    style: "ghost",
    size: screen.fz(11)
  });
  ui.button(ctx, {
    id: "route:abandon",
    rect: actions[1],
    label: "结束本局",
    style: "ghost",
    size: screen.fz(11)
  });
}

function onAction(action, state, app) {
  var id = action.id;

  if (id === "route:collection") {
    app.openInfo("collection");
    return true;
  }
  if (id === "route:theme") {
    app.openModal("themes", { readOnly: true });
    return true;
  }
  if (id === "route:abandon") {
    stateApi.abandonRun(state);
    app.commit();
    return true;
  }
  if (id.indexOf("route:node:") === 0) {
    var nodeId = id.slice("route:node:".length);
    var result = stateApi.travelTo(state, nodeId);
    if (!result.ok) {
      if (app.sound) app.sound("alert", 0.45);
      app.toast("现在还不能前往该节点");
      return true;
    }
    if (app.sound) app.sound("step", 0.7);
    app.commit();
    if (result.forcedEnd) app.toast("精神值跌破安全线，探索终止");
    return true;
  }
  return false;
}

module.exports = {
  render: render,
  onAction: onAction
};
