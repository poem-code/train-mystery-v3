/**
 * modals/event.js —— 随机事件（选择页 + 结果页）
 *
 * 两态共用一个模块：state.current.modal 为 event / eventResult。
 * 选项成本不足时置灰，避免「点了没反应」。
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");
var eventsApi = require("../data/events");

var P = draw.PALETTE;

function renderChoice(ctx, screen, state) {
  var s = screen.s;
  var run = state.run;
  var event = eventsApi.getById(run.eventId);
  var choiceCount = event ? event.choices.length : 2;
  // 高度按选项数自适应：标题区 + 正文 + 选项区，避免大片空白
  var panel = common.modalPanel(screen, screen.px(96) + choiceCount * screen.px(80) + screen.px(40));
  draw.panel(ctx, panel, {
    radius: Math.round(16 * s),
    fillTop: "#21303F",
    fillBottom: "#121E28",
    strokeColor: "rgba(155,127,212,0.5)"
  });

  var pad = screen.px(16);
  if (!event) {
    draw.text(ctx, "事件已结束", screen.width / 2, panel.y + panel.h / 2, {
      size: screen.fz(14),
      align: "center",
      color: P.inkDim
    });
    return;
  }

  draw.text(ctx, "随机事件", panel.x + pad, panel.y + pad, {
    size: screen.fz(10),
    color: P.purple,
    bold: true
  });
  draw.text(ctx, event.title, panel.x + pad, panel.y + pad + screen.px(16), {
    size: screen.fz(19),
    bold: true,
    color: P.ink
  });

  var bodyY = panel.y + pad + screen.px(46);
  var used = draw.text(ctx, event.text, panel.x + pad, bodyY, {
    size: screen.fz(12),
    color: P.inkDim,
    wrap: panel.w - pad * 2,
    lineHeight: screen.px(20)
  });

  var choiceTop = bodyY + used + screen.px(16);
  var count = event.choices.length;
  var cardH = screen.px(72);

  var i;
  for (i = 0; i < count; i += 1) {
    var choice = event.choices[i];
    var can = stateApi.canChooseEventOption(state, choice);
    var rect = {
      x: panel.x + pad,
      y: choiceTop + i * (cardH + screen.px(8)),
      w: panel.w - pad * 2,
      h: cardH
    };
    ui.card(ctx, {
      id: "event:option:" + i,
      rect: rect,
      title: choice.label,
      body: choice.hint || "",
      disabled: !can,
      highlight: can && i === 0,
      badge: can ? null : "资源不足",
      badgeColor: "rgba(216,87,74,0.18)",
      badgeTextColor: "#E88A7D",
      titleSize: screen.fz(14),
      bodySize: screen.fz(11)
    });
  }
}

function renderResult(ctx, screen, state) {
  var s = screen.s;
  var run = state.run;
  var panel = common.modalPanel(screen, screen.px(320));
  draw.panel(ctx, panel, {
    radius: Math.round(16 * s),
    fillTop: "#1F3242",
    fillBottom: "#101D26",
    strokeColor: "rgba(224,177,92,0.45)"
  });

  var pad = screen.px(18);
  draw.text(ctx, "结果", panel.x + pad, panel.y + pad, {
    size: screen.fz(11),
    color: P.gold,
    bold: true
  });
  var used = draw.text(ctx, run.eventResult || "你做出了选择。", panel.x + pad, panel.y + pad + screen.px(22), {
    size: screen.fz(13),
    color: P.ink,
    wrap: panel.w - pad * 2,
    lineHeight: screen.px(22)
  });

  var btn = {
    x: panel.x + pad,
    y: panel.y + pad + screen.px(24) + used + screen.px(16),
    w: panel.w - pad * 2,
    h: screen.px(44)
  };
  if (btn.y + btn.h > panel.y + panel.h - pad) {
    btn.y = panel.y + panel.h - pad - btn.h;
  }
  ui.button(ctx, {
    id: "event:continue",
    rect: btn,
    label: "继续前进",
    style: "primary",
    size: screen.fz(15)
  });
}

function render(ctx, screen, state) {
  if (state.current.modal === "eventResult") {
    renderResult(ctx, screen, state);
  } else {
    renderChoice(ctx, screen, state);
  }
}

function onAction(action, state, app) {
  var id = action.id;
  if (id.indexOf("event:option:") === 0) {
    var index = parseInt(id.slice("event:option:".length), 10);
    var result = stateApi.chooseEventOption(state, index);
    if (!result.ok) {
      if (app.sound) app.sound("alert", 0.5);
      app.toast(result.message || "无法选择");
      return true;
    }
    if (app.sound) app.sound("select", 0.8);
    app.commit();
    return true;
  }
  if (id === "event:continue") {
    stateApi.confirmEventResult(state);
    app.commit();
    return true;
  }
  return false;
}

module.exports = {
  render: render,
  onAction: onAction
};
