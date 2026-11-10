/**
 * data/nodes.js —— 路线节点类型定义（视觉与文案的唯一来源）
 */

var NODE_TYPES = {
  battle: {
    id: "battle",
    label: "战斗",
    full: "普通战斗",
    color: "#C08A5E",
    icon: "⚔",
    glyph: "sword"
  },
  elite: {
    id: "elite",
    label: "精英",
    full: "精英战斗",
    color: "#D8574A",
    icon: "✦",
    glyph: "skull"
  },
  event: {
    id: "event",
    label: "事件",
    full: "随机事件",
    color: "#9B7FD4",
    icon: "?",
    glyph: "question"
  },
  camp: {
    id: "camp",
    label: "营地",
    full: "营地",
    color: "#5FB87A",
    icon: "▲",
    glyph: "tent"
  },
  shop: {
    id: "shop",
    label: "商店",
    full: "补给商店",
    color: "#E0B15C",
    icon: "◈",
    glyph: "coin"
  },
  chest: {
    id: "chest",
    label: "宝箱",
    full: "遗物宝箱",
    color: "#4FC0B0",
    icon: "▣",
    glyph: "box"
  },
  boss: {
    id: "boss",
    label: "Boss",
    // Boss 是随机池，节点上不能写死某一个名字
    full: "关底首领",
    color: "#FF6B5A",
    icon: "☠",
    glyph: "boss"
  }
};

/** 每层节点类型权重（层数从 0 开始） */
function weightsForLayer(layer) {
  if (layer <= 0) return { battle: 1 };
  if (layer === 1) return { battle: 5, event: 3, chest: 2 };
  if (layer === 2) return { battle: 5, event: 2, camp: 2, shop: 1 };
  if (layer === 3) return { battle: 4, elite: 2, event: 2, camp: 1, chest: 1 };
  if (layer === 4) return { battle: 4, event: 3, shop: 1, camp: 1, elite: 1 };
  if (layer === 5) return { battle: 4, elite: 2, chest: 2, event: 1 };
  if (layer === 6) return { battle: 3, camp: 2, shop: 1, elite: 1, event: 1 };
  return { battle: 4, elite: 3, event: 1, camp: 1 };
}

module.exports = {
  NODE_TYPES: NODE_TYPES,
  weightsForLayer: weightsForLayer
};
