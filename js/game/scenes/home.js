/**
 * scenes/home.js —— 封面页
 *
 * 只做三件事：立住调性、给出唯一主动作、暴露说明与设置。
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var text = require("../data/text");

var P = draw.PALETTE;

function render(ctx, screen, state, animator) {
  var s = screen.s;
  draw.backdrop(ctx, screen);

  var W = screen.width;
  var H = screen.height;
  var top = screen.safeTop + H * 0.09;

  // 标题
  draw.text(ctx, text.gameTitle, W / 2, top, {
    size: screen.fz(38),
    bold: true,
    align: "center",
    color: P.ink,
    shadow: "rgba(224,177,92,0.45)",
    shadowBlur: 18
  });
  draw.text(ctx, text.tagline, W / 2, top + screen.px(52), {
    size: screen.fz(13),
    align: "center",
    color: P.gold
  });
  draw.text(ctx, text.slogan, W / 2, top + screen.px(74), {
    size: screen.fz(11),
    align: "center",
    color: P.inkFaint
  });

  // 中段装饰：一条铁轨 + 列车剪影
  var railY = top + H * 0.30;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(screen.pad, railY);
  ctx.lineTo(W - screen.pad, railY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(screen.pad, railY + screen.px(16));
  ctx.lineTo(W - screen.pad, railY + screen.px(16));
  ctx.stroke();
  var x;
  for (x = screen.pad; x < W - screen.pad; x += screen.px(16)) {
    ctx.beginPath();
    ctx.moveTo(x, railY);
    ctx.lineTo(x, railY + screen.px(16));
    ctx.stroke();
  }
  ctx.restore();

  draw.figure(ctx, W / 2, railY - screen.px(26), screen.px(74), "hero", P.teal);

  // 底部按钮组
  var bottom = screen.bottom(screen.px(150));
  var hasRun = state.run && state.run.active;
  var buttons = screen.col(bottom, hasRun ? 4 : 3, Math.round(10 * s));

  var idx = 0;
  if (hasRun) {
    ui.button(ctx, {
      id: "home:continue",
      rect: buttons[idx],
      label: "继续本局",
      sub: "第 " + (state.run.layer + 1) + " 层 · " + state.run.nodesVisited + " 个节点",
      style: "primary",
      size: screen.fz(17)
    });
    idx += 1;
  }
  ui.button(ctx, {
    id: "home:enter",
    rect: buttons[idx],
    label: hasRun ? "进入列车" : text.home.start,
    style: hasRun ? "ghost" : "primary",
    size: screen.fz(17)
  });
  idx += 1;

  var pair = screen.row(buttons[idx], 2, Math.round(10 * s));
  ui.button(ctx, {
    id: "home:guide",
    rect: pair[0],
    label: "玩法说明",
    style: "ghost",
    size: screen.fz(13)
  });
  ui.button(ctx, {
    id: "home:settings",
    rect: pair[1],
    label: "设置",
    style: "ghost",
    size: screen.fz(13)
  });

  draw.text(ctx, "v3.0 · 单机 · 无需登录", W / 2, H - screen.safeBottom - screen.px(22), {
    size: screen.fz(10),
    align: "center",
    color: P.inkFaint
  });
}

function onAction(action, state, app) {
  if (action.id === "home:enter") {
    app.go("train");
    return true;
  }
  if (action.id === "home:continue") {
    app.go("route");
    return true;
  }
  if (action.id === "home:guide") {
    app.openInfo("guide");
    return true;
  }
  if (action.id === "home:settings") {
    app.openModal("settings");
    return true;
  }
  return false;
}

module.exports = {
  render: render,
  onAction: onAction
};
