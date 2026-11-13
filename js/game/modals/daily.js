/**
 * modals/daily.js —— 每日挑战入口
 *
 * 同一天全服同一套路线 + 同一组限制条件（日期做种子，不需要服务端）。
 * 奖励独立结算，且开局会快照钱包、结束时还原——挑战不能成为刷资源的通道。
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");
var config = require("../config");
var text = require("../data/text");

var P = draw.PALETTE;

function render(ctx, screen, state) {
  var s = screen.s;
  var info = stateApi.dailyInfo(state, Date.now());
  var panel = common.modalPanel(screen, screen.px(480));
  draw.panel(ctx, panel, {
    radius: Math.round(16 * s),
    fillTop: "#1F3140",
    fillBottom: "#101C25",
    strokeColor: "rgba(155,127,212,0.45)"
  });

  var pad = screen.px(16);
  var streakText = info.streak > 0 ? "连续 " + info.streak + " 天" : "尚未开始";
  var y = common.modalTitle(ctx, screen, panel, "每日挑战",
    info.dateKey + " · " + streakText + " · 完成 " + info.clears + " 次");

  if (!info.unlocked) {
    draw.text(ctx, "观景台升到 Lv." + config.daily.unlockLevel + " 后开放。\n观景台在「列车升级」里，用日常探索攒下的以太就能升。", panel.x + pad, y, {
      size: screen.fz(12),
      color: P.inkDim,
      wrap: panel.w - pad * 2,
      lineHeight: screen.px(20)
    });
    ui.button(ctx, {
      id: "daily:close",
      rect: { x: panel.x + pad, y: panel.y + panel.h - pad - screen.px(42), w: panel.w - pad * 2, h: screen.px(42) },
      label: "返回",
      style: "ghost",
      size: screen.fz(14)
    });
    return;
  }

  draw.text(ctx, "今日限制条件", panel.x + pad, y, {
    size: screen.fz(11),
    color: P.gold,
    bold: true
  });
  y += screen.px(20);

  var rows = screen.col({
    x: panel.x + pad,
    y: y,
    w: panel.w - pad * 2,
    h: screen.px(168)
  }, 3, screen.px(8));

  var i;
  for (i = 0; i < info.modifiers.length; i += 1) {
    var m = info.modifiers[i];
    ui.card(ctx, {
      rect: rows[i],
      title: m.name,
      body: m.desc,
      titleSize: screen.fz(13),
      bodySize: screen.fz(10),
      strokeColor: "rgba(155,127,212,0.35)"
    });
  }

  y = rows[2].y + rows[2].h + screen.px(12);
  var obs = state.progress.trainUpgrades.observatory || 0;
  var baseReward = Math.round((config.daily.baseReward + 8 * config.daily.rewardPerLayer)
    * (1 + obs * config.daily.rewardBonusPerLevel));
  draw.text(ctx, "通关奖励约 " + baseReward + " 以太（观景台 Lv." + obs + " 加成）· 不消耗你的以太与道具", panel.x + pad, y, {
    size: screen.fz(10),
    color: P.inkFaint,
    wrap: panel.w - pad * 2,
    lineHeight: screen.px(15)
  });

  var runActive = state.run && state.run.active;
  ui.button(ctx, {
    id: "daily:start",
    rect: {
      x: panel.x + pad,
      y: panel.y + panel.h - pad - screen.px(96),
      w: panel.w - pad * 2,
      h: screen.px(46)
    },
    label: runActive ? "先结束当前探索" : "开始今日挑战",
    sub: runActive ? "回主城继续或放弃当前局" : "同一套路线，全服一致",
    style: "primary",
    disabled: runActive,
    size: screen.fz(15)
  });

  // 底部并排两枚：分享与返回同级。分享放在这里而不是标题旁，
  // 是因为它是「准备开打之前」的自然动作（拉个人一起比），不是随时可点的工具。
  var foot = screen.row({
    x: panel.x + pad,
    y: panel.y + panel.h - pad - screen.px(42),
    w: panel.w - pad * 2,
    h: screen.px(42)
  }, 2, screen.px(8));
  ui.button(ctx, {
    id: "daily:share",
    rect: foot[0],
    label: "分享挑战",
    style: "ghost",
    size: screen.fz(13)
  });
  ui.button(ctx, {
    id: "daily:close",
    rect: foot[1],
    label: "返回",
    style: "ghost",
    size: screen.fz(13)
  });
}

function onAction(action, state, app) {
  var id = action.id;

  if (id === "daily:close") {
    state.current.modal = null;
    state.current.modalData = null;
    app.commit();
    return true;
  }

  if (id === "daily:share") {
    app.share({ title: text.share.daily, imageUrl: text.share.imageDaily });
    return true;
  }

  if (id === "daily:start") {
    if (state.run && state.run.active) {
      app.toast("先结束当前探索");
      return true;
    }
    var result = stateApi.startDaily(state, app.now());
    if (!result.ok) {
      if (app.sound) app.sound("alert", 0.5);
      app.toast(result.message);
      return true;
    }
    if (app.sound) app.sound("step", 0.85);
    app.commit();
    app.go("route");
    app.toast("每日挑战开始，限制条件已生效");
    return true;
  }

  return false;
}

module.exports = {
  render: render,
  onAction: onAction
};
