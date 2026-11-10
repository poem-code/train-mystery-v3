/**
 * data/items.js —— 道具与商店
 *
 * 道具 key 必须与 player.inventory 的键名一致。
 */

var ITEMS = {
  portableFood: {
    id: "portableFood",
    name: "便携食物",
    desc: "恢复 50 点饱食度。",
    useScene: "any",
    color: "#5FB87A"
  },
  potion: {
    id: "potion",
    name: "回血药剂",
    desc: "战斗中恢复 30 点生命值。",
    useScene: "battle",
    color: "#D8574A"
  },
  retryCard: {
    id: "retryCard",
    name: "重战卡",
    desc: "战败时原地满血复活。",
    useScene: "battle",
    color: "#E0B15C"
  },
  executeCard: {
    id: "executeCard",
    name: "秒杀卡",
    desc: "普通敌人直接击破，Boss 造成半血重创。",
    useScene: "battle",
    color: "#9B7FD4"
  }
};

/** 商店商品（列车常驻 + 路线商店） */
var SHOP_ITEMS = [
  { id: "portableFood", itemId: "portableFood", costType: "ether", cost: 18, amount: 1 },
  { id: "potion", itemId: "potion", costType: "ether", cost: 24, amount: 1 },
  { id: "retryCard", itemId: "retryCard", costType: "gold", cost: 3, amount: 1 },
  { id: "executeCard", itemId: "executeCard", costType: "gold", cost: 5, amount: 1 }
];

module.exports = {
  ITEMS: ITEMS,
  SHOP_ITEMS: SHOP_ITEMS
};
