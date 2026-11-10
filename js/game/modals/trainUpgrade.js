/**
 * modals/trainUpgrade.js —— 列车长期升级（5 个模块）
 *
 * 局外成长的意义不是「变强多少」，而是「有得选」：
 * 餐车/医务室/动力室是数值线，货舱/观景台是玩法解锁线。
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");
var config = require("../config");

var P = draw.PALETTE;

var KEYS = ["diner", "medbay", "engine", "cargo", "observatory"];

/** 当前等级的实际效果（写清楚，别让玩家算） */
function effectText(key, level) {
  if (key === "diner") return "每日补给 +" + level * config.dailyFoodByDiner + " 饱食";
  if (key === "medbay") return "药剂 +" + level * config.medbayHealBonus + " 治疗";
  if (key === "engine") return "结算以太 +" + Math.round(level * config.engineEtherBonus * 100) + "%";
  if (key === "cargo") {
    var grants = config.cargoGrants[level] || {};
    var parts = [];
    if (grants.potion) parts.push("药×" + grants.potion);
    if (grants.portableFood) parts.push("口粮×" + grants.portableFood);
    if (grants.retryCard) parts.push("重战卡×" + grants.retryCard);
    if (grants.executeCard) parts.push("秒杀卡×" + grants.executeCard);
    return parts.length ? "开局保底：" + parts.join(" ") : "开局无额外道具";
  }
  if (key === "observatory") {
    if (level < config.daily.unlockLevel) return "未解锁每日挑战";
    return "每日挑战 +" + Math.round(level * config.daily.rewardBonusPerLevel * 100) + "% 奖励";
  }
  return "";
}

function render(ctx, screen, state) {
  var s = screen.s;
  var panel = common.modalPanel(screen, screen.px(530));
  draw.panel(ctx, panel, {
    radius: Math.round(16 * s),
    fillTop: "#1F3140",
    fillBottom: "#101C25",
    strokeColor: "rgba(224,177,92,0.42)"
  });

  var pad = screen.px(16);
  var y = common.modalTitle(ctx, screen, panel, "列车升级",
    "以太 " + Math.round(state.player.ether) + " · 金币 " + Math.round(state.player.gold) + " · 局外永久生效");

  var listH = panel.h - (y - panel.y) - screen.px(70);
  var rows = screen.col({
    x: panel.x + pad,
    y: y + screen.px(4),
    w: panel.w - pad * 2,
    h: listH
  }, KEYS.length, screen.px(7));

  var i;
  for (i = 0; i < KEYS.length; i += 1) {
    var key = KEYS[i];
    var def = config.trainUpgrades[key];
    var level = state.progress.trainUpgrades[key] || 0;
    var cost = stateApi.upgradeCost(state, key);
    var maxed = !cost;
    var enough = cost && state.player.ether >= cost.ether && state.player.gold >= cost.gold;
    var locked = key === "observatory" && level === 0;

    ui.card(ctx, {
      id: "upgrade:" + key,
      rect: rows[i],
      title: def.name + "  Lv." + level + (maxed ? " · 满级" : "") + (locked ? " · 未解锁挑战" : ""),
      body: effectText(key, level),
      badge: maxed ? "MAX" : cost.ether + " 以太",
      badgeColor: maxed ? "rgba(79,192,176,0.16)" : enough ? "rgba(224,177,92,0.18)" : "rgba(216,87,74,0.16)",
      badgeTextColor: maxed ? P.teal : enough ? P.gold : "#E88A7D",
      disabled: maxed || !enough,
      titleSize: screen.fz(12),
      bodySize: screen.fz(9)
    });
  }

  ui.button(ctx, {
    id: "upgrade:close",
    rect: {
      x: panel.x + pad,
      y: panel.y + panel.h - pad - screen.px(42),
      w: panel.w - pad * 2,
      h: screen.px(42)
    },
    label: "返回",
    style: "ghost",
    size: screen.fz(14)
  });
}

function onAction(action, state, app) {
  if (action.id === "upgrade:close") {
    state.current.modal = null;
    app.commit();
    return true;
  }
  if (action.id.indexOf("upgrade:") === 0) {
    var key = action.id.slice("upgrade:".length);
    var result = stateApi.upgradeTrain(state, key);
    if (app.sound) app.sound(result.ok ? "coin" : "alert", result.ok ? 0.8 : 0.45);
    if (result.ok && key === "observatory" && state.progress.trainUpgrades.observatory === 1) {
      app.toast("观景台落成，每日挑战已开放");
    } else {
      app.toast(result.message);
    }
    app.commit();
    return true;
  }
  return false;
}

module.exports = {
  render: render,
  onAction: onAction
};
