/**
 * screen.js —— 逻辑分辨率 / 安全区 / 栅格（唯一坐标来源）
 *
 * 铁律：
 * 1. 所有绘制坐标都是「逻辑像素」（= screenWidth / screenHeight），不是 canvas.width。
 * 2. 场景层禁止写死坐标与列宽，只能从 screen.rect() / screen.row() / screen.col() 取。
 * 3. 刘海、底部指示条通过 safeArea 让位；极小屏通过 s 缩放兜底。
 */

var DESIGN_WIDTH = 375;

function num(value, fallback) {
  var n = typeof value === "number" ? value : Number(value);
  return isFinite(n) && n > 0 ? n : fallback;
}

function clamp(value, min, max) {
  if (typeof value !== "number" || !isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/** 一行/一列等分，gap 为间隔 */
function split(x, y, w, h, count, gap, direction) {
  var n = Math.max(1, count | 0);
  var g = typeof gap === "number" ? gap : 8;
  var out = [];
  var i;
  var cell;
  if (direction === "v") {
    cell = (h - g * (n - 1)) / n;
    for (i = 0; i < n; i += 1) out.push({ x: x, y: y + i * (cell + g), w: w, h: cell });
    return out;
  }
  cell = (w - g * (n - 1)) / n;
  for (i = 0; i < n; i += 1) out.push({ x: x + i * (cell + g), y: y, w: cell, h: h });
  return out;
}

function createScreen(systemInfo) {
  var info = systemInfo || {};
  var width = Math.round(num(info.screenWidth || info.windowWidth, 375));
  var height = Math.round(num(info.screenHeight || info.windowHeight, 667));
  width = Math.max(240, width);
  height = Math.max(400, height);

  var safe = info.safeArea || null;
  var safeTop = 0;
  var safeBottom = 0;
  if (safe) {
    safeTop = clamp(Math.round(num(safe.top, 0)), 0, 90);
    safeBottom = clamp(Math.round(height - num(safe.bottom, height)), 0, 60);
  }
  // 抖音竖屏顶部一般有 20~44 的状态栏占位，取一个下限避免标题被裁
  safeTop = Math.max(safeTop, Math.round(height * 0.03));

  // 以 375 宽为基准做等比缩放，超宽/超窄屏都不会把按钮挤扁
  var s = clamp(width / DESIGN_WIDTH, 0.86, 1.34);

  var pad = Math.round(16 * s);
  var gap = Math.round(10 * s);
  var headerTop = safeTop + Math.round(6 * s);
  var headerH = Math.round(64 * s);

  var screen = {
    width: width,
    height: height,
    dpr: num(info.pixelRatio, 2),
    safeTop: safeTop,
    safeBottom: safeBottom,
    s: s,
    pad: pad,
    gap: gap,
    /** 字号：fz(16) → 基准 16 号在 375 宽下的实际像素 */
    fz: function (base) {
      return Math.round(base * s);
    },
    /** 间距缩放 */
    px: function (base) {
      return Math.round(base * s);
    },
    rect: function (x, y, w, h) {
      return { x: x, y: y, w: w, h: h };
    },
    /** 整屏内容区（已避开安全区） */
    content: function () {
      return {
        x: pad,
        y: headerTop + headerH,
        w: width - pad * 2,
        h: height - safeBottom - (headerTop + headerH) - pad
      };
    },
    header: function () {
      return { x: pad, y: headerTop, w: width - pad * 2, h: headerH };
    },
    /** 底部主操作区（高 h，贴安全区） */
    bottom: function (h) {
      var bh = h || Math.round(76 * s);
      return {
        x: pad,
        y: height - safeBottom - bh - Math.round(8 * s),
        w: width - pad * 2,
        h: bh
      };
    },
    row: function (rect, count, g) {
      return split(rect.x, rect.y, rect.w, rect.h, count, g === undefined ? gap : g, "h");
    },
    col: function (rect, count, g) {
      return split(rect.x, rect.y, rect.w, rect.h, count, g === undefined ? gap : g, "v");
    },
    /** 内缩 */
    inset: function (rect, d) {
      var dd = d === undefined ? gap : d;
      return { x: rect.x + dd, y: rect.y + dd, w: rect.w - dd * 2, h: rect.h - dd * 2 };
    },
    split: split
  };

  return screen;
}

module.exports = {
  createScreen: createScreen,
  split: split
};
