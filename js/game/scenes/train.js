/**
 * scenes/train.js —— 列车主城（局外）
 *
 * 这里是唯一可以「花资源、做长期成长、重新出发」的地方。
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");
var config = require("../config");
var text = require("../data/text");
var themesApi = require("../data/themes");

var P = draw.PALETTE;

function render(ctx, screen, state, animator) {
  var s = screen.s;
  // 主城按「下一局要走的车厢」上色：选完主题不用出发就能看到变化
  var tint = themesApi.getById(stateApi.selectedThemeId(state)) || themesApi.getById("rust");
  draw.backdrop(ctx, screen, null, { glow: tint.glow, beam: tint.beam });

  common.header(ctx, screen, text.train.title, "第 " + (state.progress.runsStarted + 1) + " 次出发准备", {
    id: "train:home",
    label: "首页"
  });

  var content = screen.content();
  var pad = screen.gap;

  // 资源条
  var resRect = { x: content.x, y: content.y, w: content.w, h: screen.px(42) };
  common.resourceBar(ctx, screen, state, resRect);

  var y = resRect.y + resRect.h + screen.px(26);

  // 主卡片：当前局状态 / 出发引导
  var heroRect = { x: content.x, y: y, w: content.w, h: screen.px(96) };
  draw.panel(ctx, heroRect, {
    radius: Math.round(14 * s),
    fillTop: "#1E3947",
    fillBottom: "#14262F",
    strokeColor: "rgba(79,192,176,0.35)"
  });
  var hasRun = state.run && state.run.active;
  draw.text(ctx, hasRun ? "探索进行中" : "裂隙已稳定", heroRect.x + screen.px(14), heroRect.y + screen.px(12), {
    size: screen.fz(15),
    bold: true,
    color: P.ink
  });
  var desc = hasRun
    ? "已走到第 " + (state.run.layer + 1) + " 层，路线还在等你选择。"
    : "一次完整探索约 5—8 分钟，途中会遇到战斗、事件、商店与营地。";
  draw.text(ctx, desc, heroRect.x + screen.px(14), heroRect.y + screen.px(36), {
    size: screen.fz(11),
    color: P.inkDim,
    wrap: heroRect.w - screen.px(28),
    lineHeight: screen.px(19)
  });
  draw.text(ctx, "最高纪录：第 " + Math.max(1, state.progress.bestLayer + 1) + " 层   通关 " + state.progress.bossClears + " 次", heroRect.x + screen.px(14), heroRect.y + heroRect.h - screen.px(22), {
    size: screen.fz(10),
    color: P.gold
  });

  y = heroRect.y + heroRect.h + screen.px(14);

  // 主按钮：出发 / 继续。主题名放进副标题，让「这局走哪节车厢」一眼可见。
  var themeNow = themesApi.getById(stateApi.selectedThemeId(state));
  var primary = { x: content.x, y: y, w: content.w, h: screen.px(56) };
  ui.button(ctx, {
    id: hasRun ? "train:continue" : "train:depart",
    rect: primary,
    label: hasRun ? "继续探索" : text.train.depart,
    sub: hasRun ? "回到路线图" : "精神 -" + config.sanityPerRun + " · " + (themeNow ? themeNow.name : "车厢"),
    style: "primary",
    size: screen.fz(18)
  });

  y = primary.y + primary.h + screen.px(14);

  // 六个功能格（2 行 × 3 列）：局外成长与长线目标都在这里
  var gridRect = { x: content.x, y: y, w: content.w, h: screen.px(114) };
  var rows = screen.col(gridRect, 2, screen.px(8));
  var top = screen.row(rows[0], 3, screen.px(8));
  var bottom = screen.row(rows[1], 3, screen.px(8));
  var cells = [top[0], top[1], top[2], bottom[0], bottom[1], bottom[2]];

  var cooldown = stateApi.sanityCooldownLeft(state, Date.now());
  var foodUsed = state.meta.lastFreeFoodDate === stateApi.formatDateKey(Date.now());
  var upgrades = state.progress.trainUpgrades;
  var totalLevel = upgrades.diner + upgrades.medbay + upgrades.engine + upgrades.cargo + upgrades.observatory;
  var codex = stateApi.codexSummary(state);
  var dailyInfo = stateApi.dailyInfo(state, Date.now());

  ui.button(ctx, {
    id: "train:upgrade",
    rect: cells[0],
    label: "列车升级",
    sub: "总 Lv." + totalLevel,
    style: "ghost",
    size: screen.fz(12)
  });
  ui.button(ctx, {
    id: "train:shop",
    rect: cells[1],
    label: "商店",
    sub: "补给",
    style: "ghost",
    size: screen.fz(12)
  });
  ui.button(ctx, {
    id: "train:supply",
    rect: cells[2],
    label: "补给",
    sub: foodUsed ? "已领取" : "今日免费",
    style: "ghost",
    disabled: foodUsed,
    size: screen.fz(12)
  });
  ui.button(ctx, {
    id: "train:mental",
    rect: cells[3],
    label: "精神",
    sub: cooldown > 0 ? Math.ceil(cooldown / 1000) + "s" : "可恢复",
    style: "ghost",
    disabled: cooldown > 0,
    size: screen.fz(12)
  });
  ui.button(ctx, {
    id: "train:codex",
    rect: cells[4],
    label: "图鉴",
    sub: codex.percent + "%",
    style: "ghost",
    size: screen.fz(12)
  });
  ui.button(ctx, {
    id: "train:daily",
    rect: cells[5],
    label: "每日挑战",
    sub: dailyInfo.unlocked ? (dailyInfo.playedToday ? "今日已开" : "限时限制") : "需观景台",
    style: "ghost",
    disabled: false,
    size: screen.fz(12)
  });

  y = rows[1].y + rows[1].h + screen.px(14);

  // 日志
  var logRect = {
    x: content.x,
    y: y,
    w: content.w,
    h: Math.min(screen.px(120), content.y + content.h - y)
  };
  if (logRect.h > screen.px(50)) {
    common.sectionTitle(ctx, screen, "列车日志", content.x, y, content.w);
    logRect.y = y + screen.px(24);
    logRect.h -= screen.px(24);
    common.logPanel(ctx, screen, state, logRect);
  }
}

function onAction(action, state, app) {
  var id = action.id;

  if (id === "train:home") {
    app.go("home");
    return true;
  }
  if (id === "train:continue") {
    app.go("route");
    return true;
  }
  if (id === "train:depart") {
    // 先选车厢再出发：主题是「这一局接受什么规矩」的决定，
    // 放在开局前一步，比塞进功能区更容易被看见。
    // 精神门槛仍然不设：startRun 里会把精神保底到 40 再扣本局成本。
    app.openModal("themes", { from: "train" });
    return true;
  }
  if (id === "train:upgrade") {
    app.openModal("trainUpgrade");
    return true;
  }
  if (id === "train:codex") {
    app.openModal("codex", { tab: "enemies", page: 0 });
    return true;
  }
  if (id === "train:daily") {
    app.openModal("daily");
    return true;
  }
  if (id === "train:shop") {
    app.openModal("shop");
    return true;
  }
  if (id === "train:supply") {
    var r = stateApi.claimFreeFood(state, app.now());
    if (app.sound) app.sound(r.ok ? "coin" : "alert", r.ok ? 0.75 : 0.45);
    app.toast(r.message);
    app.commit();
    return true;
  }
  if (id === "train:mental") {
    var m = stateApi.restoreSanity(state, app.now());
    if (app.sound) app.sound(m.ok ? "heal" : "alert", m.ok ? 0.75 : 0.45);
    app.toast(m.message);
    app.commit();
    return true;
  }
  return false;
}

module.exports = {
  render: render,
  onAction: onAction
};
