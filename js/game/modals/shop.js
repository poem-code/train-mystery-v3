/**
 * modals/shop.js —— 商店（列车常驻 / 路线商店共用）
 *
 * 路线商店会吃「补给铭牌」的首单 7 折，折扣只生效一次。
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");
var itemsApi = require("../data/items");

var P = draw.PALETTE;

function render(ctx, screen, state) {
  var s = screen.s;
  var panel = common.modalPanel(screen, screen.px(400));
  draw.panel(ctx, panel, {
    radius: Math.round(16 * s),
    fillTop: "#20303C",
    fillBottom: "#111E27",
    strokeColor: "rgba(224,177,92,0.45)"
  });

  var discount = state.run && state.run.active && typeof state.run.effects.firstShopDiscount === "number";
  var y = common.modalTitle(ctx, screen, panel, "补给商店",
    discount ? "首单 7 折生效中 · 以太 " + Math.round(state.player.ether) + " / 金币 " + Math.round(state.player.gold)
      : "以太 " + Math.round(state.player.ether) + " / 金币 " + Math.round(state.player.gold));

  var pad = screen.px(16);
  var rows = screen.col({
    x: panel.x + pad,
    y: y + screen.px(4),
    w: panel.w - pad * 2,
    h: screen.px(236)
  }, itemsApi.SHOP_ITEMS.length, screen.px(8));

  var i;
  for (i = 0; i < itemsApi.SHOP_ITEMS.length; i += 1) {
    var shopItem = itemsApi.SHOP_ITEMS[i];
    var def = itemsApi.ITEMS[shopItem.itemId];
    var price = stateApi.shopPrice(state, shopItem);
    var currency = shopItem.costType === "gold" ? "金币" : "以太";
    var enough = shopItem.costType === "gold"
      ? state.player.gold >= price
      : state.player.ether >= price;
    var row = rows[i];
    ui.card(ctx, {
      id: "shop:buy:" + shopItem.id,
      rect: row,
      title: def.name + "  ×" + (state.player.inventory[shopItem.itemId] || 0),
      body: def.desc,
      badge: price + " " + currency,
      badgeColor: enough ? "rgba(224,177,92,0.18)" : "rgba(216,87,74,0.18)",
      badgeTextColor: enough ? P.gold : "#E88A7D",
      disabled: !enough,
      titleSize: screen.fz(14),
      bodySize: screen.fz(11)
    });
  }

  var closeBtn = {
    x: panel.x + pad,
    y: panel.y + panel.h - pad - screen.px(44),
    w: panel.w - pad * 2,
    h: screen.px(44)
  };
  ui.button(ctx, {
    id: "shop:close",
    rect: closeBtn,
    label: "离开商店",
    style: "ghost",
    size: screen.fz(14)
  });
}

function onAction(action, state, app) {
  if (action.id.indexOf("shop:buy:") === 0) {
    var id = action.id.slice("shop:buy:".length);
    var result = stateApi.buyItem(state, id);
    if (app.sound) app.sound(result.ok ? "coin" : "alert", result.ok ? 0.8 : 0.5);
    app.toast(result.message || (result.ok ? "购买成功" : "购买失败"));
    app.commit();
    return true;
  }
  if (action.id === "shop:close") {
    state.current.modal = null;
    app.commit();
    return true;
  }
  return false;
}

module.exports = {
  render: render,
  onAction: onAction
};
