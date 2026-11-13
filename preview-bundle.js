/* 自动生成，请勿手改。源：js/ —— 由 tools/build-bundle.js 打包 */
(function(global){
  var defs = {};
  var cache = {};
  function define(id, fn) { defs[id] = fn; }
  function normalize(id) {
    var parts = id.split('/'); var out = [];
    for (var i = 0; i < parts.length; i += 1) {
      var p = parts[i];
      if (p === '.' || p === '') continue;
      if (p === '..') out.pop(); else out.push(p);
    }
    return out.join('/');
  }
  function resolve(from, request) {
    var base = from.split('/').slice(0, -1).join('/');
    var id = request.charAt(0) === '.' ? (base ? base + '/' + request : request) : request;
    id = normalize(id);
    if (!/\.js$/.test(id)) id += '.js';
    return id;
  }
  function load(id) {
    if (cache[id]) return cache[id].exports;
    var mod = { exports: {} };
    if (!defs[id]) throw new Error('模块未找到: ' + id);
    cache[id] = mod;
    defs[id](mod, mod.exports, function(request){ return load(resolve(id, request)); });
    return mod.exports;
  }
  global.__TM_LOAD__ = load;
  global.__TM_ENTRY__ = "js/main.js";
define("js/core/draw.js", function(module, exports, require) {
/**
 * draw.js —— Canvas 绘图原语（无业务、无布局）
 *
 * 兼容性约束：只用 Canvas 2D 基础 API，不用 roundRect / filter / letterSpacing
 * 等新特性（抖音低版本 Android 容器不保证支持）。
 */

var PALETTE = {
  bg0: "#0B1520",
  bg1: "#122431",
  bg2: "#1A3241",
  line: "#2A4A5C",
  ink: "#E8E2D2",
  inkDim: "#9FB0BA",
  inkFaint: "#6C8492",
  gold: "#E0B15C",
  goldDim: "#8C6E38",
  teal: "#4FC0B0",
  red: "#D8574A",
  green: "#5FB87A",
  purple: "#9B7FD4",
  white: "#FFFFFF"
};

function rr(ctx, x, y, w, h, r) {
  var rad = Math.min(r === undefined ? 10 : r, Math.min(w, h) / 2);
  if (rad <= 0.5) {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arcTo(x + w, y, x + w, y + rad, rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  ctx.lineTo(x + rad, y + h);
  ctx.arcTo(x, y + h, x, y + h - rad, rad);
  ctx.lineTo(x, y + rad);
  ctx.arcTo(x, y, x + rad, y, rad);
  ctx.closePath();
}

/** 竖直渐变填充的圆角面板 */
function panel(ctx, rect, opts) {
  var o = opts || {};
  var r = o.radius === undefined ? 12 : o.radius;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  rr(ctx, rect.x, rect.y, rect.w, rect.h, r);
  if (o.gradient !== false && typeof ctx.createLinearGradient === "function") {
    var g = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    g.addColorStop(0, o.fillTop || PALETTE.bg2);
    g.addColorStop(1, o.fillBottom || PALETTE.bg1);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = o.fill || PALETTE.bg1;
  }
  ctx.fill();
  if (o.stroke !== false) {
    ctx.lineWidth = o.lineWidth || 1;
    ctx.strokeStyle = o.strokeColor || PALETTE.line;
    ctx.stroke();
  }
  ctx.restore();
}

function fillRR(ctx, rect, color, radius) {
  ctx.save();
  rr(ctx, rect.x, rect.y, rect.w, rect.h, radius === undefined ? 10 : radius);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function strokeRR(ctx, rect, color, radius, width) {
  ctx.save();
  rr(ctx, rect.x, rect.y, rect.w, rect.h, radius === undefined ? 10 : radius);
  ctx.lineWidth = width || 1;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.restore();
}

/**
 * 文字。opts: { size, color, bold, align, baseline, maxWidth, alpha, lineHeight, wrap }
 * 返回实际占用高度，便于纵向排版。
 */
function text(ctx, str, x, y, opts) {
  var o = opts || {};
  var size = o.size || 14;
  var lineHeight = o.lineHeight || Math.round(size * 1.5);
  ctx.save();
  ctx.font = (o.bold ? "bold " : "") + size + "px " + (o.font || "sans-serif");
  ctx.fillStyle = o.color || PALETTE.ink;
  ctx.textAlign = o.align || "left";
  ctx.textBaseline = o.baseline || "top";
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  if (o.shadow) {
    ctx.shadowColor = o.shadow;
    ctx.shadowBlur = o.shadowBlur || 6;
  }

  if (!o.wrap) {
    if (o.maxWidth) {
      ctx.fillText(String(str), x, y, o.maxWidth);
    } else {
      ctx.fillText(String(str), x, y);
    }
    ctx.restore();
    return lineHeight;
  }

  var lines = wrapText(ctx, String(str), o.wrap);
  var i;
  for (i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], x, y + i * lineHeight, o.wrap);
  }
  ctx.restore();
  return lines.length * lineHeight;
}

function wrapText(ctx, str, maxWidth) {
  var out = [];
  var current = "";
  var i;
  var ch;
  for (i = 0; i < str.length; i += 1) {
    ch = str.charAt(i);
    if (ch === "\n") {
      out.push(current);
      current = "";
      continue;
    }
    if (ctx.measureText(current + ch).width > maxWidth && current.length) {
      out.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  if (current.length) out.push(current);
  return out;
}

function measure(ctx, str, size, bold) {
  ctx.save();
  ctx.font = (bold ? "bold " : "") + (size || 14) + "px sans-serif";
  var w = ctx.measureText(String(str)).width;
  ctx.restore();
  return w;
}

/** 进度条：track + fill，可选数值文字 */
function bar(ctx, rect, ratio, opts) {
  var o = opts || {};
  var r = Math.min(o.radius === undefined ? rect.h / 2 : o.radius, rect.h / 2);
  var p = Math.max(0, Math.min(1, isFinite(ratio) ? ratio : 0));
  fillRR(ctx, rect, o.track || "rgba(255,255,255,0.10)", r);
  if (p > 0.001) {
    var fillRect = { x: rect.x, y: rect.y, w: Math.max(rect.h * 0.9, rect.w * p), h: rect.h };
    ctx.save();
    rr(ctx, rect.x, rect.y, rect.w, rect.h, r);
    ctx.clip();
    if (typeof ctx.createLinearGradient === "function") {
      var g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y);
      g.addColorStop(0, o.colorFrom || o.color || PALETTE.gold);
      g.addColorStop(1, o.colorTo || o.color || PALETTE.gold);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = o.color || PALETTE.gold;
    }
    ctx.fillRect(fillRect.x, fillRect.y, fillRect.w, fillRect.h);
    ctx.restore();
  }
  if (o.label) {
    text(ctx, o.label, rect.x + rect.w / 2, rect.y + rect.h / 2 - (o.size || 10) / 2, {
      size: o.size || 10,
      color: o.labelColor || PALETTE.ink,
      align: "center",
      bold: true
    });
  }
}

/* ------------------------------------------------------------------
 * 剪影原型（纯矢量，不依赖图集）
 *
 * 19 个敌人如果只靠颜色区分，玩家在战斗里根本记不住「这是谁」。
 * 所以按行为特性给不同轮廓：形先于色，远看也能认出来。
 * figure(ctx, cx, cy, size, kind, color, variant)
 * ------------------------------------------------------------------ */

/** 地面投影：没有影子，任何剪影都像浮在空中 */
/**
 * 落地投影。
 * lift = 身体离地高度（px），影子跟着缩小、变淡——
 * 少了这一步，上下浮动的角色看起来像「贴纸在抖」而不是「站在地上呼吸」。
 */
function figShadow(ctx, cx, cy, size, lift) {
  var k = 1;
  if (lift > 0) {
    k = 1 - lift / (size * 0.75);
    if (k < 0.5) k = 0.5;
  }
  ctx.save();
  ctx.globalAlpha = 0.30 * k;
  ctx.fillStyle = "#04090D";
  ctx.translate(cx, cy + size * 0.44);
  ctx.scale(1, 0.22);
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.32 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function figFill(ctx, color, alpha) {
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha === undefined ? 0.94 : alpha;
}

function figRR(ctx, x, y, w, h, r) {
  rr(ctx, x, y, w, h, r);
  ctx.fill();
}

/**
 * 椭圆路径。低端安卓容器（Chrome 31 以下）与部分 WebView 没有 ctx.ellipse，
 * 缺了会直接抛错把整帧画崩，所以退化用 scale + arc 画。
 */
function figEllipse(ctx, cx, cy, rx, ry) {
  ctx.beginPath();
  if (typeof ctx.ellipse === "function") {
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    return;
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.restore();
}

function figPoly(ctx, points) {
  ctx.beginPath();
  var i;
  for (i = 0; i < points.length; i += 1) {
    if (i === 0) ctx.moveTo(points[i][0], points[i][1]);
    else ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();
  ctx.fill();
}

function figEyes(ctx, cx, cy, size, color) {
  ctx.save();
  ctx.fillStyle = color || "rgba(255,240,210,0.92)";
  ctx.beginPath();
  ctx.arc(cx - size * 0.055, cy, Math.max(1, size * 0.022), 0, Math.PI * 2);
  ctx.arc(cx + size * 0.055, cy, Math.max(1, size * 0.022), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 高光描边：只画一段弧，做出「左上打光」的体积感 */
function figRim(ctx, cx, cy, radius, size) {
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = Math.max(1, size * 0.018);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI * 1.05, Math.PI * 1.55);
  ctx.stroke();
  ctx.restore();
}

function figWolf(ctx, cx, cy, size, color, shadow) {
  figFill(ctx, color);
  // 躯干：横向长条
  figRR(ctx, cx - size * 0.30, cy - size * 0.10, size * 0.60, size * 0.30, size * 0.12);
  // 头 + 吻部
  ctx.beginPath();
  ctx.arc(cx - size * 0.30, cy - size * 0.20, size * 0.15, 0, Math.PI * 2);
  ctx.fill();
  figPoly(ctx, [
    [cx - size * 0.44, cy - size * 0.22],
    [cx - size * 0.54, cy - size * 0.13],
    [cx - size * 0.40, cy - size * 0.10]
  ]);
  // 耳朵
  figPoly(ctx, [
    [cx - size * 0.34, cy - size * 0.33],
    [cx - size * 0.29, cy - size * 0.47],
    [cx - size * 0.20, cy - size * 0.32]
  ]);
  // 四腿
  var i;
  for (i = 0; i < 4; i += 1) {
    var lx = cx - size * 0.24 + i * size * 0.15;
    figRR(ctx, lx, cy + size * 0.16, size * 0.055, size * 0.24, size * 0.02);
  }
  // 尾
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.055);
  ctx.beginPath();
  ctx.moveTo(cx + size * 0.30, cy - size * 0.04);
  ctx.quadraticCurveTo(cx + size * 0.46, cy - size * 0.16, cx + size * 0.42, cy - size * 0.30);
  ctx.stroke();
  ctx.restore();
  figEyes(ctx, cx - size * 0.30, cy - size * 0.21, size, "rgba(255,220,150,0.95)");
}

function figArmored(ctx, cx, cy, size, color) {
  figFill(ctx, color);
  // 方肩宽体
  figRR(ctx, cx - size * 0.28, cy - size * 0.22, size * 0.56, size * 0.50, size * 0.06);
  // 肩甲
  figRR(ctx, cx - size * 0.42, cy - size * 0.22, size * 0.16, size * 0.20, size * 0.05);
  figRR(ctx, cx + size * 0.26, cy - size * 0.22, size * 0.16, size * 0.20, size * 0.05);
  // 头盔
  figRR(ctx, cx - size * 0.13, cy - size * 0.44, size * 0.26, size * 0.20, size * 0.04);
  // 面甲缝隙
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "rgba(6,10,14,0.9)";
  ctx.fillRect(cx - size * 0.10, cy - size * 0.35, size * 0.20, size * 0.035);
  ctx.restore();
  // 铆钉
  var i;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  for (i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(cx - size * 0.18 + i * size * 0.18, cy + size * 0.04, size * 0.016, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  figRim(ctx, cx, cy - size * 0.34, size * 0.14, size);
}

function figVampire(ctx, cx, cy, size, color) {
  // 披风：下摆做波浪
  figFill(ctx, color);
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.10, cy - size * 0.30);
  ctx.lineTo(cx - size * 0.36, cy + size * 0.40);
  ctx.lineTo(cx - size * 0.18, cy + size * 0.34);
  ctx.lineTo(cx - size * 0.04, cy + size * 0.42);
  ctx.lineTo(cx + size * 0.12, cy + size * 0.34);
  ctx.lineTo(cx + size * 0.32, cy + size * 0.40);
  ctx.lineTo(cx + size * 0.10, cy - size * 0.30);
  ctx.closePath();
  ctx.fill();
  // 高领
  figPoly(ctx, [
    [cx - size * 0.12, cy - size * 0.32],
    [cx - size * 0.26, cy - size * 0.52],
    [cx - size * 0.02, cy - size * 0.38]
  ]);
  figPoly(ctx, [
    [cx + size * 0.12, cy - size * 0.32],
    [cx + size * 0.26, cy - size * 0.52],
    [cx + size * 0.02, cy - size * 0.38]
  ]);
  // 头
  ctx.beginPath();
  ctx.arc(cx, cy - size * 0.36, size * 0.10, 0, Math.PI * 2);
  ctx.fill();
  figEyes(ctx, cx, cy - size * 0.37, size, "rgba(255,140,120,0.95)");
}

function figSwarm(ctx, cx, cy, size, color) {
  var i;
  var spots = [[-0.16, -0.10, 0.17], [0.14, -0.16, 0.13], [0.06, 0.10, 0.15], [-0.20, 0.16, 0.11], [0.24, 0.14, 0.09]];
  for (i = 0; i < spots.length; i += 1) {
    figFill(ctx, color, 0.72 + (i % 2) * 0.16);
    ctx.beginPath();
    ctx.arc(cx + size * spots[i][0], cy + size * spots[i][1], size * spots[i][2], 0, Math.PI * 2);
    ctx.fill();
  }
  // 飞散的小点
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.55;
  for (i = 0; i < 8; i += 1) {
    var a = (Math.PI * 2 * i) / 8;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * size * 0.40, cy + Math.sin(a) * size * 0.34, size * 0.018, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function figMirror(ctx, cx, cy, size, color) {
  figFill(ctx, color, 0.9);
  // 菱形主体
  figPoly(ctx, [
    [cx, cy - size * 0.44],
    [cx + size * 0.26, cy],
    [cx, cy + size * 0.40],
    [cx - size * 0.26, cy]
  ]);
  // 镜面分割线 + 反光
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = Math.max(1, size * 0.014);
  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.40);
  ctx.lineTo(cx, cy + size * 0.36);
  ctx.stroke();
  ctx.globalAlpha = 0.28;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.14, cy - size * 0.10);
  ctx.lineTo(cx - size * 0.02, cy - size * 0.26);
  ctx.stroke();
  ctx.restore();
  // 碎镜
  figFill(ctx, color, 0.5);
  figPoly(ctx, [[cx + size * 0.32, cy - size * 0.26], [cx + size * 0.40, cy - size * 0.12], [cx + size * 0.28, cy - size * 0.08]]);
  figPoly(ctx, [[cx - size * 0.34, cy + size * 0.18], [cx - size * 0.26, cy + size * 0.30], [cx - size * 0.38, cy + size * 0.30]]);
}

function figBomber(ctx, cx, cy, size, color) {
  figFill(ctx, color);
  // 鼓胀的圆体
  ctx.beginPath();
  ctx.arc(cx, cy + size * 0.04, size * 0.30, 0, Math.PI * 2);
  ctx.fill();
  // 裂纹
  ctx.save();
  ctx.strokeStyle = "rgba(6,10,14,0.55)";
  ctx.lineWidth = Math.max(1, size * 0.016);
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.16, cy - size * 0.16);
  ctx.lineTo(cx - size * 0.04, cy - size * 0.02);
  ctx.lineTo(cx - size * 0.10, cy + size * 0.12);
  ctx.moveTo(cx + size * 0.10, cy - size * 0.18);
  ctx.lineTo(cx + size * 0.04, cy + size * 0.04);
  ctx.lineTo(cx + size * 0.16, cy + size * 0.18);
  ctx.stroke();
  ctx.restore();
  // 引线火花
  ctx.save();
  ctx.strokeStyle = "rgba(242,205,132,0.9)";
  ctx.lineWidth = Math.max(1, size * 0.02);
  ctx.beginPath();
  ctx.moveTo(cx + size * 0.06, cy - size * 0.26);
  ctx.quadraticCurveTo(cx + size * 0.18, cy - size * 0.42, cx + size * 0.26, cy - size * 0.34);
  ctx.stroke();
  ctx.restore();
  figEyes(ctx, cx, cy - size * 0.02, size, "rgba(255,200,120,0.95)");
}

function figWisp(ctx, cx, cy, size, color) {
  // 外层光晕
  var i;
  for (i = 3; i >= 1; i -= 1) {
    ctx.save();
    ctx.globalAlpha = 0.12 * i;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.10, size * (0.16 + i * 0.09), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  figFill(ctx, color, 0.95);
  // 泪滴体
  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.42);
  ctx.quadraticCurveTo(cx + size * 0.18, cy - size * 0.06, cx, cy + size * 0.10);
  ctx.quadraticCurveTo(cx - size * 0.18, cy - size * 0.06, cx, cy - size * 0.42);
  ctx.fill();
  // 拖尾
  ctx.save();
  ctx.fillStyle = color;
  for (i = 0; i < 3; i += 1) {
    ctx.globalAlpha = 0.4 - i * 0.1;
    ctx.beginPath();
    ctx.arc(cx + (i % 2 ? size * 0.07 : -size * 0.06), cy + size * (0.20 + i * 0.10), size * (0.035 - i * 0.007), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  figEyes(ctx, cx, cy - size * 0.18, size, "rgba(220,255,246,0.95)");
}

function figIdol(ctx, cx, cy, size, color) {
  figFill(ctx, color);
  // 基座
  figRR(ctx, cx - size * 0.28, cy + size * 0.30, size * 0.56, size * 0.12, size * 0.03);
  // 三段石身
  figRR(ctx, cx - size * 0.22, cy + size * 0.06, size * 0.44, size * 0.24, size * 0.03);
  figRR(ctx, cx - size * 0.17, cy - size * 0.16, size * 0.34, size * 0.22, size * 0.03);
  // 头
  figRR(ctx, cx - size * 0.10, cy - size * 0.38, size * 0.20, size * 0.20, size * 0.03);
  // 手持护盾
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = "rgba(230,240,245,0.75)";
  ctx.lineWidth = Math.max(1.2, size * 0.022);
  ctx.beginPath();
  ctx.arc(cx + size * 0.26, cy + size * 0.04, size * 0.16, Math.PI * 1.6, Math.PI * 0.6);
  ctx.stroke();
  ctx.restore();
  figEyes(ctx, cx, cy - size * 0.28, size, "rgba(140,230,215,0.9)");
}

function figAssassin(ctx, cx, cy, size, color) {
  // 残影
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = color;
  figRR(ctx, cx - size * 0.10, cy - size * 0.18, size * 0.20, size * 0.48, size * 0.06);
  ctx.restore();
  figFill(ctx, color);
  // 瘦长躯干
  figRR(ctx, cx - size * 0.09, cy - size * 0.18, size * 0.18, size * 0.48, size * 0.05);
  // 兜帽
  figPoly(ctx, [
    [cx - size * 0.13, cy - size * 0.22],
    [cx, cy - size * 0.50],
    [cx + size * 0.13, cy - size * 0.22]
  ]);
  // 长刃
  ctx.save();
  ctx.strokeStyle = "rgba(235,245,250,0.92)";
  ctx.lineWidth = Math.max(1.4, size * 0.028);
  ctx.beginPath();
  ctx.moveTo(cx + size * 0.12, cy + size * 0.02);
  ctx.lineTo(cx + size * 0.46, cy - size * 0.34);
  ctx.stroke();
  ctx.restore();
  figEyes(ctx, cx, cy - size * 0.32, size, "rgba(190,220,255,0.9)");
}

function figOverlord(ctx, cx, cy, size, color) {
  figFill(ctx, color);
  // 巨大躯干
  figRR(ctx, cx - size * 0.34, cy - size * 0.10, size * 0.68, size * 0.62, size * 0.10);
  // 头
  ctx.beginPath();
  ctx.arc(cx, cy - size * 0.24, size * 0.22, 0, Math.PI * 2);
  ctx.fill();
  // 双角
  figPoly(ctx, [
    [cx - size * 0.20, cy - size * 0.36],
    [cx - size * 0.42, cy - size * 0.66],
    [cx - size * 0.06, cy - size * 0.44]
  ]);
  figPoly(ctx, [
    [cx + size * 0.20, cy - size * 0.36],
    [cx + size * 0.42, cy - size * 0.66],
    [cx + size * 0.06, cy - size * 0.44]
  ]);
  // 胸口裂隙
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = "rgba(255,120,90,0.65)";
  figPoly(ctx, [
    [cx, cy + size * 0.02],
    [cx + size * 0.07, cy + size * 0.16],
    [cx, cy + size * 0.34],
    [cx - size * 0.07, cy + size * 0.16]
  ]);
  ctx.restore();
  figEyes(ctx, cx, cy - size * 0.26, size, "rgba(255,150,110,0.98)");
}

function figHero(ctx, cx, cy, size, color) {
  figFill(ctx, color);
  // 腿
  figRR(ctx, cx - size * 0.10, cy + size * 0.20, size * 0.08, size * 0.20, size * 0.03);
  figRR(ctx, cx + size * 0.02, cy + size * 0.20, size * 0.08, size * 0.20, size * 0.03);
  // 躯干
  figRR(ctx, cx - size * 0.13, cy - size * 0.10, size * 0.26, size * 0.34, size * 0.06);
  // 头 + 兜帽
  ctx.beginPath();
  ctx.arc(cx, cy - size * 0.22, size * 0.11, 0, Math.PI * 2);
  ctx.fill();
  figPoly(ctx, [
    [cx - size * 0.14, cy - size * 0.20],
    [cx, cy - size * 0.40],
    [cx + size * 0.14, cy - size * 0.20]
  ]);
  // 弓
  ctx.save();
  ctx.strokeStyle = "rgba(242,205,132,0.9)";
  ctx.lineWidth = Math.max(1.2, size * 0.022);
  ctx.beginPath();
  ctx.arc(cx + size * 0.20, cy - size * 0.02, size * 0.22, Math.PI * 1.65, Math.PI * 0.35);
  ctx.stroke();
  ctx.restore();
}

/* ---------- 第二批次：织网 / 寄生 / 狂化 / 赌徒 ---------- */

function figWeaver(ctx, cx, cy, size, color) {
  var i;
  // 八条细腿：先画腿，压在身体下面
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, size * 0.022);
  ctx.globalAlpha = 0.75;
  for (i = 0; i < 4; i += 1) {
    var y = cy + size * (0.02 + i * 0.09);
    var spread = size * (0.34 + i * 0.03);
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.06, y);
    ctx.lineTo(cx - spread, y + size * 0.10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + size * 0.06, y);
    ctx.lineTo(cx + spread, y + size * 0.10);
    ctx.stroke();
  }
  ctx.restore();
  // 圆腹
  figFill(ctx, color, 0.94);
  ctx.beginPath();
  ctx.arc(cx, cy + size * 0.14, size * 0.26, 0, Math.PI * 2);
  ctx.fill();
  // 头胸
  ctx.beginPath();
  ctx.arc(cx, cy - size * 0.12, size * 0.15, 0, Math.PI * 2);
  ctx.fill();
  // 腹部网纹
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = Math.max(1, size * 0.012);
  for (i = 1; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.arc(cx, cy + size * 0.14, size * 0.09 * i, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  figEyes(ctx, cx, cy - size * 0.13, size * 0.5, "rgba(18,24,30,0.92)");
  figRim(ctx, cx, cy, size * 0.34, size);
}

function figParasite(ctx, cx, cy, size, color) {
  // 肿胀的囊体：上下两个椭圆叠出「被撑开」的感觉
  figFill(ctx, color, 0.9);
  ctx.beginPath();
  figEllipse(ctx, cx, cy + size * 0.06, size * 0.30, size * 0.34);
  ctx.fill();
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  figEllipse(ctx, cx + size * 0.10, cy - size * 0.14, size * 0.18, size * 0.20);
  ctx.fill();
  ctx.globalAlpha = 1;
  // 体内的卵：小圆点，暗示「里面还有东西」
  var eggs = [[-0.10, 0.02], [0.04, 0.14], [0.12, -0.02], [-0.02, -0.12]];
  for (var i = 0; i < eggs.length; i += 1) {
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = "#F3E4D0";
    ctx.beginPath();
    ctx.arc(cx + size * eggs[i][0], cy + size * eggs[i][1], size * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // 垂下的肢须
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = Math.max(1, size * 0.018);
  for (var k = -1; k <= 1; k += 1) {
    ctx.beginPath();
    ctx.moveTo(cx + size * k * 0.12, cy + size * 0.32);
    ctx.quadraticCurveTo(cx + size * k * 0.18, cy + size * 0.42, cx + size * k * 0.10, cy + size * 0.48);
    ctx.stroke();
  }
  ctx.restore();
  figEyes(ctx, cx, cy - size * 0.14, size * 0.52, "rgba(28,18,24,0.92)");
}

function figEnrage(ctx, cx, cy, size, color) {
  // 方肩躯体
  figFill(ctx, color, 0.95);
  rr(ctx, cx - size * 0.28, cy - size * 0.30, size * 0.56, size * 0.66, size * 0.10);
  ctx.fill();
  // 两侧尖刺：越往外越细，做出「外壳被撑裂」的轮廓
  figPoly(ctx, [
    [cx - size * 0.28, cy - size * 0.18],
    [cx - size * 0.50, cy - size * 0.30],
    [cx - size * 0.28, cy - size * 0.02]
  ]);
  figPoly(ctx, [
    [cx + size * 0.28, cy - size * 0.18],
    [cx + size * 0.50, cy - size * 0.30],
    [cx + size * 0.28, cy - size * 0.02]
  ]);
  // 胸口裂缝：锯齿线，里面透出暖光
  ctx.save();
  ctx.strokeStyle = "rgba(255,150,90,0.95)";
  ctx.lineWidth = Math.max(1.2, size * 0.02);
  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.26);
  ctx.lineTo(cx - size * 0.06, cy - size * 0.06);
  ctx.lineTo(cx + size * 0.05, cy + size * 0.02);
  ctx.lineTo(cx - size * 0.04, cy + size * 0.26);
  ctx.stroke();
  ctx.restore();
  figEyes(ctx, cx, cy - size * 0.20, size * 0.52, "rgba(20,16,18,0.9)");
}

function figGambler(ctx, cx, cy, size, color) {
  // 斗篷：上窄下宽，底边做出破布锯齿
  figFill(ctx, color, 0.9);
  figPoly(ctx, [
    [cx, cy - size * 0.38],
    [cx + size * 0.20, cy - size * 0.12],
    [cx + size * 0.30, cy + size * 0.34],
    [cx + size * 0.10, cy + size * 0.30],
    [cx, cy + size * 0.36],
    [cx - size * 0.10, cy + size * 0.30],
    [cx - size * 0.30, cy + size * 0.34],
    [cx - size * 0.20, cy - size * 0.12]
  ]);
  // 兜帽阴影
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "rgba(12,16,20,0.85)";
  ctx.beginPath();
  figEllipse(ctx, cx, cy - size * 0.20, size * 0.13, size * 0.15);
  ctx.fill();
  ctx.restore();
  // 手里的骰子
  var dx = cx + size * 0.26;
  var dy = cy + size * 0.04;
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = "#F0E2C4";
  rr(ctx, dx - size * 0.09, dy - size * 0.09, size * 0.18, size * 0.18, size * 0.035);
  ctx.fill();
  ctx.fillStyle = "rgba(20,24,28,0.9)";
  var pips = [[-0.035, -0.035], [0.035, 0], [-0.035, 0.035]];
  for (var i = 0; i < pips.length; i += 1) {
    ctx.beginPath();
    ctx.arc(dx + size * pips[i][0], dy + size * pips[i][1], size * 0.018, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  figRim(ctx, cx, cy, size * 0.34, size);
}

var VARIANTS = {
  wolf: figWolf,
  armored: figArmored,
  vampire: figVampire,
  swarm: figSwarm,
  mirror: figMirror,
  bomber: figBomber,
  wisp: figWisp,
  idol: figIdol,
  assassin: figAssassin,
  overlord: figOverlord,
  weaver: figWeaver,
  parasite: figParasite,
  enrage: figEnrage,
  gambler: figGambler,
  hero: figHero
};

/**
 * 角色/敌人剪影。
 * variant 传敌人特性（trait）时按特性画轮廓；不传则回退到按 kind 的老剪影，
 * 保证任何遗漏都不会出现「空白敌人」。
 *
 * pose（可选）用来做待机/受击的形变，全部是「当帧算出来的量」，不存任何状态：
 *   bob  —— 竖直位移（px，负数向上），呼吸时用
 *   sx   —— 横向缩放，挤压帧用（1.12 表示横向摊开）
 *   sy   —— 纵向缩放
 *   rot  —— 绕脚底中心旋转（弧度），前倾/后仰用
 * 形变只作用于身体，影子固定在地上并随 bob 收缩，否则浮空感会反过来。
 *
 * 为什么需要 rot：整体平移读起来是「挪了一步」，不是「前倾」。
 * 人的重心在脚上，身体倾出去而脚不动，才像在使劲。
 */
function figure(ctx, cx, cy, size, kind, color, variant, pose) {
  var c = color || PALETTE.teal;
  var p = pose || {};
  var bob = p.bob || 0;
  var sx = p.sx === undefined ? 1 : p.sx;
  var sy = p.sy === undefined ? 1 : p.sy;
  var rot = p.rot || 0;
  figShadow(ctx, cx, cy, size, bob < 0 ? -bob : 0);
  ctx.save();
  if (bob || sx !== 1 || sy !== 1 || rot !== 0) {
    // 以脚底中心为基准做形变：横向摊开会压到地面，纵向压扁不会浮起来
    ctx.translate(cx, cy + bob);
    if (rot !== 0) ctx.rotate(rot);
    ctx.scale(sx, sy);
    ctx.translate(-cx, -cy);
  }
  var painter = variant && VARIANTS[variant];
  if (painter) {
    painter(ctx, cx, cy, size, c);
    ctx.restore();
    return;
  }
  if (kind === "hero") {
    figHero(ctx, cx, cy, size, c);
    ctx.restore();
    return;
  }
  figFill(ctx, c, 0.92);
  if (kind === "boss") {
    figOverlord(ctx, cx, cy, size, c);
  } else if (kind === "elite") {
    // 精英兜底：比杂兵大一圈，带单角
    rr(ctx, cx - size * 0.26, cy - size * 0.06, size * 0.52, size * 0.56, size * 0.12);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.20, size * 0.19, 0, Math.PI * 2);
    ctx.fill();
    figPoly(ctx, [
      [cx - size * 0.20, cy - size * 0.34],
      [cx - size * 0.34, cy - size * 0.52],
      [cx - size * 0.04, cy - size * 0.38]
    ]);
    figEyes(ctx, cx, cy - size * 0.21, size, "rgba(255,220,180,0.9)");
  } else {
    // 杂兵兜底：团块 + 双眼
    ctx.beginPath();
    ctx.arc(cx, cy + size * 0.06, size * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - size * 0.14, cy - size * 0.16, size * 0.14, 0, Math.PI * 2);
    ctx.arc(cx + size * 0.14, cy - size * 0.16, size * 0.14, 0, Math.PI * 2);
    ctx.fill();
    figEyes(ctx, cx, cy - size * 0.16, size, "rgba(220,235,240,0.85)");
  }
  ctx.restore();
}

/* ------------------------------------------------------------------
 * 节点图标：用同一条线条语言画几何图形，替代 ⚔ ✦ ? 这些字形
 * （字形在不同机型上字重不一致，而且和界面风格脱节）
 * ------------------------------------------------------------------ */

var GLYPHS = {
  sword: function (ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.62);
    ctx.lineTo(cx + r * 0.16, cy - r * 0.20);
    ctx.lineTo(cx + r * 0.16, cy + r * 0.28);
    ctx.lineTo(cx - r * 0.16, cy + r * 0.28);
    ctx.lineTo(cx - r * 0.16, cy - r * 0.20);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx - r * 0.40, cy + r * 0.26, r * 0.80, r * 0.14);
  },
  skull: function (ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.08, r * 0.40, Math.PI, Math.PI * 2);
    ctx.lineTo(cx + r * 0.40, cy + r * 0.16);
    ctx.lineTo(cx - r * 0.40, cy + r * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx - r * 0.22, cy + r * 0.16, r * 0.44, r * 0.20);
  },
  question: function (ctx, cx, cy, r) {
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = Math.max(1.4, r * 0.18);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.22, r * 0.30, Math.PI * 1.1, Math.PI * 0.25);
    ctx.lineTo(cx, cy + r * 0.10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.34, r * 0.10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  tent: function (ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.46);
    ctx.lineTo(cx + r * 0.48, cy + r * 0.34);
    ctx.lineTo(cx - r * 0.48, cy + r * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.12);
    ctx.lineTo(cx + r * 0.18, cy + r * 0.34);
    ctx.lineTo(cx - r * 0.18, cy + r * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
  coin: function (ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(cx - r * 0.06, cy - r * 0.22, r * 0.12, r * 0.44);
    ctx.restore();
  },
  box: function (ctx, cx, cy, r) {
    ctx.fillRect(cx - r * 0.40, cy - r * 0.24, r * 0.80, r * 0.52);
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(cx - r * 0.40, cy - r * 0.24, r * 0.80, r * 0.14);
    ctx.restore();
  },
  crown: function (ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.48, cy + r * 0.24);
    ctx.lineTo(cx - r * 0.48, cy - r * 0.28);
    ctx.lineTo(cx - r * 0.22, cy + r * 0.02);
    ctx.lineTo(cx, cy - r * 0.40);
    ctx.lineTo(cx + r * 0.22, cy + r * 0.02);
    ctx.lineTo(cx + r * 0.48, cy - r * 0.28);
    ctx.lineTo(cx + r * 0.48, cy + r * 0.24);
    ctx.closePath();
    ctx.fill();
  }
};

function nodeGlyph(ctx, cx, cy, radius, glyph, color) {
  var painter = GLYPHS[glyph];
  ctx.save();
  ctx.fillStyle = color || PALETTE.ink;
  if (painter) {
    painter(ctx, cx, cy, radius);
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.24, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function clear(ctx, w, h, color) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = color || PALETTE.bg0;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * 背景：三层视差（远景光带 / 中景车窗 / 近景扶手）
 * opts: { tone, offset } —— offset 由路线图滚动位置驱动，让场景有纵深
 */
function backdrop(ctx, screen, tone, opts) {
  var o = opts || {};
  var t = o.tone || tone;
  var offset = o.offset || 0;
  // 车厢主题只管两处色：顶部光晕与车窗光带。其余用统一调色板，
  // 免得主题一多就出现「整个界面跟着变色」的失控感。
  var glow = o.glow || "rgba(79,192,176,0.16)";
  var beamColor = o.beam || "rgba(224,177,92,0.10)";
  var w = screen.width;
  var h = screen.height;

  clear(ctx, w, h, t === "light" ? "#0E1C28" : PALETTE.bg0);

  ctx.save();
  // 远景：顶部光晕
  if (typeof ctx.createLinearGradient === "function") {
    var g = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    g.addColorStop(0, glow);
    g.addColorStop(1, "rgba(79,192,176,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h * 0.55);

    // 中景：斜向光带（车窗透进来的光），随 offset 缓慢移动
    var beam = ctx.createLinearGradient(0, h * 0.12, w, h * 0.62);
    beam.addColorStop(0, beamColor);
    beam.addColorStop(0.45, "rgba(224,177,92,0.02)");
    beam.addColorStop(1, "rgba(224,177,92,0)");
    ctx.fillStyle = beam;
    ctx.save();
    ctx.translate(0, (offset * 0.25) % (h * 0.6));
    for (var b = -1; b < 3; b += 1) {
      ctx.fillRect(0, b * h * 0.55, w, h * 0.16);
    }
    ctx.restore();
  }

  // 远景横纹
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = PALETTE.ink;
  var y;
  for (y = 0; y < h; y += 28) {
    ctx.fillRect(0, y, w, 1);
  }

  // 近景：两侧竖扶手（极淡），给出「在车厢里」的边框感
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = "#9FB0BA";
  ctx.fillRect(w * 0.045, 0, Math.max(1, screen.px(2)), h);
  ctx.fillRect(w * 0.955 - screen.px(2), 0, Math.max(1, screen.px(2)), h);
  ctx.restore();
}

module.exports = {
  PALETTE: PALETTE,
  rr: rr,
  panel: panel,
  fillRR: fillRR,
  strokeRR: strokeRR,
  text: text,
  measure: measure,
  bar: bar,
  figure: figure,
  nodeGlyph: nodeGlyph,
  clear: clear,
  backdrop: backdrop,
  wrapText: wrapText
};

});

define("js/core/engine.js", function(module, exports, require) {
/**
 * engine.js —— 主循环 / 输入分发 / 视图调度 / Toast
 *
 * 职责边界：
 * - 只管「怎么画、怎么点」，不知道任何玩法规则。
 * - 玩法状态与动作处理由 main.js 注入（dispatch / getState / commit）。
 * - 脏标记渲染：没有动画、没有 toast、没有新输入时不重绘。
 */

var ui = require("./ui");
var draw = require("./draw");
var tween = require("./tween");
var fxApi = require("./fx");
var metricsApi = require("./metrics");

function createEngine(options) {
  /**
   * 绘制指令计数：包一层 ctx，对场景/弹窗完全透明（它们拿到的还是同一个 ctx 接口）。
   * `instrument: false` 可以整层关掉，计数退化为 0，渲染行为不变——
   * 留在真机上哪天这层转发变贵时的退路。
   */
  var metrics = options.instrument === false ? null : metricsApi.instrument(options.ctx);
  var ctx = metrics ? metrics.ctx : options.ctx;
  var canvas = options.canvas;
  var platform = options.platform;
  var screen = options.screen;
  var getState = options.getState;
  var dispatch = options.dispatch;
  var getSceneId = options.getSceneId;
  var getModalId = options.getModalId;
  var scenes = options.scenes || {};
  var modals = options.modals || {};

  var animator = tween.createAnimator();
  var fx = fxApi.createFx();
  var audio = options.audio || null;
  /** 由业务层注入：当前视图是否需要持续重绘（例如战斗里的待机呼吸） */
  var isLiveView = options.isLiveView || null;
  var toasts = [];
  /**
   * 帧统计：低端机上「卡不卡」需要能被量出来，而不是靠感觉。
   * 只做计数与最近一次的耗时，不参与渲染，也不占额外定时器。
   */
  var perf = { frames: 0, slowFrames: 0, renderMs: 0, worstRenderMs: 0, sampleStart: 0, fps: 0, windowFrames: 0, paints: 0, drawCalls: 0, worstDrawCalls: 0, drawPaints: 0 };
  var dirty = true;
  var lastFrameAt = 0;
  var elapsed = 0;
  var running = false;
  var transitions = { alpha: 1, key: "boot" };
  /**
   * 待机动画的节拍：累计毫秒（喂给渲染层算相位）与上一次「为待机而重绘」的时刻。
   * 待机动作不需要 60fps，12.5fps 就足够顺，电池和发热却差一个量级。
   */
  var clock = 0;
  var lastLivePaint = 0;
  var LIVE_INTERVAL_MS = 80;

  function invalidate() {
    dirty = true;
  }

  function toast(text, opts) {
    toasts.push({
      text: String(text),
      life: (opts && opts.life) || 1800,
      age: 0
    });
    if (toasts.length > 3) toasts.shift();
    invalidate();
  }

  /** 场景切换的淡入，给正式版留的转场钩子 */
  function transition() {
    fx.clear();
    animator.start(transitions.key, 260);
    invalidate();
  }

  /* ---------------- 渲染 ---------------- */

  function renderToast() {
    if (!toasts.length) return;
    var s = screen.s;
    var i;
    for (i = 0; i < toasts.length; i += 1) {
      var t = toasts[i];
      var alpha = t.age < 200 ? t.age / 200 : t.life - t.age < 300 ? Math.max(0, (t.life - t.age) / 300) : 1;
      var size = Math.round(13 * s);
      var w = Math.min(screen.width - screen.pad * 2, draw.measure(ctx, t.text, size, true) + Math.round(28 * s));
      var h = Math.round(34 * s);
      // 提示居中偏上：既不挡底部操作区，也不压住顶部标题与资源条
      var y = Math.round(screen.height * 0.38) + i * (h + Math.round(6 * s));
      var x = (screen.width - w) / 2;
      ctx.save();
      ctx.globalAlpha = alpha * 0.96;
      draw.fillRR(ctx, { x: x, y: y, w: w, h: h }, "rgba(10,22,30,0.94)", Math.round(h / 2));
      draw.strokeRR(ctx, { x: x, y: y, w: w, h: h }, draw.PALETTE.line, Math.round(h / 2), 1);
      draw.text(ctx, t.text, screen.width / 2, y + h / 2 - size * 0.62, {
        size: size,
        bold: true,
        align: "center",
        color: draw.PALETTE.ink
      });
      ctx.restore();
    }
  }

  function render() {
    var state = getState();
    elapsed += 1;
    perf.paints += 1;
    if (metrics) metrics.reset();
    ui.beginFrame(screen, elapsed);

    var sceneId = getSceneId(state);
    var modalId = getModalId(state);
    var scene = scenes[sceneId] || scenes.home;
    var modal = modalId ? modals[modalId] : null;

    try {
      // 震屏：只位移「世界」，不位移 toast 与转场遮罩，避免文字跟着抖到读不清
      var shake = fx.getShake();
      ctx.save();
      if (shake.x || shake.y) ctx.translate(shake.x, shake.y);

      if (scene && scene.render) scene.render(ctx, screen, state, animator, clock);
      if (modal) {
        ctx.save();
        ctx.globalAlpha = 0.72;
        ctx.fillStyle = "#04090D";
        ctx.fillRect(0, 0, screen.width, screen.height);
        ctx.restore();
        if (modal.render) modal.render(ctx, screen, state, animator, clock);
      }
      // 特效画在弹窗之上：伤害飘字必须压在角色与卡片上层才看得见
      fx.render(ctx);
      ctx.restore();

      renderToast();

      // 场景切换淡入
      var p = animator.progress(transitions.key);
      if (p < 1) {
        ctx.save();
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = "#04090D";
        ctx.fillRect(0, 0, screen.width, screen.height);
        ctx.restore();
      }
    } catch (error) {
      platform.reportError(error, "render:" + sceneId + (modalId ? "/" + modalId : ""));
      draw.clear(ctx, screen.width, screen.height, "#1A0E0E");
      draw.text(ctx, "渲染异常，已恢复。", screen.width / 2, screen.height / 2, {
        size: 14,
        align: "center",
        color: "#FFFFFF"
      });
    }

    // 计数放在 try 之外：渲染中途抛异常时，这一帧的指令数同样是真实发生的，
    // 记下来才能看出「异常帧是不是画得比平时多」。
    if (metrics) {
      perf.drawCalls = metrics.calls();
      perf.drawPaints = metrics.paints();
      if (perf.drawCalls > perf.worstDrawCalls) perf.worstDrawCalls = perf.drawCalls;
    }
  }

  /* ---------------- 输入 ---------------- */

  /** 音效入口：场景/弹窗只需要喊名字，不需要知道平台差异 */
  function playSound(name, volume) {
    if (!audio) return;
    audio.play(name, volume);
  }

  /** 当前视图标识：场景 + 弹窗，用于判断一次点击有没有换屏 */
  function viewKeyOf(state) {
    return state.current.scene + "/" + (state.current.modal || "");
  }

  function handleTap(x, y) {
    var hit = ui.hitTest(x, y);
    ui.setPressed(null);
    if (!hit) {
      invalidate();
      return;
    }
    try {
      var action = { id: hit.id, meta: hit.meta || {}, kind: hit.kind };
      playSound("tap", 0.55);
      var beforeKey = viewKeyOf(getState());
      dispatch(action);
      // 换屏就清掉上一屏的特效：否则战斗最后一击的伤害数字会飘到「选择强化」上
      if (viewKeyOf(getState()) !== beforeKey) fx.clear();
    } catch (error) {
      platform.reportError(error, "action:" + hit.id);
      toast("操作异常，已跳过");
    }
    invalidate();
  }

  function bindInput() {
    platform.bindTouch({
      onStart: function (x, y) {
        var hit = ui.hitTest(x, y);
        ui.setPressed(hit ? hit.id : null);
        invalidate();
      },
      onEnd: function (x, y) {
        handleTap(x, y);
      },
      onMove: function (x, y) {
        if (ui.pressedId) {
          // 手指滑出按钮就取消按压态
          var hit = ui.hitTest(x, y);
          if (!hit || hit.id !== ui.pressedId) {
            ui.setPressed(null);
            invalidate();
          }
        }
      }
    });
  }

  /* ---------------- 主循环 ---------------- */

  /** 无头环境（Node）不自动起循环，由测试手动 __tick 推进 */
  function canAutoLoop() {
    if (typeof requestAnimationFrame === "function") return true;
    if (platform && typeof platform.isNode === "function" && platform.isNode()) return false;
    return true;
  }

  /**
   * 推进一帧：真实循环与无头测试共用这一条路径。
   * （测试若自己另写一份，就会漏掉脏标记与节流逻辑，「跑得通」不代表线上跑得通）
   */
  function step(dt) {
    clock += dt;
    animator.tick(dt);
    fx.tick(dt);

    var i;
    var alive = false;
    for (i = toasts.length - 1; i >= 0; i -= 1) {
      toasts[i].age += dt;
      if (toasts[i].age >= toasts[i].life) {
        toasts.splice(i, 1);
      } else {
        alive = true;
      }
    }
    if (alive) dirty = true;

    // 特效在跑也必须持续重绘，否则粒子会定格
    if (fx.isActive()) dirty = true;

    // 任何补间在跑都要继续画：不能只盯转场那一个 key
    if (animator.anyRunning()) dirty = true;

    // 待机动画：只有当前视图声明「会动」时才持续重绘，且限速到 ~12fps
    if (isLiveView && isLiveView(getState()) && clock - lastLivePaint >= LIVE_INTERVAL_MS) {
      lastLivePaint = clock;
      dirty = true;
    }

    if (dirty) {
      dirty = false;
      var renderStart = Date.now();
      render();
      perf.renderMs = Date.now() - renderStart;
      if (perf.renderMs > perf.worstRenderMs) perf.worstRenderMs = perf.renderMs;
    }
  }

  function frame(timestamp) {
    if (!running) return;
    var now = typeof timestamp === "number" ? timestamp : Date.now();
    var dt = lastFrameAt ? Math.min(64, now - lastFrameAt) : 16;
    lastFrameAt = now;

    perf.frames += 1;
    perf.windowFrames += 1;
    if (dt > 40) perf.slowFrames += 1;
    if (!perf.sampleStart) perf.sampleStart = now;
    if (now - perf.sampleStart >= 1000) {
      perf.fps = Math.round((perf.windowFrames * 1000) / (now - perf.sampleStart));
      perf.windowFrames = 0;
      perf.sampleStart = now;
    }

    step(dt);

    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(frame);
    } else if (canAutoLoop()) {
      setTimeout(function () { frame(Date.now()); }, 16);
    }
  }

  function start() {
    if (running) return;
    running = true;
    lastFrameAt = 0;
    animator.start(transitions.key, 300);
    render();
    dirty = false;
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(frame);
    } else if (canAutoLoop()) {
      setTimeout(function () { frame(Date.now()); }, 16);
    }
  }

  return {
    start: start,
    stop: function () { running = false; },
    invalidate: invalidate,
    toast: toast,
    transition: transition,
    render: render,
    handleTap: handleTap,
    bindInput: bindInput,
    animator: animator,
    fx: fx,
    playSound: playSound,
    setAudio: function (next) { audio = next; },
    /** 诊断用：最近一秒帧率、渲染耗时、慢帧数、单帧绘制指令数 */
    getPerf: function () {
      return "fps=" + perf.fps + " 渲染=" + perf.renderMs + "ms(最差 " + perf.worstRenderMs +
        "ms) 绘制=" + perf.drawPaints + "/" + perf.drawCalls + "(最差 " + perf.worstDrawCalls +
        ") 帧数=" + perf.frames + " 慢帧=" + perf.slowFrames;
    },
    /** 诊断用：上一帧的绘制指令数（测试用它给「不许画得更多」上闸） */
    getDrawCalls: function () {
      return perf.drawCalls;
    },
    /** 诊断用：上一帧里真正落像素的调用数（fill/stroke/文字/贴图） */
    getDrawPaints: function () {
      return perf.drawPaints;
    },
    getWorstDrawCalls: function () {
      return perf.worstDrawCalls;
    },
    /** 诊断用：累计绘制次数（待机节流是否生效靠它量） */
    getPaintCount: function () {
      return perf.paints;
    },
    /** 诊断用：喂给渲染层的累计毫秒 */
    getClock: function () {
      return clock;
    },
    clearToasts: function () {
      toasts.length = 0;
      invalidate();
    },
    /** 无头测试用：强制重绘一帧（等价于「有输入发生」） */
    __tick: function (dt) {
      dirty = true;
      step(dt || 16);
    },
    /** 无头测试用：不强制重绘，只推进时钟——用来验证脏标记与待机节流 */
    __step: function (dt) {
      step(dt || 16);
    }
  };
}

module.exports = createEngine;

});

define("js/core/fx.js", function(module, exports, require) {
/**
 * core/fx.js —— 轻量特效层（粒子 / 飘字 / 震屏 / 闪白 / 涟漪）
 *
 * 定位：只负责「让动作有反馈」，不含任何玩法判断。
 * 使用方式：场景在渲染末尾调用 render(ctx)；engine 每帧 tick，并读取 getShake() 做画面位移。
 *
 * 性能约束（抖音低端机）：
 * - 粒子总数上限 MAX_PARTICLES，超出后丢弃新粒子而不是卡顿
 * - 每个特效都是简单几何（圆/环/字），不用阴影、不用图片
 * - 全部对象用普通 JS 对象 + 数组，避免每帧创建闭包
 */

var MAX_PARTICLES = 96;
var MAX_FLOATS = 12;
var MAX_RINGS = 8;

function createFx() {
  var particles = [];
  var floats = [];
  var rings = [];
  var shakeState = null;
  var flashState = null;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function burst(x, y, opts) {
    var o = opts || {};
    var count = o.count || 12;
    var color = o.color || "#FFB199";
    var speed = o.speed || 150;
    var gravity = o.gravity === undefined ? 620 : o.gravity;
    var size = o.size || 3;
    var spread = o.spread === undefined ? Math.PI * 2 : o.spread;
    var dir = o.dir === undefined ? -Math.PI / 2 : o.dir;
    var i;
    for (i = 0; i < count; i += 1) {
      if (particles.length >= MAX_PARTICLES) break;
      var angle = dir + rand(-spread / 2, spread / 2);
      var v = speed * rand(0.45, 1);
      particles.push({
        x: x + rand(-4, 4),
        y: y + rand(-4, 4),
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        age: 0,
        life: o.life || rand(260, 460),
        size: size * rand(0.6, 1.3),
        color: color,
        gravity: gravity,
        drag: o.drag === undefined ? 0.92 : o.drag
      });
    }
  }

  function float(x, y, label, opts) {
    var o = opts || {};
    if (floats.length >= MAX_FLOATS) floats.shift();
    floats.push({
      x: x,
      y: y,
      text: String(label),
      age: 0,
      life: o.life || 720,
      color: o.color || "#FFB199",
      size: o.size || 20,
      rise: o.rise === undefined ? 46 : o.rise,
      bold: o.bold !== false,
      drift: o.drift || 0
    });
  }

  function ring(x, y, opts) {
    var o = opts || {};
    if (rings.length >= MAX_RINGS) rings.shift();
    rings.push({
      x: x,
      y: y,
      age: 0,
      life: o.life || 340,
      from: o.from === undefined ? 6 : o.from,
      to: o.to === undefined ? 54 : o.to,
      color: o.color || "#4FC0B0",
      width: o.width || 3
    });
  }

  function shake(strength, duration) {
    // 取较强的一次，避免连续小震动把大震动覆盖掉
    if (shakeState && shakeState.strength > strength) return;
    shakeState = { strength: strength || 4, age: 0, life: duration || 180 };
  }

  function flash(color, duration, alpha) {
    flashState = {
      color: color || "rgba(255,255,255,0.35)",
      age: 0,
      life: duration || 140,
      alpha: alpha === undefined ? 0.35 : alpha
    };
  }

  function tick(dt) {
    var i;
    for (i = particles.length - 1; i >= 0; i -= 1) {
      var p = particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += (p.gravity * dt) / 1000;
      p.vx *= Math.pow(p.drag, dt / 16);
      p.x += (p.vx * dt) / 1000;
      p.y += (p.vy * dt) / 1000;
    }
    for (i = floats.length - 1; i >= 0; i -= 1) {
      floats[i].age += dt;
      if (floats[i].age >= floats[i].life) floats.splice(i, 1);
    }
    for (i = rings.length - 1; i >= 0; i -= 1) {
      rings[i].age += dt;
      if (rings[i].age >= rings[i].life) rings.splice(i, 1);
    }
    if (shakeState) {
      shakeState.age += dt;
      if (shakeState.age >= shakeState.life) shakeState = null;
    }
    if (flashState) {
      flashState.age += dt;
      if (flashState.age >= flashState.life) flashState = null;
    }
  }

  function isActive() {
    return particles.length > 0 || floats.length > 0 || rings.length > 0 ||
      !!shakeState || !!flashState;
  }

  /** 当前画面位移，随着时间快速衰减 */
  function getShake() {
    if (!shakeState) return { x: 0, y: 0 };
    var k = 1 - shakeState.age / shakeState.life;
    var amp = shakeState.strength * k * k;
    return {
      x: (Math.random() * 2 - 1) * amp,
      y: (Math.random() * 2 - 1) * amp
    };
  }

  function render(ctx) {
    var i;

    // 冲击环
    for (i = 0; i < rings.length; i += 1) {
      var g = rings[i];
      var gp = g.age / g.life;
      var radius = g.from + (g.to - g.from) * gp;
      ctx.save();
      ctx.globalAlpha = (1 - gp) * 0.8;
      ctx.beginPath();
      ctx.arc(g.x, g.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = g.color;
      ctx.lineWidth = Math.max(1, g.width * (1 - gp));
      ctx.stroke();
      ctx.restore();
    }

    // 粒子
    for (i = 0; i < particles.length; i += 1) {
      var p = particles[i];
      var pp = p.age / p.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - pp * pp);
      ctx.fillStyle = p.color;
      var r = p.size * (1 - pp * 0.55);
      if (r <= 0.6) {
        ctx.restore();
        continue;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 飘字
    for (i = 0; i < floats.length; i += 1) {
      var f = floats[i];
      var fp = f.age / f.life;
      var ease = 1 - (1 - fp) * (1 - fp);
      var alpha = fp < 0.75 ? 1 : Math.max(0, 1 - (fp - 0.75) / 0.25);
      // 出现时有轻微放大，像「弹」出来
      var scale = fp < 0.12 ? 0.72 + (fp / 0.12) * 0.34 : 1.06 - Math.min(0.06, (fp - 0.12) * 0.2);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(f.x + f.drift * ease, f.y - f.rise * ease);
      ctx.scale(scale, scale);
      ctx.font = (f.bold ? "bold " : "") + f.size + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = Math.max(2, f.size * 0.18);
      ctx.strokeStyle = "rgba(4,9,13,0.72)";
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }

    // 全屏闪
    if (flashState) {
      var fa = flashState.age / flashState.life;
      ctx.save();
      ctx.globalAlpha = flashState.alpha * (1 - fa);
      ctx.fillStyle = flashState.color;
      ctx.fillRect(0, 0, 4096, 4096);
      ctx.restore();
    }
  }

  function clear() {
    particles.length = 0;
    floats.length = 0;
    rings.length = 0;
    shakeState = null;
    flashState = null;
  }

  return {
    burst: burst,
    float: float,
    ring: ring,
    shake: shake,
    flash: flash,
    tick: tick,
    render: render,
    isActive: isActive,
    getShake: getShake,
    clear: clear,
    count: function () {
      return particles.length + floats.length + rings.length;
    }
  };
}

module.exports = {
  createFx: createFx
};

});

define("js/core/metrics.js", function(module, exports, require) {
/**
 * metrics.js —— 绘制指令计数
 *
 * 为什么需要：`perf` 已经有 fps 与 renderMs，但这两个数在真机上只能告诉你「慢」，
 * 不能告诉你「为什么慢」。掉帧可能是指令太多，也可能是某一次 fill 的面积极大；
 * 前者能靠减少指令修，后者只能改设计。没有指令计数，就只能等到真机上猜。
 *
 * 口径（写进测试，不要随手改）：**只数影响像素或路径的调用**——
 *   fill / stroke / fillRect / strokeRect / fillText / strokeText / drawImage /
 *   clearRect / clip，以及路径构造（beginPath / moveTo / lineTo / arc / arcTo /
 *   ellipse / rect / quadraticCurveTo / bezierCurveTo / closePath）。
 * save / restore / translate / rotate / scale / measureText 与属性赋值**不计**：
 * 它们不改像素，计进去数字会随「怎么组织排版」漂移，而不是随「画了多少东西」。
 * 注意 beginPath 计入是因为「开了几条独立路径」直接决定光栅化次数。
 *
 * 实现对上层完全透明：返回一个与 ctx 行为一致的包装对象，所有读写转发到真 ctx。
 * 包装只在引擎创建时做一次；一帧几百次调用多一层 apply，实测对 renderMs 无可见影响
 * （见 docs/ARCHITECTURE.md 的量法）。真机上如果哪天这一层变贵了，
 * 把 `config.perf.instrument` 置 false 即可整体关掉，计数退化为 0，渲染行为不变。
 */

/** 计入指令数的方法 */
var COUNTED = {
  beginPath: true,
  closePath: true,
  moveTo: true,
  lineTo: true,
  arc: true,
  arcTo: true,
  ellipse: true,
  rect: true,
  quadraticCurveTo: true,
  bezierCurveTo: true,
  fill: true,
  stroke: true,
  fillRect: true,
  strokeRect: true,
  clearRect: true,
  fillText: true,
  strokeText: true,
  drawImage: true,
  clip: true
};

/**
 * 真正落像素的那一小撮：fill / stroke / 文字 / 贴图。
 * 路径构造（lineTo 之类）只改路径、不落像素，单独计——
 * 「一帧画了多少段线」和「一帧提交了多少次绘制」是两种成本，
 * 混成一个数会看不出瓶颈在哪（前者是 CPU 拼装，后者是光栅化与状态切换）。
 */
var PAINTED = {
  fill: true,
  stroke: true,
  fillRect: true,
  strokeRect: true,
  fillText: true,
  strokeText: true,
  drawImage: true,
  clearRect: true
};

/** 需要转发但**不计数**的方法 */
var PASSTHROUGH = [
  "save", "restore", "translate", "rotate", "scale", "transform", "setTransform",
  "measureText", "createLinearGradient", "createRadialGradient", "createPattern",
  "setLineDash", "getLineDash", "putImageData", "getImageData", "isPointInPath"
];

/** 需要转发的属性（读也要转发：低端机代码会回读 globalAlpha 做恢复） */
var PROPS = [
  "globalAlpha", "globalCompositeOperation", "fillStyle", "strokeStyle",
  "lineWidth", "lineCap", "lineJoin", "miterLimit",
  "font", "textAlign", "textBaseline", "direction",
  "shadowBlur", "shadowColor", "shadowOffsetX", "shadowOffsetY",
  "imageSmoothingEnabled", "canvas"
];

/**
 * 包一层 ctx，返回 { ctx, calls, reset }。
 * 用普通对象 + defineProperty 而不是 Proxy：小游戏环境不一定有 Proxy，
 * 而且 Proxy 的读拦截比 getter 慢。
 */
function instrument(target) {
  var api = {};
  var state = { calls: 0, paints: 0 };
  var i;

  function bindCounted(name) {
    var isPaint = PAINTED[name] === true;
    api[name] = function () {
      state.calls += 1;
      if (isPaint) state.paints += 1;
      return target[name].apply(target, arguments);
    };
  }

  function bindPass(name) {
    api[name] = function () {
      return target[name].apply(target, arguments);
    };
  }

  for (i = 0; i < PASSTHROUGH.length; i += 1) {
    if (typeof target[PASSTHROUGH[i]] === "function") bindPass(PASSTHROUGH[i]);
  }

  var countedNames = [];
  var k;
  for (k in COUNTED) {
    if (COUNTED.hasOwnProperty(k)) countedNames.push(k);
  }
  for (i = 0; i < countedNames.length; i += 1) {
    if (typeof target[countedNames[i]] === "function") bindCounted(countedNames[i]);
  }

  for (i = 0; i < PROPS.length; i += 1) {
    (function (name) {
      Object.defineProperty(api, name, {
        enumerable: true,
        get: function () { return target[name]; },
        set: function (value) { target[name] = value; }
      });
    })(PROPS[i]);
  }

  return {
    ctx: api,
    calls: function () { return state.calls; },
    paints: function () { return state.paints; },
    reset: function () { state.calls = 0; state.paints = 0; },
    /** 目标对象上不存在的方法名（用于测试断言没有漏转发） */
    missing: function (names) {
      var out = [];
      var j;
      for (j = 0; j < names.length; j += 1) {
        if (typeof target[names[j]] === "function" && !api[names[j]]) out.push(names[j]);
      }
      return out;
    }
  };
}

module.exports = {
  instrument: instrument,
  COUNTED: COUNTED,
  PAINTED: PAINTED
};

});

define("js/core/screen.js", function(module, exports, require) {
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

});

define("js/core/tween.js", function(module, exports, require) {
/**
 * tween.js —— 极简补间与缓动
 *
 * 只做两件事：数值插值、按 key 管理的动画时钟。
 * 不依赖全局 rAF，由 engine 每帧 tick(dt)。
 */

function easeOutCubic(t) {
  var p = 1 - t;
  return 1 - p * p * p;
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeOutBack(t) {
  var c1 = 1.70158;
  var c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * 一次性动画：start(key, durationMs)，progress(key) 返回 0~1（未启动时为 1）
 */
function createAnimator() {
  var anims = {};

  function start(key, duration) {
    anims[key] = { t: 0, d: Math.max(1, duration || 200) };
  }

  function stop(key) {
    delete anims[key];
  }

  function tick(dtMs) {
    var key;
    for (key in anims) {
      if (!Object.prototype.hasOwnProperty.call(anims, key)) continue;
      anims[key].t += dtMs;
      if (anims[key].t >= anims[key].d) delete anims[key];
    }
  }

  function progress(key, easing) {
    var a = anims[key];
    if (!a) return 1;
    var raw = clamp01(a.t / a.d);
    return (easing || easeOutCubic)(raw);
  }

  function isRunning(key) {
    return !!anims[key];
  }

  /**
   * 是否有任意补间在跑。
   * 引擎需要靠它判断「还要不要再画一帧」——之前只看转场那一个 key，
   * 受击后坐力这类补间只能蹭粒子的重绘顺风车，粒子早停了就卡在中间帧。
   */
  function anyRunning() {
    var key;
    for (key in anims) {
      if (Object.prototype.hasOwnProperty.call(anims, key)) return true;
    }
    return false;
  }

  function clear() {
    anims = {};
  }

  return {
    start: start,
    stop: stop,
    tick: tick,
    progress: progress,
    isRunning: isRunning,
    anyRunning: anyRunning,
    clear: clear
  };
}

module.exports = {
  createAnimator: createAnimator,
  easeOutCubic: easeOutCubic,
  easeInOutQuad: easeInOutQuad,
  easeOutBack: easeOutBack,
  clamp01: clamp01
};

});

define("js/core/ui.js", function(module, exports, require) {
/**
 * ui.js —— 组件层：按钮 / 卡片 / 徽标 / 进度条行 + 命中区注册
 *
 * 命中区规则：每帧 beginFrame() 清空，控件在绘制时按「后绘制者优先」压栈，
 * hitTest 从栈顶往下找第一个命中的控件。这样弹窗天然盖住底下的场景。
 */

var draw = require("./draw");

var P = draw.PALETTE;

var state = {
  hits: [],
  pressedId: null,
  screen: null,
  time: 0
};

function beginFrame(screen, time) {
  state.hits.length = 0;
  state.screen = screen;
  state.time = time || 0;
}

/**
 * 最小触控区：44×44（逻辑像素）。
 *
 * 界面是按 390 宽排的，小屏上 `screen.px()` 会把胶囊和返回键缩到 58×27 这种尺寸——
 * 视觉上没问题，手指点不中。移动端的标准做法是**视觉不变、命中区外扩**：
 * 玩家看到的还是那颗小胶囊，但手指偏一点也点得到。
 *
 * 两条约束，缺一个就会帮倒忙：
 * 1. **不越出屏幕**：越界的命中区等于把点击送给屏幕外，看起来是「点了没反应」。
 * 2. **不压住已经注册的其他命中区**：地图节点常比小胶囊先注册，
 *    外扩如果吃掉节点的点击区，就是用一个 bug 换另一个 bug。重叠超过阈值就放弃外扩。
 */
var MIN_TOUCH = 44;
var TOUCH_OVERLAP_LIMIT = 0.25;

function overlapAreaRatio(a, b) {
  if (!a || !b) return 0;
  var x1 = Math.max(a.x, b.x);
  var y1 = Math.max(a.y, b.y);
  var x2 = Math.min(a.x + a.w, b.x + b.w);
  var y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x1 || y2 <= y1) return 0;
  var inter = (x2 - x1) * (y2 - y1);
  var area = b.w * b.h;
  return area > 0 ? inter / area : 0;
}

function expandToMinTouch(rect) {
  var w = Math.max(rect.w, MIN_TOUCH);
  var h = Math.max(rect.h, MIN_TOUCH);
  var x = rect.x + (rect.w - w) / 2;
  var y = rect.y + (rect.h - h) / 2;
  var screen = state.screen;
  if (screen) {
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x + w > screen.width) x = Math.max(0, screen.width - w);
    if (y + h > screen.height) y = Math.max(0, screen.height - h);
  }
  return { x: x, y: y, w: w, h: h };
}

function pushHit(hit) {
  var r = hit && hit.rect;
  if (!r) {
    state.hits.push(hit);
    return;
  }
  if (r.w >= MIN_TOUCH && r.h >= MIN_TOUCH) {
    state.hits.push(hit);
    return;
  }
  var cand = expandToMinTouch(r);
  var i;
  for (i = 0; i < state.hits.length; i += 1) {
    if (overlapAreaRatio(state.hits[i].rect, cand) > TOUCH_OVERLAP_LIMIT) {
      // 有人（通常是地图节点）已经占着这块：宁可维持小命中区，也不抢别人的点击
      state.hits.push(hit);
      return;
    }
  }
  hit.rect = cand;
  state.hits.push(hit);
}

function setPressed(id) {
  state.pressedId = id;
}

function hitTest(x, y) {
  var i;
  var hit;
  for (i = state.hits.length - 1; i >= 0; i -= 1) {
    hit = state.hits[i];
    var r = hit.rect;
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      return hit;
    }
  }
  return null;
}

function inRect(rect, x, y) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

var STYLES = {
  primary: { top: "#F2CD84", bottom: "#D0A049", text: "#20180A", stroke: null },
  ghost: { top: "#1B3341", bottom: "#152833", text: "#DCE6EA", stroke: "#33576A" },
  danger: { top: "#C24A3D", bottom: "#9E3A30", text: "#FFEDEA", stroke: null },
  teal: { top: "#3FA697", bottom: "#2C7F74", text: "#061714", stroke: null }
};

/**
 * 按钮。
 * opts: { id, rect, label, sub, style, disabled, meta, alpha, radius, icon }
 * 返回是否被按下（供调用方做音效等）
 */
function button(ctx, opts) {
  var screen = state.screen;
  var s = screen ? screen.s : 1;
  var r = opts.rect;
  var st = STYLES[opts.style || "ghost"] || STYLES.ghost;
  var disabled = opts.disabled === true;
  var pressed = state.pressedId === opts.id;
  var radius = opts.radius === undefined ? Math.round(12 * s) : opts.radius;
  var rect = r;
  if (pressed) {
    rect = { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 };
  }

  ctx.save();
  ctx.globalAlpha = disabled ? 0.42 : (opts.alpha === undefined ? 1 : opts.alpha);

  var g = typeof ctx.createLinearGradient === "function"
    ? ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h)
    : null;
  draw.rr(ctx, rect.x, rect.y, rect.w, rect.h, radius);
  if (g) {
    g.addColorStop(0, st.top);
    g.addColorStop(1, st.bottom);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = st.top;
  }
  ctx.fill();
  if (st.stroke) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = st.stroke;
    ctx.stroke();
  } else {
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.stroke();
  }

  var fontSize = opts.size || Math.round(16 * s);
  var labelY = opts.sub ? rect.y + rect.h * 0.26 : rect.y + rect.h / 2 - fontSize * 0.62;
  draw.text(ctx, opts.label, rect.x + rect.w / 2, labelY, {
    size: fontSize,
    bold: true,
    align: "center",
    color: st.text
  });
  if (opts.sub) {
    draw.text(ctx, opts.sub, rect.x + rect.w / 2, rect.y + rect.h * 0.58, {
      size: Math.round(11 * s),
      align: "center",
      color: st.text,
      alpha: 0.75
    });
  }
  ctx.restore();

  if (!disabled) {
    pushHit({ id: opts.id, rect: r, meta: opts.meta, kind: "button" });
  }
  return pressed;
}

/** 顶部信息条（资源/状态） */
function chip(ctx, rect, opts) {
  var screen = state.screen;
  var s = screen ? screen.s : 1;
  draw.fillRR(ctx, rect, opts.bg || "rgba(255,255,255,0.07)", Math.round(rect.h / 2));
  var size = opts.size || Math.round(12 * s);
  draw.text(ctx, opts.label, rect.x + Math.round(8 * s), rect.y + rect.h / 2 - size * 0.62, {
    size: size,
    color: opts.color || P.ink,
    bold: true
  });
  return rect;
}

/** 通用卡片（可点击）：标题 + 描述 + 右侧数值 */
function card(ctx, opts) {
  var screen = state.screen;
  var s = screen ? screen.s : 1;
  var r = opts.rect;
  var pressed = state.pressedId === opts.id;
  var disabled = opts.disabled === true;

  ctx.save();
  ctx.globalAlpha = disabled ? 0.45 : 1;
  draw.panel(ctx, { x: r.x, y: r.y + (pressed ? 1 : 0), w: r.w, h: r.h }, {
    radius: Math.round(12 * s),
    fillTop: opts.highlight ? "#26414F" : "#1C3140",
    fillBottom: opts.highlight ? "#1B303C" : "#152731",
    strokeColor: opts.strokeColor || (opts.highlight ? P.gold : P.line)
  });

  var pad = Math.round(12 * s);
  var titleSize = opts.titleSize || Math.round(15 * s);
  var bodySize = opts.bodySize || Math.round(12 * s);
  var cursorY = r.y + pad + (pressed ? 1 : 0);

  if (opts.badge) {
    var bw = draw.measure(ctx, opts.badge, Math.round(10 * s), true) + Math.round(14 * s);
    var badgeRect = { x: r.x + r.w - pad - bw, y: cursorY, w: bw, h: Math.round(18 * s) };
    draw.fillRR(ctx, badgeRect, opts.badgeColor || "rgba(224,177,92,0.16)", Math.round(9 * s));
    draw.text(ctx, opts.badge, badgeRect.x + bw / 2, badgeRect.y + Math.round(3 * s), {
      size: Math.round(10 * s),
      align: "center",
      bold: true,
      color: opts.badgeTextColor || P.gold
    });
  }

  draw.text(ctx, opts.title, r.x + pad, cursorY, {
    size: titleSize,
    bold: true,
    color: opts.titleColor || P.ink,
    maxWidth: r.w - pad * 2 - (opts.badge ? Math.round(52 * s) : 0)
  });
  cursorY += Math.round(titleSize * 1.5);

  if (opts.body) {
    var used = draw.text(ctx, opts.body, r.x + pad, cursorY, {
      size: bodySize,
      color: opts.bodyColor || P.inkDim,
      wrap: r.w - pad * 2,
      lineHeight: Math.round(bodySize * 1.55)
    });
    cursorY += used;
  }
  if (opts.foot) {
    draw.text(ctx, opts.foot, r.x + pad, r.y + r.h - pad - Math.round(bodySize * 1.4), {
      size: Math.round(11 * s),
      color: opts.footColor || P.gold,
      bold: true
    });
  }
  ctx.restore();

  if (opts.id && !disabled) {
    pushHit({ id: opts.id, rect: r, meta: opts.meta, kind: opts.kind || "card" });
  }
  return cursorY;
}

/** 段落文本块，返回占用高度 */
function paragraph(ctx, str, x, y, width, opts) {
  var screen = state.screen;
  var s = screen ? screen.s : 1;
  var size = (opts && opts.size) || Math.round(13 * s);
  return draw.text(ctx, str, x, y, {
    size: size,
    color: (opts && opts.color) || P.inkDim,
    wrap: width,
    lineHeight: (opts && opts.lineHeight) || Math.round(size * 1.65),
    align: (opts && opts.align) || "left"
  });
}

/** 分区小标题 */
function section(ctx, label, x, y, width) {
  var screen = state.screen;
  var s = screen ? screen.s : 1;
  var size = Math.round(12 * s);
  draw.text(ctx, label, x, y, { size: size, color: P.gold, bold: true });
  var lineY = y + size * 1.7;
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = P.line;
  ctx.fillRect(x, lineY, width, 1);
  ctx.restore();
  return lineY + Math.round(8 * s);
}

module.exports = {
  beginFrame: beginFrame,
  setPressed: setPressed,
  hitTest: hitTest,
  inRect: inRect,
  button: button,
  chip: chip,
  card: card,
  paragraph: paragraph,
  section: section,
  pushHit: pushHit,
  getHits: function () { return state.hits; }
};

});

define("js/game/config.js", function(module, exports, require) {
/**
 * config.js —— 全局数值与常量（唯一数值来源）
 *
 * 调参只改这里，禁止在场景/逻辑里写魔法数字。
 * 单位约定：毫秒、点、枚。
 */

module.exports = {
  /** 存档结构版本：改动 state 结构必须 +1，并在 storage 里补迁移 */
  schemaVersion: 5,
  storageKey: "train-mystery-v3-save",
  legacyKeys: ["train-mystery-douyin-save-v2", "train-mystery-roguelike-save-v4"],

  /* ---------- 诊断与预算 ---------- */
  perf: {
    /**
     * 绘制指令计数（js/core/metrics.js）。默认开：一帧几百次调用多一层转发，
     * 实测对 renderMs 无可见影响，换来的是「掉帧时能看出是不是画得太多」。
     * 真机上若哪天这一层变贵了，置 false 即可整体关掉，渲染行为不变。
     */
    instrument: true,
    /** 单帧光栅化调用预算（fill/stroke/文字/贴图），测试按它兜底 */
    paintBudget: 400
  },

  /* ---------- 激励视频 ------ */
  rewardedVideoAdUnitId: "REPLACE_WITH_YOUR_AD_UNIT_ID",
  adDailyLimit: 15,
  adReviveHp: 70,

  /* ---------- 三资源上限 ---------- */
  maxHp: 100,
  maxHunger: 100,
  maxSanity: 100,
  maxEther: 9999,
  maxGold: 999,

  /* ---------- 玩家基础战斗 ---------- */
  baseAttack: 16,
  preciseBonus: 4,
  powerBonus: 12,
  powerHitRate: 0.68,
  defendShield: 12,
  defendNextAttackBonus: 5,
  potionHeal: 30,
  /** 每场战斗胜利后的基础回血（容错，不依赖强化） */
  healAfterWin: 4,
  portableFoodRestore: 50,
  dailyFoodRestore: 30,

  /* ---------- 路线与消耗 ---------- */
  /** 单局层数（不含 Boss 层） */
  routeLayers: 8,
  layerMinNodes: 2,
  layerMaxNodes: 4,
  hungerPerNode: 6,
  sanityPerBattle: 5,
  sanityPerRun: 5,
  sanityDangerLine: 20,
  /** 逃跑成本（以太碎片），可被强化免除 */
  escapeCost: 12,

  /* ---------- 局外 ---------- */
  /** 精神恢复装置冷却 */
  sanityRestoreCooldownMs: 3 * 60 * 1000,
  starterEther: 40,
  starterGold: 4,
  dailyFoodByDiner: 6,
  medbayHealBonus: 5,
  engineEtherBonus: 0.15,
  /** 列车升级：单价随等级线性递增 */
  trainUpgrades: {
    diner: { name: "餐车", desc: "每日补给 +6 饱食度", baseEther: 60, baseGold: 1, maxLevel: 5 },
    medbay: { name: "医务室", desc: "回血药剂 +5 治疗量", baseEther: 70, baseGold: 1, maxLevel: 5 },
    engine: { name: "动力室", desc: "结算以太 +15%", baseEther: 80, baseGold: 2, maxLevel: 5 },
    cargo: { name: "货舱", desc: "开局多带道具（药/口粮/重战卡/秒杀卡）", baseEther: 90, baseGold: 2, maxLevel: 5 },
    observatory: { name: "观景台", desc: "解锁每日挑战，每级 +10% 挑战奖励", baseEther: 110, baseGold: 2, maxLevel: 5 }
  },

  /** 货舱按等级发的开局道具：索引 = 等级 */
  cargoGrants: [
    {},
    { potion: 1 },
    { potion: 1, portableFood: 1 },
    { potion: 1, portableFood: 1, retryCard: 1 },
    { potion: 2, portableFood: 1, retryCard: 1 },
    { potion: 2, portableFood: 1, retryCard: 1, executeCard: 1 }
  ],

  /* ---------- 精英词缀 ---------- */
  /** 精英额外血量倍率：词缀加了行为，血量就不该再叠太多 */
  eliteHpMul: 0.9,
  /** 精英基础强化候选数 */
  eliteEnhanceBase: 4,

  /* ---------- 每日挑战 ---------- */
  daily: {
    /** 观景台达到该等级才开放 */
    unlockLevel: 1,
    /** 完成挑战的基础以太 */
    baseReward: 90,
    /** 每层额外以太 */
    rewardPerLayer: 8,
    /** 观景台每级奖励加成 */
    rewardBonusPerLevel: 0.1,
    modifierCount: 3
  },

  /* ---------- 图鉴 ---------- */
  codex: {
    /** 每达到一档进度发一次奖励（百分比） */
    tiers: [25, 50, 75, 100],
    rewardPerTier: 60
  },

  /* ---------- 音频 ---------- */
  audio: {
    sfxBasePath: "assets/audio/",
    bgmBasePath: "assets/audio/",
    bgmVolume: 0.42,
    bgmFadeMs: 600,
    /** 场景 → BGM 曲目 */
    trackByScene: { home: "bgm_home", train: "bgm_home", route: "bgm_route" },
    trackBattle: "bgm_battle",
    trackResult: "bgm_home"
  },

  /* ---------- 首次进入引导 ---------- */
  tutorialCopy: [
    "在分支节点之间选路，路线决定这一局的难度和收益。",
    "战斗有四种行动：精准、强力、防御、道具。强力命中率低但伤害高。",
    "战斗与宝箱会给「强化」，宝箱与精英会给「遗物」，本局结束后清空。"
  ]
};

});

define("js/game/data/achievements.js", function(module, exports, require) {
/**
 * data/achievements.js —— 成就（纯数据，声明式）
 *
 * 这里只声明「指标 + 目标值」，指标由 state.js 的 computeMetrics 统一计算。
 * 不在数据里写函数的原因和强化/遗物一致：数据要能被遍历、被测试、被面板展示。
 *
 * 奖励只给以太与称号，不给战力——给战力会直接破坏每局的平衡。
 */

var ACHIEVEMENTS = [
  { id: "firstClear", name: "初次穿越", desc: "首次击败关底首领。", metric: "bossClears", target: 1, reward: 80 },
  { id: "clear3", name: "熟门熟路", desc: "累计通关 3 次。", metric: "bossClears", target: 3, reward: 160 },
  { id: "clear8", name: "老乘客", desc: "累计通关 8 次。", metric: "bossClears", target: 8, reward: 320 },
  { id: "reachBoss", name: "抵达尽头", desc: "抵达最深一层。", metric: "bestLayer", target: 8, reward: 100 },
  { id: "relic5", name: "满载而归", desc: "单局携带 5 件遗物。", metric: "maxRelics", target: 5, reward: 140 },
  { id: "enh10", name: "构筑成型", desc: "单局获得 10 项强化。", metric: "maxEnhancements", target: 10, reward: 160 },
  { id: "perfectBoss", name: "毫发无伤", desc: "满生命击败关底首领。", metric: "perfectBossWins", target: 1, reward: 240 },
  { id: "lowSanityClear", name: "精神临界", desc: "精神低于 30 时通关。", metric: "lowSanityClears", target: 1, reward: 220 },
  { id: "noRelicClear", name: "赤手空拳", desc: "不带任何遗物通关。", metric: "noRelicClears", target: 1, reward: 260 },
  { id: "codexHalf", name: "博物学者", desc: "图鉴进度达到 50%。", metric: "codexPercent", target: 50, reward: 200 },
  { id: "codexFull", name: "全知乘客", desc: "图鉴进度达到 100%。", metric: "codexPercent", target: 100, reward: 500 },
  { id: "daily3", name: "每日常客", desc: "完成 3 次每日挑战。", metric: "dailyClears", target: 3, reward: 180 }
];

function getById(id) {
  var i;
  for (i = 0; i < ACHIEVEMENTS.length; i += 1) {
    if (ACHIEVEMENTS[i].id === id) return ACHIEVEMENTS[i];
  }
  return null;
}

module.exports = {
  ACHIEVEMENTS: ACHIEVEMENTS,
  getById: getById
};

});

define("js/game/data/affixes.js", function(module, exports, require) {
/**
 * data/affixes.js —— 精英词缀（纯数据）
 *
 * 设计原则：词缀是「数值修饰 + 复用已有战斗分支」，不新写战斗流程。
 * 4 个精英模板 × 8 个词缀 = 32 种精英组合，比单纯堆敌人更省、更耐玩。
 *
 * 每个词缀必须在 state.js 里有真实行为分支，否则就是一个名字与行为不符的空壳。
 * （test-headless 会用正则反查源码，缺分支直接红）
 */

var AFFIXES = [
  {
    id: "frenzy",
    name: "狂暴",
    desc: "伤害 +30%，但每次出手自伤 2 点。",
    color: "#E06A5A",
    damageMul: 1.3,
    selfDamage: 2
  },
  {
    id: "bulwark",
    name: "壁垒",
    desc: "每 3 回合立起 12 点护盾。",
    color: "#4FC0B0",
    shieldEvery: 3,
    shieldAmount: 12
  },
  {
    id: "venom",
    name: "毒化",
    desc: "命中后让你每回合额外损失 3 点生命，持续 3 回合。",
    color: "#7FA84F",
    poison: 3
  },
  {
    id: "summon",
    name: "召唤",
    desc: "首回合与第 4 回合各召来一次扑咬，额外 5 点伤害。",
    color: "#9B7FD4",
    summonTurns: [1, 4],
    summonDamage: 5
  },
  {
    id: "swift",
    name: "迅捷",
    desc: "首回合抢先攻击两次。",
    color: "#E0B15C",
    swiftTurn: 1
  },
  {
    id: "mirrorA",
    name: "镜像",
    desc: "命中时反弹 4 点伤害。",
    color: "#9FC6D4",
    reflect: 4
  },
  {
    id: "greedy",
    name: "贪婪",
    desc: "赏金翻倍，但攻击力 +20%。",
    color: "#E0B15C",
    damageMul: 1.2,
    goldMul: 2
  },
  {
    id: "echo",
    name: "残响",
    desc: "首次死亡时以 40% 生命复活，继续战斗。",
    color: "#C2703E",
    reviveRatio: 0.4
  }
];

function getById(id) {
  var i;
  for (i = 0; i < AFFIXES.length; i += 1) {
    if (AFFIXES[i].id === id) return AFFIXES[i];
  }
  return null;
}

/** Boss 不吃词缀：Boss 本身已经有一套独立行为，再叠词缀会失控 */
function rollFor(pickFn) {
  return pickFn(AFFIXES);
}

module.exports = {
  AFFIXES: AFFIXES,
  getById: getById,
  rollFor: rollFor
};

});

define("js/game/data/daily.js", function(module, exports, require) {
/**
 * data/daily.js —— 每日挑战：限制条件池与日期种子
 *
 * 每日挑战不需要服务端：用日期字符串做种子，同一天所有玩家拿到同一条路线、
 * 同一组限制条件。这是「零后端也能做全服一致性」的标准做法。
 *
 * 每个限制条件都必须被 state.js 读取并真正生效，否则就只是装饰。
 */

var MODIFIERS = [
  {
    id: "frailBody",
    name: "脆弱躯壳",
    desc: "生命上限 -25。",
    maxHpDelta: -25
  },
  {
    id: "harshLand",
    name: "荒芜地带",
    desc: "每次移动额外消耗 3 饱食。",
    hungerPerNodeDelta: 3
  },
  {
    id: "swiftFoes",
    name: "凶暴之敌",
    desc: "敌人伤害 +20%。",
    enemyDamageMul: 1.2
  },
  {
    id: "thinAir",
    name: "稀薄空气",
    desc: "精神消耗翻倍。",
    sanityCostMul: 2
  },
  {
    id: "poorStart",
    name: "身无分文",
    desc: "开局没有以太碎片。",
    startEther: 0
  },
  {
    id: "fewChoices",
    name: "思路受限",
    desc: "每次强化只有 2 个候选。",
    enhanceChoiceDelta: -1
  },
  {
    id: "pricey",
    name: "物价飞涨",
    desc: "商店价格翻倍。",
    shopPriceMul: 2
  }
];

/** FNV-1a 变体：把 YYYY-MM-DD 变成稳定的 32 位种子 */
function seedFromDate(dateKey) {
  var text = String(dateKey || "1970-01-01");
  var hash = 2166136261;
  var i;
  for (i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul ? Math.imul(hash, 16777619) : (hash * 16777619) >>> 0;
  }
  return hash >>> 0;
}

/**
 * 按种子取 3 个互不相同的限制条件。
 * 用「种子做游标 + 步长互质」的确定性洗牌，保证同一天结果完全一致。
 */
function rollModifiers(seed) {
  var pool = MODIFIERS.slice();
  var state = seed >>> 0;
  var picked = [];
  var count = 3;
  var i;
  for (i = 0; i < count && pool.length; i += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    var index = state % pool.length;
    picked.push(pool[index]);
    pool.splice(index, 1);
  }
  return picked;
}

/** 把限制条件合并成一个便于读取的对象（全部给默认值，避免到处判空） */
function combine(modifiers) {
  var out = {
    maxHpDelta: 0,
    hungerPerNodeDelta: 0,
    enemyDamageMul: 1,
    sanityCostMul: 1,
    startEther: null,
    enhanceChoiceDelta: 0,
    shopPriceMul: 1
  };
  var list = modifiers || [];
  var i;
  for (i = 0; i < list.length; i += 1) {
    var m = list[i];
    if (m.maxHpDelta) out.maxHpDelta += m.maxHpDelta;
    if (m.hungerPerNodeDelta) out.hungerPerNodeDelta += m.hungerPerNodeDelta;
    if (m.enemyDamageMul) out.enemyDamageMul *= m.enemyDamageMul;
    if (m.sanityCostMul) out.sanityCostMul *= m.sanityCostMul;
    if (typeof m.startEther === "number") out.startEther = m.startEther;
    if (m.enhanceChoiceDelta) out.enhanceChoiceDelta += m.enhanceChoiceDelta;
    if (m.shopPriceMul) out.shopPriceMul *= m.shopPriceMul;
  }
  return out;
}

module.exports = {
  MODIFIERS: MODIFIERS,
  seedFromDate: seedFromDate,
  rollModifiers: rollModifiers,
  combine: combine
};

});

define("js/game/data/effects.js", function(module, exports, require) {
/**
 * data/effects.js —— 效果字段定义与合并
 *
 * 设计原则：所有强化/遗物都是「往 effects 里加数」，不存函数。
 * 好处：存档可序列化、效果可面板展示、加新词条不用改逻辑。
 */

/** 可累加的数值型效果 */
var NUMERIC_KEYS = [
  "attackFlat",            // 攻击力加成
  "firstTurnShield",       // 每场战斗首回合护盾
  "healAfterBattle",       // 战后回血
  "hungerCostDelta",       // 节点移动饱食消耗增减（负数=减少）
  "lowSanityBonus",        // 低精神伤害加成（比例）
  "potionBonus",           // 药剂额外治疗
  "eventRewardBoost",      // 事件收益加成（比例）
  "campHealBonus",         // 营地额外回血
  "bossDamageBonus",       // 对 Boss 伤害加成（比例）
  "restoreSanityEveryThree", // 每 3 节点回精神
  "battleBonusGold",       // 战斗额外金币
  "foodRecoveryEveryTwo",  // 每 2 节点回饱食
  "lowSanityDamageReduction", // 低精神受伤减免（比例）
  "extraEliteEnhanceChoice",  // 精英额外强化候选
  "maxHpBonus",            // 生命上限加成
  "reviveHealBonus",       // 复活额外血量
  "critChance",            // 精准射击暴击率（0—1，叠加上限在逻辑里夹）
  "defendShieldBonus",     // 防御额外护盾
  "lowHpDamageBonus",      // 生命低于 40% 时的伤害加成（比例）
  "firstStrikeBonus"       // 每场战斗第一击的额外伤害
];

/** 布尔型效果 */
var FLAG_KEYS = [
  "escapeFree",       // 逃跑免以太
  "autoReviveOnce"    // 濒死自动复活一次
];

function emptyEffects() {
  var out = {};
  var i;
  for (i = 0; i < NUMERIC_KEYS.length; i += 1) out[NUMERIC_KEYS[i]] = 0;
  for (i = 0; i < FLAG_KEYS.length; i += 1) out[FLAG_KEYS[i]] = false;
  out.firstShopDiscount = null;
  return out;
}

/** 把 effects 增量叠加到 target（就地修改），返回 target */
function addEffects(target, effects) {
  if (!effects) return target;
  var key;
  for (key in effects) {
    if (!Object.prototype.hasOwnProperty.call(effects, key)) continue;
    var value = effects[key];
    if (value === null || value === undefined) continue;
    if (typeof value === "number") {
      target[key] = (typeof target[key] === "number" ? target[key] : 0) + value;
    } else if (typeof value === "boolean") {
      target[key] = target[key] || value;
    } else {
      // firstShopDiscount 这类一次性配置，取第一次设置的值
      if (target[key] === null || target[key] === undefined) target[key] = value;
    }
  }
  return target;
}

module.exports = {
  NUMERIC_KEYS: NUMERIC_KEYS,
  FLAG_KEYS: FLAG_KEYS,
  emptyEffects: emptyEffects,
  addEffects: addEffects
};

});

define("js/game/data/enemies.js", function(module, exports, require) {
/**
 * data/enemies.js —— 敌人模板
 *
 * 字段：
 * - material: 受击材质（metal / flesh / cloth / void，决定打击音色与粒子色；
 *             纯表现，不参与任何数值。新增敌人必须给，缺省会被测试标记）
 * - themes:   车厢主题权重标签（可选，命中的主题下更容易抽到）
 * - trait:     行为特性（决定 enemyTurn / battleAction 的分支）
 * - figure:    剪影形状（normal / elite / boss）
 * - hpRange:   血量区间（普通怪用，随机取值）
 * - hp:        固定血量（精英 / Boss 用）
 * - damageRange: 单次攻击伤害区间
 * - reward:    击败奖励
 * - layerMin:  从第几层开始可能出现
 * - intro:     首次遭遇的战斗日志文案
 *
 * 扩充新敌人只需往数组里加一条；但如果用了新 trait，
 * 必须同时在 state.js 的 enemyTurn / battleAction 里实现对应行为，
 * 否则它会退化成「白板怪」——名字唬人但什么都不做。
 */

var ENEMIES = [
  /* ---------------- 普通 ---------------- */
  {
    id: "strayHound",
    material: "flesh",
    name: "反击猎犬",
    kind: "normal",
    trait: "wolf",
    figure: "normal",
    color: "#9FB0BA",
    hpRange: [32, 40],
    damageRange: [8, 13],
    reward: { ether: 22, gold: 0 },
    layerMin: 1,
    intro: "受击后会反扑，强力射击有几率被侧闪。"
  },
  {
    id: "guardConstruct",
    material: "metal",
    name: "坚守构体",
    kind: "normal",
    trait: "idol",
    figure: "normal",
    color: "#7C93A0",
    hpRange: [38, 46],
    damageRange: [6, 10],
    reward: { ether: 22, gold: 1 },
    layerMin: 1,
    intro: "每 3 回合立盾 10 点，拖慢你的节奏。"
  },
  {
    id: "shallowWisp",
    material: "cloth",
    themes: ["frost"],
    name: "浅域游魂",
    kind: "normal",
    trait: "wisp",
    figure: "normal",
    color: "#6FA9B8",
    hpRange: [28, 34],
    damageRange: [7, 12],
    reward: { ether: 20, gold: 0 },
    layerMin: 1,
    intro: "奇数回合吸收残光，恢复少量生命。"
  },
  {
    id: "noiseStalker",
    material: "cloth",
    name: "噪响潜伏者",
    kind: "normal",
    trait: "assassin",
    figure: "normal",
    color: "#8C7FA8",
    hpRange: [30, 36],
    damageRange: [9, 14],
    reward: { ether: 23, gold: 0 },
    layerMin: 2,
    intro: "会蓄势，下一击更重。"
  },
  {
    id: "rustScavenger",
    material: "metal",
    name: "锈蚀拾荒者",
    kind: "normal",
    trait: "armored",
    figure: "normal",
    color: "#A88F6A",
    hpRange: [34, 42],
    damageRange: [7, 12],
    reward: { ether: 22, gold: 1 },
    layerMin: 1,
    intro: "裹着废铁甲片，每次受击少掉 3 点血。"
  },
  {
    id: "corpseLamp",
    material: "void",
    themes: ["ember"],
    name: "尸灯",
    kind: "normal",
    trait: "vampire",
    figure: "normal",
    color: "#B7706A",
    hpRange: [30, 38],
    damageRange: [8, 13],
    reward: { ether: 23, gold: 0 },
    layerMin: 2,
    intro: "每次打中你会吸走部分血量补给自己。"
  },
  {
    id: "beetleSwarm",
    material: "flesh",
    name: "甲虫群",
    kind: "normal",
    trait: "swarm",
    figure: "normal",
    color: "#8FA97A",
    hpRange: [26, 32],
    damageRange: [6, 10],
    reward: { ether: 21, gold: 0 },
    layerMin: 2,
    intro: "每 3 回合成群扑咬，一回合打两下。"
  },
  {
    id: "glassEcho",
    material: "metal",
    themes: ["frost"],
    name: "玻璃回响",
    kind: "normal",
    trait: "mirror",
    figure: "normal",
    color: "#86B8C8",
    hpRange: [28, 36],
    damageRange: [8, 12],
    reward: { ether: 23, gold: 0 },
    layerMin: 3,
    intro: "受击时把 3 点伤害反射回你身上。"
  },
  {
    id: "cinderHound",
    material: "flesh",
    themes: ["ember"],
    name: "灰烬猎犬",
    kind: "normal",
    trait: "bomber",
    figure: "normal",
    color: "#C77A4C",
    hpRange: [24, 30],
    damageRange: [9, 14],
    reward: { ether: 24, gold: 0 },
    layerMin: 3,
    intro: "死亡时会炸出一片余烬，扣你 10 点生命。"
  },
  {
    id: "ticketGhost",
    material: "cloth",
    name: "检票幽灵",
    kind: "normal",
    trait: "wisp",
    figure: "normal",
    color: "#7D9BB0",
    hpRange: [30, 36],
    damageRange: [7, 11],
    reward: { ether: 22, gold: 1 },
    layerMin: 3,
    intro: "在残光里不断修补自己。"
  },
  {
    id: "ironMoth",
    material: "metal",
    themes: ["frost"],
    name: "铁翼蛾",
    kind: "normal",
    trait: "armored",
    figure: "normal",
    color: "#B3A98C",
    hpRange: [36, 44],
    damageRange: [8, 13],
    reward: { ether: 23, gold: 0 },
    layerMin: 4,
    intro: "翅膀覆着金属鳞粉，很难打出有效伤害。"
  },
  {
    id: "wailingBride",
    material: "flesh",
    themes: ["frost"],
    name: "哀鸣新娘",
    kind: "normal",
    trait: "vampire",
    figure: "normal",
    color: "#B985A8",
    hpRange: [32, 40],
    damageRange: [9, 14],
    reward: { ether: 25, gold: 1 },
    layerMin: 5,
    intro: "她的哭声会顺着伤口往里渗。"
  },

  /* ---------------- 精英 ---------------- */
  {
    id: "riftHunter",
    material: "void",
    name: "裂隙执猎者",
    kind: "elite",
    trait: "assassin",
    figure: "elite",
    color: "#C98A5E",
    hp: [64, 76],
    damageRange: [11, 17],
    reward: { ether: 38, gold: 2 },
    layerMin: 2,
    intro: "精英：蓄势突袭，会给 4 个强化候选。"
  },
  {
    id: "ironWarden",
    material: "metal",
    name: "铁锈守望",
    kind: "elite",
    trait: "idol",
    figure: "elite",
    color: "#B0A06A",
    hp: [70, 82],
    damageRange: [10, 15],
    reward: { ether: 40, gold: 2 },
    layerMin: 4,
    intro: "精英：护盾频繁，需要高爆发。"
  },
  {
    id: "shardGolem",
    material: "metal",
    name: "碎片魔像",
    kind: "elite",
    trait: "armored",
    figure: "elite",
    color: "#9AA7B5",
    hp: [76, 88],
    damageRange: [11, 16],
    reward: { ether: 42, gold: 2 },
    layerMin: 3,
    intro: "精英：整体由甲片构成，硬碰硬会吃亏。"
  },
  {
    id: "twinEcho",
    material: "void",
    themes: ["frost"],
    name: "双生回响",
    kind: "elite",
    trait: "mirror",
    figure: "elite",
    color: "#8FB0D0",
    hp: [68, 80],
    damageRange: [12, 18],
    reward: { ether: 44, gold: 2 },
    layerMin: 5,
    intro: "精英：每次被击中都会把伤害反射回来。"
  },

  /* ---------------- Boss ---------------- */
  {
    id: "riftWarden",
    material: "void",
    name: "裂隙看守者",
    kind: "boss",
    trait: "overlord",
    figure: "boss",
    color: "#D8574A",
    hp: [112, 112],
    damageRange: [12, 18],
    reward: { ether: 90, gold: 4 },
    layerMin: 99,
    intro: "Boss：每 2 回合加盾 8 点，每 3 回合蓄势重击。",
    /**
     * 第二形态：双影。
     *
     * 它是五个 Boss 里唯一「变多」的那个，所以机制也必须是数量：一回合打两段。
     * 两段的单段伤害只有 55%，总和几乎不变——换的不是数值而是「防御架势只挡得住
     * 第一段」这件事。玩家蹲一回合换来的免伤，在它面前只剩一半。
     */
    phase2: {
      label: "双影",
      // hint 写在「打之前」：它不剧透，只让玩家在开战前多看一眼影子。
      // 剧透会把惊喜变成说明书，完全不提又会让崩开显得凭空出现——
      // 埋一个可以被忽略、也可以在事后想起来的细节，是这两者之间唯一的位置。
      // callback 是它在半血那一下的兑现：同一幅画面的第二拍，不是复读 hint，
      // 也不是解释机制（机制在 tip 里）。
      hint: "它站在灯下的角度不太对——影子比身体多出一层。",
      callback: "你终于看清了——它从来都不是一个。",
      line: "它从正中裂开，第二个影子站了起来。",
      tip: "每回合两段攻击，防御架势只挡得住第一段。",
      dmgAdd: 1,
      shield: 10,
      cadence: 2,
      hits: 2,
      hitScale: 0.55
    }
  },
  {
    id: "facelessConductor",
    material: "void",
    name: "无面车长",
    kind: "boss",
    trait: "overlord",
    figure: "boss",
    color: "#B24B66",
    hp: [118, 118],
    damageRange: [13, 18],
    reward: { ether: 96, gold: 4 },
    layerMin: 99,
    intro: "Boss：检票的节奏越来越快，蓄势重击一次比一次狠。",
    /**
     * 第二形态：查票。
     *
     * 车长的本职是核对——第二形态就把「核对」从检票挪到你的动作上：
     * 连续两回合用同一招，这一击伤害 +45%。它惩罚的是重复，不是某个具体招式，
     * 所以四个行动都不吃亏，吃亏的是「一直按同一个按钮」。
     */
    phase2: {
      label: "查票",
      hint: "它手里捏着一沓票根，每一张都写着同一个名字。",
      callback: "那沓票根上记的，是你每一次出手。",
      line: "它把票根翻过来，开始照着你上一回合念。",
      tip: "重复上回合的同一招，这一击伤害 +45%。",
      dmgAdd: 1,
      shield: 12,
      cadence: 2,
      repeatPunish: 0.45
    }
  },
  {
    id: "rustStoker",
    material: "metal",
    themes: ["ember"],
    name: "锈血司炉",
    kind: "boss",
    trait: "armored",
    figure: "boss",
    color: "#C2703E",
    hp: [126, 126],
    damageRange: [12, 17],
    reward: { ether: 92, gold: 5 },
    layerMin: 99,
    intro: "Boss：整节锅炉都是它的躯壳，每次受击都要先啃穿一层铁。",
    /**
     * 第二形态：过载。
     *
     * 它把炉门顶开，把自己也点了——出手重 30%，但每回合自损 5 点。
     * 这是唯一一个「变强同时变脆」的形态：玩家不用变强，只要拖住。
     * 换阶段护盾也给得最少（8），因为它的第二形态本来就该是「赶紧的」。
     */
    phase2: {
      label: "过载",
      hint: "炉温还在往上走，铁皮已经开始发红发亮。",
      callback: "铁皮红得发亮——原来那不是灯光。",
      line: "炉门被顶开，火从它的缝里烧出来——它也烧起来了。",
      tip: "出手重 30%，但它每回合自损 5 点生命。",
      dmgAdd: 0,
      shield: 8,
      cadence: 2,
      dmgMul: 1.3,
      selfBleed: 5
    }
  },

  /* ================= 第二批次：新特性 + 深水区敌人 =================
   *
   * 这一批的设计目的不是「更多名字」，而是给后期（L5—L8）换节奏：
   * 前面几层靠熟悉度就能过，从第 5 层开始要读行为。
   *
   * 新特性说明：
   * - weaver 织网：每 3 回合缠住你，下一击伤害 -35%（不封行动，只削弱）
   * - parasite 寄生：命中后挂卵，2 回合后孵化，扣 12 血并给敌人回 10
   * - enrage 狂化：首次跌破半血时永久加攻 45%（一刀更比一刀狠）
   * - gambler 赌徒：伤害在 50%—170% 之间浮动（平均值不变，方差变大）
   */

  /* ---------------- 普通 · 第二批 ---------------- */
  {
    id: "threadWeaver",
    material: "cloth",
    themes: ["frost"],
    name: "织网蛛",
    kind: "normal",
    trait: "weaver",
    figure: "normal",
    color: "#7E8FA6",
    hpRange: [30, 38],
    damageRange: [7, 11],
    reward: { ether: 24, gold: 0 },
    layerMin: 3,
    intro: "每 3 回合吐网，你下一击的伤害会被拖慢。"
  },
  {
    id: "broodHost",
    material: "flesh",
    name: "育卵客",
    kind: "normal",
    trait: "parasite",
    figure: "normal",
    color: "#A87D8C",
    hpRange: [36, 44],
    damageRange: [7, 11],
    reward: { ether: 25, gold: 0 },
    layerMin: 4,
    intro: "命中后在你体内产卵，两回合后孵化——要么速杀，要么挨一下。"
  },
  {
    id: "frenziedMiner",
    material: "flesh",
    themes: ["ember"],
    name: "狂乱矿工",
    kind: "normal",
    trait: "enrage",
    figure: "normal",
    color: "#B0855F",
    hpRange: [40, 48],
    damageRange: [8, 12],
    reward: { ether: 26, gold: 1 },
    layerMin: 4,
    intro: "血掉到一半会彻底发狂，攻势永久加重。"
  },
  {
    id: "boneGambler",
    material: "flesh",
    name: "骸骨赌徒",
    kind: "normal",
    trait: "gambler",
    figure: "normal",
    color: "#9C8FA0",
    hpRange: [34, 42],
    damageRange: [6, 16],
    reward: { ether: 27, gold: 1 },
    layerMin: 2,
    intro: "出手轻重全凭运气，伤害在五成到一成七之间跳。"
  },
  {
    id: "ashPilgrim",
    material: "cloth",
    themes: ["ember"],
    name: "灰烬朝圣者",
    kind: "normal",
    trait: "wisp",
    figure: "normal",
    color: "#8FA3B5",
    hpRange: [32, 40],
    damageRange: [6, 10],
    reward: { ether: 23, gold: 0 },
    layerMin: 3,
    intro: "每 2 回合的吸收残光，拖得越久它越精神。"
  },
  {
    id: "chainHound",
    material: "flesh",
    name: "锁链猎犬",
    kind: "normal",
    trait: "wolf",
    figure: "normal",
    color: "#96A2AD",
    hpRange: [30, 38],
    damageRange: [9, 14],
    reward: { ether: 25, gold: 0 },
    layerMin: 5,
    intro: "受击必反扑，拖在地上的铁链会跟着扫过来。"
  },
  {
    id: "rustPreacher",
    material: "flesh",
    name: "锈蚀布道者",
    kind: "normal",
    trait: "vampire",
    figure: "normal",
    color: "#A9707A",
    hpRange: [38, 46],
    damageRange: [8, 12],
    reward: { ether: 26, gold: 0 },
    layerMin: 5,
    intro: "打着布道的名义饮血，打空伤害它就吸不到。"
  },

  /* ---------------- 精英 · 第二批 ---------------- */
  {
    id: "weaverMatron",
    material: "cloth",
    themes: ["frost"],
    name: "织巢母体",
    kind: "elite",
    trait: "weaver",
    figure: "elite",
    color: "#6B7E98",
    hp: [84, 94],
    damageRange: [9, 14],
    reward: { ether: 78, gold: 3 },
    layerMin: 6,
    intro: "整节车厢都是它的网。每 3 回合把你按在原地一下。"
  },
  {
    id: "hollowKing",
    material: "void",
    themes: ["ember"],
    name: "空洞之王",
    kind: "elite",
    trait: "enrage",
    figure: "elite",
    color: "#B4626F",
    hp: [90, 100],
    damageRange: [10, 15],
    reward: { ether: 84, gold: 3 },
    layerMin: 7,
    intro: "它空着的王座还在等一个名字。半血之后才是真正的它。"
  },

  /* ---------------- Boss · 第二批 ---------------- */
  {
    id: "brokenSwitchman",
    material: "metal",
    name: "断轨扳道工",
    kind: "boss",
    trait: "gambler",
    figure: "boss",
    color: "#C98A4B",
    hp: [126, 126],
    damageRange: [11, 20],
    reward: { ether: 100, gold: 5 },
    layerMin: 99,
    intro: "Boss：它每一次扳道都赌上整列车的方向，出手轻重毫无规律。",
    /**
     * 第二形态：脱轨。
     *
     * 赌徒特性本来就在掷骰，第二形态让它多掷一次：35% 概率追加一段 55% 的伤害。
     * 期望伤害只涨 19%，但方差很大——玩家算不准还剩几回合能扛，
     * 这正是扳道工该给人的感觉：不是更疼，是更没底。
     */
    phase2: {
      label: "脱轨",
      hint: "它的手一直搭在扳道上，指节在抖。",
      callback: "那只手一直按着扳道，现在终于扳下去了。",
      line: "它把道岔扳到底，铁轨的摩擦声失去了规律。",
      tip: "每次出手有 35% 概率再扳一次道，追加一击。",
      dmgAdd: 1,
      shield: 10,
      cadence: 2,
      extraChance: 0.35,
      extraScale: 0.55
    }
  },
  {
    id: "thePassenger",
    material: "flesh",
    name: "那位乘客",
    kind: "boss",
    trait: "parasite",
    figure: "boss",
    color: "#9B6E86",
    hp: [124, 124],
    damageRange: [11, 16],
    reward: { ether: 104, gold: 5 },
    layerMin: 99,
    intro: "Boss：从第一站就在车上，一直在等一个愿意让它住下的人。",
    /**
     * 第二形态：换宿主。
     *
     * 它不再站在对面，而是钻进来。所以这一段没有护盾可以挡：每回合穿盾扣 3 点，
     * 你喝下的药剂只回一半。它的护盾给得也最少（6）——它已经不在外面了，
     * 外面那层壳没有意义。玩家能做的只有一件事：在血被抽干之前把它打死。
     */
    phase2: {
      label: "换宿主",
      hint: "它看着你，眼神像在找一个能住进去的地方。",
      callback: "那双眼睛一直在找一个能住得进去的地方。",
      line: "它不再站在你对面——它钻了进来。",
      tip: "每回合穿盾掉 3 点，回血药剂只回一半。",
      dmgAdd: 1,
      shield: 6,
      cadence: 3,
      dotOnPlayer: 3,
      healCut: 0.5
    }
  },

  /* ---------------- 普通 · 第三批 ---------------- */
  // 这一批的重点不是「更多」，而是「更早」：低层数池子里原本只有 4 只普通怪，
  // 一局前十层会遇到三遍同一个。新增里 4 只 layerMin ≤ 2，把早期重复率压下去。
  // 另外锈蚀主题原本一只专属敌人都没有（全靠无标签通用怪），这批补了 4 只。
  {
    id: "couplerHusk",
    material: "metal",
    themes: ["rust"],
    name: "车钩空壳",
    kind: "normal",
    trait: "armored",
    figure: "normal",
    color: "#B08A62",
    hpRange: [36, 44],
    damageRange: [7, 11],
    reward: { ether: 22, gold: 1 },
    layerMin: 1,
    intro: "焊了三层铁皮，每次受击少掉 3 点伤害。"
  },
  {
    id: "lamplessPorter",
    material: "cloth",
    themes: ["rust"],
    name: "无灯的脚夫",
    kind: "normal",
    trait: "wisp",
    figure: "normal",
    color: "#7E8B96",
    hpRange: [28, 34],
    damageRange: [6, 10],
    reward: { ether: 21, gold: 0 },
    layerMin: 1,
    intro: "提着没点亮的灯，奇数回合吸收残光恢复生命。"
  },
  {
    id: "sootBeggar",
    material: "flesh",
    themes: ["rust"],
    name: "煤灰乞者",
    kind: "normal",
    trait: "vampire",
    figure: "normal",
    color: "#8C6B5F",
    hpRange: [30, 38],
    damageRange: [8, 13],
    reward: { ether: 23, gold: 0 },
    layerMin: 2,
    intro: "它打出的伤害有四成会变成自己的生命。"
  },
  {
    id: "frostLatch",
    material: "metal",
    themes: ["frost"],
    name: "冻锁构体",
    kind: "normal",
    trait: "idol",
    figure: "normal",
    color: "#8FB2C4",
    hpRange: [40, 48],
    damageRange: [6, 10],
    reward: { ether: 23, gold: 1 },
    layerMin: 2,
    intro: "每 3 回合把门闩焊死，获得 10 点护盾。"
  },
  {
    id: "shiverChoir",
    material: "cloth",
    themes: ["frost"],
    name: "战栗唱诗班",
    kind: "normal",
    trait: "swarm",
    figure: "normal",
    color: "#9FB6CE",
    hpRange: [26, 32],
    damageRange: [6, 10],
    reward: { ether: 24, gold: 0 },
    layerMin: 3,
    intro: "第 3 回合齐声尖啸，一回合连击两次。"
  },
  {
    id: "emberBellows",
    material: "void",
    themes: ["ember"],
    name: "鼓风余烬",
    kind: "normal",
    trait: "bomber",
    figure: "normal",
    color: "#C87A5A",
    hpRange: [22, 28],
    damageRange: [10, 15],
    reward: { ether: 25, gold: 0 },
    layerMin: 3,
    intro: "血很薄，但崩解时会炸你 10 点——不会致死。"
  },
  {
    id: "railSpider",
    material: "cloth",
    themes: ["rust"],
    name: "轨枕蛛",
    kind: "normal",
    trait: "weaver",
    figure: "normal",
    color: "#A08672",
    hpRange: [34, 42],
    damageRange: [7, 12],
    reward: { ether: 25, gold: 0 },
    layerMin: 4,
    intro: "每 3 回合吐丝，你的下一击会被拖慢。"
  },
  {
    id: "glacierTick",
    material: "flesh",
    themes: ["frost"],
    name: "霜蛰",
    kind: "normal",
    trait: "assassin",
    figure: "normal",
    color: "#7FA6A0",
    hpRange: [32, 40],
    damageRange: [10, 15],
    reward: { ether: 26, gold: 0 },
    layerMin: 5,
    intro: "会蓄势加重下一击，也有机会偏开你的强力射击。"
  },
  {
    id: "cinderMason",
    material: "metal",
    themes: ["ember"],
    name: "焦砖匠",
    kind: "normal",
    trait: "enrage",
    figure: "normal",
    color: "#A9705B",
    hpRange: [42, 50],
    damageRange: [8, 12],
    reward: { ether: 26, gold: 1 },
    layerMin: 5,
    intro: "半血之后攻势骤然变猛，伤害提升 45%。"
  },

  /* ---------------- 精英 · 第三批 ---------------- */
  {
    id: "doubleHeader",
    material: "metal",
    themes: ["rust"],
    name: "双头车首",
    kind: "elite",
    trait: "gambler",
    figure: "elite",
    color: "#C0A16A",
    hp: [88, 98],
    damageRange: [9, 16],
    reward: { ether: 80, gold: 3 },
    layerMin: 6,
    intro: "精英：两个车头朝相反方向使劲，每一击的轻重都在 50%—170% 之间赌一把。"
  }
];

function byKind(kind) {
  return ENEMIES.filter(function (enemy) {
    return enemy.kind === kind;
  });
}

function getById(id) {
  var i;
  for (i = 0; i < ENEMIES.length; i += 1) {
    if (ENEMIES[i].id === id) return ENEMIES[i];
  }
  return null;
}

/** 按层数筛选可出现的敌人（普通/精英分开取） */
function poolFor(kind, layer) {
  return ENEMIES.filter(function (enemy) {
    return enemy.kind === kind && layer >= (enemy.layerMin || 1);
  });
}

module.exports = {
  ENEMIES: ENEMIES,
  byKind: byKind,
  getById: getById,
  poolFor: poolFor
};

});

define("js/game/data/enhancements.js", function(module, exports, require) {
/**
 * data/enhancements.js —— 局内强化池（3 选 1，本局结束清空）
 *
 * 与遗物的区别：强化更常见、数值更小、可以重复叠（同类效果累加）。
 */

var ENHANCEMENTS = [
  { id: "atk3", name: "火力校准", desc: "攻击力 +3。", tag: "攻击", effects: { attackFlat: 3 } },
  { id: "atk5", name: "强化膛线", desc: "攻击力 +5，但节点饱食消耗 +1。", tag: "攻击", effects: { attackFlat: 5, hungerCostDelta: 1 } },
  { id: "shield8", name: "防御站姿", desc: "每场战斗首回合护盾 +8。", tag: "防御", effects: { firstTurnShield: 8 } },
  { id: "healAfterBattle", name: "战后包扎", desc: "每场战斗后恢复 10 生命。", tag: "续航", effects: { healAfterBattle: 10 } },
  { id: "lessHunger", name: "节律呼吸", desc: "节点移动的饱食消耗 -2。", tag: "续航", effects: { hungerCostDelta: -2 } },
  { id: "lowSanityAtk", name: "紧绷意志", desc: "精神值低于 50 时，伤害 +40%。", tag: "攻击", effects: { lowSanityBonus: 0.4 } },
  { id: "freeEscape", name: "快速撤离", desc: "逃跑不再扣除以太碎片。", tag: "机动", effects: { escapeFree: true } },
  { id: "potionBoost", name: "急救强化", desc: "回血药剂效果 +15。", tag: "续航", effects: { potionBonus: 15 } },
  { id: "eventBoost", name: "冒险嗅觉", desc: "事件奖励提高 25%。", tag: "收益", effects: { eventRewardBoost: 0.25 } },
  { id: "campBonus", name: "安稳睡眠", desc: "营地休息额外恢复 8 生命。", tag: "续航", effects: { campHealBonus: 8 } },
  { id: "bossHunter", name: "裂隙猎手", desc: "对 Boss 伤害 +20%。", tag: "攻击", effects: { bossDamageBonus: 0.2 } },
  { id: "steadyMind", name: "心智稳定", desc: "每经过 3 个节点恢复 6 精神值。", tag: "精神", effects: { restoreSanityEveryThree: 6 } },
  { id: "goldGain", name: "稀有折现", desc: "每场战斗额外获得 1 金币。", tag: "收益", effects: { battleBonusGold: 1 } },
  { id: "calmDown", name: "静息训练", desc: "低精神时受到的伤害 -15%。", tag: "防御", effects: { lowSanityDamageReduction: 0.15 } },
  { id: "vitality", name: "充沛体力", desc: "生命上限 +10，并立即回 10 生命。", tag: "续航", effects: { maxHpBonus: 10 } },

  /* ---------- 扩充词条：给 3 选 1 提供真正的取舍 ---------- */
  { id: "openingShot", name: "先手一箭", desc: "攻击力 +2，每场战斗首回合护盾 +6。", tag: "攻击", effects: { attackFlat: 2, firstTurnShield: 6 } },
  { id: "ironSkin", name: "铁皮护心", desc: "生命上限 +14。", tag: "防御", effects: { maxHpBonus: 14 } },
  { id: "scavenger", name: "拾荒本能", desc: "每场战斗额外 1 金币，事件收益 +10%。", tag: "收益", effects: { battleBonusGold: 1, eventRewardBoost: 0.1 } },
  { id: "fieldMedic", name: "战地急救", desc: "回血药剂效果 +20。", tag: "续航", effects: { potionBonus: 20 } },
  { id: "ironWill", name: "铁意志", desc: "精神低于 50 时伤害 +25%。", tag: "攻击", effects: { lowSanityBonus: 0.25 } },
  { id: "calmSight", name: "静观", desc: "低精神时受到的伤害 -20%。", tag: "防御", effects: { lowSanityDamageReduction: 0.2 } },
  { id: "marrow", name: "骨髓代谢", desc: "每场战斗后回 6 生命，每 2 节点回 6 饱食。", tag: "续航", effects: { healAfterBattle: 6, foodRecoveryEveryTwo: 6 } },
  { id: "nightRun", name: "夜行", desc: "节点移动的饱食消耗 -3。", tag: "机动", effects: { hungerCostDelta: -3 } },
  { id: "riftLens", name: "裂隙透镜", desc: "对 Boss 伤害 +25%。", tag: "攻击", effects: { bossDamageBonus: 0.25 } },

  /* ---------- 第三批：暴击 / 盾流 / 残血反打 / 先手 ----------
   * 这一批补的是「打法」而不是「数值」：
   * 暴击流走精准，盾流走防御，残血流走血线管理，先手流走速杀。
   * 四条线各自能成型，混搭则都不够强——这才是 3 选 1 该有的分叉。
   */
  { id: "aimVitals", name: "瞄准要害", desc: "精准射击有 20% 几率暴击（1.8 倍伤害）。", tag: "攻击", effects: { critChance: 0.2 } },
  { id: "eagleEye", name: "鹰眼", desc: "攻击力 +2，精准暴击率 +12%。", tag: "攻击", effects: { attackFlat: 2, critChance: 0.12 } },
  { id: "ironWall", name: "铁壁", desc: "防御时护盾 +8。", tag: "防御", effects: { defendShieldBonus: 8 } },
  { id: "shieldWall", name: "盾墙", desc: "防御时护盾 +12，但节点饱食消耗 +1。", tag: "防御", effects: { defendShieldBonus: 12, hungerCostDelta: 1 } },
  { id: "lastStand", name: "背水一战", desc: "生命低于 40% 时，伤害 +35%。", tag: "攻击", effects: { lowHpDamageBonus: 0.35 } },
  { id: "desperate", name: "死战", desc: "生命低于 40% 时伤害 +25%，生命上限 +6。", tag: "攻击", effects: { lowHpDamageBonus: 0.25, maxHpBonus: 6 } },
  { id: "openingPress", name: "开场压制", desc: "每场战斗第一击额外造成 8 点伤害。", tag: "攻击", effects: { firstStrikeBonus: 8 } },
  { id: "ambush", name: "伏击", desc: "战斗第一击 +10 伤害，首回合护盾 +4。", tag: "机动", effects: { firstStrikeBonus: 10, firstTurnShield: 4 } },
  { id: "thinBlood", name: "稀血", desc: "残血时伤害 +20%，每场战斗后回 6 生命。", tag: "续航", effects: { lowHpDamageBonus: 0.2, healAfterBattle: 6 } },
  { id: "hunterInstinct", name: "猎人直觉", desc: "精准暴击率 +10%，每场战斗额外 1 金币。", tag: "收益", effects: { critChance: 0.1, battleBonusGold: 1 } }
];

function getById(id) {
  var i;
  for (i = 0; i < ENHANCEMENTS.length; i += 1) {
    if (ENHANCEMENTS[i].id === id) return ENHANCEMENTS[i];
  }
  return null;
}

/**
 * 抽 count 个不重复候选。
 * pickRandom / shuffle 由调用方注入，保持本模块无状态。
 */
function draw(shuffle, count) {
  return shuffle(ENHANCEMENTS.slice()).slice(0, count);
}

module.exports = {
  ENHANCEMENTS: ENHANCEMENTS,
  getById: getById,
  draw: draw
};

});

define("js/game/data/events.js", function(module, exports, require) {
/**
 * data/events.js —— 随机事件（数据驱动，无函数，可序列化）
 *
 * 选项结构：
 *   label        按钮文案
 *   hint         副文案（风险提示）
 *   cost         支付成本 { ether, gold, hp, sanity }，不足则该选项置灰
 *   gain         直接收益 { ether, gold, hp, sanity, hunger }
 *   items        道具收益 { potion: 1, ... }
 *   action       "enhance" 给强化 | "relic" 给遗物 | null
 *   risk         概率分支 { chance, ok: {...}, bad: {...}, okText, badText }
 *   text         执行后的结果文案
 *   minLayer     最早出现层数（默认 1）
 *
 * 结算逻辑统一在 state.js 的 applyEventChoice，本文件只描述数据。
 */

var EVENTS = [
  {
    id: "signalBeacon",
    title: "残缺信号塔",
    text: "旧信号塔还在雾中闪烁。稳定校准能换来资源，超频广播也许回报更高——也可能引来不该来的东西。",
    weight: 10,
    choices: [
      {
        label: "稳定校准",
        hint: "稳定收益",
        gain: { ether: 24, gold: 1 },
        text: "你重新点亮了信号塔，收到 24 以太碎片与 1 枚金币。"
      },
      {
        label: "超频广播",
        hint: "一半概率拿强化，一半概率掉血",
        risk: {
          chance: 0.5,
          ok: { action: "enhance" },
          bad: { hp: -16 },
          okText: "广播召来残响能量，你获得一次额外强化选择。",
          badText: "广播惊动了暗影，你损失了 16 点生命值。"
        }
      }
    ]
  },
  {
    id: "sealedCabin",
    title: "封闭车厢",
    text: "一节古旧车厢半埋在裂隙边缘。门后像是有补给，也可能有代价。",
    weight: 10,
    choices: [
      {
        label: "破门搜刮",
        hint: "拿道具，但掉精神",
        items: { potion: 1, portableFood: 1 },
        gain: { sanity: -6 },
        text: "你带走了药剂与便携食物，封闭感让精神值下降了 6 点。"
      },
      {
        label: "谨慎拆解",
        hint: "稳妥小收益",
        gain: { ether: 18, hp: 6 },
        text: "你拆下可用的零件，获得 18 以太碎片并恢复了 6 点生命。"
      }
    ]
  },
  {
    id: "riftMirror",
    title: "裂隙镜面",
    text: "镜面里映出另一个你。它愿意用代价交换成长。",
    weight: 8,
    choices: [
      {
        label: "交出生命换强化",
        hint: "-15 生命换一次强化",
        cost: { hp: 15 },
        action: "enhance",
        text: "你与镜面完成了交易，损失 15 点生命，换来新的强化。"
      },
      {
        label: "保持距离",
        hint: "回精神",
        gain: { sanity: 12 },
        text: "你拒绝了镜面的诱惑，精神值恢复 12 点。"
      }
    ]
  },
  {
    id: "weirdTrader",
    title: "诡异商人",
    text: "披着旧披风的商人坐在断轨边，只接受奇怪的交易方式。",
    weight: 8,
    choices: [
      {
        label: "20 生命换遗物",
        hint: "遗物很稀有",
        cost: { hp: 20 },
        action: "relic",
        text: "你割让了一段生命力，换来一件遗物。"
      },
      {
        label: "2 金币买强化",
        hint: "需要 2 金币",
        cost: { gold: 2 },
        action: "enhance",
        text: "商人收下金币，翻开一张新的强化卡。"
      },
      {
        label: "转身离开",
        hint: "无风险",
        text: "你没有理会他，继续赶路。"
      }
    ]
  },
  {
    id: "supplyCrate",
    title: "废弃补给箱",
    text: "锈蚀的补给箱半开着，里面的东西可能还完好。",
    weight: 12,
    choices: [
      {
        label: "立刻打开",
        hint: "资源更多，但掉精神",
        gain: { ether: 30, sanity: -8 },
        text: "你清空了补给箱，获得 30 以太碎片，翻动尸骸让你精神下降 8 点。"
      },
      {
        label: "小心拆解",
        hint: "资源较少，无风险",
        gain: { ether: 14 },
        text: "你谨慎地取下可用部分，获得 14 以太碎片。"
      }
    ]
  },
  {
    id: "echoCorridor",
    title: "回声走廊",
    text: "走廊尽头的回声比你的脚步慢半拍。深入进去，或许能听到裂隙的秘密。",
    weight: 9,
    choices: [
      {
        label: "深入调查",
        hint: "高风险高收益",
        risk: {
          chance: 0.55,
          ok: { ether: 42, gold: 2 },
          bad: { hp: -18, sanity: -6 },
          okText: "你在回声里找到一处旧仓储，获得 42 以太碎片与 2 枚金币。",
          badText: "回声突然收束，你被压得喘不过气，损失 18 生命与 6 精神。"
        }
      },
      {
        label: "原路离开",
        hint: "无收益",
        text: "你退了出来，什么也没得到，但什么也没失去。"
      }
    ]
  },
  {
    id: "oldDevice",

    themes: ["ember"],
    title: "旧世界装置",
    text: "一台还在嗡鸣的旧世界装置，面板上的指示灯忽明忽暗。",
    weight: 9,
    choices: [
      {
        label: "强行启动",
        hint: "随机大收益或掉血",
        risk: {
          chance: 0.45,
          ok: { action: "relic" },
          bad: { hp: -14 },
          okText: "装置吐出一件旧时代的遗物，你把它收进背包。",
          badText: "装置短路爆炸，你被碎片划伤，损失 14 点生命。"
        }
      },
      {
        label: "稳定拆解",
        hint: "稳定小收益",
        gain: { ether: 20, gold: 1 },
        text: "你拆下核心部件，换来 20 以太碎片与 1 枚金币。"
      }
    ]
  },
  {
    id: "silentConductor",

    themes: ["frost"],
    title: "沉默乘务员",
    text: "一位旧制服乘务员站在过道尽头，向你摊开手掌，什么也不说。",
    weight: 7,
    minLayer: 3,
    choices: [
      {
        label: "给他 1 金币",
        hint: "换一次精神恢复",
        cost: { gold: 1 },
        gain: { sanity: 20, hp: 10 },
        text: "他点头收下，替你把车窗擦净。精神恢复 20 点，生命恢复 10 点。"
      },
      {
        label: "什么也不给",
        hint: "他很失望",
        gain: { sanity: -4 },
        text: "你从他身边走过，背后传来一声很轻的叹息。"
      }
    ]
  },
  {
    id: "frozenDiner",

    themes: ["frost"],
    title: "结霜餐车",
    text: "餐车的窗上结着厚厚的白霜，炉子还温着。热气里有种久违的味道。",
    weight: 11,
    choices: [
      {
        label: "坐下来吃一顿",
        hint: "回满饱食与部分生命",
        gain: { hunger: 40, hp: 12, sanity: 4 },
        text: "你吃完了一整份热食，饱食度与生命都回来了不少。"
      },
      {
        label: "打包带走",
        hint: "换道具，不立刻回血",
        items: { portableFood: 1, potion: 1 },
        text: "你把食物装进背包，留着后面更难受的时候用。"
      }
    ]
  },
  {
    id: "ticketBooth",
    title: "无人售票口",
    text: "售票窗口后面没有人，只有一台还在计数的机器，玻璃上贴着一张褪色的价目表。",
    weight: 10,
    choices: [
      {
        label: "投 20 以太买一张票",
        hint: "换 2 金币",
        cost: { ether: 20 },
        gain: { gold: 2 },
        text: "机器吐出一张旧车票，转手就能当 2 枚金币用。"
      },
      {
        label: "翻找找零槽",
        hint: "小收益，掉精神",
        gain: { ether: 16, sanity: -5 },
        text: "你在找零槽里摸出一把碎币，指尖沾了黏腻的东西。"
      }
    ]
  },
  {
    id: "echoChild",
    title: "回声小孩",
    text: "一个模糊的小孩轮廓站在车厢连接处，指着你背包的方向，又指向更深处。",
    weight: 9,
    minLayer: 2,
    choices: [
      {
        label: "给它一份便携食物",
        hint: "需要 1 份便携食物",
        cost: { hp: 0 },
        items: { portableFood: -1 },
        risk: {
          chance: 0.75,
          ok: { action: "relic" },
          bad: { sanity: -10 },
          okText: "它领着你走到一节暗车厢，指着一件蒙尘的遗物，然后消散了。",
          badText: "它把你引向了死路，回头时它已经不在了，只剩一片刺骨的安静。"
        }
      },
      {
        label: "不理会它",
        hint: "无风险",
        text: "你从它身边走过。它没有跟上来。"
      }
    ]
  },
  {
    id: "rustPiano",
    title: "锈蚀钢琴",
    text: "车厢角落摆着一架锈到走音的钢琴，琴键上落着薄灰。",
    weight: 9,
    choices: [
      {
        label: "弹一首",
        hint: "大概率回精神，小概率引来东西",
        risk: {
          chance: 0.7,
          ok: { sanity: 22 },
          bad: { hp: -14, sanity: 6 },
          okText: "你弹了一首很久以前的曲子，胸口松了一点，精神恢复 22 点。",
          badText: "琴声传得很远。有什么东西顺着声音找到了你，你被拖拽了一下。"
        }
      },
      {
        label: "拆下铜弦",
        hint: "稳定收益",
        gain: { ether: 24 },
        text: "你把还能用的铜弦和铜件拆下来，换了 24 以太碎片。"
      }
    ]
  },
  {
    id: "brokenClock",
    title: "停摆的时钟",
    text: "车厢正中的挂钟停在某个时刻，秒针在同一个位置轻微颤动。",
    weight: 8,
    minLayer: 2,
    choices: [
      {
        label: "校准它",
        hint: "一半概率大幅回血，一半概率掉精神",
        risk: {
          chance: 0.5,
          ok: { hp: 24, sanity: 8 },
          bad: { sanity: -18 },
          okText: "指针重新走动，钟声让你清醒过来，生命回复 24 点。",
          badText: "指针倒着走了几格。你看着自己的手，忽然不确定过了多久。"
        }
      },
      {
        label: "上弦就走",
        hint: "小收益",
        gain: { ether: 15, hunger: 6 },
        text: "你随手上了几圈弦，顺手在钟座下面摸到一点碎币。"
      }
    ]
  },
  {
    id: "bloodCar",

    themes: ["ember"],
    title: "采血车厢",
    text: "一节挂着红十字的旧车厢，椅子上还留着束带。墙上的告示写着「有偿」。",
    weight: 8,
    minLayer: 3,
    choices: [
      {
        label: "献 18 生命",
        hint: "换金币与强化",
        cost: { hp: 18 },
        gain: { gold: 2 },
        action: "enhance",
        text: "针头冰凉。作为回报，你拿到 2 枚金币和一次强化选择。"
      },
      {
        label: "只取血浆袋",
        hint: "拿道具，掉精神",
        items: { potion: 2 },
        gain: { sanity: -8 },
        text: "你从冷藏柜里拿了两袋血浆，出门时听见背后有轮子滚动的声音。"
      }
    ]
  },
  {
    id: "mirrorPlatform",

    themes: ["frost"],
    title: "镜面站台",
    text: "站台地面像镜子一样，倒影里的你比你慢了半步，并且一直在看你。",
    weight: 8,
    minLayer: 3,
    choices: [
      {
        label: "和倒影交换",
        hint: "-20 生命换一次强化",
        cost: { hp: 20 },
        action: "enhance",
        text: "你和倒影错身而过，它留下了一点东西，你带走了一次强化。"
      },
      {
        label: "蹲下观察",
        hint: "回精神",
        gain: { sanity: 14, ether: 10 },
        text: "你盯着倒影看了很久，反而冷静下来。精神恢复 14 点。"
      }
    ]
  },
  {
    id: "lanternCrew",
    title: "提灯乘务组",
    text: "三名穿旧制服的乘务员提着灯巡过，灯罩里烧的不是油，是很细的光。",
    weight: 9,
    minLayer: 2,
    choices: [
      {
        label: "交涉（1 金币）",
        hint: "换治疗与饱食",
        cost: { gold: 1 },
        gain: { hp: 18, hunger: 20 },
        text: "为首的乘务员点点头，给你处理了伤口，还塞了一份口粮。"
      },
      {
        label: "抢一盏灯",
        hint: "高风险，高回报",
        risk: {
          chance: 0.4,
          ok: { action: "relic", ether: 20 },
          bad: { hp: -22, sanity: -8 },
          okText: "你夺过一盏灯，灯灭的瞬间掉出一件遗物。",
          badText: "灯没抢到，三盏灯同时转向了你。"
        }
      }
    ]
  },
  {
    id: "cargoHold",
    title: "货舱暗格",
    text: "货舱底板有一块新换过的木板，边缘的钉子还没锈。",
    weight: 10,
    minLayer: 2,
    choices: [
      {
        label: "撬开它",
        hint: "一堆道具，掉精神",
        items: { potion: 1, retryCard: 1 },
        gain: { sanity: -9 },
        text: "暗格里塞着药剂和一张重战卡。你不知道前一个人为什么把它们藏起来。"
      },
      {
        label: "上报列车",
        hint: "换金币",
        gain: { gold: 2, sanity: 4 },
        text: "你标记了位置。列车按规矩给了你 2 枚金币作为奖励。"
      }
    ]
  },
  {
    id: "whisperVent",
    title: "低语通风口",
    text: "通风口里传出很轻的说话声，句式规整，像在念一份名单。",
    weight: 9,
    minLayer: 3,
    choices: [
      {
        label: "凑近听",
        hint: "换以太，掉精神",
        gain: { ether: 40, sanity: -14 },
        text: "你听清了一串坐标，顺着它摸到一处藏起来的以太结晶。"
      },
      {
        label: "塞住它",
        hint: "小回复",
        gain: { sanity: 10, hunger: -6 },
        text: "你用破布把通风口堵上，世界安静了，你也终于能喘口气。"
      }
    ]
  },
  {
    id: "derailWreck",

    themes: ["ember"],
    title: "脱轨残骸",
    text: "一节脱轨的车厢斜插在裂隙边缘，里面可能还有东西，也可能随时塌下去。",
    weight: 8,
    minLayer: 4,
    choices: [
      {
        label: "钻进去搜",
        hint: "遗物，但很可能重伤",
        risk: {
          chance: 0.55,
          ok: { action: "relic" },
          bad: { hp: -28 },
          okText: "你在残骸深处摸到一件完好的遗物，赶在塌陷前退了出来。",
          badText: "车厢在你身下陷了一截，你被压住，硬拖出来时已经血流不止。"
        }
      },
      {
        label: "绕开",
        hint: "只回一点精神",
        gain: { sanity: 6 },
        text: "你没有靠近，只是绕开了那片阴影。"
      }
    ]
  },
  {
    id: "oldVending",
    title: "旧售货机",
    text: "一台还亮着的售货机，投币口旁边手写着「不保证出货」。",
    weight: 12,
    choices: [
      {
        label: "投 1 金币",
        hint: "随机结果",
        cost: { gold: 1 },
        risk: {
          chance: 0.5,
          ok: { gold: 3 },
          bad: { items: { potion: 1 }, sanity: -4 },
          okText: "机器哗啦啦吐出一把金币，你赚了两枚。",
          badText: "卡了半瓶药剂出来，硬币是被吞掉了。"
        }
      },
      {
        label: "踹两脚就走",
        hint: "无风险，掉精神",
        gain: { sanity: -3, ether: 8 },
        text: "售货机晃了晃，掉出 8 以太的找零。你有点烦躁。"
      }
    ]
  },
  {
    id: "lastSupper",
    title: "最后一顿晚饭",
    text: "餐桌上摆着四套餐具，只有你的那份还热着。对面三张椅子都空着。",
    weight: 7,
    minLayer: 5,
    choices: [
      {
        label: "坐下吃完",
        hint: "大回血，掉饱食",
        gain: { hp: 30, hunger: -20, sanity: 10 },
        text: "你一个人吃完了四个人的份。胃里很沉，心里却轻了些。"
      },
      {
        label: "把餐具收好",
        hint: "回精神，掉饱食",
        gain: { sanity: 18, hunger: -8 },
        text: "你把三套餐具叠好放在一边，像在等谁回来。"
      }
    ]
  },

  /* ================= 第二批次：独立事件（11 个） =================
   *
   * 这一批侧重「小而具体」的物件：检票剪、行李箱、结冰的水箱……
   * 单次事件的收益不做大，重点是让 8 层路上不重复看到同样的三件事。
   */

  {
    id: "ticketPunch",
    title: "还亮着的检票剪",
    text: "一台老式检票剪悬在扶手上，刀口还带着新剪的痕迹。投币口旁边写着两个字：可用。",
    weight: 11,
    choices: [
      {
        label: "投 1 金币试试",
        hint: "稳定收益",
        cost: { gold: 1 },
        gain: { ether: 30 },
        text: "检票剪剪下一张半透明的票根，票根化作 30 以太碎片。"
      },
      {
        label: "把手伸进刀口",
        hint: "一半概率给强化，一半概率被夹",
        risk: {
          chance: 0.55,
          ok: { action: "enhance" },
          bad: { hp: -14 },
          okText: "刀口落下却剪开了某种束缚，你获得一次额外强化。",
          badText: "刀口夹住了你的手腕，你掉了 14 点生命。"
        }
      }
    ]
  },
  {
    id: "hangingCase",
    title: "挂在行李架上的箱子",
    text: "一只旧皮箱挂在行李架上，锁扣锈死了，箱角有被撬过的痕迹。",
    weight: 11,
    choices: [
      {
        label: "砸开它",
        hint: "可能掉血",
        risk: {
          chance: 0.7,
          ok: { ether: 28, items: { potion: 1 } },
          bad: { hp: -12 },
          okText: "锁扣崩开，里面塞着 28 以太碎片和一支药剂。",
          badText: "箱子弹起的铁片划伤了你的手，你掉了 12 点生命。"
        }
      },
      {
        label: "整个拎走",
        hint: "少一点，但稳",
        gain: { ether: 14 },
        text: "你没打开它，把它交给路过的商人换了 14 以太碎片。"
      }
    ]
  },
  {
    id: "frozenTank",

    themes: ["frost"],
    title: "结冰的水箱",
    text: "水箱表面结着厚冰，冰层下有东西在缓慢移动，看不出是什么。",
    weight: 10,
    choices: [
      {
        label: "敲碎冰面取水",
        hint: "耗血换资源",
        cost: { hp: 8 },
        gain: { ether: 34 },
        text: "你砸开冰面，从水里捞出一把沉在底下的碎片，共 34 以太。"
      },
      {
        label: "只化一点冰喝",
        hint: "回饱食",
        gain: { hunger: 30 },
        text: "你把冰块捂化，喝了半升冰水，胃里终于有点东西。"
      }
    ]
  },
  {
    id: "cartOfCups",
    title: "无脸乘务员的推车",
    text: "一辆餐车停在过道中央，上面摆满杯子，每一杯都冒着热气。推车后面没有人。",
    weight: 10,
    choices: [
      {
        label: "喝一杯",
        hint: "多半回血，也可能有问题",
        risk: {
          chance: 0.6,
          ok: { hp: 28 },
          bad: { hp: -10 },
          okText: "热汤滑进胃里，你恢复了 28 点生命。",
          badText: "杯底沉着一层锈，你难受地咳了半天，掉了 10 点生命。"
        }
      },
      {
        label: "讨要点心",
        hint: "回饱食",
        gain: { hunger: 24, ether: 10 },
        text: "你拿起一碟压缩饼干，推车底部还散着 10 以太碎片。"
      }
    ]
  },
  {
    id: "stackOfTickets",
    title: "一叠旧车票",
    text: "座位上放着一叠车票，日期全是同一天，终点站写着不同的名字。",
    weight: 10,
    choices: [
      {
        label: "收起来",
        hint: "换金币",
        gain: { gold: 2 },
        text: "你把车票按站名整理好，卖给了收旧票的人，换到 2 金币。"
      },
      {
        label: "拿口粮换一张",
        hint: "交口粮，换以太",
        items: { portableFood: -1 },
        gain: { ether: 30 },
        text: "对方接过口粮，把一张印着「终点」的车票推给你，票根值 30 以太。"
      }
    ]
  },
  {
    id: "ringingPhone",
    title: "车厢尽头的电话",
    text: "墙上的老式电话在响，铃声很轻，像是怕吵醒谁。",
    weight: 9,
    minLayer: 2,
    choices: [
      {
        label: "接起来",
        hint: "精神大幅波动",
        risk: {
          chance: 0.5,
          ok: { sanity: 30 },
          bad: { sanity: -25 },
          okText: "那头是熟悉的声音，只说了句「别回头」，你反而踏实了。",
          badText: "那头只有你自己的呼吸声，一直在重复。"
        }
      },
      {
        label: "拔掉电话线",
        hint: "换以太",
        gain: { ether: 15 },
        text: "你拔掉线，从听筒里倒出几枚细小的以太结晶。"
      }
    ]
  },
  {
    id: "pendulum",

    themes: ["frost"],
    title: "停在半空的钟摆",
    text: "车厢顶上的钟摆悬在半空，既没有下落，也没有回摆。",
    weight: 9,
    minLayer: 3,
    choices: [
      {
        label: "跟着它数秒",
        hint: "回精神",
        gain: { sanity: 20, ether: 8 },
        text: "你数到六十的时候它终于动了，你的呼吸也跟着稳下来。"
      },
      {
        label: "用手打断它",
        hint: "多半有收获",
        risk: {
          chance: 0.65,
          ok: { gold: 3 },
          bad: { hp: -10 },
          okText: "钟摆碎成一地零件，轴心是 3 枚金币。",
          badText: "钟摆反手抽在你的指骨上，掉了 10 点生命。"
        }
      }
    ]
  },
  {
    id: "seatedCorpse",
    title: "坐着的尸体",
    text: "一位乘客坐得笔直，双手放在膝上，像是在等下一站。他已经很久没有呼吸了。",
    weight: 9,
    minLayer: 3,
    choices: [
      {
        label: "搜他的口袋",
        hint: "多半有收获",
        risk: {
          chance: 0.7,
          ok: { ether: 30, gold: 2 },
          bad: { hp: -15 },
          okText: "口袋里是 30 以太碎片和 2 枚金币，他像是特意留给你的。",
          badText: "你刚碰到他，他的手指扣住了你的手腕，掉了 15 点生命。"
        }
      },
      {
        label: "鞠一躬走开",
        hint: "回精神",
        gain: { sanity: 12 },
        text: "你去下一节车厢前对他点了点头。这个动作让你安心。"
      }
    ]
  },
  {
    id: "leakingValve",

    themes: ["ember"],
    title: "漏气的阀门",
    text: "一根管子嘶嘶漏着白气，阀门上缠着别人留下的布条。",
    weight: 10,
    choices: [
      {
        label: "把它拧紧",
        hint: "耗精神，换以太",
        cost: { sanity: 10 },
        gain: { ether: 20 },
        text: "你顶住蒸汽把阀门拧死，管事的人塞给你 20 以太碎片。"
      },
      {
        label: "顺手拿走布条",
        hint: "回精神",
        gain: { sanity: 8, hunger: 6 },
        text: "布条上还有余温，你把它垫在座位上，靠着喘了口气。"
      }
    ]
  },
  {
    id: "handprints",
    title: "车窗上的手印",
    text: "整面车窗都是手印，全是从外面按上来的，掌纹很深。",
    weight: 9,
    minLayer: 4,
    choices: [
      {
        label: "把它们擦掉",
        hint: "回精神",
        gain: { sanity: 18 },
        text: "你用手肘一节一节擦过去，擦到最后一扇窗时，外面已经什么都没有了。"
      },
      {
        label: "按上自己的手印",
        hint: "一半概率给强化",
        risk: {
          chance: 0.55,
          ok: { action: "enhance" },
          bad: { hp: -12 },
          okText: "你的掌印亮了一下，某种东西顺着玻璃流进了你的手臂。",
          badText: "玻璃外侧有东西按住了你的手，你掉了 12 点生命。"
        }
      }
    ]
  },
  {
    id: "crateOfVials",
    title: "一整箱药剂",
    text: "货架上放着一整个木箱，里面码着整齐的药剂，标签已经看不清了。",
    weight: 9,
    minLayer: 3,
    choices: [
      {
        label: "全拿走",
        hint: "花钱换两个",
        cost: { ether: 20 },
        items: { potion: 2 },
        text: "你付了 20 以太碎片当「保管费」，把两瓶药剂塞进包里。"
      },
      {
        label: "只拿一支",
        hint: "白拿一支",
        items: { potion: 1 },
        text: "你只拿了一支，剩下的留给下一个路过的人。"
      }
    ]
  },

  /* ================= 三条事件链（每链 3 段） =================
   *
   * 链事件不进随机池（roll 里过滤掉 chain 字段），只由 nextChainEvent 按顺序发。
   * 目的：给单局一点「我还记得上一节车厢」的连续性，但失败/跳过不惩罚。
   */

  /* ---- 链 A：检票员的手册 ---- */
  {
    id: "chainTicket1",
    title: "座位下的半本手册",
    text: "座位缝里卡着半本手册，封面印着「乘务作业规范」，缺了后半册。",
    weight: 0,
    chain: "ticketBook",
    stage: 1,
    minLayer: 2,
    choices: [
      {
        label: "收进包里",
        hint: "换以太",
        gain: { ether: 18 },
        text: "你把手册塞进包里，纸页间掉出 18 枚以太碎片。"
      },
      {
        label: "撕下空白页",
        hint: "回饱食与精神",
        gain: { hunger: 15, sanity: 8 },
        text: "你用空白页卷了点干粮，慢慢嚼着，心情松了些。"
      }
    ]
  },
  {
    id: "chainTicket2",
    title: "拿着手册的查票员",
    text: "一个查票员站在过道中间，手里拿着另外半本手册，正对着你翻。",
    weight: 0,
    chain: "ticketBook",
    stage: 2,
    minLayer: 4,
    choices: [
      {
        label: "把半本递给他",
        hint: "多半换到强化",
        risk: {
          chance: 0.55,
          ok: { action: "enhance" },
          bad: { hp: -20 },
          okText: "两半合在一起，他点点头，教了你一手东西。",
          badText: "他看完后把手册塞回你的胸口，力气大得不像人。"
        }
      },
      {
        label: "说自己在赶时间",
        hint: "花钱过关",
        cost: { gold: 1 },
        gain: { ether: 20 },
        text: "你塞给他 1 枚金币，他侧身让路，还找回 20 以太碎片。"
      }
    ]
  },
  {
    id: "chainTicket3",
    title: "终点车厢的补票窗口",
    text: "车厢尽头开着一个补票窗口，里面的人只要你手上那半本手册。",
    weight: 0,
    chain: "ticketBook",
    stage: 3,
    minLayer: 6,
    choices: [
      {
        label: "用手册补一张全票",
        hint: "换秒杀卡",
        cost: { ether: 30 },
        items: { executeCard: 1 },
        text: "窗口里的人撕下票根递给你——一张能在关键时刻终结一切的票。"
      },
      {
        label: "把手册还回去",
        hint: "大回精神与以太",
        gain: { sanity: 25, ether: 40 },
        text: "你把手册推回去，说了句「路上小心」。他第一次抬起头看你。"
      }
    ]
  },

  /* ---- 链 B：孩子的画 ---- */
  {
    id: "chainDrawing1",
    title: "一张蜡笔画",
    text: "座位上摊着一张蜡笔画：一列车，车窗里有很多小人，颜色涂得很用力。",
    weight: 0,
    chain: "childDrawing",
    stage: 1,
    minLayer: 2,
    choices: [
      {
        label: "收好它",
        hint: "回精神",
        gain: { sanity: 12 },
        text: "你把画折好放进内袋，像是替谁保管一样。"
      },
      {
        label: "折成纸飞机",
        hint: "换以太",
        gain: { ether: 16 },
        text: "纸飞机飞出两节车厢就落了，落地时压着 16 枚以太碎片。"
      }
    ]
  },
  {
    id: "chainDrawing2",
    title: "画里的那节车厢",
    text: "前面那节车厢和画上一模一样，连车窗里小人的位置都对得上。",
    weight: 0,
    chain: "childDrawing",
    stage: 2,
    minLayer: 4,
    choices: [
      {
        label: "走进去",
        hint: "多半给遗物",
        risk: {
          chance: 0.6,
          ok: { action: "relic" },
          bad: { hp: -18 },
          okText: "车厢里空着，座位中央放着一件东西，像是给你留的。",
          badText: "你刚踏进去，所有小人的头同时转了过来。"
        }
      },
      {
        label: "站在门口看",
        hint: "稳一点的收益",
        gain: { ether: 22 },
        text: "你没有进去。车门关上时，缝隙里掉出 22 枚以太碎片。"
      }
    ]
  },
  {
    id: "chainDrawing3",
    title: "在等你的孩子",
    text: "一个孩子坐在长椅上，脚够不到地，正低头玩着手里的蜡笔。",
    weight: 0,
    chain: "childDrawing",
    stage: 3,
    minLayer: 6,
    choices: [
      {
        label: "把画还给他",
        hint: "大回血与精神",
        gain: { hp: 15, sanity: 30 },
        text: "他接过画，认真地说了声谢谢。你觉得身上轻了很多。"
      },
      {
        label: "转身离开",
        hint: "拿以太，掉精神",
        cost: { sanity: 15 },
        gain: { ether: 45 },
        text: "你没敢回头。包里的以太碎片变沉了，脚步也变沉了。"
      }
    ]
  },

  /* ---- 链 C：锅炉的低语 ---- */
  {
    id: "chainBoiler1",
    title: "地板下的敲击声",
    text: "脚下的铁板在响，三下，停一下，再三下。像有人在里面敲门。",
    weight: 0,
    chain: "boilerWhisper",
    stage: 1,
    minLayer: 2,
    choices: [
      {
        label: "也敲三下",
        hint: "多半有收获",
        risk: {
          chance: 0.65,
          ok: { ether: 28 },
          bad: { sanity: -20 },
          okText: "对面回了一串节奏，铁板缝隙里滑出 28 枚以太碎片。",
          badText: "敲击停下后，你听见自己的名字被念了一遍。"
        }
      },
      {
        label: "捂住耳朵走开",
        hint: "回精神",
        gain: { sanity: 10 },
        text: "你走远了两节车厢，声音还在，但已经小到可以忽略。"
      }
    ]
  },
  {
    id: "chainBoiler2",
    title: "锅炉检修口",
    text: "检修口的螺丝被从里面拧松了，盖子虚掩着，往外冒热气。",
    weight: 0,
    chain: "boilerWhisper",
    stage: 2,
    minLayer: 4,
    choices: [
      {
        label: "钻进去",
        hint: "耗血换资源",
        cost: { hp: 10 },
        gain: { ether: 34, gold: 2 },
        text: "热浪灼着你的背，你在炉膛边上摸到 34 以太碎片和 2 枚金币。"
      },
      {
        label: "把盖子关严",
        hint: "回精神",
        gain: { sanity: 12 },
        text: "你拧紧螺丝，声音停了。至少这一节车厢是安静的。"
      }
    ]
  },
  {
    id: "chainBoiler3",
    title: "空着的司炉位",
    text: "锅炉前的凳子空着，铲子还插在煤堆里，炉火却旺得不正常。",
    weight: 0,
    chain: "boilerWhisper",
    stage: 3,
    minLayer: 6,
    choices: [
      {
        label: "坐进那个位置",
        hint: "多半给强化，也可能烫伤",
        risk: {
          chance: 0.55,
          ok: { action: "enhance" },
          bad: { hp: -25 },
          okText: "炉火顺着你的手臂流了一圈，你突然明白了很多事。",
          badText: "火舌从炉口窜出来，你的袖子烧掉了一半。"
        }
      },
      {
        label: "把火压小一点",
        hint: "稳定收益",
        gain: { ether: 40, hunger: 20 },
        text: "你铲了两铲湿煤压住火头，炉边的水壶正好烧开。"
      }
    ]
  },

  /* ---------------- 第三批随机事件 ---------------- */
  // 一局只发 2—4 个事件点，32 个事件已经够「不重样」；这批补的是**分布**：
  // 锈蚀原本只有通用事件可抽（专属事件 0 个），而且低层数段（L1—L2）的比例偏高——
  // 第 1 层就抽出 L4 的内容等于白抽。所以 8 条里有 5 条落在 L1—L2。
  {
    id: "brakeShoes",
    themes: ["rust"],
    title: "刹车片堆",
    text: "检修槽里堆着几十片拆下来的刹车片，铁还在，锈也还在。车早就不跑了。",
    weight: 10,
    choices: [
      {
        label: "拆黄铜衬套",
        hint: "稳定收益",
        gain: { ether: 22, gold: 1 },
        text: "你拧下三只黄铜衬套，指尖全是黑油。"
      },
      {
        label: "整堆拖去换钱",
        hint: "多半能卖，也可能划伤",
        risk: {
          chance: 0.6,
          ok: { gold: 2 },
          bad: { hp: -9 },
          okText: "收购的人没多看一眼，直接数了两枚金币。",
          badText: "铁片滑落，一道口子从手背一直划到手腕。"
        }
      }
    ]
  },
  {
    id: "lostAndFound",
    themes: ["rust"],
    title: "失物招领处",
    text: "小桌上摆着十几件没人认领的东西：一只手套，一副假牙，一块还在走的表。墙上写着「逾期销毁」。",
    weight: 9,
    minLayer: 2,
    choices: [
      {
        label: "认领自己的行李",
        hint: "拿回道具，安心一点",
        items: { potion: 1 },
        gain: { sanity: 5 },
        text: "你在最底下翻到了自己的包，药剂还在里面。"
      },
      {
        label: "翻别人的",
        hint: "钱多，掉精神",
        gain: { ether: 26, gold: 1, sanity: -9 },
        text: "你把能换钱的都收走了。那块表还在走，你没敢看时间。"
      }
    ]
  },
  {
    id: "windowFrost",
    themes: ["frost"],
    title: "霜上的字",
    text: "车窗的霜上有人写过字，笔画很细，像是用指甲划的：「别回头」。",
    weight: 9,
    minLayer: 2,
    choices: [
      {
        label: "照着做，一路不回头",
        hint: "回精神",
        gain: { sanity: 14 },
        text: "你盯着前方走完了整节车厢。什么都没发生——也许正因为你没回头。"
      },
      {
        label: "回头看",
        hint: "风险：也许撞见什么",
        risk: {
          chance: 0.55,
          ok: { ether: 30 },
          bad: { hp: -14, sanity: -10 },
          okText: "身后什么都没有，只有你自己的脚印，一路排到车门。",
          badText: "你看见了不该看的东西。它跟着你走了很长一段。"
        }
      }
    ]
  },
  {
    id: "coalChute",
    themes: ["ember"],
    title: "煤槽",
    text: "脚下是一道运煤的斜槽，直通下一节车厢。槽壁上糊着厚厚一层煤灰。",
    weight: 10,
    choices: [
      {
        label: "直接滑下去",
        hint: "省饱食，脏，掉精神",
        gain: { hunger: 12, sanity: -6, hp: -4 },
        text: "你从煤槽一路滑到底，指甲缝里三天都洗不干净。"
      },
      {
        label: "踩铆钉慢慢下",
        hint: "稳妥，顺手捡点",
        gain: { ether: 14 },
        text: "你踩着槽壁的铆钉一步步下去，顺手捡了几块没烧透的煤。"
      }
    ]
  },
  {
    id: "boilerTimeclock",
    themes: ["ember"],
    title: "司炉打卡钟",
    text: "墙上挂着一只打卡钟，卡片槽里还插着一张没打过的卡。钟还在走。",
    weight: 9,
    minLayer: 2,
    choices: [
      {
        label: "打一张卡",
        hint: "多一次强化，也可能夹到手",
        risk: {
          chance: 0.6,
          ok: { action: "enhance" },
          bad: { hp: -12 },
          okText: "值班表认了你，供热管道让开一条路——你多了一次强化。",
          badText: "钟咬住你的手指，抽出来时少了半截指甲。"
        }
      },
      {
        label: "把钟拆了",
        hint: "铜和齿轮",
        gain: { ether: 20, gold: 1, sanity: -5 },
        text: "你拆下铜壳和齿轮，钟停了。整节车厢像是松了一口气，你却没有。"
      }
    ]
  },
  {
    id: "ashMarket",
    themes: ["ember"],
    title: "灰市",
    text: "锅炉后面的空地上摆着几个摊位，摊主都裹着灰。他们不收钱，只收「还热着的东西」。",
    weight: 8,
    minLayer: 3,
    choices: [
      {
        label: "交出一段记忆",
        hint: "重代价换遗物",
        cost: { sanity: 16 },
        action: "relic",
        text: "你把一段记忆交出去。摊主掂了掂分量，从布下摸出一件东西递给你。"
      },
      {
        label: "卖一瓶药剂",
        hint: "换金币",
        items: { potion: -1 },
        gain: { gold: 3, ether: 10 },
        text: "摊主收下药剂，把三枚金币压进你掌心，手心还带着煤灰的温度。"
      }
    ]
  },
  {
    id: "frozenSwitch",
    themes: ["frost"],
    title: "冻死的道岔",
    text: "道岔被冻死了，扳手就插在上面。扳过去能抄近路，扳不动就得绕。",
    weight: 8,
    minLayer: 4,
    choices: [
      {
        label: "硬扳",
        hint: "省饱食，可能受伤",
        risk: {
          chance: 0.6,
          ok: { hunger: 14, ether: 16 },
          bad: { hp: -16, hunger: 6 },
          okText: "冰壳裂开，道岔咔的一声归位，你抄了近路。",
          badText: "扳手弹回来砸在你肋上。你还是绕了远路。"
        }
      },
      {
        label: "绕过去",
        hint: "稳，掉饱食",
        gain: { hunger: -10, sanity: 4 },
        text: "你沿着车厢外侧绕行，风把手指吹得没了知觉。"
      }
    ]
  },
  {
    id: "ownCarriage",
    title: "你原来的车厢",
    text: "门牌号正是你买票时的那一节。门没锁，行李还摆在你离开时的位置。",
    weight: 7,
    minLayer: 5,
    choices: [
      {
        label: "进去坐一会儿",
        hint: "回精神与饱食",
        gain: { sanity: 20, hunger: 8 },
        text: "你在自己的位置上坐了很久。窗外还是那片雾，但你没那么怕了。"
      },
      {
        label: "翻自己的行李",
        hint: "遗物，掉精神",
        cost: { sanity: 10 },
        action: "relic",
        text: "包底压着一件你完全不记得带出门的东西。你把它收进怀里，也没敢细想。"
      }
    ]
  }
];

/** 事件链登记：id → 按顺序排列的段数 */
var CHAINS = {
  ticketBook: { name: "检票员的手册", stages: ["chainTicket1", "chainTicket2", "chainTicket3"] },
  childDrawing: { name: "孩子的画", stages: ["chainDrawing1", "chainDrawing2", "chainDrawing3"] },
  boilerWhisper: { name: "锅炉的低语", stages: ["chainBoiler1", "chainBoiler2", "chainBoiler3"] }
};


function getById(id) {
  var i;
  for (i = 0; i < EVENTS.length; i += 1) {
    if (EVENTS[i].id === id) return EVENTS[i];
  }
  return null;
}

/**
 * 按层数与权重抽取（排除最近出现过的 id；链事件不进随机池）
 *
 * themeId 只调权重、不排除任何人：打了别的主题标签的事件降到 0.4 倍，
 * 通用事件（没有 themes 字段）保持 1 倍。硬过滤会让主题专属事件被排除后
 * 池子变空、最后还是得 fallback，不如一开始就用权重。
 */
function roll(pickRandom, layer, recentIds, themeId) {
  var recent = recentIds || [];
  var pool = [];
  EVENTS.forEach(function (event) {
    if (event.chain) return;              // 链事件只能由 nextChainEvent 发
    if (layer < (event.minLayer || 1)) return;
    if (recent.indexOf(event.id) >= 0) return;
    var weight = event.weight || 10;
    if (themeId && event.themes && event.themes.length) {
      weight = Math.round(weight * (event.themes.indexOf(themeId) >= 0 ? 3 : 0.4));
    }
    var i;
    for (i = 0; i < weight; i += 1) pool.push(event);
  });
  if (!pool.length) {
    EVENTS.forEach(function (event) {
      if (layer >= (event.minLayer || 1)) pool.push(event);
    });
  }
  return pickRandom(pool) || EVENTS[0];
}

/**
 * 事件链推进：返回下一个该出现的链事件，没有则返回 null。
 *
 * - progress: { chainId: 已完成到第几段 }
 * - layer:    当前层，用来卡「第 2 段不该在第 1 层就出现」
 * - random:   注入的 0—1 随机函数（测试里可以传固定值）
 *
 * 故意留 CHAIN_CHANCE 这个概率：事件点不多（一局 2—4 个），
 * 如果一到层数就必发链事件，玩家会觉得「每局都一样」，随机事件的意义就没了。
 */
var CHAIN_CHANCE = 0.6;
var CHAIN_ORDER = ["ticketBook", "childDrawing", "boilerWhisper"];

function nextChainEvent(progress, layer, random) {
  var reached = progress || {};
  var rand = typeof random === "function" ? random : Math.random;
  var candidates = [];
  var i;
  for (i = 0; i < CHAIN_ORDER.length; i += 1) {
    var id = CHAIN_ORDER[i];
    var chain = CHAINS[id];
    if (!chain) continue;
    var done = reached[id] || 0;
    if (done >= chain.stages.length) continue;
    var event = getById(chain.stages[done]);
    if (!event) continue;
    if (layer < (event.minLayer || 1)) continue;
    candidates.push({ chain: id, chainName: chain.name, stage: done + 1, total: chain.stages.length, event: event });
  }
  if (!candidates.length) return null;
  if (rand() > CHAIN_CHANCE) return null;
  var index = Math.floor(rand() * candidates.length) % candidates.length;
  return candidates[index];
}

module.exports = {
  EVENTS: EVENTS,
  CHAINS: CHAINS,
  getById: getById,
  roll: roll,
  nextChainEvent: nextChainEvent
};

});

define("js/game/data/items.js", function(module, exports, require) {
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

});

define("js/game/data/materials.js", function(module, exports, require) {
/**
 * data/materials.js —— 敌人「材质」与受击音效分层
 *
 * 为什么需要这一层：
 * 打一坨铁、打一团肉、打一片布、打一个虚影，如果听感完全一样，
 * 30 个敌人在手感上就退化成同一个靶子。材质字段把「听觉身份」交给数据，
 * 战斗代码只负责按材质取音层，不关心具体是哪个敌人。
 *
 * 约定：
 * - 材质是**纯表现**，不许参与任何数值计算（伤害、减伤、抗性都不行）。
 *   一旦参与数值，它就变成第 5 个属性，玩家得记住 30 个敌人的抗性表。
 * - 音层由「通用层 + 材质层」拼出来，而不是每个敌人各配一条音轨：
 *   4 个材质 × 2 种强度 = 8 条，换成逐敌人配就是 60 条，包体直接爆。
 * - 未知材质一律回退 DEFAULT，读档不会因为字段缺失变哑。
 *
 * 字段：
 * - id / name   内部标识与界面显示名
 * - hit         材质层音效名（对应 assets/audio/<hit>.wav）
 * - spark       受击粒子色（与音色同一个隐喻：铁是冷白、肉是暖红、布是土黄、虚空是紫）
 * - desc        图鉴/说明里的一句话
 */

var DEFAULT = "flesh";

var LIST = [
  {
    id: "metal",
    name: "金属",
    hit: "hit_metal",
    spark: "#DCE8F2",
    desc: "铁皮与齿轮，声音脆、余响长"
  },
  {
    id: "flesh",
    name: "血肉",
    hit: "hit_flesh",
    spark: "#FFB199",
    desc: "湿润的闷响，低频压手"
  },
  {
    id: "cloth",
    name: "丝布",
    hit: "hit_cloth",
    spark: "#CFBB92",
    desc: "干涩的摩擦，像抽在旧帆布上"
  },
  {
    id: "void",
    name: "虚空",
    hit: "hit_void",
    spark: "#B79BE8",
    desc: "声音往下坠，像是被打进了水里"
  }
];

var BY_ID = {};
(function () {
  var i;
  for (i = 0; i < LIST.length; i += 1) BY_ID[LIST[i].id] = LIST[i];
})();

function ids() {
  var out = [];
  var i;
  for (i = 0; i < LIST.length; i += 1) out.push(LIST[i].id);
  return out;
}

function isId(id) {
  return !!(id && BY_ID[id]);
}

/** 未知/缺失一律回退，绝不返回 null——返回 null 会让调用处到处判空 */
function getById(id) {
  return BY_ID[id] || BY_ID[DEFAULT];
}

function nameOf(id) {
  return getById(id).name;
}

/**
 * 受击音层。
 * - 普通命中：材质层单独出声
 * - 重击：通用「crit」打底（低频冲击负责重量）+ 材质层降低音量补质感
 *   反过来（材质层打底）会听不出重击，因为材质音都很短
 *
 * 返回数组而不是单个名字，是为了让调用处直接 for 循环播放，
 * 将来加「破盾层」「属性层」不用再改调用处签名。
 */
function layersFor(id, opts) {
  var material = getById(id);
  var crit = !!(opts && opts.crit);
  if (crit) {
    return [
      { name: "crit", volume: 0.78 },
      { name: material.hit, volume: 0.40 }
    ];
  }
  return [{ name: material.hit, volume: 0.66 }];
}

module.exports = {
  LIST: LIST,
  DEFAULT: DEFAULT,
  ids: ids,
  isId: isId,
  getById: getById,
  nameOf: nameOf,
  layersFor: layersFor
};

});

define("js/game/data/nodes.js", function(module, exports, require) {
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

});

define("js/game/data/relics.js", function(module, exports, require) {
/**
 * data/relics.js —— 遗物池（本局永久被动，稀有）
 *
 * 获取途径：宝箱、精英战、事件交易。
 * 扩充规则：id 唯一，effects 只填需要的键。
 */

var RELICS = [
  {
    id: "oldMagazine",
    name: "旧式弹仓",
    desc: "基础攻击 +4。",
    rarity: "common",
    effects: { attackFlat: 4 }
  },
  {
    id: "rationBox",
    name: "餐车配给箱",
    desc: "每经过 2 个节点恢复 8 饱食度。",
    rarity: "common",
    effects: { foodRecoveryEveryTwo: 8 }
  },
  {
    id: "calmChip",
    name: "冷静芯片",
    desc: "精神值低于 30 时，受到的伤害 -25%。",
    rarity: "rare",
    effects: { lowSanityDamageReduction: 0.25 }
  },
  {
    id: "emergencyNeedle",
    name: "应急针剂",
    desc: "每局首次濒死时自动恢复 20 生命。",
    rarity: "rare",
    effects: { autoReviveOnce: true, reviveHealBonus: 20 }
  },
  {
    id: "echoCore",
    name: "回响核心",
    desc: "事件收益提高 30%。",
    rarity: "common",
    effects: { eventRewardBoost: 0.3 }
  },
  {
    id: "hunterBadge",
    name: "猎影徽记",
    desc: "精英战斗额外多 1 个强化候选。",
    rarity: "rare",
    effects: { extraEliteEnhanceChoice: 1 }
  },
  {
    id: "steelCharm",
    name: "钢骨护符",
    desc: "每场战斗首回合获得 10 点护盾。",
    rarity: "common",
    effects: { firstTurnShield: 10 }
  },
  {
    id: "supplyPlate",
    name: "补给铭牌",
    desc: "路线商店首次购买打 7 折。",
    rarity: "common",
    effects: { firstShopDiscount: 0.7 }
  },
  {
    id: "ironHeart",
    name: "铁质心脏",
    desc: "生命上限 +15，并立即回满。",
    rarity: "epic",
    effects: { maxHpBonus: 15 }
  },
  {
    id: "foldedMap",
    name: "折叠路线图",
    desc: "节点移动的饱食消耗 -2。",
    rarity: "common",
    effects: { hungerCostDelta: -2 }
  },
  {
    id: "brassKey",
    name: "黄铜钥匙",
    desc: "沿途商店首次购买打 6 折。",
    rarity: "common",
    effects: { firstShopDiscount: 0.6 }
  },
  {
    id: "boneDice",
    name: "骨制骰子",
    desc: "每场战斗额外获得 1 枚金币。",
    rarity: "common",
    effects: { battleBonusGold: 1 }
  },
  {
    id: "warmBrick",
    name: "暖砖",
    desc: "每经过 2 个节点恢复 6 饱食度。",
    rarity: "common",
    effects: { foodRecoveryEveryTwo: 6 }
  },
  {
    id: "sniperScope",
    name: "瞄准镜",
    desc: "攻击力 +6，但节点饱食消耗 +1。",
    rarity: "rare",
    effects: { attackFlat: 6, hungerCostDelta: 1 }
  },
  {
    id: "voidLens",
    name: "虚空透镜",
    desc: "对 Boss 造成的伤害 +30%。",
    rarity: "rare",
    effects: { bossDamageBonus: 0.3 }
  },
  {
    id: "thinBlanket",
    name: "薄毯",
    desc: "营地休息额外恢复 12 生命。",
    rarity: "common",
    effects: { campHealBonus: 12 }
  },
  {
    id: "twinShell",
    name: "孪生弹壳",
    desc: "攻击力 +2，精英战额外多 1 个强化候选。",
    rarity: "rare",
    effects: { attackFlat: 2, extraEliteEnhanceChoice: 1 }
  },
  {
    id: "mourningBadge",
    name: "哀悼徽章",
    desc: "每经过 3 个节点恢复 8 精神值。",
    rarity: "rare",
    effects: { restoreSanityEveryThree: 8 }
  },

  /* ---------- 第二批次：四个流派各给一件「定型装」 ---------- */
  {
    id: "brassCompass",
    name: "黄铜罗盘",
    desc: "精准射击暴击率 +15%。",
    rarity: "rare",
    effects: { critChance: 0.15 }
  },
  {
    id: "trenchPlate",
    name: "战壕胸板",
    desc: "防御时护盾 +10，生命上限 +6。",
    rarity: "rare",
    effects: { defendShieldBonus: 10, maxHpBonus: 6 }
  },
  {
    id: "bloodOath",
    name: "血誓",
    desc: "生命低于 40% 时伤害 +40%，低精神受伤 -10%。",
    rarity: "epic",
    effects: { lowHpDamageBonus: 0.4, lowSanityDamageReduction: 0.1 }
  },
  {
    id: "quickDraw",
    name: "快枪套",
    desc: "每场战斗第一击额外造成 12 点伤害。",
    rarity: "rare",
    effects: { firstStrikeBonus: 12 }
  },
  {
    id: "widowCoin",
    name: "寡妇硬币",
    desc: "每场战斗额外 2 金币，事件收益 +15%。",
    rarity: "common",
    effects: { battleBonusGold: 2, eventRewardBoost: 0.15 }
  },
  {
    id: "boneLantern",
    name: "骨灯",
    desc: "每场战斗后回 8 生命，回血药剂效果 +10。",
    rarity: "common",
    effects: { healAfterBattle: 8, potionBonus: 10 }
  },
  {
    id: "mirrorShard",
    name: "镜片碎片",
    desc: "精准暴击率 +8%，对 Boss 伤害 +15%。",
    rarity: "rare",
    effects: { critChance: 0.08, bossDamageBonus: 0.15 }
  },
  {
    id: "emptyShell",
    name: "空弹壳",
    desc: "攻击力 +3，回血药剂效果 +12。",
    rarity: "common",
    effects: { attackFlat: 3, potionBonus: 12 }
  }
];

function getById(id) {
  var i;
  for (i = 0; i < RELICS.length; i += 1) {
    if (RELICS[i].id === id) return RELICS[i];
  }
  return null;
}

/** 按稀有度权重随机，排除已拥有 */
function roll(pickRandom, ownedIds) {
  var owned = ownedIds || [];
  var pool = RELICS.filter(function (relic) {
    return owned.indexOf(relic.id) < 0;
  });
  if (!pool.length) return null;
  var weighted = [];
  pool.forEach(function (relic) {
    var weight = relic.rarity === "epic" ? 1 : relic.rarity === "rare" ? 3 : 6;
    var i;
    for (i = 0; i < weight; i += 1) weighted.push(relic);
  });
  return pickRandom(weighted) || pool[0];
}

module.exports = {
  RELICS: RELICS,
  getById: getById,
  roll: roll
};

});

define("js/game/data/relicSets.js", function(module, exports, require) {
/**
 * data/relicSets.js —— 遗物序列（套装）
 *
 * 为什么要有序列：26 件遗物各自只加一点数值，玩家拿到什么全看运气，
 * 到中后期会觉得「一堆散件、没有方向」。序列把散件按打法归类，
 * 同一序列凑够件数就额外给一次成型奖励——拿遗物从「抽奖」变成「凑牌」。
 *
 * 设计约束：
 * 1. members 只写 id，不复制名字/描述，避免两处文案打架（名字以 relics.js 为准）。
 * 2. tiers 的 need 必须递增且 ≤ members.length，否则永远激活不了。
 * 3. effects 只能用 effects.js 里已声明的键——加新键要同时补行为分支，
 *    否则就是「描述写着 +X，实际没生效」。tests 里有对应断言。
 * 4. 序列奖励只给数值，不给规则型开关：规则型开关（逃跑免费、复活）在
 *    套装里会变成「凑齐就无敌」，代价和取舍都没了。
 */

var RELIC_SETS = [
  {
    id: "arsenal",
    name: "军械序列",
    accent: "gold",
    tagline: "把车厢里所有还能打响的东西都算上。",
    members: [
      "oldMagazine",
      "sniperScope",
      "quickDraw",
      "twinShell",
      "emptyShell",
      "voidLens"
    ],
    tiers: [
      { need: 2, desc: "攻击力 +3", effects: { attackFlat: 3 } },
      { need: 4, desc: "第一击 +6 伤害", effects: { firstStrikeBonus: 6 } },
      { need: 6, desc: "攻击力 +5，对 Boss 伤害 +12%", effects: { attackFlat: 5, bossDamageBonus: 0.12 } }
    ]
  },
  {
    id: "vigil",
    name: "守望序列",
    accent: "purple",
    tagline: "盯住要害，别眨眼。",
    members: [
      "brassCompass",
      "mirrorShard",
      "hunterBadge",
      "mourningBadge"
    ],
    tiers: [
      { need: 2, desc: "精准暴击率 +6%", effects: { critChance: 0.06 } },
      { need: 3, desc: "暴击率 +6%，精英战多 1 个强化候选", effects: { critChance: 0.06, extraEliteEnhanceChoice: 1 } },
      { need: 4, desc: "暴击率 +10%，对 Boss 伤害 +10%", effects: { critChance: 0.1, bossDamageBonus: 0.1 } }
    ]
  },
  {
    id: "warden",
    name: "守护序列",
    accent: "teal",
    tagline: "活着走到终点，比赢下每一场都难。",
    members: [
      "calmChip",
      "emergencyNeedle",
      "steelCharm",
      "ironHeart",
      "thinBlanket",
      "trenchPlate",
      "bloodOath",
      "boneLantern"
    ],
    tiers: [
      { need: 2, desc: "生命上限 +6", effects: { maxHpBonus: 6 } },
      { need: 4, desc: "防御时护盾 +6", effects: { defendShieldBonus: 6 } },
      { need: 6, desc: "低精神受伤再 -10%", effects: { lowSanityDamageReduction: 0.1 } },
      { need: 8, desc: "生命上限 +12，战后回 6 生命", effects: { maxHpBonus: 12, healAfterBattle: 6 } }
    ]
  },
  {
    id: "scavenger",
    name: "拾荒序列",
    accent: "green",
    tagline: "别人看见垃圾，你看见下一顿饭。",
    members: [
      "rationBox",
      "echoCore",
      "supplyPlate",
      "brassKey",
      "boneDice",
      "foldedMap",
      "warmBrick",
      "widowCoin"
    ],
    tiers: [
      { need: 2, desc: "每场战斗额外 1 金币", effects: { battleBonusGold: 1 } },
      { need: 4, desc: "事件收益 +15%", effects: { eventRewardBoost: 0.15 } },
      { need: 6, desc: "节点饱食消耗 -1", effects: { hungerCostDelta: -1 } },
      { need: 8, desc: "战斗金币再 +3，事件收益再 +15%", effects: { battleBonusGold: 3, eventRewardBoost: 0.15 } }
    ]
  }
];

function getById(id) {
  var i;
  for (i = 0; i < RELIC_SETS.length; i += 1) {
    if (RELIC_SETS[i].id === id) return RELIC_SETS[i];
  }
  return null;
}

/** 某件遗物属于哪个序列；不属于任何序列返回 null */
function forRelic(relicId) {
  var i;
  var j;
  for (i = 0; i < RELIC_SETS.length; i += 1) {
    for (j = 0; j < RELIC_SETS[i].members.length; j += 1) {
      if (RELIC_SETS[i].members[j] === relicId) return RELIC_SETS[i];
    }
  }
  return null;
}

module.exports = {
  RELIC_SETS: RELIC_SETS,
  getById: getById,
  forRelic: forRelic
};

});

define("js/game/data/text.js", function(module, exports, require) {
/**
 * data/text.js —— 静态文案（避免散落在场景里）
 */

module.exports = {
  gameTitle: "列车秘境",
  tagline: "一局一条路线，穿过裂隙",
  slogan: "分支路线 · 局内构筑 · 三资源压力",

  /**
   * 分享：标题 + 配图。
   * 图是 `tools/share-card.html` 截出来的合成件（不是美术资产），
   * 换图只改这里的路径，不用动逻辑；A2 立绘到位后直接把三张图替换掉。
   * 尺寸 500×400（5:4），抖音分享卡的推荐比例。
   */
  share: {
    title: "列车秘境：一局一条路线，穿过裂隙",
    cleared: "我打通了裂隙看守者，你来试试这条路线",
    failed: "我在第 %d 层倒下了，你能走多远？",
    imageCleared: "assets/share/cleared.png",
    imageFailed: "assets/share/failed.png",
    imageDaily: "assets/share/daily.png",
    daily: "今天的列车秘境是这套限制，来比比谁走得远"
  },

  home: {
    start: "进入列车",
    continue: "继续本局",
    intro: "裂隙撕开了旧铁路。你驾驶最后一列列车，在分支路线之间做出选择——每一站都会改变这一局的走向。"
  },

  train: {
    title: "列车主城",
    depart: "出发探索",
    upgrade: "列车升级",
    shop: "列车商店",
    supply: "领取补给",
    mental: "精神恢复"
  },

  guide: {
    title: "玩法说明",
    body: [
      "每局在分支节点之间选路，路线决定风险与收益。",
      "战斗有四种行动：精准射击（稳）、强力射击（伤害高但可能落空）、防御架势（护盾 + 下一击加成）、使用道具。",
      "战斗胜利、宝箱、营地整备会给「强化」，宝箱与精英会给「遗物」，它们本局生效、结束清空。",
      "生命、饱食、精神三条资源同时承压：饱食随移动下降，精神随战斗下降。精神跌破安全线会被强制回收。",
      "打到第 9 层的 Boss「裂隙看守者」，本局即通关。"
    ]
  },

  privacy: {
    title: "隐私说明",
    body: [
      "本游戏为单机产品，首版仅在本地保存游玩进度（生命、货币、背包、路线与统计）。",
      "当前版本不采集姓名、手机号、身份证号等敏感个人信息。",
      "接入平台广告与统计能力后，将按平台要求补充披露并更新本说明。",
      "如需清空本地数据，可在设置页使用「重置存档」。"
    ]
  },

  about: {
    title: "关于",
    body: [
      "《列车秘境》是一款轻 Roguelike 分支路线小游戏。",
      "单局 12—16 个节点，一局约 5—8 分钟，适合碎片时间。",
      "美术与代码由独立开发者借助 AI 工具完成。"
    ]
  },

  service: {
    title: "用户服务",
    body: [
      "本游戏为休闲策略类产品，建议合理安排游玩时间。",
      "激励视频奖励仅在完整观看后发放，未看完不发放。",
      "遇到版本异常或存档问题，可通过重置存档恢复初始状态。"
    ]
  }
};

});

define("js/game/data/themes.js", function(module, exports, require) {
/**
 * data/themes.js —— 车厢主题
 *
 * 主题 = 一组「规则修饰符」+ 一套背景色 + 一份内容权重偏好。
 * 修饰符字段刻意与 daily.combine() 的输出同形，合并逻辑只写一次（state.modsOf）。
 *
 * 纯数据文件：只导出表和查表函数，不放任何玩法计算。
 */

var THEMES = [
  {
    id: "rust",
    name: "锈蚀车厢",
    subtitle: "停在这里的第七年",
    desc: "车厢早该报废了，扶手一碰就掉锈。这里没有额外的规矩，只有一趟最普通的路。",
    unlockCost: 0,
    accent: "#E0B15C",
    glow: "rgba(79,192,176,0.16)",
    beam: "rgba(224,177,92,0.10)",
    rules: [
      "无额外修正",
      "资源消耗与掉落均为标准值"
    ],
    mods: {}
  },
  {
    id: "frost",
    name: "霜封车厢",
    subtitle: "呼吸都会结在窗上",
    desc: "车窗结了厚霜，怪物的关节冻得发僵，可铁皮也冻硬了。冷风一路抽走你的力气，走路格外耗神，得靠更多补给撑着。",
    unlockCost: 150,
    accent: "#8FC4DE",
    glow: "rgba(120,190,220,0.18)",
    beam: "rgba(190,225,245,0.11)",
    rules: [
      "敌人生命 +15%",
      "敌人伤害 -15%",
      "每层额外消耗 1 点饱食",
      "开局额外 20 以太"
    ],
    mods: {
      enemyHpMul: 1.15,
      enemyDamageMul: 0.85,
      hungerPerNodeDelta: 1,
      startEtherBonus: 20
    }
  },
  {
    id: "ember",
    name: "焚炉车厢",
    subtitle: "地板下面就是火",
    desc: "锅炉烧穿了地板，热浪把两边都逼急了：它们出手更狠，但值钱的东西也更多。这里的商店还便宜些，适合攒局外资源。",
    unlockCost: 220,
    accent: "#E58A5C",
    glow: "rgba(226,110,70,0.20)",
    beam: "rgba(238,150,90,0.12)",
    rules: [
      "敌人伤害 +4%",
      "战斗金币 +40%",
      "商店价格 -15%",
      "开局额外 30 以太"
    ],
    mods: {
      enemyDamageMul: 1.04,
      goldMul: 1.4,
      shopPriceMul: 0.85,
      startEtherBonus: 30
    }
  }
];

function getById(id) {
  var i;
  for (i = 0; i < THEMES.length; i += 1) {
    if (THEMES[i].id === id) return THEMES[i];
  }
  return null;
}

function ids() {
  return THEMES.map(function (theme) { return theme.id; });
}

/** 主题未解锁时显示的价格；已解锁返回 0 */
function unlockCostOf(id) {
  var theme = getById(id);
  return theme ? theme.unlockCost : 0;
}

module.exports = {
  THEMES: THEMES,
  getById: getById,
  ids: ids,
  unlockCostOf: unlockCostOf
};

});

define("js/game/map.js", function(module, exports, require) {
/**
 * map.js —— 分支路线图生成（纯函数，输入 seed 输出图）
 *
 * 结构：
 *   run.map = [ layer0[], layer1[], ... , bossLayer[] ]
 *   node = { id, layer, lane, type, visited, links: [下一层节点 id] }
 *
 * 生成规则：
 * 1. 每层 2—4 个节点，相邻层之间按「归一化横向距离」连边，形成分叉观感。
 * 2. 生成后修补连通性：每个节点至少一条出边（Boss 层除外），每个节点至少一条入边。
 * 3. 全图保底：至少 1 商店、1 营地、1 宝箱、1 精英，避免一局缺少关键构筑节点。
 */

var config = require("./config");
var nodes = require("./data/nodes");

function makeId(layer, lane) {
  return "n-" + layer + "-" + lane;
}

function connect(layers, rng) {
  var i;
  var j;
  for (i = 0; i < layers.length - 1; i += 1) {
    var cur = layers[i];
    var next = layers[i + 1];
    var curMax = Math.max(1, cur.length - 1);
    var nextMax = Math.max(1, next.length - 1);

    for (j = 0; j < cur.length; j += 1) {
      var p1 = j / curMax;
      var links = [];
      var k;
      for (k = 0; k < next.length; k += 1) {
        var p2 = k / nextMax;
        // 距离阈值随两层节点数放宽，避免窄层全连
        var limit = 0.55 + (0.2 * Math.min(cur.length, next.length)) / 4;
        if (Math.abs(p1 - p2) <= limit) {
          links.push(next[k].id);
        }
      }
      if (!links.length) {
        // 退化：连最近的一个
        var best = 0;
        var bestDist = 9;
        for (k = 0; k < next.length; k += 1) {
          var d = Math.abs(p1 - k / nextMax);
          if (d < bestDist) {
            bestDist = d;
            best = k;
          }
        }
        links.push(next[best].id);
      }
      cur[j].links = links;
    }

    // 入边修补：确保下一层每个节点都能被走到
    for (j = 0; j < next.length; j += 1) {
      var hasIn = cur.some(function (node) {
        return node.links.indexOf(next[j].id) >= 0;
      });
      if (!hasIn) {
        var pickIndex = rng.int(0, cur.length - 1);
        cur[pickIndex].links.push(next[j].id);
      }
    }
  }
  return layers;
}

/** 保底：确保关键节点类型存在 */
function ensureCoverage(layers) {
  var required = ["shop", "camp", "chest", "elite"];
  var present = {};
  var candidates = [];
  var i;
  var j;

  for (i = 1; i < layers.length - 1; i += 1) {
    for (j = 0; j < layers[i].length; j += 1) {
      present[layers[i][j].type] = true;
      candidates.push(layers[i][j]);
    }
  }

  var missing = required.filter(function (type) {
    return !present[type];
  });

  // 用「普通战斗」节点改造，避免破坏事件密度
  var spare = candidates.filter(function (node) {
    return node.type === "battle";
  });

  missing.forEach(function (type, index) {
    var target = spare[index];
    if (target) target.type = type;
  });

  return layers;
}

function generate(seed) {
  var rng = require("./rng").createRng(seed || 1);
  var layers = [];
  var layerCount = config.routeLayers;
  var i;
  var j;

  for (i = 0; i < layerCount; i += 1) {
    var count;
    if (i === 0) {
      count = 2;
    } else {
      count = rng.int(config.layerMinNodes, config.layerMaxNodes);
    }
    var layer = [];
    var weights = nodes.weightsForLayer(i);
    for (j = 0; j < count; j += 1) {
      var type = i === 0 ? "battle" : rng.weighted(weights);
      layer.push({
        id: makeId(i, j),
        layer: i,
        lane: j,
        type: type || "battle",
        visited: false,
        links: []
      });
    }
    layers.push(layer);
  }

  // Boss 层
  layers.push([
    {
      id: makeId(layerCount, 0),
      layer: layerCount,
      lane: 0,
      type: "boss",
      visited: false,
      links: []
    }
  ]);

  ensureCoverage(layers);
  connect(layers, rng);

  return layers;
}

function findById(map, nodeId) {
  var i;
  var j;
  if (!map) return null;
  for (i = 0; i < map.length; i += 1) {
    for (j = 0; j < map[i].length; j += 1) {
      if (map[i][j].id === nodeId) return map[i][j];
    }
  }
  return null;
}

/** 当前可前往的节点：无当前节点则第一层全开，否则走上一次的 links */
function available(map, currentNodeId) {
  if (!map || !map.length) return [];
  if (!currentNodeId) return map[0] || [];
  var current = findById(map, currentNodeId);
  if (!current) return [];
  var out = [];
  var i;
  for (i = 0; i < current.links.length; i += 1) {
    var node = findById(map, current.links[i]);
    if (node) out.push(node);
  }
  return out;
}

module.exports = {
  generate: generate,
  findById: findById,
  available: available,
  makeId: makeId
};

});

define("js/game/modals/battle.js", function(module, exports, require) {
/**
 * modals/battle.js —— 回合战斗
 *
 * 四种行动：精准（稳）/ 强力（高伤低命中）/ 防御（护盾+下一击加成）/ 道具
 * 死亡时：重战卡 → 激励视频复活 → 结束本局
 *
 * 布局从上到下：类型标签 → 敌人名 → 敌人血条 → 双方面板 → 战斗日志（自适应撑满）→ 行动按钮（贴底）
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");
var config = require("../config");
var materialsApi = require("../data/materials");

var P = draw.PALETTE;

/**
 * 恒等缓动。
 * animator.progress 默认套 easeOutCubic，出手动作是按「真实时间比例」分段的
 * （强力射击前 35% 后仰、后 65% 前扑），用默认缓动会把后仰压成几十毫秒，
 * 画面上直接消失。这里显式要线性，包络自己用 sin 做。
 */
function linearEase(t) { return t; }

/**
 * 把 #RRGGBB 转成带透明度的 rgba 串。
 *
 * 不能靠 ctx.globalAlpha 做半透明：draw.figure 内部走 figFill，那里会把
 * globalAlpha 覆盖成 0.94，外层设的透明度会被无声地吃掉。所以透明度必须
 * 落在颜色字符串里。颜色不合法时退回中性灰，画面上最多是「影子颜色不对」，
 * 不会整帧抛错。
 */
function fadeColor(hex, alpha) {
  var h = typeof hex === "string" && hex.charAt(0) === "#" ? hex.slice(1) : "";
  if (h.length !== 6) return "rgba(160,170,178," + alpha + ")";
  var r = parseInt(h.slice(0, 2), 16);
  var g = parseInt(h.slice(2, 4), 16);
  var b = parseInt(h.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "rgba(160,170,178," + alpha + ")";
  return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
}

/**
 * 最近一次渲染的坐标缓存。
 * onAction 拿不到 screen，特效需要知道「敌人在哪」才能把飘字打对位置，
 * 所以由 render 每帧写入，onAction 读取。屏幕尺寸变化时 render 会立刻刷新。
 */
var layout = { ex: 0, ey: 0, hx: 0, hy: 0, scale: 1 };

function actionLabel(kind) {
  if (kind === "elite") return "精英战斗";
  if (kind === "boss") return "BOSS 战";
  return "遭遇战";
}

function render(ctx, screen, state, animator, clock) {
  var s = screen.s;
  var run = state.run;
  var battle = run && run.battle;
  var r = common.modalPanel(screen, screen.px(560));

  if (!battle) {
    draw.panel(ctx, r, {});
    draw.text(ctx, "战斗已结束", screen.width / 2, r.y + r.h / 2, {
      size: screen.fz(14),
      align: "center",
      color: P.inkDim
    });
    return;
  }

  draw.panel(ctx, r, {
    radius: Math.round(16 * s),
    fillTop: "#1A2E3A",
    fillBottom: "#0C1922",
    strokeColor: battle.boss ? "rgba(216,87,74,0.55)" : "rgba(42,74,92,0.9)"
  });

  var pad = screen.px(14);
  var left = r.x + pad;
  var right = r.x + r.w - pad;
  var innerW = r.w - pad * 2;
  var cursor = r.y + pad;

  /**
   * Boss 登场卡：整块面板先换成一张「这是谁」，画完直接返回。
   *
   * 不做成叠在战斗界面上的浮层：叠层会让玩家以为可以边看卡边点按钮，
   * 而此刻那四个行动按钮都还没有意义——牌还没发，先问怎么出是荒谬的。
   */
  if (battle.introOpen && !battle.over && state.player.hp > 0) {
    renderBossIntro(ctx, screen, r, battle, clock);
    return;
  }

  // 类型 + 材质 + 回合
  // 材质放在这一行而不是另起一行：它是「说明这刀打上去是什么手感」的注脚，
  // 不该占用垂直空间（战斗面板的每一像素都要留给日志）
  draw.text(ctx, actionLabel(battle.kind) + " · " + materialsApi.nameOf(battle.material), left, cursor, {
    size: screen.fz(10),
    bold: true,
    color: battle.boss ? "#FF8B7A" : battle.elite ? "#E88A7D" : P.inkFaint
  });
  draw.text(ctx, "第 " + battle.turn + " 回合", right, cursor, {
    size: screen.fz(11),
    align: "right",
    color: P.inkFaint
  });
  cursor += screen.px(15);

  // 敌人名 + 词缀徽标（精英必须在打之前就能看出「他有什么毛病」）
  // 第二形态的形态名徽标也在这里先算宽度：名字是先画的，徽标是后画的，
  // 不把这几十像素让出来，窄屏上长名字会钻到徽标底下被盖掉。
  var phaseLabelTxt = battle.boss && battle.phase >= 2 ? (battle.phaseLabel || "第二阶段") : null;
  var phaseChipW = phaseLabelTxt
    ? draw.measure(ctx, phaseLabelTxt, screen.fz(9), true) + screen.px(12) : 0;
  var nameMaxW = innerW;
  var affixChipW = 0;
  if (phaseChipW) nameMaxW -= phaseChipW + screen.px(8);
  if (battle.affixName) {
    var badge = "词缀 · " + battle.affixName;
    var bw = draw.measure(ctx, badge, screen.fz(9), true) + screen.px(14);
    affixChipW = bw;
    nameMaxW -= bw + screen.px(8);
    var chip = { x: right - bw, y: cursor + screen.px(5), w: bw, h: screen.px(17) };
    draw.fillRR(ctx, chip, "rgba(224,177,92,0.18)", screen.px(9));
    draw.text(ctx, badge, chip.x + bw / 2, chip.y + screen.px(3), {
      size: screen.fz(9),
      align: "center",
      bold: true,
      color: P.gold
    });
  }
  draw.text(ctx, battle.name, left, cursor, {
    size: screen.fz(20),
    bold: true,
    color: P.ink,
    maxWidth: nameMaxW
  });
  /**
   * Boss 第二形态的标记。
   * 用徽标而不是「名字（第二阶段）」：名字改动会让玩家怀疑换了个敌人，
   * 而事实是同一个东西裂开了。徽标只加后缀信息，不重命名。
   *
   * 徽标文案跟着形态走：「双影」「查票」「过载」比统一写「第二阶段」有用得多——
   * 五个 Boss 的第二形态各不相同，统一文案等于告诉玩家「又是一样的」。
   * 老存档没有 phaseLabel 时退回通用文案，不会出现空徽标。
   */
  if (phaseLabelTxt) {
    var pw = phaseChipW;
    // 词缀徽标也在这一行：两个都贴右边会叠成一团，形态名要往左让出词缀的位置
    var pchip = {
      x: right - pw - affixChipW - (affixChipW ? screen.px(6) : 0),
      y: cursor + screen.px(9), w: pw, h: screen.px(16)
    };
    draw.fillRR(ctx, pchip, "rgba(255,90,68,0.20)", screen.px(8));
    draw.text(ctx, phaseLabelTxt, pchip.x + pw / 2, pchip.y + screen.px(3), {
      size: screen.fz(9),
      align: "center",
      bold: true,
      color: "#FF7A66"
    });
  }
  cursor += screen.px(30);

  // 敌人血条
  var hpRect = { x: left, y: cursor, w: innerW, h: screen.px(9) };
  draw.bar(ctx, hpRect, battle.hp / battle.maxHp, {
    // 二形态换色：同一个血条，玩家扫一眼就知道「这不是刚才那个东西了」
    color: battle.boss ? (battle.phase >= 2 ? "#FF5A44" : P.red) : "#C8664F",
    track: "rgba(255,255,255,0.10)"
  });
  cursor += hpRect.h + screen.px(4);
  draw.text(ctx, Math.max(0, Math.round(battle.hp)) + " / " + battle.maxHp, left, cursor, {
    size: screen.fz(10),
    color: P.inkDim
  });
  if (battle.enemyShield > 0) {
    draw.text(ctx, "护盾 " + battle.enemyShield, right, cursor, {
      size: screen.fz(10),
      align: "right",
      color: P.teal
    });
  }
  cursor += screen.px(18);

  // 舞台：敌人（右）+ 玩家（左）
  var stageCenter = cursor + screen.px(56);
  var enemyX = r.x + r.w * 0.68;
  var heroX = left + screen.px(20);

  /**
   * 待机与打击动画。三个 key 各管一件事：
   *   enemyHit  —— 敌人挨打的挤压 + 后坐（同一个 key 驱动位移与形变，才同步）
   *   enemyLunge —— 敌人扑咬时向玩家方向冲出去
   *   heroHurt  —— 玩家挨打时向左一顿
   */
  /**
   * 下回合预告。这是「敌人在憋什么」的唯一来源——界面不许自己再猜一遍，
   * 否则状态与画面迟早对不上。
   */
  var tele = battle.telegraph || null;

  var recoil = animator.progress("enemyHit");
  var kick = recoil < 1 ? (1 - recoil) * screen.px(9) : 0;
  var enemySize = battle.boss ? screen.px(104) : screen.px(80);

  /**
   * 待机呼吸：相位完全由 clock 推出，界面不存任何动画状态。
   * 敌人与玩家相位错开约 0.6 拍——同频起伏会让两个剪影看起来像连在一起。
   * 幅度只有 2px 左右：这是「活的」暗示，不是蹦迪，超过 4px 就会显得滑稽。
   *
   * 血量会改呼吸：残血时呼吸变快变深（喘），濒死再叠一层高频颤抖。
   * 「快死了」因此写在身体上，而不是只写在血条长度上——血条只能告诉你还剩多少，
   * 剪影才能告诉你「它快撑不住了」。
   */
  var breatheT = (typeof clock === "number" ? clock : 0) / 1000;
  var enemyHpRatio = Math.max(0, Math.min(1, battle.hp / (battle.maxHp || 1)));
  var heroHpRatio = Math.max(0, Math.min(1, state.player.hp / (state.player.maxHp || 1)));
  var enemyPanting = enemyHpRatio < 0.32 ? 1 : 0;
  var enemyDying = enemyHpRatio < 0.12 ? 1 : 0;
  var heroPanting = heroHpRatio < 0.32 ? 1 : 0;

  // 喘息 = 周期缩短 + 幅度加大；两者都只改节奏，不改任何玩法数值
  // 第二形态再压一档：没到残血的 Boss 也已经在急促换气，这是「它认真了」的信号
  var phaseRate = battle.phase >= 2 ? 1.25 : 1;
  var enemyBreath = Math.sin(breatheT * Math.PI * 2 / (2.6 / (1 + 0.7 * enemyPanting) / phaseRate));
  var heroBreath = Math.sin(breatheT * Math.PI * 2 / (2.6 / (1 + 0.7 * heroPanting)) + Math.PI * 0.6);
  var enemyAmp = 2.2 * (1 + 0.55 * enemyPanting);
  var heroAmp = 1.6 * (1 + 0.55 * heroPanting);
  // 濒死颤抖只能由 clock 推出：用 Math.random 会让同一毫秒的两次渲染长得不一样，
  // 脏渲染会一直以为「有变化」，等于把节流关掉
  var tremble = enemyDying ? Math.sin(breatheT * Math.PI * 2 / 0.18) : 0;

  // 受击挤压帧：p 从 0 走到 1，挤压量取 (1-p)；没在跑时 p === 1，挤压为 0
  var hitP = animator.progress("enemyHit");
  var squash = hitP < 1 ? 1 - hitP : 0;
  // 敌人扑咬：朝玩家方向冲一下再收回（正弦包络，冲出去和收回来一样快）
  var lungeP = animator.progress("enemyLunge");
  var lunge = lungeP < 1 ? Math.sin(lungeP * Math.PI) : 0;
  var hurtP = animator.progress("heroHurt");
  var hurt = hurtP < 1 ? 1 - hurtP : 0;

  /**
   * 蓄势姿态：缩成一团、略微后仰。用 clock 做 0.9 秒一次的紧促脉动，
   * 频率比呼吸快——「憋着劲」和「在呼吸」是两种节奏，玩家不看文字也分得出来。
   * 幅度压得很小：这里要传达的是紧张感，不是把敌人画成一个弹簧。
   */
  var charging = tele && tele.kind === "charge" ? 1 : 0;
  var chargePulse = charging
    ? 0.5 + 0.5 * Math.sin(breatheT * Math.PI * 2 / 0.9)
    : 0;
  var gathering = tele && tele.kind === "swarm" ? 1 : 0;
  /**
   * 裂开的一瞬：横向撑开、纵向压扁，再收回去。
   * 只有 420ms，但它是「外壳崩开」在剪影上的唯一证据——
   * 光靠闪白和飘字，剪影不动的话这一下仍然像是界面在闪，而不是它在裂。
   */
  var breakP = animator.progress("bossPhase", linearEase);
  var breaking = breakP < 1 ? Math.sin(breakP * Math.PI) : 0;

  /**
   * 玩家出手动作。此前点按钮只有飘字在动，剪影始终像雕塑——
   * 「我正在做什么」必须由身体说出来，否则四个行动在视觉上完全一样。
   *
   * 幅度都压得很小（最大 9px）：这是回合结算后的一瞬间，不是动作游戏。
   * 四个 key 分别对应四种行动，闭着眼听音色、睁着眼看姿态，指向同一件事。
   */
  var shootP = animator.progress("heroShoot", linearEase);
  var powerP = animator.progress("heroPower", linearEase);
  var guardP = animator.progress("heroGuard", linearEase);
  var drinkP = animator.progress("heroDrink", linearEase);
  var lean = 0;
  var tilt = 0;
  var actSx = 0;
  var actSy = 0;
  var actBob = 0;

  if (shootP < 1) {
    // 精准：小幅前倾，收肩。稳，所以动作也稳
    var se = Math.sin(shootP * Math.PI);
    lean += screen.px(4) * se;
    // 倾角才是「在用劲」的主信号，位移只是让重心跟着挪一点
    tilt += 0.09 * se;
    actSx -= 0.05 * se;
    actSy += 0.04 * se;
  }
  if (powerP < 1) {
    // 强力：前 35% 后仰拉满，后 65% 整个人扑出去。
    // 拉得越狠打得越重——动作本身就在解释「低命中换高伤害」
    var pe = powerP < 0.35
      ? -Math.sin(powerP / 0.35 * Math.PI / 2) * 0.9
      : Math.sin((powerP - 0.35) / 0.65 * Math.PI);
    lean += screen.px(9) * pe;
    tilt += 0.16 * pe;
    actSx -= 0.09 * Math.abs(pe);
    actSy += 0.06 * Math.abs(pe);
  }
  if (guardP < 1) {
    // 防御：蹲下去，横向撑开。缩得比站着矮，才像「架住了」
    var ge = Math.sin(guardP * Math.PI);
    actSy -= 0.18 * ge;
    actSx += 0.13 * ge;
    tilt -= 0.03 * ge;
  }
  if (drinkP < 1) {
    var de = Math.sin(drinkP * Math.PI);
    actBob -= screen.px(4) * de;
    actSy += 0.04 * de;
    tilt -= 0.05 * de;
  }
  // 挨打时出手姿态让位：正被顶退的那一帧，「我举着弓」比「我被打中」次要
  var actW = 1 - hurt;

  /**
   * 双影：第二形态真的有两个影子，剪影就必须是两个。
   *
   * 只画一个半透明副本会被读成「重影 / 渲染叠了一层」，所以三个信号必须同时给：
   * 落后半个身位、呼吸相位错开、颜色更暗。玩家看到的是「那边还站着一个」，
   * 而不是「画面糊了」——这一段没有任何数值含义，只是让两段攻击有视觉依据。
   */
  if (battle.phaseHits > 1) {
    var twinBreath = Math.sin(breatheT * Math.PI * 2 / (2.6 / phaseRate) + Math.PI * 0.85);
    // 偏移量取敌人身宽的六成：再小两具剪影就糊成一团，玩家读到的是「渲染重影」
    // 而不是「那边还站着一个」；再大就会压到玩家的血条上。
    // 抬高 6px 是透视：站得远的那个，脚底在画面上更高一点。
    draw.figure(ctx, enemyX - enemySize * 0.6 + tremble * screen.px(0.7),
      stageCenter - screen.px(6), enemySize * 0.8,
      battle.figure, fadeColor(battle.color, 0.38), battle.trait, {
        bob: -screen.px(enemyAmp) * twinBreath + tremble * screen.px(0.5),
        rot: -0.05 * charging + 0.05 * enemyDying,
        sx: 1 + 0.03 * gathering - 0.03 * enemyDying,
        sy: 1 - 0.02 * gathering - 0.05 * enemyDying
      });
  }

  draw.figure(ctx, enemyX + kick - lunge * screen.px(26) + charging * screen.px(4) + tremble * screen.px(1.2) - enemyDying * screen.px(2),
    stageCenter, enemySize,
    battle.figure, battle.color, battle.trait, {
      bob: -screen.px(enemyAmp) * enemyBreath + tremble * screen.px(0.6)
        - charging * screen.px(1.2) * chargePulse,
      rot: 0.04 * charging + 0.05 * enemyDying,
      sx: 1 + 0.14 * squash + 0.06 * lunge - 0.07 * charging + 0.02 * chargePulse * charging
        + 0.03 * gathering - 0.03 * enemyDying + 0.18 * breaking,
      sy: 1 - 0.12 * squash - 0.04 * lunge + 0.06 * charging - 0.02 * chargePulse * charging
        - 0.02 * gathering - 0.06 * enemyDying - 0.11 * breaking
    });
  draw.figure(ctx, heroX - hurt * screen.px(5) + lean * actW, stageCenter, screen.px(48),
    "hero", P.teal, "hero", {
      bob: -screen.px(heroAmp) * heroBreath + actBob * actW,
      rot: tilt * actW,
      sx: 1 + 0.10 * hurt + actSx * actW,
      sy: 1 - 0.09 * hurt + actSy * actW
    });

  if (tele) {
    drawTelegraph(ctx, screen, enemyX, stageCenter, enemySize, tele, breatheT);
  }

  layout.ex = enemyX;
  layout.ey = stageCenter - enemySize * 0.1;
  layout.hx = heroX;
  layout.hy = stageCenter - screen.px(30);
  layout.scale = s;

  // 玩家血量（右侧对齐在玩家剪影旁）
  var phpRect = { x: left + screen.px(46), y: stageCenter + screen.px(16), w: innerW * 0.5, h: screen.px(8) };
  draw.bar(ctx, phpRect, state.player.hp / state.player.maxHp, {
    color: "#5FB87A",
    track: "rgba(255,255,255,0.10)"
  });
  draw.text(ctx, "你 " + Math.round(state.player.hp) + " / " + state.player.maxHp, phpRect.x, phpRect.y + phpRect.h + screen.px(3), {
    size: screen.fz(10),
    color: P.inkDim
  });
  if (battle.playerShield > 0) {
    draw.text(ctx, "护盾 " + battle.playerShield, phpRect.x + phpRect.w, phpRect.y + phpRect.h + screen.px(3), {
      size: screen.fz(10),
      align: "right",
      color: P.teal
    });
  }

  // 行动区贴底
  var actionsTop = r.y + r.h - screen.px(174);

  // 战斗日志：撑满中间剩余空间
  var logTop = stageCenter + screen.px(48);
  var logH = Math.max(screen.px(56), actionsTop - logTop - screen.px(12));
  var logRect = { x: left, y: logTop, w: innerW, h: logH };
  ctx.save();
  ctx.globalAlpha = 0.85;
  draw.fillRR(ctx, logRect, "rgba(0,0,0,0.24)", Math.round(8 * s));
  ctx.restore();

  var lineH = screen.px(15);
  var maxLines = Math.max(1, Math.floor((logH - screen.px(10)) / lineH));
  var logs = battle.logs.slice(0, maxLines);
  var i;
  for (i = 0; i < logs.length; i += 1) {
    /**
     * 呼应句换一支颜色。
     * 它和登场卡上的「预感」是同一句话的两头，所以用同一支暖色（#E6B4A4）——
     * 玩家不会去记文案，但会认出「这个颜色刚才在卡片上出现过」。
     * 判据只看首字的「」：日志里只有这一种句子会被括起来。
     */
    var lineColor = i === 0 ? P.ink : (P.inkSoft || P.inkDim);
    if (logs[i].charAt(0) === "「") lineColor = "#E6B4A4";
    draw.text(ctx, logs[i], logRect.x + screen.px(8), logRect.y + screen.px(6) + i * lineH, {
      size: screen.fz(10),
      color: lineColor,
      maxWidth: logRect.w - screen.px(16),
      alpha: 1 - i * 0.16
    });
  }

  if (battle.over || state.player.hp <= 0) {
    renderDeath(ctx, screen, state, r, actionsTop);
    return;
  }

  // 三个横向行、每行 2—3 个按钮
  var rowH = (screen.px(174) - screen.px(16)) / 3;
  var rows = [
    { x: left, y: actionsTop, w: innerW, h: rowH },
    { x: left, y: actionsTop + rowH + screen.px(8), w: innerW, h: rowH },
    { x: left, y: actionsTop + (rowH + screen.px(8)) * 2, w: innerW, h: rowH }
  ];
  var row1 = screen.row(rows[0], 2, screen.px(8));
  var row2 = screen.row(rows[1], 2, screen.px(8));
  var row3 = screen.row(rows[2], 3, screen.px(8));

  ui.button(ctx, {
    id: "battle:precise",
    rect: row1[0],
    label: "精准射击",
    sub: "稳定命中",
    style: "primary",
    size: screen.fz(15)
  });
  ui.button(ctx, {
    id: "battle:power",
    rect: row1[1],
    label: "强力射击",
    sub: "68% 命中 · 高伤",
    style: "teal",
    size: screen.fz(15)
  });
  /**
   * 防御按钮的「建议」高亮。
   * 预警如果不能落到一个具体动作上，就只是噪音；所以预告重击/连击时，
   * 把唯一能减伤的那个按钮圈出来。描边呼吸而不是换配色：换底色会让按钮
   * 像是变成了另一个按钮，描边只表示「现在选它更划算」。
   */
  var adviseDefend = tele && (tele.kind === "charge" || tele.kind === "swarm");
  if (adviseDefend) {
    var ap = 0.5 + 0.5 * Math.sin(breatheT * Math.PI * 2 / 1.1);
    ctx.save();
    ctx.globalAlpha = 0.30 + 0.50 * ap;
    ctx.strokeStyle = "#F2CD84";
    ctx.lineWidth = Math.max(1, screen.px(1.6));
    draw.rr(ctx, row2[0].x - screen.px(2), row2[0].y - screen.px(2),
      row2[0].w + screen.px(4), row2[0].h + screen.px(4), screen.px(13));
    ctx.stroke();
    ctx.restore();
  }

  ui.button(ctx, {
    id: "battle:defend",
    rect: row2[0],
    label: "防御架势",
    sub: adviseDefend ? "挡下这记预告" : "+12 护盾 · 下击 +5",
    style: "ghost",
    size: screen.fz(15)
  });
  ui.button(ctx, {
    id: "battle:potion",
    rect: row2[1],
    label: "回血药剂 ×" + (state.player.inventory.potion || 0),
    sub: "恢复 30+ 生命",
    style: "ghost",
    disabled: (state.player.inventory.potion || 0) <= 0,
    size: screen.fz(14)
  });
  ui.button(ctx, {
    id: "battle:execute",
    rect: row3[0],
    label: "秒杀卡 ×" + (state.player.inventory.executeCard || 0),
    style: "ghost",
    disabled: (state.player.inventory.executeCard || 0) <= 0,
    size: screen.fz(12)
  });
  ui.button(ctx, {
    id: "battle:escape",
    rect: row3[1],
    label: "撤离 " + (run.effects.escapeFree ? "免费" : "12 以太"),
    style: "ghost",
    size: screen.fz(12)
  });
  ui.button(ctx, {
    id: "battle:info",
    rect: row3[2],
    label: "敌人特性",
    style: "ghost",
    size: screen.fz(12)
  });
}

/**
 * Boss 登场卡。
 *
 * 三件事按顺序发生：先看到「有多大」（剪影），再看到「是谁」（名字），
 * 最后读到「它怎么打」和一句没头没尾的预感。顺序不能反——
 * 先把规则摆在最上面，玩家会把它当说明书扫一眼就点掉。
 *
 * 预感那一行是这张卡真正的价值：它不解释任何机制，只在开战前留下一句话。
 * 半血崩开时，这句话会突然对上号——「原来它刚才说的影子是这个」。
 * 剧透会把惊喜变成说明书，完全不提又会让第二形态显得凭空出现。
 */
function renderBossIntro(ctx, screen, r, battle, clock) {
  var breatheT = (typeof clock === "number" ? clock : 0) / 1000;
  var pad = screen.px(18);
  var left = r.x + pad;
  var innerW = r.w - pad * 2;
  var cx = r.x + r.w / 2;
  // 按钮位置先算出来：下面的「预感」块要贴着它排，先把底边钉住，
  // 剩下多少空间，中间的排版才知道自己有多少余量
  var btnH = screen.px(44);
  var btnTop = r.y + r.h - pad - btnH;

  draw.text(ctx, "关底首领 · " + materialsApi.nameOf(battle.material), left, r.y + pad, {
    size: screen.fz(10),
    bold: true,
    color: "#FF8B7A"
  });

  // 剪影 + 背光。背光用几圈低透明度实心圆叠出来，不用渐变：
  // 低端机上 canvas 渐变每帧重建一次就有可见的卡顿，而这里每一帧都在动。
  //
  // 位置按 figure 的真实比例算：传给它的 cy 是「躯干中心」，不是脚底——
  // 双角顶到 cy - 0.66×size，躯干底在 cy + 0.52×size。不按这个算，
  // 名字就会写进它的胸口里（第一版截图里就是这样）。
  var figSize = screen.px(164);
  var bodyTop = r.y + pad + screen.px(24);
  var figY = bodyTop + figSize * 0.66;
  var bodyBottom = figY + figSize * 0.52;
  var i;
  for (i = 3; i >= 1; i -= 1) {
    ctx.save();
    ctx.globalAlpha = 0.05 * i;
    ctx.fillStyle = "#D8574A";
    ctx.beginPath();
    ctx.arc(cx, figY - figSize * 0.08, figSize * (0.34 + 0.16 * i), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // 呼吸比战斗里慢一档：这里是「它还没动」，不是「它要动了」
  var breath = Math.sin(breatheT * Math.PI * 2 / 3.6);
  draw.figure(ctx, cx, figY, figSize, battle.figure, battle.color, battle.trait, {
    bob: -screen.px(2.6) * breath,
    sx: 1 + 0.012 * breath,
    sy: 1 - 0.010 * breath
  });

  var nameY = bodyBottom + screen.px(24);
  draw.text(ctx, battle.name, cx, nameY, {
    size: screen.fz(26),
    bold: true,
    align: "center",
    color: P.ink,
    maxWidth: innerW
  });

  // 血量与每击：这两条是唯一影响「要不要现在交药」的数字，
  // 放在卡上比放在战斗面板里更有用——玩家在读卡的这几秒才真的在想这件事
  draw.text(ctx,
    "生命 " + battle.maxHp + "　·　每击 " + battle.damageRange[0] + "—" + battle.damageRange[1],
    cx, nameY + screen.px(38), {
      size: screen.fz(10),
      align: "center",
      color: P.inkFaint
    });

  // intro 原文以「Boss：」开头，那是日志里的写法；卡上已经有「关底首领」，
  // 再念一遍就成了「关底首领 / Boss：」的重复
  var introText = String(battle.intro || "").replace(/^Boss：/, "");
  var introY = nameY + screen.px(66);
  var introUsed = draw.text(ctx, introText, cx, introY, {
    size: screen.fz(11),
    align: "center",
    color: P.inkDim,
    wrap: innerW,
    lineHeight: screen.px(17)
  });

  if (battle.introHint) {
    // 预感块贴底，不贴着上一段：它是这张卡最后一句、也是唯一真需要读进去的一句，
    // 跟规则文字挤在一起就变成了脚注。贴在按钮上方，中间那片空才读成「留白」，
    // 而不是「有一块内容加载失败」。上限兜底：极窄屏上两块仍不许叠。
    var hy = Math.max(introY + introUsed + screen.px(16), btnTop - screen.px(112));
    draw.fillRR(ctx, { x: left, y: hy, w: innerW, h: 1 }, "rgba(255,138,106,0.26)", 0);
    draw.text(ctx, "预感", left, hy + screen.px(10), {
      size: screen.fz(9),
      bold: true,
      color: "#F08A6A"
    });
    draw.text(ctx, battle.introHint, left, hy + screen.px(26), {
      size: screen.fz(11),
      color: "#E6B4A4",
      wrap: innerW,
      lineHeight: screen.px(17)
    });
  }

  var pulse = 0.55 + 0.45 * Math.sin(breatheT * Math.PI * 2 / 1.6);
  draw.text(ctx, "轻触任意处继续", cx, btnTop - screen.px(22), {
    size: screen.fz(9),
    align: "center",
    color: P.inkFaint,
    alpha: 0.35 + 0.45 * pulse
  });

  // 整块面板先注册点击，按钮后画：后画的在栈顶，按钮才有按压反馈。
  // 两个 id 相同，所以点在哪儿都是同一件事——「我看完了」。
  ui.pushHit({ id: "battle:intro", rect: r, kind: "card" });
  ui.button(ctx, {
    id: "battle:intro",
    rect: { x: left, y: btnTop, w: innerW, h: btnH },
    label: "迎战",
    style: "primary",
    size: screen.fz(15)
  });
}

function renderDeath(ctx, screen, state, r, top) {
  var pad = screen.px(14);
  var left = r.x + pad;
  var innerW = r.w - pad * 2;

  draw.text(ctx, "你倒下了", r.x + r.w / 2, top, {
    size: screen.fz(21),
    bold: true,
    align: "center",
    color: "#FFB199"
  });
  draw.text(ctx,
    (state.player.inventory.retryCard || 0) > 0
      ? "使用重战卡原地满血复活，或看一次广告复活"
      : "可以看一次激励视频复活，或直接结束本局",
    r.x + r.w / 2, top + screen.px(30), {
      size: screen.fz(11),
      align: "center",
      color: P.inkDim,
      wrap: innerW,
      lineHeight: screen.px(17)
    });

  var btns = screen.col({ x: left, y: top + screen.px(60), w: innerW, h: screen.px(108) }, 3, screen.px(8));

  ui.button(ctx, {
    id: "battle:retry",
    rect: btns[0],
    label: "使用重战卡 ×" + (state.player.inventory.retryCard || 0),
    sub: "满血复活",
    style: "primary",
    disabled: (state.player.inventory.retryCard || 0) <= 0,
    size: screen.fz(14)
  });
  ui.button(ctx, {
    id: "battle:adRevive",
    rect: btns[1],
    label: "看视频复活",
    sub: "恢复 70 生命",
    style: "teal",
    size: screen.fz(14)
  });
  ui.button(ctx, {
    id: "battle:giveUp",
    rect: btns[2],
    label: "结束本局",
    sub: "结算并返回列车",
    style: "ghost",
    size: screen.fz(14)
  });
}

/**
 * 敌人身侧的预告气泡。
 *
 * 为什么不在头顶：头顶那 20px 是血条、血量数字和护盾行占着的地盘，
 * 早期版本把气泡放在头顶，正好压住「护盾 8」，而且窄屏上还会顶到面板右缘。
 * 玩家与敌人之间的空白是面板里唯一一块没被占用的地方，气泡放这儿既能对上
 * 剪影，又不和任何数字抢位置。
 *
 * 只写「下回合真要发生的事」：气泡上的数字就是结算时的数字，对不上比没提示更糟。
 * 颜色按危险类型分，脉动 1.1 秒——比待机呼吸快，余光能捕捉，又不至于读不清字。
 */
function drawTelegraph(ctx, screen, cx, cy, enemySize, tele, t) {
  var color = tele.kind === "weave" ? "#7ED8CB"
    : tele.kind === "swarm" ? "#F0B45C" : "#F08A6A";
  var fs = screen.fz(9);
  var label = tele.label + " · " + tele.detail;
  var padX = screen.px(8);
  var w = Math.min(draw.measure(ctx, label, fs, true) + padX * 2 + screen.px(7), screen.px(150));
  var h = screen.px(20);
  var anchorX = cx - enemySize * 0.5 - screen.px(7);
  var x = anchorX - screen.px(9) - w;
  var y = cy - h / 2 + screen.px(3);
  // 贴着面板左缘时收进来，宁可离剪影远一点，也不能把气泡画到面板外
  var minX = screen.px(12);
  if (x < minX) x = minX;
  var pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 / 1.1);

  draw.fillRR(ctx, { x: x, y: y, w: w, h: h }, "rgba(10,22,30,0.90)", screen.px(7));

  ctx.save();
  ctx.globalAlpha = 0.55 + 0.45 * pulse;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, screen.px(1.2));
  draw.rr(ctx, x, y, w, h, screen.px(7));
  ctx.stroke();

  // 左侧小圆点：与描边同频呼吸，把视线拉过来
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + padX * 0.55, y + h / 2, Math.max(1.5, screen.px(2)), 0, Math.PI * 2);
  ctx.fill();

  // 指向敌人的箭头（气泡右缘 → 剪影），没有它这块牌子就只是飘在空中的一段字
  ctx.beginPath();
  ctx.moveTo(x + w, y + h / 2 - screen.px(4));
  ctx.lineTo(anchorX + screen.px(2), y + h / 2);
  ctx.lineTo(x + w, y + h / 2 + screen.px(4));
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  draw.text(ctx, label, x + padX * 1.05, y + (h - fs * 1.3) / 2, {
    size: fs,
    bold: true,
    color: color,
    maxWidth: w - padX * 1.4
  });
}

/** 按当前屏幕缩放折算像素，保证特效在各机型上比例一致 */
function px(base) {
  return Math.round(base * (layout.scale || 1));
}

function hitPos() {
  return { x: layout.ex || 200, y: layout.ey || 300 };
}

function heroPos() {
  return { x: layout.hx || 60, y: layout.hy || 300 };
}

function onAction(action, state, app) {
  var id = action.id;
  if (id.indexOf("battle:") !== 0) return false;
  var command = id.slice(7);
  var fx = app.fx ? app.fx() : null;

  /**
   * 登场卡还开着：任何战斗动作都先当成「关掉卡片」。
   *
   * 卡上没画按钮，但手指可能落在旧位置（甚至就是上一场战斗「精准射击」那儿）。
   * 若把这一下当行动处理，玩家只是在读字就被白打一回合——这一击和「读卡」毫无关系。
   */
  if (command === "intro"
    || (state.run && state.run.battle && state.run.battle.introOpen)) {
    if (stateApi.dismissBattleIntro(state)) {
      if (app.sound) app.sound("tap", 0.6);
      app.commit();
    }
    return true;
  }

  if (command === "info") {
    app.openInfo("enemy");
    return true;
  }
  if (command === "giveUp") {
    if (app.sound) app.sound("lose", 0.7);
    stateApi.endRun(state, false, "你在战斗中放弃了本次探索。");
    app.commit();
    return true;
  }
  if (command === "adRevive") {
    app.requestAd("revive", function () {
      var ok = stateApi.applyAdRevive(state);
      if (!ok) {
        app.toast("复活失败，请稍后再试");
      } else if (fx) {
        var h = heroPos();
        fx.ring(h.x, h.y, { color: "#7FD69A", to: px(70), life: 460, width: 3 });
        fx.float(h.x, h.y - px(16), "+" + config.adReviveHp, { color: "#7FD69A", size: px(22) });
        fx.flash("rgba(127,214,154,0.30)", 220);
      }
      if (app.sound) app.sound("heal", 0.8);
      app.commit();
      // 旧代码在这里 start("battlefx")，但那颗补间是给「敌人受击」用的，
      // 复活时让敌人无故后坐了一帧。复活只留光效，不动剪影。
    });
    return true;
  }
  if (command === "retry") {
    var rr = stateApi.battleAction(state, "retry");
    if (!rr.ok) {
      app.toast("无法使用重战卡");
    } else {
      if (app.sound) app.sound("heal", 0.9);
      if (fx) {
        var hp = heroPos();
        fx.ring(hp.x, hp.y, { color: "#E0B15C", to: px(80), life: 480, width: 3 });
        fx.burst(hp.x, hp.y, { count: 18, color: "#F2CD84", speed: 190, life: 520 });
        fx.flash("rgba(240,205,132,0.30)", 240);
      }
    }
    app.commit();
    return true;
  }

  var battleBefore = state.run && state.run.battle;
  var enemyHpBefore = battleBefore ? battleBefore.hp : 0;
  var enemyShieldBefore = battleBefore ? battleBefore.enemyShield : 0;
  var phaseBefore = battleBefore ? (battleBefore.phase || 1) : 1;
  var playerHpBefore = state.player.hp;
  var result = stateApi.battleAction(state, command) || {};
  var phaseBroke = !!battleBefore && battleBefore.phase > phaseBefore;

  // 出手音：不同行动给不同音色，让玩家闭着眼也能听出自己在干什么
  if (app.sound) {
    if (command === "defend") app.sound("shield", 0.7);
    else if (command === "potion") app.sound("heal", 0.7);
    else if (command === "execute") app.sound("crit", 0.95);
    else if (command === "escape") app.sound("select", 0.7);
    else app.sound("bow", 0.6);
  }

  // 换阶段是这一回合里最重要的事，压过其它所有反馈：
  // 一闪、一震、一圈裂纹，玩家才知道刚才那一下打出了什么。
  // 音效放在出手音之后，否则会被后面那句 app.sound("bow") 盖掉。
  if (phaseBroke) {
    var bp2 = hitPos();
    if (fx) {
      fx.flash("rgba(255,235,220,0.42)", 260);
      fx.shake(px(7), 300);
      fx.ring(bp2.x, bp2.y, { color: "#FF8B7A", to: px(130), life: 620, width: 3 });
      fx.burst(bp2.x, bp2.y, {
        count: 26, color: "#D8574A", speed: 260, life: 700, size: px(3)
      });
      // 飘字要抬得比伤害数字高得多：伤害数字从 y-8 往上飘 52px，
      // 两个都在同一高度就会撞成一团「第二阶段-16」。
      fx.float(bp2.x, bp2.y - px(58), battleBefore.phaseLabel || "第二阶段", {
        color: "#FF9C86", size: px(20), rise: px(24), bold: true
      });
    }
    if (app.sound) app.sound("crit", 1);
    if (app.animator) app.animator.start("bossPhase", 420);
  }

  // 出手动作：和音色指向同一件事。时长比音效尾巴略长，动作不会在半路僵住。
  // 落空、闪避也照播——「我确实出手了，只是没打中」，这正是需要看见的信息。
  // 行动没成立（没药、没钱）时不播：喝了口空气还做出仰头动作，是在骗玩家。
  if (app.animator && result.ok !== false) {
    if (command === "defend") app.animator.start("heroGuard", 420);
    else if (command === "potion") app.animator.start("heroDrink", 360);
    else if (command === "power" || command === "execute") app.animator.start("heroPower", 420);
    else if (command === "precise") app.animator.start("heroShoot", 240);
  }

  var hp = hitPos();
  var hero = heroPos();

  // 落空 / 闪避：给明确的「没打中」反馈，而不是什么都没有
  if (result.missed) {
    if (fx) {
      fx.float(hp.x, hp.y - px(10), "落空", { color: "#8FA3AE", size: px(17), rise: 34 });
      fx.burst(hp.x, hp.y + px(30), { count: 6, color: "#5B6C77", speed: 90, life: 300, dir: -Math.PI / 2, spread: Math.PI });
    }
  } else if (result.dodged) {
    if (fx) {
      fx.float(hp.x, hp.y - px(10), "闪避", { color: "#9FC6D4", size: px(17), rise: 34 });
      fx.burst(hp.x, hp.y, { count: 8, color: "#9FC6D4", speed: 130, life: 320 });
    }
  } else {
    // 命中伤害 = 血条变化 + 被护盾吃掉的量
    var afterBattle = state.run && state.run.battle;
    var dealt = enemyHpBefore - (afterBattle ? afterBattle.hp : 0);
    if (dealt > 0) {
      // 材质决定「这一刀打的是什么」：铁是冷白火星、肉是暖红血雾、布是土黄碎屑、虚空是紫色残光。
      // 音色与粒子色共用同一个材质字段，玩家的视觉与听觉指向同一件事。
      var spark = materialsApi.getById(battleBefore && battleBefore.material).spark;
      if (fx) {
        var big = dealt >= 20;
        fx.float(hp.x, hp.y - px(8), "-" + dealt, {
          color: big ? "#FF7A66" : "#FFB199",
          size: px(big ? 27 : 21),
          rise: px(52),
          drift: px(6)
        });
        fx.burst(hp.x, hp.y, {
          count: big ? 20 : 12,
          color: spark,
          speed: big ? 240 : 165,
          life: 460,
          size: px(3)
        });
        if (big) {
          fx.ring(hp.x, hp.y, { color: "#F2CD84", to: px(72), life: 380, width: 3 });
          fx.flash("rgba(255,240,210,0.22)", 120);
          fx.shake(px(7), 200);
        } else {
          fx.shake(px(4), 150);
        }
      }
      // 音层由数据决定：普通命中只出材质层，重击叠一层通用低频
      if (app.sound) {
        var layers = materialsApi.layersFor(battleBefore && battleBefore.material, { crit: dealt >= 20 });
        var li;
        for (li = 0; li < layers.length; li += 1) {
          app.sound(layers[li].name, layers[li].volume);
        }
      }
      // 受击帧：重击挤得更狠一点，和飘字/震屏是同一个「大」的判据
      if (app.animator) app.animator.start("enemyHit", dealt >= 20 ? 300 : 230);
    }
    // 打在护盾上：没有血条变化，但要告诉玩家「被挡了」
    if (dealt <= 0 && result.ok && (command === "precise" || command === "power")) {
      if (afterBattle && afterBattle.enemyShield < enemyShieldBefore) {
        if (fx) {
          fx.float(hp.x, hp.y - px(8), "护盾吸收", { color: "#4FC0B0", size: px(16), rise: px(34) });
          fx.burst(hp.x, hp.y, { count: 8, color: "#4FC0B0", speed: 140, life: 340 });
        }
        if (app.sound) app.sound("shield", 0.6);
      }
    }
  }

  // 敌方反击：受伤数字打在玩家身上
  if (state.player.hp < playerHpBefore) {
    var took = playerHpBefore - state.player.hp;
    // 蓄势重击兑现：这回合的反馈必须比普通反击更重，否则前三回合的预警等于白给
    var charged = !!(state.run && state.run.battle && state.run.battle.lastChargedHit);
    if (fx) {
      fx.float(hero.x + px(14), hero.y, "-" + took, {
        color: charged ? "#FF6B55" : "#FF8B7A",
        size: px(charged ? 26 : (took >= 18 ? 22 : 18)),
        rise: px(charged ? 54 : 40)
      });
      if (charged) {
        fx.float(hero.x + px(14), hero.y - px(22), "重击", {
          color: "#F08A6A", size: px(13), rise: px(30)
        });
      }
      fx.burst(hero.x, hero.y + px(6), {
        count: charged ? 16 : 9,
        color: "#D8574A",
        speed: charged ? 210 : 150,
        life: 380,
        size: px(2.6)
      });
      fx.shake(px(charged ? 8 : 3), charged ? 240 : 130);
      if (charged) fx.flash("rgba(240,138,106,0.16)", 150);
    }
    if (app.sound) {
      app.sound("hit", 0.45);
      if (charged) app.sound("crit", 0.6);
    }
    // 敌人扑过来 + 玩家被顶退：两个补间同期跑，才像「它撞了你」而不是「你掉血了」
    // 蓄势重击冲得更远更久，动作本身就说明了「这一下不一样」
    if (app.animator) {
      app.animator.start("enemyLunge", charged ? 420 : 300);
      app.animator.start("heroHurt", charged ? 340 : 240);
    }
  }

  // 防御：给护盾一个可见的形状
  if (command === "defend" && fx) {
    fx.ring(hero.x, hero.y + px(10), { color: "#4FC0B0", to: px(66), life: 420, width: 3 });
    fx.float(hero.x, hero.y - px(8), "护盾 +" + config.defendShield, { color: "#7ED8CB", size: px(16), rise: px(38) });
  }

  // 喝药
  if (command === "potion" && state.player.hp > playerHpBefore) {
    if (fx) {
      var healed = state.player.hp - playerHpBefore;
      fx.float(hero.x + px(10), hero.y - px(8), "+" + healed, { color: "#7FD69A", size: px(20), rise: px(44) });
      fx.ring(hero.x, hero.y + px(10), { color: "#7FD69A", to: px(58), life: 420, width: 2.5 });
      fx.burst(hero.x, hero.y + px(14), { count: 10, color: "#7FD69A", speed: 120, life: 460, gravity: -180, dir: -Math.PI / 2, spread: Math.PI * 0.8 });
    }
  }

  app.vibrate();
  if (result.message) app.toast(result.message);

  if (result.runCleared) {
    if (app.sound) app.sound("win", 1);
    if (fx) {
      fx.flash("rgba(255,245,220,0.55)", 420);
      fx.shake(px(10), 320);
      fx.burst(hp.x, hp.y, { count: 28, color: "#F2CD84", speed: 300, life: 720, size: px(3.4) });
    }
  } else if (state.player.hp <= 0) {
    if (app.sound) app.sound("lose", 0.9);
    if (fx) fx.shake(px(6), 260);
  }

  app.commit();
  return true;
}

module.exports = {
  render: render,
  onAction: onAction
};

});

define("js/game/modals/camp.js", function(module, exports, require) {
/**
 * modals/camp.js —— 营地：休息 / 整备 二选一
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");

var P = draw.PALETTE;

function render(ctx, screen, state) {
  var s = screen.s;
  var panel = common.modalPanel(screen, screen.px(340));
  draw.panel(ctx, panel, {
    radius: Math.round(16 * s),
    fillTop: "#22342B",
    fillBottom: "#111E1A",
    strokeColor: "rgba(95,184,122,0.5)"
  });

  var pad = screen.px(16);
  draw.text(ctx, "营地", panel.x + pad, panel.y + pad, {
    size: screen.fz(10),
    color: P.green,
    bold: true
  });
  draw.text(ctx, "安全的一夜", panel.x + pad, panel.y + pad + screen.px(16), {
    size: screen.fz(19),
    bold: true,
    color: P.ink
  });
  draw.text(ctx, "你可以在这里恢复状态，或者利用整备时间换取一次强化。", panel.x + pad, panel.y + pad + screen.px(46), {
    size: screen.fz(11),
    color: P.inkDim,
    wrap: panel.w - pad * 2,
    lineHeight: screen.px(19)
  });

  var heal = 22 + (state.run ? state.run.effects.campHealBonus : 0);
  var rows = screen.col({
    x: panel.x + pad,
    y: panel.y + panel.h - pad - screen.px(120),
    w: panel.w - pad * 2,
    h: screen.px(120)
  }, 2, screen.px(10));

  ui.button(ctx, {
    id: "camp:rest",
    rect: rows[0],
    label: "休息",
    sub: "+" + heal + " 生命 / +10 精神 / +15 饱食",
    style: "primary",
    size: screen.fz(15)
  });
  ui.button(ctx, {
    id: "camp:prepare",
    rect: rows[1],
    label: "整备",
    sub: "获得一次强化选择",
    style: "teal",
    size: screen.fz(15)
  });
}

function onAction(action, state, app) {
  if (action.id === "camp:rest") {
    var r = stateApi.campRest(state);
    app.toast(r.message);
    app.commit();
    return true;
  }
  if (action.id === "camp:prepare") {
    stateApi.campPrepare(state);
    app.commit();
    return true;
  }
  return false;
}

module.exports = {
  render: render,
  onAction: onAction
};

});

define("js/game/modals/chest.js", function(module, exports, require) {
/**
 * modals/chest.js —— 宝箱：先展示获得的遗物，确认后再进强化
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");
var relicsApi = require("../data/relics");
var relicSetsApi = require("../data/relicSets");

var P = draw.PALETTE;

function rarityLabel(rarity) {
  if (rarity === "epic") return "史诗";
  if (rarity === "rare") return "稀有";
  return "普通";
}

function rarityColor(rarity) {
  if (rarity === "epic") return P.purple;
  if (rarity === "rare") return P.gold;
  return P.teal;
}

function render(ctx, screen, state) {
  var s = screen.s;
  var run = state.run;
  var relic = relicsApi.getById(run && run.pendingRelicId);
  var panel = common.modalPanel(screen, screen.px(360));
  draw.panel(ctx, panel, {
    radius: Math.round(16 * s),
    fillTop: "#1B3540",
    fillBottom: "#0F1D25",
    strokeColor: "rgba(79,192,176,0.5)"
  });

  var pad = screen.px(18);
  draw.text(ctx, "遗物宝箱", panel.x + pad, panel.y + pad, {
    size: screen.fz(10),
    color: P.teal,
    bold: true
  });

  if (!relic) {
    draw.text(ctx, "箱子是空的。", panel.x + panel.w / 2, panel.y + panel.h / 2, {
      size: screen.fz(14),
      align: "center",
      color: P.inkDim
    });
  } else {
    // 遗物图标
    var cx = panel.x + panel.w / 2;
    var cy = panel.y + screen.px(96);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, screen.px(28), 0, Math.PI * 2);
    ctx.fillStyle = "rgba(79,192,176,0.14)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = rarityColor(relic.rarity);
    ctx.stroke();
    ctx.restore();
    draw.text(ctx, relic.name.slice(0, 1), cx, cy - screen.fz(16) * 0.7, {
      size: screen.fz(22),
      bold: true,
      align: "center",
      color: rarityColor(relic.rarity)
    });

    draw.text(ctx, relic.name, cx, cy + screen.px(38), {
      size: screen.fz(18),
      bold: true,
      align: "center",
      color: P.ink
    });
    draw.text(ctx, rarityLabel(relic.rarity) + "遗物", cx, cy + screen.px(62), {
      size: screen.fz(10),
      align: "center",
      color: rarityColor(relic.rarity)
    });
    var descTop = cy + screen.px(84);
    // draw.text 返回的是「这段文字占的高度」，不是下一个 y，别直接当坐标用
    var descHeight = draw.text(ctx, relic.desc, panel.x + pad, descTop, {
      size: screen.fz(12),
      color: P.inkDim,
      wrap: panel.w - pad * 2,
      lineHeight: screen.px(20)
    });

    // 序列进度：拿到第 N 件时正好能凑齐下一档，是这一格最该说的事，
    // 但要在「收下」之前说，否则玩家事后才知道自己刚凑齐了套装。
    var set = relicSetsApi.forRelic(relic.id);
    if (set) {
      var ownedCount = 0;
      var dup = false;
      var k;
      for (k = 0; k < run.relics.length; k += 1) {
        if (set.members.indexOf(run.relics[k].id) >= 0) ownedCount += 1;
        if (run.relics[k].id === relic.id) dup = true;
      }
      var after = dup ? ownedCount : ownedCount + 1;
      var granted = (run.setActive && run.setActive[set.id]) || 0;
      var next = granted < set.tiers.length ? set.tiers[granted] : null;
      var willUnlock = !dup && next && after >= next.need;
      var accent = P[set.accent] || P.teal;
      var setY = descTop + descHeight + screen.px(12);
      draw.text(ctx, set.name + "  " + after + " / " + set.members.length, cx, setY, {
        size: screen.fz(11),
        align: "center",
        bold: true,
        color: accent
      });
      var tip = willUnlock
        ? "本次凑齐 " + next.need + " 件：" + next.desc
        : (dup ? "已拥有，折算为资源" : (next ? "下一档 " + next.need + " 件：" + next.desc : "档位已全部达成"));
      draw.text(ctx, tip, cx, setY + screen.px(18), {
        size: screen.fz(10),
        align: "center",
        color: willUnlock ? P.gold : P.inkFaint,
        wrap: panel.w - pad * 2
      });
    }
  }

  var btn = {
    x: panel.x + pad,
    y: panel.y + panel.h - pad - screen.px(44),
    w: panel.w - pad * 2,
    h: screen.px(44)
  };
  ui.button(ctx, {
    id: "chest:continue",
    rect: btn,
    label: "收下，并选择一次强化",
    style: "primary",
    size: screen.fz(14)
  });
}

function onAction(action, state, app) {
  if (action.id === "chest:continue") {
    if (app.sound) app.sound("coin", 0.8);
    stateApi.confirmChest(state);
    app.commit();
    return true;
  }
  return false;
}

module.exports = {
  render: render,
  onAction: onAction
};

});

define("js/game/modals/codex.js", function(module, exports, require) {
/**
 * modals/codex.js —— 永久图鉴（敌人 / 遗物 / 强化 / 成就）
 *
 * 这是「跨局目标感」的落点：玩家每局结束都能看到图鉴往前推了一点。
 * 分页而不是滚动：Canvas 手写滚动条在低端机上容易抖，分页更稳。
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");
var config = require("../config");
var enemiesApi = require("../data/enemies");
var materialsApi = require("../data/materials");
var relicsApi = require("../data/relics");
var relicSetsApi = require("../data/relicSets");
var enhApi = require("../data/enhancements");
var achievementsApi = require("../data/achievements");

var P = draw.PALETTE;

var TABS = [
  { id: "enemies", label: "敌人" },
  { id: "relics", label: "遗物" },
  { id: "enhancements", label: "强化" },
  { id: "achievements", label: "成就" }
];

/** 每页条数：敌人条目多一行特性说明，所以少放一条 */
var PAGE_SIZE = { enemies: 5, relics: 5, enhancements: 6, achievements: 4 };

function tabIndex(tab) {
  var i;
  for (i = 0; i < TABS.length; i += 1) {
    if (TABS[i].id === tab) return i;
  }
  return 0;
}

function buildRows(state, tab) {
  var codex = state.progress.codex;
  var rows = [];
  var i;

  if (tab === "enemies") {
    for (i = 0; i < enemiesApi.ENEMIES.length; i += 1) {
      var enemy = enemiesApi.ENEMIES[i];
      var entry = codex.enemies[enemy.id];
      rows.push({
        id: enemy.id,
        name: entry && entry.seen ? enemy.name : "？？？",
        unlocked: !!(entry && entry.seen),
        desc: entry && entry.seen
          // 材质写在最前面：它是玩家在战斗里能「听出来」的属性，图鉴里得能对上号
          ? "「" + materialsApi.nameOf(enemy.material) + "」" +
            (entry.defeats > 0 ? "已击败 " + entry.defeats + " 次" : "已遇见，尚未击败") +
            " · " + (enemy.intro || "无额外特性")
          : "尚未遇见",
        color: entry && entry.seen ? enemy.color : P.inkFaint
      });
    }
    return rows;
  }

  if (tab === "relics") {
    for (i = 0; i < relicsApi.RELICS.length; i += 1) {
      var relic = relicsApi.RELICS[i];
      var owned = !!codex.relics[relic.id];
      var set = relicSetsApi.forRelic(relic.id);
      rows.push({
        id: relic.id,
        name: owned ? relic.name : "？？？",
        unlocked: owned,
        desc: owned
          ? (set ? "「" + set.name + "」· " + relic.desc : relic.desc)
          : (set ? "尚未获得 · 属于「" + set.name + "」" : "尚未获得"),
        color: owned ? P.teal : P.inkFaint
      });
    }
    return rows;
  }

  if (tab === "enhancements") {
    for (i = 0; i < enhApi.ENHANCEMENTS.length; i += 1) {
      var enh = enhApi.ENHANCEMENTS[i];
      var got = !!codex.enhancements[enh.id];
      rows.push({
        id: enh.id,
        name: got ? enh.name : "？？？",
        unlocked: got,
        desc: got ? enh.desc : "尚未获得",
        color: got ? P.gold : P.inkFaint
      });
    }
    return rows;
  }

  // 成就
  for (i = 0; i < achievementsApi.ACHIEVEMENTS.length; i += 1) {
    var ach = achievementsApi.ACHIEVEMENTS[i];
    var done = !!state.progress.achievements[ach.id];
    rows.push({
      id: ach.id,
      name: ach.name,
      unlocked: done,
      desc: ach.desc + "（" + ach.reward + " 以太）",
      color: done ? P.green : P.inkFaint
    });
  }
  return rows;
}

function render(ctx, screen, state) {
  var s = screen.s;
  var data = state.current.modalData || {};
  var tab = data.tab || "enemies";
  var page = data.page || 0;

  var summary = stateApi.codexSummary(state);
  var panel = common.modalPanel(screen, screen.px(556));
  draw.panel(ctx, panel, {
    radius: Math.round(16 * s),
    fillTop: "#1C2E3A",
    fillBottom: "#101C25",
    strokeColor: "rgba(224,177,92,0.40)"
  });

  var pad = screen.px(16);
  var y = common.modalTitle(ctx, screen, panel, "图鉴",
    "已解锁 " + summary.unlocked + " / " + summary.total + " · " + summary.percent + "% · 每 25% 领一次以太");

  // 进度条
  var barRect = { x: panel.x + pad, y: y - screen.px(6), w: panel.w - pad * 2, h: screen.px(6) };
  draw.bar(ctx, barRect, summary.percent / 100, { color: P.gold, track: "rgba(255,255,255,0.10)" });
  y = barRect.y + barRect.h + screen.px(12);

  // 分页标签
  var tabs = screen.row({ x: panel.x + pad, y: y, w: panel.w - pad * 2, h: screen.px(34) }, 4, screen.px(6));
  var i;
  for (i = 0; i < TABS.length; i += 1) {
    var active = TABS[i].id === tab;
    ui.button(ctx, {
      id: "codex:tab:" + TABS[i].id,
      rect: tabs[i],
      label: TABS[i].label,
      style: active ? "primary" : "ghost",
      size: screen.fz(12)
    });
  }
  y = tabs[0].y + tabs[0].h + screen.px(10);

  // 列表
  var rows = buildRows(state, tab);
  var size = PAGE_SIZE[tab] || 5;
  var totalPages = Math.max(1, Math.ceil(rows.length / size));
  var current = Math.min(page, totalPages - 1);
  var start = current * size;
  var listTop = y;
  var listBottom = panel.y + panel.h - screen.px(96);
  var rowH = Math.min(screen.px(56), Math.max(screen.px(30), (listBottom - listTop) / size));

  for (i = 0; i < size; i += 1) {
    var row = rows[start + i];
    if (!row) break;
    var ry = listTop + i * rowH;
    draw.text(ctx, row.name, panel.x + pad, ry, {
      size: screen.fz(13),
      bold: true,
      color: row.color,
      maxWidth: panel.w - pad * 2
    });
    draw.text(ctx, row.desc, panel.x + pad, ry + screen.px(17), {
      size: screen.fz(10),
      color: row.unlocked ? P.inkDim : P.inkFaint,
      wrap: panel.w - pad * 2,
      lineHeight: screen.px(14),
      alpha: row.unlocked ? 1 : 0.75
    });
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = P.line;
    ctx.fillRect(panel.x + pad, ry + rowH - screen.px(4), panel.w - pad * 2, 1);
    ctx.restore();
  }

  // 分页
  var pager = screen.row({
    x: panel.x + pad,
    y: panel.y + panel.h - screen.px(84),
    w: panel.w - pad * 2,
    h: screen.px(32)
  }, 3, screen.px(6));

  ui.button(ctx, {
    id: "codex:prev",
    rect: pager[0],
    label: "上一页",
    style: "ghost",
    disabled: current <= 0,
    size: screen.fz(11)
  });
  draw.text(ctx, (current + 1) + " / " + totalPages, pager[1].x + pager[1].w / 2, pager[1].y + pager[1].h / 2 - screen.fz(10) * 0.6, {
    size: screen.fz(11),
    align: "center",
    color: P.inkDim
  });
  ui.button(ctx, {
    id: "codex:next",
    rect: pager[2],
    label: "下一页",
    style: "ghost",
    disabled: current >= totalPages - 1,
    size: screen.fz(11)
  });

  ui.button(ctx, {
    id: "codex:close",
    rect: {
      x: panel.x + pad,
      y: panel.y + panel.h - pad - screen.px(42),
      w: panel.w - pad * 2,
      h: screen.px(42)
    },
    label: "关闭",
    style: "ghost",
    size: screen.fz(14)
  });
}

function onAction(action, state, app) {
  var id = action.id;
  var data = state.current.modalData || {};

  if (id === "codex:close") {
    state.current.modal = null;
    state.current.modalData = null;
    app.commit();
    return true;
  }
  if (id.indexOf("codex:tab:") === 0) {
    state.current.modalData = { tab: id.slice("codex:tab:".length), page: 0 };
    if (app.sound) app.sound("select", 0.6);
    app.commit();
    return true;
  }
  if (id === "codex:prev" || id === "codex:next") {
    var page = data.page || 0;
    state.current.modalData = {
      tab: data.tab || "enemies",
      page: Math.max(0, page + (id === "codex:next" ? 1 : -1))
    };
    if (app.sound) app.sound("tap", 0.5);
    app.commit();
    return true;
  }
  return false;
}

module.exports = {
  render: render,
  onAction: onAction,
  TABS: TABS
};

});

define("js/game/modals/daily.js", function(module, exports, require) {
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

});

define("js/game/modals/enhance.js", function(module, exports, require) {
/**
 * modals/enhance.js —— 3 选 1 强化
 *
 * 候选由 state.openEnhance 生成并写入 run.pendingEnhancements（只存 id + 文案，可序列化）。
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");

var P = draw.PALETTE;

function render(ctx, screen, state) {
  var s = screen.s;
  var run = state.run;
  var pending = (run && run.pendingEnhancements) || [];
  var panel = common.modalPanel(screen, screen.px(370));
  draw.panel(ctx, panel, {
    radius: Math.round(16 * s),
    fillTop: "#1E3746",
    fillBottom: "#101E27",
    strokeColor: "rgba(79,192,176,0.45)"
  });

  var y = common.modalTitle(ctx, screen, panel, "选择强化", "本局生效，结束后清空");
  var pad = screen.px(16);
  var listTop = y + screen.px(8);
  var listH = panel.y + panel.h - pad - listTop;
  var count = Math.max(1, pending.length);
  var cardH = Math.min(screen.px(78), (listH - screen.px(8) * (count - 1)) / count);
  var rows = [];
  var k;
  for (k = 0; k < count; k += 1) {
    rows.push({ x: panel.x + pad, y: listTop + k * (cardH + screen.px(8)), w: panel.w - pad * 2, h: cardH });
  }

  var i;
  for (i = 0; i < pending.length; i += 1) {
    var item = pending[i];
    ui.card(ctx, {
      id: "enhance:pick:" + item.id,
      rect: rows[i],
      title: item.name,
      body: item.desc,
      badge: item.tag || "强化",
      badgeColor: "rgba(79,192,176,0.16)",
      badgeTextColor: P.teal,
      highlight: i === 0,
      titleSize: screen.fz(15),
      bodySize: screen.fz(11)
    });
  }

  if (!pending.length) {
    draw.text(ctx, "没有可选的强化", panel.x + panel.w / 2, panel.y + panel.h / 2, {
      size: screen.fz(13),
      align: "center",
      color: P.inkDim
    });
  }
}

function onAction(action, state, app) {
  if (action.id.indexOf("enhance:pick:") === 0) {
    var id = action.id.slice("enhance:pick:".length);
    var result = stateApi.chooseEnhancement(state, id);
    if (result.ok) {
      if (app.sound) app.sound("select", 0.8);
      app.toast("获得强化：" + result.enhancement.name);
    } else if (app.sound) {
      app.sound("alert", 0.5);
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

});

define("js/game/modals/event.js", function(module, exports, require) {
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

});

define("js/game/modals/info.js", function(module, exports, require) {
/**
 * modals/info.js —— 通用信息弹窗
 *
 * 承载：玩法说明 / 隐私 / 关于 / 服务 / 本局构筑 / 敌人特性
 * view 由 state.current.modalData.view 决定。
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");
var text = require("../data/text");
var relicsApi = require("../data/relics");
var enhApi = require("../data/enhancements");

var P = draw.PALETTE;

function staticView(view) {
  if (view === "privacy") return text.privacy;
  if (view === "about") return text.about;
  if (view === "service") return text.service;
  return text.guide;
}

function renderParagraphs(ctx, screen, panel, title, paragraphs) {
  var pad = screen.px(16);
  var y = common.modalTitle(ctx, screen, panel, title);
  var i;
  for (i = 0; i < paragraphs.length; i += 1) {
    var used = draw.text(ctx, paragraphs[i], panel.x + pad, y, {
      size: screen.fz(12),
      color: P.inkDim,
      wrap: panel.w - pad * 2,
      lineHeight: screen.px(20)
    });
    y += used + screen.px(8);
    if (y > panel.y + panel.h - screen.px(56)) break;
  }
}

function renderCollection(ctx, screen, panel, state) {
  var pad = screen.px(16);
  var run = state.run;
  var y = common.modalTitle(ctx, screen, panel, "本局构筑", "遗物与强化都会在本局结束时清空");
  var i;

  // 序列放在最前面：它是「这一局该往哪凑」的唯一提示，
  // 排在长串遗物后面的话，遗物一多就永远看不到。
  var sets = stateApi.setProgress(run);
  y = ui.section(ctx, "遗物序列", panel.x + pad, y, panel.w - pad * 2);
  for (i = 0; i < sets.length; i += 1) {
    var set = sets[i];
    var color = draw.PALETTE[set.accent] || P.inkDim;
    if (!set.count) color = P.inkFaint;
    var tail;
    if (set.count >= set.total) tail = "已集齐";
    else if (!set.nextNeed) tail = "档位全达成";
    else tail = "再 " + (set.nextNeed - set.count) + " 件进档";
    draw.text(ctx, set.name + " " + set.count + " / " + set.total, panel.x + pad, y, {
      size: screen.fz(11),
      color: color,
      bold: set.count > 0
    });
    draw.text(ctx, tail, panel.x + panel.w - pad, y, {
      size: screen.fz(10),
      align: "right",
      color: P.inkFaint
    });
    y += screen.px(17);
  }
  y += screen.px(6);

  y = ui.section(ctx, "遗物 " + (run.relics.length || 0), panel.x + pad, y, panel.w - pad * 2);
  if (!run.relics.length) {
    draw.text(ctx, "暂无遗物，宝箱与精英战斗会掉落。", panel.x + pad, y, {
      size: screen.fz(11),
      color: P.inkFaint
    });
    y += screen.px(20);
  } else {
    var shown = 0;
    for (i = 0; i < run.relics.length; i += 1) {
      if (y > panel.y + panel.h - screen.px(112)) break;
      draw.text(ctx, "· " + run.relics[i].name, panel.x + pad, y, {
        size: screen.fz(12),
        color: P.teal,
        bold: true
      });
      var used = draw.text(ctx, run.relics[i].desc, panel.x + pad + screen.px(10), y + screen.px(16), {
        size: screen.fz(10),
        color: P.inkDim,
        wrap: panel.w - pad * 2 - screen.px(10),
        lineHeight: screen.px(15)
      });
      y += used + screen.px(20);
      shown += 1;
    }
    // 装不下时给一句「还有 N 件」：直接截断会让人以为遗物丢了。
    // 遗物都放不下时强化更放不下，顺带把强化数量也报出来。
    if (shown < run.relics.length) {
      var rest = "…… 还有 " + (run.relics.length - shown) + " 件遗物未展开";
      if (run.enhancements.length) rest += " · 强化 " + run.enhancements.length + " 项";
      draw.text(ctx, rest, panel.x + pad, y, {
        size: screen.fz(10),
        color: P.inkFaint
      });
      y += screen.px(16);
    }
  }

  // 空间不够时整节不画：只画个「强化 2」标题、下面空空，
  // 比不画更像卡住了
  if (y < panel.y + panel.h - screen.px(96)) {
    y = ui.section(ctx, "强化 " + (run.enhancements.length || 0), panel.x + pad, y + screen.px(4), panel.w - pad * 2);
    if (!run.enhancements.length) {
      draw.text(ctx, "暂无强化，战斗胜利与营地整备会给。", panel.x + pad, y, {
        size: screen.fz(11),
        color: P.inkFaint
      });
    } else {
      for (i = 0; i < run.enhancements.length; i += 1) {
        if (y > panel.y + panel.h - screen.px(76)) break;
        draw.text(ctx, "· " + run.enhancements[i].name, panel.x + pad, y, {
          size: screen.fz(11),
          color: P.ink
        });
        y += screen.px(18);
      }
    }
  } else if (run.enhancements.length && y < panel.y + panel.h - screen.px(76)) {
    // 连标题都放不下时至少留一句，别让玩家以为自己没强化
    draw.text(ctx, "强化 " + run.enhancements.length + " 项（此处放不下，见路线图）", panel.x + pad, y, {
      size: screen.fz(10),
      color: P.inkFaint
    });
  }
}

function renderEnemy(ctx, screen, panel, state) {
  var battle = state.run && state.run.battle;
  var pad = screen.px(16);
  var y = common.modalTitle(ctx, screen, panel, battle ? battle.name : "敌人");
  if (!battle) return;
  var lines = [
    battle.intro || "没有额外特性。",
    "血量 " + Math.round(battle.hp) + " / " + battle.maxHp + "，攻击 " + battle.damageRange[0] + "—" + battle.damageRange[1] + "。",
    battle.boss ? "Boss：每 2 回合加 8 护盾，每 3 回合蓄势重击。" : "",
    battle.elite ? "精英：击败后会有 4 个强化候选。" : ""
  ].filter(function (line) { return !!line; });
  var i;
  for (i = 0; i < lines.length; i += 1) {
    var used = draw.text(ctx, lines[i], panel.x + pad, y, {
      size: screen.fz(12),
      color: P.inkDim,
      wrap: panel.w - pad * 2,
      lineHeight: screen.px(20)
    });
    y += used + screen.px(8);
  }
}

function render(ctx, screen, state) {
  var s = screen.s;
  var data = state.current.modalData || {};
  var view = data.view || "guide";

  // 面板高度按内容自适应：固定高度会让「只有 1 件遗物」的构筑页留下大片空白，
  // 看起来像资源没加载出来。
  var height = 470;
  if (view === "collection") {
    var run = state.run;
    // 210 是「标题 + 两个分节头 + 底部按钮」的固定开销，46/18/17 是各类条目的行高。
    var body = 210 + stateApi.setProgress(run).length * 17 +
      run.relics.length * 46 + run.enhancements.length * 18;
    height = Math.max(260, Math.min(560, body));
  } else if (view === "enemy") {
    height = 250;
  }
  var panel = common.modalPanel(screen, screen.px(height));
  draw.panel(ctx, panel, {
    radius: Math.round(16 * s),
    fillTop: "#1C2E3A",
    fillBottom: "#101C25",
    strokeColor: "rgba(42,74,92,0.95)"
  });

  if (view === "collection") {
    renderCollection(ctx, screen, panel, state);
  } else if (view === "enemy") {
    renderEnemy(ctx, screen, panel, state);
  } else {
    var content = staticView(view);
    renderParagraphs(ctx, screen, panel, content.title, content.body);
  }

  var pad = screen.px(16);
  ui.button(ctx, {
    id: "info:close",
    rect: {
      x: panel.x + pad,
      y: panel.y + panel.h - pad - screen.px(42),
      w: panel.w - pad * 2,
      h: screen.px(42)
    },
    label: "知道了",
    style: "ghost",
    size: screen.fz(14)
  });
}

function onAction(action, state, app) {
  if (action.id === "info:close") {
    state.current.modal = null;
    state.current.modalData = null;
    app.commit();
    return true;
  }
  return false;
}

module.exports = {
  render: render,
  onAction: onAction
};

});

define("js/game/modals/settings.js", function(module, exports, require) {
/**
 * modals/settings.js —— 设置：说明入口 / 音量 / 诊断 / 重置存档（两段确认）
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");

var P = draw.PALETTE;

function render(ctx, screen, state) {
  var s = screen.s;
  var panel = common.modalPanel(screen, screen.px(492));
  draw.panel(ctx, panel, {
    radius: Math.round(16 * s),
    fillTop: "#1B2C38",
    fillBottom: "#0F1B23",
    strokeColor: "rgba(42,74,92,0.95)"
  });

  var pad = screen.px(16);
  var y = common.modalTitle(ctx, screen, panel, "设置", "单机存档 · 本地保存");

  var rows = screen.col({
    x: panel.x + pad,
    y: y + screen.px(4),
    w: panel.w - pad * 2,
    h: screen.px(300)
  }, 7, screen.px(7));

  ui.button(ctx, { id: "settings:guide", rect: rows[0], label: "玩法说明", style: "ghost", size: screen.fz(13) });
  ui.button(ctx, { id: "settings:privacy", rect: rows[1], label: "隐私说明", style: "ghost", size: screen.fz(13) });
  ui.button(ctx, { id: "settings:about", rect: rows[2], label: "关于本作", style: "ghost", size: screen.fz(13) });

  var bgmOn = state.meta.bgmOn !== false;
  var sfxOn = state.meta.sfxOn !== false;
  ui.button(ctx, {
    id: "settings:bgm",
    rect: rows[3],
    label: "音乐：" + (bgmOn ? "开" : "关"),
    style: bgmOn ? "teal" : "ghost",
    size: screen.fz(13)
  });
  ui.button(ctx, {
    id: "settings:sound",
    rect: rows[4],
    label: "音效：" + (sfxOn ? "开" : "关"),
    style: sfxOn ? "teal" : "ghost",
    size: screen.fz(13)
  });
  ui.button(ctx, {
    id: "settings:diag",
    rect: rows[5],
    label: "复制诊断信息",
    style: "ghost",
    size: screen.fz(12)
  });

  var data = state.current.modalData || {};
  var confirmReset = data.confirmReset === true;
  ui.button(ctx, {
    id: "settings:reset",
    rect: rows[6],
    label: confirmReset ? "再点一次确认清空存档" : "重置存档",
    style: confirmReset ? "danger" : "ghost",
    size: screen.fz(13)
  });

  draw.text(ctx, "v4.0 · schema " + state.schemaVersion, panel.x + pad, panel.y + panel.h - pad - screen.px(58), {
    size: screen.fz(10),
    color: P.inkFaint
  });

  ui.button(ctx, {
    id: "settings:close",
    rect: {
      x: panel.x + pad,
      y: panel.y + panel.h - pad - screen.px(42),
      w: panel.w - pad * 2,
      h: screen.px(42)
    },
    label: "关闭",
    style: "primary",
    size: screen.fz(14)
  });
}

function onAction(action, state, app) {
  var id = action.id;

  if (id === "settings:close") {
    state.current.modal = null;
    state.current.modalData = null;
    app.commit();
    return true;
  }
  if (id === "settings:guide" || id === "settings:privacy" || id === "settings:about") {
    app.openInfo(id.slice("settings:".length));
    return true;
  }
  if (id === "settings:bgm") {
    state.meta.bgmOn = state.meta.bgmOn === false;
    if (app.applyAudioSetting) app.applyAudioSetting();
    app.commit();
    return true;
  }
  if (id === "settings:sound") {
    // soundOn 与 sfxOn 同步：老存档只有 soundOn，别让它变成两个互相矛盾的开关
    state.meta.sfxOn = state.meta.sfxOn === false;
    state.meta.soundOn = state.meta.sfxOn;
    if (app.applyAudioSetting) app.applyAudioSetting();
    if (state.meta.sfxOn) app.sound("select", 0.7);
    app.commit();
    return true;
  }
  if (id === "settings:diag") {
    if (app.copyDiagnostics) app.copyDiagnostics();
    return true;
  }
  if (id === "settings:reset") {
    var data = state.current.modalData || {};
    if (data.confirmReset === true) {
      app.resetSave();
      return true;
    }
    state.current.modalData = { confirmReset: true };
    app.toast("再次点击将清空全部进度");
    app.commit();
    return true;
  }
  return false;
}

module.exports = {
  render: render,
  onAction: onAction
};

});

define("js/game/modals/shop.js", function(module, exports, require) {
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

});

define("js/game/modals/summary.js", function(module, exports, require) {
/**
 * modals/summary.js —— 本局结算
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");
var text = require("../data/text");

var P = draw.PALETTE;

function render(ctx, screen, state) {
  var s = screen.s;
  var data = state.current.modalData || {};
  var summary = data.summary || stateApi.computeSummary(state);
  var panel = common.modalPanel(screen, screen.px(430));
  draw.panel(ctx, panel, {
    radius: Math.round(18 * s),
    fillTop: summary.cleared ? "#2A3B2F" : "#33262A",
    fillBottom: "#101A21",
    strokeColor: summary.cleared ? "rgba(224,177,92,0.6)" : "rgba(216,87,74,0.45)"
  });

  var pad = screen.px(18);
  var cx = panel.x + panel.w / 2;

  draw.text(ctx, summary.cleared ? "通关" : "探索终止", cx, panel.y + pad, {
    size: screen.fz(24),
    bold: true,
    align: "center",
    color: summary.cleared ? P.gold : "#E88A7D"
  });
  draw.text(ctx, data.message || "", cx, panel.y + pad + screen.px(34), {
    size: screen.fz(11),
    align: "center",
    color: P.inkDim,
    wrap: panel.w - pad * 2,
    lineHeight: screen.px(18)
  });

  // 统计格子
  var statsTop = panel.y + pad + screen.px(78);
  var statItems = [
    { label: "到达层数", value: "第 " + (summary.layer + 1) + " 层" },
    { label: "经过节点", value: summary.nodes + " 个" },
    { label: "战斗胜利", value: summary.battlesWon + " 场" },
    { label: "造成伤害", value: summary.damageDealt }
  ];
  var gridRows = screen.col({ x: panel.x + pad, y: statsTop, w: panel.w - pad * 2, h: screen.px(96) }, 2, screen.px(8));
  var i;
  for (i = 0; i < statItems.length; i += 1) {
    var col = i % 2;
    var rowIndex = Math.floor(i / 2);
    var cellW = (panel.w - pad * 2 - screen.px(8)) / 2;
    var rect = {
      x: panel.x + pad + col * (cellW + screen.px(8)),
      y: statsTop + rowIndex * (screen.px(44) + screen.px(8)),
      w: cellW,
      h: screen.px(44)
    };
    draw.fillRR(ctx, rect, "rgba(255,255,255,0.05)", Math.round(10 * s));
    draw.text(ctx, statItems[i].label, rect.x + screen.px(10), rect.y + screen.px(7), {
      size: screen.fz(9),
      color: P.inkFaint
    });
    draw.text(ctx, String(statItems[i].value), rect.x + screen.px(10), rect.y + screen.px(21), {
      size: screen.fz(15),
      bold: true,
      color: P.ink
    });
  }

  // 收获
  var gainTop = statsTop + screen.px(112);
  draw.text(ctx, "本局结算", panel.x + pad, gainTop, {
    size: screen.fz(11),
    color: P.gold,
    bold: true
  });
  draw.text(ctx, "以太 +" + summary.reward + "   遗物 " + summary.relics.length + " 件   强化 " + summary.enhancements.length + " 项", panel.x + pad, gainTop + screen.px(18), {
    size: screen.fz(12),
    color: P.inkDim
  });

  if (summary.relics.length) {
    var names = summary.relics.map(function (item) { return item.name; }).join(" / ");
    draw.text(ctx, names, panel.x + pad, gainTop + screen.px(38), {
      size: screen.fz(10),
      color: P.teal,
      wrap: panel.w - pad * 2,
      lineHeight: screen.px(16)
    });
  }

  // 按钮
  var btns = screen.row({
    x: panel.x + pad,
    y: panel.y + panel.h - pad - screen.px(46),
    w: panel.w - pad * 2,
    h: screen.px(46)
  }, 2, screen.px(10));

  ui.button(ctx, {
    id: "summary:share",
    rect: btns[0],
    label: "分享战绩",
    style: "ghost",
    size: screen.fz(14)
  });
  ui.button(ctx, {
    id: "summary:close",
    rect: btns[1],
    label: "返回列车",
    style: "primary",
    size: screen.fz(14)
  });
}

function onAction(action, state, app) {
  if (action.id === "summary:close") {
    stateApi.closeSummary(state);
    app.go("train");
    app.commit();
    return true;
  }
  if (action.id === "summary:share") {
    var data = state.current.modalData || {};
    var summary = data.summary || {};
    app.share({
      title: summary.cleared ? text.share.cleared : text.share.failed.replace("%d", String((summary.layer || 0) + 1)),
      // 配图与文案同源：通关/阵亡各一张，玩家在会话里看到的图和他刚打出来的结果对得上
      imageUrl: summary.cleared ? text.share.imageCleared : text.share.imageFailed
    });
    return true;
  }
  return false;
}

module.exports = {
  render: render,
  onAction: onAction
};

});

define("js/game/modals/themes.js", function(module, exports, require) {
/**
 * modals/themes.js —— 车厢主题选择
 *
 * 出发前决定：选哪节车厢，就接受哪套规则。
 * 规则一旦出发就不能改（中途改会被利用成「快死了切霜封减伤」），
 * 所以这里只在 run 未开始时允许切换；局内打开时只做展示。
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");
var themesApi = require("../data/themes");

var P = draw.PALETTE;

function cardHeight(screen) {
  return screen.px(104);
}

function render(ctx, screen, state) {
  var s = screen.s;
  var runActive = !!(state.run && state.run.active);
  var current = stateApi.selectedThemeId(state);

  var panel = common.modalPanel(screen, screen.px(512));
  draw.panel(ctx, panel, {
    radius: Math.round(16 * s),
    fillTop: "#1F3140",
    fillBottom: "#101C25",
    strokeColor: "rgba(224,177,92,0.40)"
  });

  var pad = screen.px(16);
  var y = common.modalTitle(ctx, screen, panel, "车厢主题",
    runActive ? "本局已锁定，下一局生效" : "选一节车厢，接受它的规矩");

  var list = themesApi.THEMES;
  var cards = screen.col({
    x: panel.x + pad,
    y: y,
    w: panel.w - pad * 2,
    h: cardHeight(screen) * list.length + screen.px(10) * (list.length - 1)
  }, list.length, screen.px(10));

  list.forEach(function (theme, i) {
    var rect = cards[i];
    var unlocked = stateApi.themeUnlocked(state, theme.id);
    var isSelected = theme.id === current;
    var cost = themesApi.unlockCostOf(theme.id);
    var affordable = state.player.ether >= cost;

    draw.panel(ctx, rect, isSelected
      ? {
        radius: Math.round(12 * s),
        fillTop: "rgba(224,177,92,0.18)",
        fillBottom: "rgba(224,177,92,0.05)",
        strokeColor: theme.accent
      }
      : {
        radius: Math.round(12 * s),
        fill: "#14232E",
        strokeColor: "rgba(120,150,170,0.28)"
      });

    // 左侧色条：主题的识别色，和背景光晕同源
    ctx.save();
    ctx.fillStyle = unlocked ? theme.accent : "rgba(120,150,170,0.35)";
    ctx.fillRect(rect.x, rect.y + screen.px(12), screen.px(3), rect.h - screen.px(24));
    ctx.restore();

    var tx = rect.x + screen.px(14);
    var title = theme.name + (unlocked ? "" : " · 未解锁");
    draw.text(ctx, title, tx, rect.y + screen.px(10), {
      size: screen.fz(14),
      bold: true,
      color: isSelected ? theme.accent : unlocked ? P.ink : P.inkDim
    });
    draw.text(ctx, theme.subtitle, rect.x + rect.w - screen.px(12), rect.y + screen.px(12), {
      size: screen.fz(10),
      align: "right",
      color: P.inkFaint
    });
    draw.text(ctx, theme.rules.join(" · "), tx, rect.y + screen.px(32), {
      size: screen.fz(10),
      color: P.inkDim,
      wrap: rect.w - screen.px(30),
      lineHeight: screen.px(15)
    });

    // 右下角状态：已选 / 可切换 / 价格
    var statusText;
    if (isSelected) {
      statusText = "当前";
    } else if (!unlocked) {
      statusText = cost + " 以太解锁";
    } else {
      statusText = "点击切换";
    }
    draw.text(ctx, statusText, rect.x + rect.w - screen.px(12), rect.y + rect.h - screen.px(24), {
      size: screen.fz(10),
      align: "right",
      color: !unlocked && !affordable ? P.red : isSelected ? P.gold : P.inkFaint
    });

    var hitId = !unlocked ? "theme:unlock:" + theme.id : "theme:select:" + theme.id;
    if (runActive && !unlocked) hitId = null;   // 局内不让花以太，避免误触
    if (hitId) {
      ui.pushHit({ id: hitId, rect: rect, meta: { themeId: theme.id }, kind: "theme" });
    }
  });

  var footerY = panel.y + panel.h - pad - screen.px(42);
  var canStart = !runActive;
  ui.button(ctx, {
    id: canStart ? "theme:start" : "theme:close",
    rect: { x: panel.x + pad, y: footerY, w: panel.w - pad * 2, h: screen.px(42) },
    label: canStart ? "登上这节车厢" : "返回路线图",
    style: canStart ? "primary" : "ghost",
    size: screen.fz(15)
  });

  if (!canStart) {
    draw.text(ctx, "改变主意请在下一局出发前切换。", panel.x + panel.w / 2, footerY - screen.px(16), {
      size: screen.fz(10),
      align: "center",
      color: P.inkFaint
    });
  }
}

function onAction(action, state, app) {
  var id = action.id;

  if (id.indexOf("theme:select:") === 0) {
    var pick = id.slice("theme:select:".length);
    var r1 = stateApi.selectTheme(state, pick);
    if (r1.ok) {
      if (app.sound) app.sound("step", 0.6);
      app.commit();
    } else {
      if (app.sound) app.sound("alert", 0.4);
      app.toast(r1.reason === "locked" ? "这节车厢还没接通" : "切换失败");
    }
    return true;
  }

  if (id.indexOf("theme:unlock:") === 0) {
    var want = id.slice("theme:unlock:".length);
    var r2 = stateApi.unlockTheme(state, want);
    if (r2.ok) {
      if (app.sound) app.sound("coin", 0.7);
      app.commit();
      app.toast("已接通「" + themesApi.getById(want).name + "」");
    } else {
      if (app.sound) app.sound("alert", 0.5);
      app.toast(r2.reason === "poor" ? "以太不足" : "无法解锁");
    }
    return true;
  }

  if (id === "theme:start") {
    if (state.run && state.run.active) {
      app.toast("先结束当前探索");
      return true;
    }
    if (app.sound) app.sound("step", 0.85);
    stateApi.startRun(state, app.now());
    app.commit();
    app.go("route");
    return true;
  }

  if (id === "theme:close") {
    app.closeModal();
    return true;
  }

  return false;
}

module.exports = {
  render: render,
  onAction: onAction
};

});

define("js/game/modals/trainUpgrade.js", function(module, exports, require) {
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

});

define("js/game/registry.js", function(module, exports, require) {
/** 场景与弹窗注册表：新增界面只需在这里挂一行 */

module.exports = {
  scenes: {
    home: require("./scenes/home"),
    train: require("./scenes/train"),
    route: require("./scenes/route")
  },
  modals: {
    battle: require("./modals/battle"),
    event: require("./modals/event"),
    eventResult: require("./modals/event"),
    enhance: require("./modals/enhance"),
    shop: require("./modals/shop"),
    camp: require("./modals/camp"),
    chest: require("./modals/chest"),
    summary: require("./modals/summary"),
    info: require("./modals/info"),
    settings: require("./modals/settings"),
    trainUpgrade: require("./modals/trainUpgrade"),
    codex: require("./modals/codex"),
    daily: require("./modals/daily"),
    themes: require("./modals/themes")
  }
};

});

define("js/game/rng.js", function(module, exports, require) {
/**
 * rng.js —— 可复现随机数（mulberry32）
 *
 * 为什么不用 Math.random：
 * 路线图按 seed 生成，存档只存 seed 就能还原同一张地图；
 * 读档后地图不会突然变形，也便于排查「同 seed 不同结果」的 bug。
 */

function createRng(seed) {
  var s = (seed >>> 0) || 1;
  function next() {
    s = (s + 0x6D2B79F5) >>> 0;
    var t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function int(min, max) {
    return Math.floor(next() * (max - min + 1)) + min;
  }

  function pick(list) {
    if (!list || !list.length) return null;
    return list[Math.floor(next() * list.length)];
  }

  function shuffle(list) {
    var arr = list.slice();
    var i;
    for (i = arr.length - 1; i > 0; i -= 1) {
      var j = Math.floor(next() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  return {
    next: next,
    int: int,
    pick: pick,
    shuffle: shuffle,
    /** 按权重表抽取 key，weights = { battle: 5, event: 3 } */
    weighted: function (weights) {
      var keys = [];
      var total = 0;
      var key;
      for (key in weights) {
        if (!Object.prototype.hasOwnProperty.call(weights, key)) continue;
        total += weights[key];
        keys.push({ key: key, w: weights[key] });
      }
      if (!total) return null;
      var roll = next() * total;
      var acc = 0;
      var i;
      for (i = 0; i < keys.length; i += 1) {
        acc += keys[i].w;
        if (roll <= acc) return keys[i].key;
      }
      return keys[keys.length - 1].key;
    }
  };
}

/**
 * 全局默认随机（战斗伤害用，不需要复现）。
 * 注意：这里的种子在**模块加载时**取 Date.now()，早于任何调用方——
 * 所以「想复现一场战斗」必须调 reseed()，改 Date.now 是没用的。
 */
var globalRng = createRng(Date.now() & 0x7FFFFFFF);

/** 重新播种全局随机：用于复现某次战斗，或让自动化测试稳定 */
function reseed(seed) {
  globalRng = createRng(seed);
}

// 转发而不是直接导出实例的方法：reseed 换了实例之后，这些引用必须跟着换
function int(min, max) { return globalRng.int(min, max); }
function pick(list) { return globalRng.pick(list); }
function shuffle(list) { return globalRng.shuffle(list); }
function weighted(weights) { return globalRng.weighted(weights); }

module.exports = {
  createRng: createRng,
  reseed: reseed,
  int: int,
  pick: pick,
  shuffle: shuffle,
  weighted: weighted
};

});

define("js/game/scenes/home.js", function(module, exports, require) {
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

});

define("js/game/scenes/route.js", function(module, exports, require) {
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

});

define("js/game/scenes/train.js", function(module, exports, require) {
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

});

define("js/game/state.js", function(module, exports, require) {
/**
 * state.js —— 全局状态与纯玩法逻辑（无渲染、无存档、无平台依赖，可直接单测）
 *
 * 分层：
 *   局外（player / meta / progress）  ← 列车主城、每日签到、列车升级
 *   局内（run）                       ← 路线、战斗、事件、强化、遗物、结算
 *
 * 约定：
 * - 所有函数第一个参数是 state，就地修改并返回结果对象。
 * - 函数只改数据，不落盘、不弹窗、不 toast；由 main.js 统一 commit。
 * - 随机：地图用 seed 复现（rng.createRng），战斗用全局 rng。
 */

var config = require("./config");
var mapApi = require("./map");
var rng = require("./rng");
var enemiesApi = require("./data/enemies");
var relicsApi = require("./data/relics");
var relicSetsApi = require("./data/relicSets");
var enhApi = require("./data/enhancements");
var eventsApi = require("./data/events");
var itemsApi = require("./data/items");
var effectsApi = require("./data/effects");
var affixesApi = require("./data/affixes");
var achievementsApi = require("./data/achievements");
var dailyApi = require("./data/daily");
var themesApi = require("./data/themes");

/* ---------------- 基础工具 ---------------- */

function clamp(value, min, max) {
  var n = Number(value);
  if (!isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function pad2(value) {
  var n = Math.floor(Math.abs(Number(value) || 0));
  return n < 10 ? "0" + n : String(n);
}

function formatDateKey(time) {
  var d = new Date(time);
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

/** 解析 YYYY-MM-DD：不能用 new Date(key)，ES 规范按 UTC 解析会退一天 */
function parseDateKey(key) {
  if (typeof key !== "string") return null;
  var parts = key.split("-");
  if (parts.length !== 3) return null;
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  var d = parseInt(parts[2], 10);
  if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return null;
  return new Date(y, m - 1, d);
}

function dayDiff(fromKey, toKey) {
  var from = parseDateKey(fromKey);
  var to = parseDateKey(toKey);
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function makeLog(title, text) {
  return {
    title: String(title).slice(0, 12),
    text: String(text).slice(0, 120),
    id: String(Date.now()) + "-" + Math.random().toString(16).slice(2, 6)
  };
}

function pushLog(state, title, text) {
  state.logs.unshift(makeLog(title, text));
  if (state.logs.length > 20) state.logs = state.logs.slice(0, 20);
}

/* ---------------- 初始状态 ---------------- */

function createRun(seed) {
  return {
    seed: seed,
    active: false,
    completed: false,
    failed: false,
    layers: [],
    currentNodeId: null,
    layer: -1,
    route: [],
    nodesVisited: 0,
    battle: null,
    eventId: null,
    eventChoiceIndex: -1,
    eventResult: null,
    eventFollowUp: null,
    pendingEnhancements: null,
    pendingRelicId: null,
    effects: effectsApi.emptyEffects(),
    relics: [],
    /** 各序列已发放的档位数量：{ setId: 2 } 表示前两档已生效，避免重复叠加 */
    setActive: {},
    enhancements: [],
    recentEvents: [],
    /** 事件链进度：{ chainId: 已完成段数 } */
    chains: {},
    /** 当前正在展示的链事件（仅用于界面标注） */
    eventChain: null,
    /** 每日挑战信息：普通局为 null */
    daily: null,
    /** 本局车厢主题 id（route 场景可切换，只影响本局） */
    theme: "rust",
    stats: {
      battlesWon: 0,
      damageDealt: 0,
      etherGained: 0,
      turns: 0,
      shopsVisited: 0
    }
  };
}

/* ---------------- 修正符（每日条件 + 车厢主题） ---------------- */

/**
 * 把「每日限制」与「车厢主题」合并成一套修正符。
 *
 * 两边的字段形状刻意做成一致（daily.combine 的输出），所以合并只写一次，
 * 消费点也只需要读 run 的合并结果，不用各自判断来源。
 * 加法字段（delta）相加，乘法字段（mul）相乘。
 */
function modsOf(run) {
  var out = {
    maxHpDelta: 0,
    hungerPerNodeDelta: 0,
    enemyDamageMul: 1,
    sanityCostMul: 1,
    enhanceChoiceDelta: 0,
    shopPriceMul: 1,
    enemyHpMul: 1,
    goldMul: 1,
    startEtherBonus: 0
  };

  function merge(m) {
    if (!m) return;
    out.maxHpDelta += m.maxHpDelta || 0;
    out.hungerPerNodeDelta += m.hungerPerNodeDelta || 0;
    out.enemyDamageMul *= m.enemyDamageMul || 1;
    out.sanityCostMul *= m.sanityCostMul || 1;
    out.enhanceChoiceDelta += m.enhanceChoiceDelta || 0;
    out.shopPriceMul *= m.shopPriceMul || 1;
    out.enemyHpMul *= m.enemyHpMul || 1;
    out.goldMul *= m.goldMul || 1;
    out.startEtherBonus += m.startEtherBonus || 0;
  }

  if (run && run.daily) merge(run.daily.combined);
  var theme = run && run.theme ? themesApi.getById(run.theme) : null;
  if (theme) merge(theme.mods);
  return out;
}

/**
 * 主题亲和权重：喜欢的 ×3，明确属于别的主题的 ×0.4，
 * 没打标签的 ×1（通用）。用权重而不是硬过滤——硬过滤会让池子在
 * 低层数下变空，最后还是会 fallback，等于白写。
 */
function themeWeight(list, themeId) {
  if (!list || !list.length || !themeId) return 1;
  return list.indexOf(themeId) >= 0 ? 3 : 0.4;
}

/** 按权重展开成桶再随机取一个，保持与 rng.pick 一致的确定性 */
function weightedPick(list, themeId) {
  var basket = [];
  var i;
  var j;
  for (i = 0; i < list.length; i += 1) {
    var n = Math.round(themeWeight(list[i].themes, themeId) * 4);
    for (j = 0; j < n; j += 1) basket.push(list[i]);
  }
  if (!basket.length) basket = list;
  return rng.pick(basket);
}

/* ---------------- 主题解锁与选择 ---------------- */

function themeUnlocked(state, id) {
  var list = state.progress.themeUnlocked || [];
  return list.indexOf(id) >= 0;
}

function selectedThemeId(state) {
  var id = state.progress.themeSelected;
  if (id && themesApi.getById(id) && themeUnlocked(state, id)) return id;
  return "rust";
}

function themeSummary(state) {
  var unlocked = state.progress.themeUnlocked || [];
  return {
    selected: selectedThemeId(state),
    total: themesApi.THEMES.length,
    unlocked: unlocked.length
  };
}

function selectTheme(state, id) {
  if (!themesApi.getById(id)) return { ok: false, reason: "unknown" };
  if (!themeUnlocked(state, id)) return { ok: false, reason: "locked" };
  // 局内不允许改：换主题会立刻改敌人伤害倍率，
  // 「快死了切霜封」这类操作会把难度设计作废。本局锁定，下一局生效。
  if (state.run && state.run.active) return { ok: false, reason: "inRun" };
  state.progress.themeSelected = id;
  return { ok: true, id: id };
}

function unlockTheme(state, id) {
  var theme = themesApi.getById(id);
  if (!theme) return { ok: false, reason: "unknown" };
  if (themeUnlocked(state, id)) return { ok: false, reason: "owned" };
  if (state.run && state.run.active) return { ok: false, reason: "inRun" };
  if (state.player.ether < theme.unlockCost) return { ok: false, reason: "poor" };
  state.player.ether -= theme.unlockCost;
  state.progress.themeUnlocked.push(id);
  state.progress.themeSelected = id;
  pushLog(state, "解锁", "「" + theme.name + "」已接通，路线图上可以切换了。");
  return { ok: true, id: id, cost: theme.unlockCost };
}

function createDefaultState(now) {
  var time = now || Date.now();
  return {
    schemaVersion: config.schemaVersion,
    player: {
      hp: config.maxHp,
      maxHp: config.maxHp,
      hunger: config.maxHunger,
      sanity: config.maxSanity,
      ether: config.starterEther,
      gold: config.starterGold,
      baseAttack: config.baseAttack,
      inventory: {
        portableFood: 1,
        potion: 2,
        retryCard: 0,
        executeCard: 0
      }
    },
    meta: {
      createdAt: time,
      lastLoginDate: formatDateKey(time),
      loginStreak: 1,
      lastFreeFoodDate: null,
      lastSanityRestoreAt: 0,
      adViewDate: formatDateKey(time),
      adViewsToday: 0,
      tutorialSeen: false,
      totalPlayMs: 0,
      // soundOn 保留：老存档只有这一个开关，读档时映射到 sfxOn
      soundOn: true,
      bgmOn: true,
      sfxOn: true,
      vibrationOn: true
    },
    progress: {
      runsStarted: 0,
      runsCleared: 0,
      bossClears: 0,
      bestLayer: 0,
      totalEther: 0,
      trainUpgrades: { diner: 0, medbay: 0, engine: 0, cargo: 0, observatory: 0 },
      /** 永久图鉴：只存「见过/击败次数」，不存数据表副本 */
      codex: {
        enemies: {},
        relics: {},
        enhancements: {},
        tier: 0
      },
      /** 成就：id → 解锁时间戳 */
      achievements: {},
      /** 跨局累计统计，成就指标从这里来 */
      stats: {
        battlesWon: 0,
        maxRelics: 0,
        maxEnhancements: 0,
        perfectBossWins: 0,
        lowSanityClears: 0,
        noRelicClears: 0
      },
      /** 每日挑战记录 */
      daily: {
        lastDate: null,
        streak: 0,
        clears: 0,
        attempts: 0,
        bestLayer: -1
      },
      /** 已解锁的车厢主题（rust 默认解锁） */
      themeUnlocked: ["rust"],
      themeSelected: "rust"
    },
    current: {
      scene: "home",
      modal: null,
      modalData: null
    },
    run: createRun(1),
    logs: [makeLog("系统", "列车完成检修，新的路线可以出发了。")]
  };
}

/* ---------------- 货币与道具 ---------------- */

function grantCurrency(state, delta) {
  var d = delta || {};
  var before = state.player.ether;
  state.player.ether = clamp(state.player.ether + (d.ether || 0), 0, config.maxEther);
  state.player.gold = clamp(state.player.gold + (d.gold || 0), 0, config.maxGold);
  var gained = state.player.ether - before;
  if (gained > 0) {
    state.progress.totalEther += gained;
    if (state.run && state.run.active) state.run.stats.etherGained += gained;
  }
  return gained;
}

function spendCurrency(state, type, amount) {
  var key = type === "gold" ? "gold" : "ether";
  if (state.player[key] < amount) return false;
  state.player[key] -= amount;
  return true;
}

function grantItems(state, items) {
  if (!items) return;
  var key;
  for (key in items) {
    if (!Object.prototype.hasOwnProperty.call(items, key)) continue;
    if (state.player.inventory[key] === undefined) state.player.inventory[key] = 0;
    state.player.inventory[key] = clamp(state.player.inventory[key] + items[key], 0, 99);
  }
}

/* ---------------- 局外：每日 / 补给 / 升级 ---------------- */

function handleDailyLogin(state, now) {
  var today = formatDateKey(now);
  var changed = false;

  if (state.meta.adViewDate !== today) {
    state.meta.adViewDate = today;
    state.meta.adViewsToday = 0;
  }

  if (state.meta.lastLoginDate !== today) {
    var diff = dayDiff(state.meta.lastLoginDate, today);
    state.meta.loginStreak = diff === 1 ? state.meta.loginStreak + 1 : 1;
    state.meta.lastLoginDate = today;
    pushLog(state, "签到", "连续登录 " + state.meta.loginStreak + " 天。");
    changed = true;

    if (state.meta.loginStreak === 3) {
      grantItems(state, { retryCard: 1 });
      pushLog(state, "签到奖励", "连登 3 天，获得 1 张重战卡。");
    }
    if (state.meta.loginStreak === 7) {
      grantItems(state, { executeCard: 1 });
      pushLog(state, "签到奖励", "连登 7 天，获得 1 张秒杀卡。");
    }
  }
  return changed;
}

function restoreSanity(state, now) {
  var left = config.sanityRestoreCooldownMs - (now - state.meta.lastSanityRestoreAt);
  if (left > 0) {
    return { ok: false, message: "恢复装置冷却中，还需 " + Math.ceil(left / 1000) + " 秒。" };
  }
  state.player.sanity = config.maxSanity;
  state.meta.lastSanityRestoreAt = now;
  pushLog(state, "恢复装置", "精神值已恢复至满值。");
  return { ok: true, message: "精神值已恢复至满值。" };
}

function sanityCooldownLeft(state, now) {
  return Math.max(0, config.sanityRestoreCooldownMs - (now - state.meta.lastSanityRestoreAt));
}

function claimFreeFood(state, now) {
  var today = formatDateKey(now);
  if (state.meta.lastFreeFoodDate === today) {
    return { ok: false, message: "今天的补给已经领过了。" };
  }
  var heal = config.dailyFoodRestore + state.progress.trainUpgrades.diner * config.dailyFoodByDiner;
  state.meta.lastFreeFoodDate = today;
  state.player.hunger = clamp(state.player.hunger + heal, 0, config.maxHunger);
  pushLog(state, "补给站", "领取今日补给，恢复 " + heal + " 饱食度。");
  return { ok: true, message: "恢复 " + heal + " 点饱食度。" };
}

function usePortableFood(state) {
  if (state.player.inventory.portableFood <= 0) {
    return { ok: false, message: "没有便携食物。" };
  }
  state.player.inventory.portableFood -= 1;
  state.player.hunger = clamp(state.player.hunger + config.portableFoodRestore, 0, config.maxHunger);
  pushLog(state, "补给", "你食用了便携食物。");
  return { ok: true, message: "饱食度 +" + config.portableFoodRestore };
}

function upgradeCost(state, partId) {
  var def = config.trainUpgrades[partId];
  if (!def) return null;
  var level = state.progress.trainUpgrades[partId] || 0;
  if (level >= def.maxLevel) return null;
  return {
    ether: def.baseEther + level * Math.round(def.baseEther * 0.6),
    gold: def.baseGold + Math.floor(level / 2)
  };
}

function upgradeTrain(state, partId) {
  var def = config.trainUpgrades[partId];
  var cost = upgradeCost(state, partId);
  if (!def) return { ok: false, message: "未知模块。" };
  if (!cost) return { ok: false, message: def.name + " 已满级。" };
  if (state.player.ether < cost.ether || state.player.gold < cost.gold) {
    return { ok: false, message: "资源不足。" };
  }
  state.player.ether -= cost.ether;
  state.player.gold -= cost.gold;
  state.progress.trainUpgrades[partId] += 1;
  pushLog(state, "列车升级", def.name + " 升至 Lv." + state.progress.trainUpgrades[partId] + "。");
  return { ok: true, message: def.name + " 升级成功。" };
}

/* ---------------- 图鉴（永久解锁） ---------------- */

function codexTotals() {
  return {
    enemies: enemiesApi.ENEMIES.length,
    relics: relicsApi.RELICS.length,
    enhancements: enhApi.ENHANCEMENTS.length
  };
}

/** 进入战斗 / 打开图鉴时记录「见过」 */
function markEnemySeen(state, enemyId) {
  if (!enemyId) return;
  var codex = state.progress.codex;
  if (!codex.enemies[enemyId]) codex.enemies[enemyId] = { seen: 1, defeats: 0 };
}

function markEnemyDefeated(state, enemyId) {
  if (!enemyId) return;
  var codex = state.progress.codex;
  if (!codex.enemies[enemyId]) codex.enemies[enemyId] = { seen: 1, defeats: 0 };
  codex.enemies[enemyId].defeats = clamp(codex.enemies[enemyId].defeats + 1, 0, 99999);
}

function markRelicObtained(state, relicId) {
  if (relicId) state.progress.codex.relics[relicId] = 1;
}

function markEnhancementObtained(state, enhId) {
  if (enhId) state.progress.codex.enhancements[enhId] = 1;
}

function codexSummary(state) {
  var codex = state.progress.codex;
  var totals = codexTotals();
  var enemiesSeen = 0;
  var id;
  for (id in codex.enemies) {
    if (Object.prototype.hasOwnProperty.call(codex.enemies, id) && codex.enemies[id].seen) enemiesSeen += 1;
  }
  var relicCount = 0;
  for (id in codex.relics) {
    if (Object.prototype.hasOwnProperty.call(codex.relics, id) && codex.relics[id]) relicCount += 1;
  }
  var enhCount = 0;
  for (id in codex.enhancements) {
    if (Object.prototype.hasOwnProperty.call(codex.enhancements, id) && codex.enhancements[id]) enhCount += 1;
  }
  var total = totals.enemies + totals.relics + totals.enhancements;
  var unlocked = enemiesSeen + relicCount + enhCount;
  return {
    enemiesSeen: enemiesSeen,
    enemiesTotal: totals.enemies,
    relics: relicCount,
    relicsTotal: totals.relics,
    enhancements: enhCount,
    enhancementsTotal: totals.enhancements,
    unlocked: unlocked,
    total: total,
    percent: total > 0 ? Math.round((unlocked / total) * 100) : 0
  };
}

/**
 * 图鉴进度奖励：每跨过一个档位（25/50/75/100%）发一次以太。
 * 这是把「收集」变成「变强」的桥——没有奖励的图鉴只会被当成说明书。
 */
function checkCodexReward(state) {
  var summary = codexSummary(state);
  var codex = state.progress.codex;
  var tiers = config.codex.tiers;
  var granted = 0;
  while (codex.tier < tiers.length && summary.percent >= tiers[codex.tier]) {
    codex.tier += 1;
    grantCurrency(state, { ether: config.codex.rewardPerTier });
    pushLog(state, "图鉴", "图鉴进度达到 " + tiers[codex.tier - 1] + "%，获得 " + config.codex.rewardPerTier + " 以太。");
    granted += config.codex.rewardPerTier;
  }
  return granted;
}

/* ---------------- 成就 ---------------- */

function computeMetrics(state) {
  var p = state.progress;
  return {
    bossClears: p.bossClears,
    bestLayer: p.bestLayer,
    maxRelics: p.stats.maxRelics,
    maxEnhancements: p.stats.maxEnhancements,
    perfectBossWins: p.stats.perfectBossWins,
    lowSanityClears: p.stats.lowSanityClears,
    noRelicClears: p.stats.noRelicClears,
    codexPercent: codexSummary(state).percent,
    dailyClears: p.daily.clears
  };
}

/**
 * 成就检查：声明式指标比对，解锁即发以太。
 * 返回本次新解锁的成就列表（供界面提示）。
 */
function evaluateAchievements(state) {
  var metrics = computeMetrics(state);
  var unlocked = [];
  var list = achievementsApi.ACHIEVEMENTS;
  var i;
  for (i = 0; i < list.length; i += 1) {
    var item = list[i];
    if (state.progress.achievements[item.id]) continue;
    if (metrics[item.metric] >= item.target) {
      state.progress.achievements[item.id] = Date.now();
      grantCurrency(state, { ether: item.reward });
      pushLog(state, "成就", "解锁「" + item.name + "」，获得 " + item.reward + " 以太。");
      unlocked.push(item);
    }
  }
  return unlocked;
}

/** 已解锁数量，用于主城入口角标 */
function achievementCount(state) {
  var count = 0;
  var id;
  for (id in state.progress.achievements) {
    if (Object.prototype.hasOwnProperty.call(state.progress.achievements, id)) count += 1;
  }
  return count;
}

/* ---------------- 每日挑战 ---------------- */

function dailyUnlocked(state) {
  return (state.progress.trainUpgrades.observatory || 0) >= config.daily.unlockLevel;
}

function dailyInfo(state, now) {
  var dateKey = formatDateKey(now || Date.now());
  var seed = dailyApi.seedFromDate(dateKey);
  var modifiers = dailyApi.rollModifiers(seed);
  var record = state.progress.daily;
  return {
    unlocked: dailyUnlocked(state),
    dateKey: dateKey,
    seed: seed,
    modifiers: modifiers,
    combined: dailyApi.combine(modifiers),
    playedToday: record.lastDate === dateKey,
    streak: record.streak,
    clears: record.clears,
    attempts: record.attempts,
    bestLayer: record.bestLayer
  };
}

/* ---------------- 局内：出发与路线 ---------------- */


/** 只补到「至少这么多」，不会累加：否则开局 - 放弃 - 再开局就能无限刷道具 */
function topUpItems(state, grants) {
  if (!grants) return;
  var key;
  for (key in grants) {
    if (!Object.prototype.hasOwnProperty.call(grants, key)) continue;
    var target = grants[key];
    if ((state.player.inventory[key] || 0) < target) {
      state.player.inventory[key] = target;
    }
  }
}

function snapshotWallet(state) {
  return {
    ether: state.player.ether,
    gold: state.player.gold,
    inventory: JSON.parse(JSON.stringify(state.player.inventory))
  };
}

function restoreWallet(state, wallet) {
  if (!wallet) return;
  state.player.ether = clamp(wallet.ether, 0, config.maxEther);
  state.player.gold = clamp(wallet.gold, 0, config.maxGold);
  var key;
  for (key in wallet.inventory) {
    if (Object.prototype.hasOwnProperty.call(wallet.inventory, key)) {
      state.player.inventory[key] = clamp(wallet.inventory[key], 0, 99);
    }
  }
}

/**
 * 开始一局。
 * mode = "daily" 时按日期种子生成路线与限制条件，并在结束时还原钱包
 * （否则「身无分文」这种条件会真的清空玩家攒下的以太）。
 */
function startRun(state, now, mode) {
  var time = now || Date.now();
  var isDaily = mode === "daily";
  var daily = null;

  if (isDaily) {
    if (!dailyUnlocked(state)) {
      return null;
    }
    var info = dailyInfo(state, time);
    daily = {
      dateKey: info.dateKey,
      seed: info.seed,
      modifierIds: info.modifiers.map(function (m) { return m.id; }),
      modifierNames: info.modifiers.map(function (m) { return m.name; }),
      combined: info.combined,
      wallet: snapshotWallet(state)
    };
    var record = state.progress.daily;
    if (record.lastDate !== info.dateKey) {
      var diff = record.lastDate ? dayDiff(record.lastDate, info.dateKey) : 0;
      record.streak = diff === 1 ? record.streak + 1 : 1;
      record.lastDate = info.dateKey;
    }
    record.attempts += 1;
  }

  state.progress.runsStarted += 1;
  var seed = isDaily
    ? daily.seed
    : ((time ^ (state.progress.runsStarted * 2654435761)) >>> 0);

  var run = createRun(seed);
  run.active = true;
  run.daily = daily;
  // 每日挑战固定走锈蚀车厢：它承诺「同一天全服同一套条件」，
  // 主题会改敌人伤害/血量倍率，让不同玩家比不同难度就失去意义了。
  run.theme = isDaily ? "rust" : selectedThemeId(state);
  run.layers = mapApi.generate(seed);
  state.run = run;
  state.current.scene = "route";
  state.current.modal = null;
  state.current.modalData = null;

  var mods = modsOf(run);
  var themeDef = themesApi.getById(run.theme);

  // 生命上限每局重算：局内强化加的 maxHpBonus 不该带到下一局
  state.player.maxHp = clamp(config.maxHp + mods.maxHpDelta, 40, 500);
  state.player.hp = state.player.maxHp;

  // 出发整备：精神保底 40 再扣本局成本
  // 保底的意义：单机产品不能让玩家卡在「精神太低无法出发」的死锁里
  var sanityCost = Math.round(config.sanityPerRun * mods.sanityCostMul);
  state.player.sanity = clamp(Math.max(state.player.sanity, 40) - sanityCost, 0, config.maxSanity);
  if (state.player.hunger < 50) state.player.hunger = 50;

  // 货舱：保证开局至少有这些道具（top-up 语义，不叠加）
  var cargoLevel = clamp(state.progress.trainUpgrades.cargo || 0, 0, 5);
  topUpItems(state, config.cargoGrants[cargoLevel] || {});

  if (daily && typeof daily.combined.startEther === "number") {
    state.player.ether = daily.combined.startEther;
  }
  if (mods.startEtherBonus > 0) {
    grantCurrency(state, { ether: mods.startEtherBonus });
  }

  if (isDaily) {
    pushLog(state, "每日挑战", dailyLogText(daily));
  } else {
    pushLog(state, "出发", "列车穿过裂隙，" +
      (themeDef && themeDef.id !== "rust" ? "驶入「" + themeDef.name + "」。" : "新的路线图已经展开。"));
  }
  if (themeDef && themeDef.id !== "rust") {
    pushLog(state, "车厢主题", themeDef.rules.join(" · "));
  }
  return state.run;
}

/** 每日挑战的日志文案（单独抽出来，避免开局逻辑里拼字符串） */
function dailyLogText(daily) {
  return "限制条件：" + daily.modifierNames.join(" / ");
}

function startDaily(state, now) {
  var run = startRun(state, now, "daily");
  if (!run) {
    return { ok: false, message: "观景台 Lv." + config.daily.unlockLevel + " 后才能进入每日挑战。" };
  }
  return { ok: true, run: run };
}

function getAvailableNodes(state) {
  if (!state.run || !state.run.active) return [];
  if (state.run.battle || state.run.pendingEnhancements || state.current.modal) return [];
  return mapApi.available(state.run.layers, state.run.currentNodeId);
}

function travelTo(state, nodeId) {
  var run = state.run;
  if (!run || !run.active) return { ok: false };
  if (state.current.modal) return { ok: false };

  var allowed = mapApi.available(run.layers, run.currentNodeId);
  var target = null;
  var i;
  for (i = 0; i < allowed.length; i += 1) {
    if (allowed[i].id === nodeId) target = allowed[i];
  }
  if (!target) return { ok: false };

  // 移动成本
  run.nodesVisited += 1;
  var hungerCost = Math.max(1, config.hungerPerNode + run.effects.hungerCostDelta + modsOf(run).hungerPerNodeDelta);
  state.player.hunger = clamp(state.player.hunger - hungerCost, 0, config.maxHunger);

  if (run.effects.foodRecoveryEveryTwo > 0 && run.nodesVisited % 2 === 0) {
    state.player.hunger = clamp(state.player.hunger + run.effects.foodRecoveryEveryTwo, 0, config.maxHunger);
    pushLog(state, "遗物", "餐车配给箱补充了饱食度。");
  }
  if (run.effects.restoreSanityEveryThree > 0 && run.nodesVisited % 3 === 0) {
    state.player.sanity = clamp(state.player.sanity + run.effects.restoreSanityEveryThree, 0, config.maxSanity);
    pushLog(state, "强化", "心智稳定恢复了精神值。");
  }

  target.visited = true;
  run.currentNodeId = target.id;
  run.layer = target.layer;
  run.route.push(target.type);
  if (target.layer > state.progress.bestLayer) state.progress.bestLayer = target.layer;

  enterNode(state, target);

  // 精神跌破安全线：强制结束（但战斗/事件弹窗优先处理完）
  if (state.player.sanity < config.sanityDangerLine && !state.current.modal) {
    endRun(state, false, "精神值跌破安全线，本次探索被迫终止。");
    return { ok: true, forcedEnd: true };
  }
  return { ok: true, node: target };
}

function enterNode(state, node) {
  if (node.type === "battle") return startBattle(state, "normal");
  if (node.type === "elite") return startBattle(state, "elite");
  if (node.type === "boss") return startBattle(state, "boss");
  if (node.type === "event") return openEvent(state);
  if (node.type === "camp") {
    state.current.modal = "camp";
    return null;
  }
  if (node.type === "shop") {
    state.current.modal = "shop";
    state.run.stats.shopsVisited += 1;
    return null;
  }
  if (node.type === "chest") return openChest(state);
  return null;
}

/* ---------------- 战斗 ---------------- */

function pickEnemy(kind, layer, themeId) {
  if (kind === "boss") {
    // Boss 也从池里随机：三场通关不重样，是重复游玩的最低成本手段
    var bosses = enemiesApi.byKind("boss");
    return weightedPick(bosses.length ? bosses : [enemiesApi.getById("riftWarden")], themeId);
  }
  var pool = enemiesApi.poolFor(kind === "elite" ? "elite" : "normal", layer);
  if (!pool.length) pool = enemiesApi.byKind(kind === "elite" ? "elite" : "normal");
  return weightedPick(pool, themeId);
}

function startBattle(state, kind) {
  var run = state.run;
  var layer = run.layer >= 0 ? run.layer : 0;
  var template = pickEnemy(kind, layer, run.theme);
  var mods = modsOf(run);
  var hpRange = template.kind === "normal" ? template.hpRange : template.hp;
  var hp = rng.int(hpRange[0], hpRange[1]);

  // 精英 = 基础敌人 + 1 个词缀；Boss 本身已有一套独立行为，不再叠词缀
  var affix = kind === "elite" ? affixesApi.rollFor(rng.pick) : null;
  if (affix) hp = Math.max(1, Math.round(hp * config.eliteHpMul));
  // 车厢主题可以整体调血量（霜封更硬、焚炉更狠）
  if (mods.enemyHpMul !== 1) hp = Math.max(1, Math.round(hp * mods.enemyHpMul));

  var sanityCost = Math.round(config.sanityPerBattle * mods.sanityCostMul);
  state.player.sanity = clamp(state.player.sanity - sanityCost, 0, config.maxSanity);
  markEnemySeen(state, template.id);

  run.battle = {
    kind: kind,
    enemyId: template.id,
    name: template.name,
    // 材质只是表现层（打击音色 + 粒子色），存进战斗对象是为了读档后音画不丢
    material: template.material,
    figure: template.figure,
    color: template.color,
    trait: template.trait,
    affix: affix ? affix.id : null,
    affixName: affix ? affix.name : null,
    affixDesc: affix ? affix.desc : null,
    poison: 0,
    revived: false,
    egg: 0,
    webbed: false,
    enraged: false,
    strikeUsed: false,
    lastCrit: false,
    intro: template.intro,
    /**
     * Boss 登场卡。
     *
     * 只有 Boss 才停这一下：普通战斗每局要打十几次，每次都插一屏就是纯摩擦；
     * Boss 一局只有一次，停下来的成本可以忽略，换来的是「这一场不一样」的仪式感。
     * 卡片上还会带一句 phase2.hint——不提任何机制，只是把第二形态的种子提前埋下，
     * 让半血崩开那一刻变成「原来刚才那句话是这个意思」。
     */
    introOpen: template.kind === "boss",
    introHint: template.phase2 && template.phase2.hint ? template.phase2.hint : null,
    hp: hp,
    maxHp: hp,
    damageRange: template.damageRange.slice(),
    reward: { ether: template.reward.ether, gold: template.reward.gold },
    boss: template.kind === "boss",
    elite: template.kind === "elite",
    // 1 = 完整形态，2 = 半血后的第二形态。只有 Boss 会变，其余永远是 1。
    phase: 1,
    // 第二形态的形态名与段数：由 checkBossPhase 按模板的 phase2 写入，
    // UI 与伤害结算都只读这两个字段，不自己去查敌人表
    phaseLabel: null,
    phaseHits: 1,
    // 上一步 / 上上一步动作：第二形态「查票」的判定依据
    lastAction: null,
    prevAction: null,
    phaseBreak: false,
    enemyShield: 0,
    playerShield: run.effects.firstTurnShield,
    turn: 1,
    defenseStance: false,
    enemyCharge: 0,
    // 下回合预告：由敌方回合末尾写入，玩家回合渲染时读。
    // 这是「敌人打算干什么」的唯一真相，UI 不许自己猜。
    telegraph: null,
    lastChargedHit: false,
    over: false,
    result: null,
    logs: [template.intro || "敌人阻断了前路，战斗开始。"]
  };
  state.current.modal = "battle";
  return run.battle;
}

/**
 * 关掉 Boss 登场卡。
 *
 * 它刻意不是一次「战斗行动」：不动回合、不进敌方回合、不掉血。
 * 如果做成行动，玩家在读卡时手抖一下就得白挨一击，而这一击和「读卡」毫无关系。
 * 返回是否真的关掉了一张开着的卡，方便调用方决定要不要播音效。
 */
function dismissBattleIntro(state) {
  var battle = state.run && state.run.battle;
  if (!battle || !battle.introOpen) return false;
  battle.introOpen = false;
  return true;
}

function pushBattleLog(battle, text) {
  if (!battle) return;
  battle.logs.unshift(text);
  if (battle.logs.length > 24) battle.logs = battle.logs.slice(0, 24);
}

function calcPlayerDamage(state, base) {
  var run = state.run;
  var battle = run.battle;
  var damage = base + state.player.baseAttack + run.effects.attackFlat;
  if (battle.defenseStance) damage += config.defendNextAttackBonus;
  if (state.player.sanity < 50) damage = Math.round(damage * (1 + run.effects.lowSanityBonus));
  if (battle.boss) damage = Math.round(damage * (1 + run.effects.bossDamageBonus));

  // 背水一战：生命低于 40% 时反打，和「低精神加成」是两条独立的线，
  // 一个赌血、一个赌精神，逼玩家在两种危险里选一种。
  var lowHpLine = state.player.maxHp * 0.4;
  if (state.player.hp > 0 && state.player.hp < lowHpLine) {
    damage = Math.round(damage * (1 + run.effects.lowHpDamageBonus));
  }

  // 先手加成只吃本场第一击，打完就作废（用 battle.strikeUsed 标记）
  if (!battle.strikeUsed && run.effects.firstStrikeBonus > 0) {
    damage += run.effects.firstStrikeBonus;
  }

  // 织网：被缠住时这一击削弱，打完即解除
  if (battle.webbed) {
    damage = Math.round(damage * 0.65);
    battle.webbed = false;
    pushBattleLog(battle, "缠网拖慢了你的动作，这一击被削弱了。");
  }

  return Math.max(1, damage);
}

function dealEnemyDamage(run, battle, amount) {
  var remaining = Math.max(0, amount);
  if (battle.enemyShield > 0) {
    var absorbed = Math.min(battle.enemyShield, remaining);
    battle.enemyShield -= absorbed;
    remaining -= absorbed;
  }
  // 重甲特性：每次受击固定少掉 3 点，但保底 1 点，避免完全打不动
  if (battle.trait === "armored" && remaining > 0) {
    remaining = Math.max(1, remaining - 3);
  }
  var before = battle.hp;
  battle.hp = clamp(battle.hp - remaining, 0, battle.maxHp);
  var dealt = before - battle.hp;
  run.stats.damageDealt += dealt;
  // 阶段检查挂在这里，因为它是「所有对敌伤害」的唯一收口。
  // 挂到各个攻击分支上就得加五处，漏一处玩家就会遇到打穿半血却没变阶段的 Boss。
  if (dealt > 0) checkBossPhase(battle);
  return { dealt: dealt, absorbed: Math.min(before, amount) - dealt };
}

/**
 * 每个 Boss 的第二形态是一次改名，还是真的换了一套打法？
 *
 * 0.9.3 给所有 Boss 共用一套第二形态（伤害 +3 / 护盾 12 / 节奏变快）。
 * 同一套机制重复五次，第二次就不新鲜了——玩家打到第二个 Boss 就知道
 * 「半血之后它会加盾」，后面三次只是在复述。
 *
 * 所以第二形态的参数从数据层读：模板上带 phase2 就按它来，没带就用旧的那套兜底
 * （旧存档、测试桩、未来新增但没写 phase2 的 Boss 都不会崩）。
 */
function phase2Of(battle) {
  if (!battle || !battle.enemyId) return null;
  var def = enemiesApi.getById(battle.enemyId);
  return def && def.phase2 ? def.phase2 : null;
}

/**
 * Boss 换阶段：血量首次跌破半血时进入第二阶段。
 *
 * 单场 Boss 战原本只是「血更厚的普通怪」——打到最后三分之一的回合和第一回合
 * 长得一模一样，赢的那一刻没有「我把一个东西打崩了」的感觉。
 *
 * 三条设计约束：
 * 1. **换阶段那回合敌人不出手**。变强如果不给缓冲，玩家的体感是「快赢了突然被打死」；
 *    给一回合，同一件事就变成「我把它打崩了，它正在重组」。
 * 2. **旧蓄势作废**。否则转换前攒的层数会在转换后立刻兑现，变成一记毫无预告的重击。
 * 3. **一击致死不触发**。血条直接归零时没有第二阶段可言，否则会画出「刚裂开就死了」。
 */
function checkBossPhase(battle) {
  if (!battle || !battle.boss || battle.over) return false;
  if (battle.phase >= 2) return false;
  if (battle.hp <= 0) return false;
  if (battle.hp > battle.maxHp * 0.5) return false;

  var p2 = phase2Of(battle);
  battle.phase = 2;
  // 形态名落进战斗对象：UI 只读，不许自己按 enemyId 猜
  battle.phaseLabel = (p2 && p2.label) || "第二阶段";
  battle.phaseHits = (p2 && p2.hits > 1) ? Math.round(p2.hits) : 1;
  battle.enemyCharge = 0;
  battle.telegraph = null;
  battle.phaseBreak = true;
  var add = p2 && typeof p2.dmgAdd === "number" ? p2.dmgAdd : 3;
  battle.damageRange = [battle.damageRange[0] + add, battle.damageRange[1] + add];
  // 这里不写日志：dealEnemyDamage 在「命中」那行 push 之前跑，
  // 现在写会变成「崩开 → 命中」，玩家从上往下读就是反的。
  // 交给 enemyTurn 的 phaseBreak 分支，按时间顺序补上。
  return true;
}

/**
 * 敌方回合末尾：写下「下回合会发生什么」，并落到 battle.telegraph 上。
 *
 * 蓄势重击 / 成群连击 / 黏网原本都在同一回合里既宣布又生效，
 * 玩家读到的只是一行事后日志，没有任何可应对的余地。现在它们提前一回合公布，
 * 「搞不懂为什么突然挨这么重」变成「看见了，这回合要不要换防御」。
 * 节奏不变：仍是每 3 回合一次，变的只是公布时机。
 */
function writeTelegraph(battle) {
  if (!battle || battle.over) return null;
  battle.telegraph = null;
  // 第二形态的节奏由形态自己定：双影/查票/脱轨仍是每 2 回合，
  // 换宿主退回 3 回合（它已经在体内持续掉血，再来个高频蓄势就只是加法）。
  var p2 = battle.phase >= 2 ? phase2Of(battle) : null;
  var cadence = battle.phase >= 2 ? ((p2 && p2.cadence) || 2) : 3;
  if (battle.turn % cadence !== 0) return null;

  var t = null;
  if (battle.trait === "assassin" || battle.boss) {
    // 已有层数会一起结算，预告里报的就是真正的加成量，不许写个约数糊弄玩家
    t = {
      kind: "charge",
      label: "蓄势",
      detail: "下一击 +" + (8 * (battle.enemyCharge + 1)),
      log: battle.name + " 伏低身子蓄势，下一击会更重。"
    };
    battle.enemyCharge += 1;
  } else if (battle.trait === "swarm") {
    t = {
      kind: "swarm",
      label: "集结",
      detail: "连击两次",
      log: battle.name + " 发出尖啸，同伴正在聚集。"
    };
  } else if (battle.trait === "weaver") {
    t = {
      kind: "weave",
      label: "吐丝",
      detail: "缠住你",
      log: battle.name + " 开始吐丝结网。"
    };
  }

  battle.telegraph = t;
  if (t) pushBattleLog(battle, t.log);
  return t;
}

function enemyTurn(state) {
  var run = state.run;
  var battle = run.battle;
  if (!battle || battle.over) return;

  /**
   * 换阶段的那一回合：它只顾重组躯壳，不还手，但立起一层护盾。
   *
   * 这一回合是换阶段能被接受的全部原因。直接加难度会让玩家觉得
   * 「我快赢了它突然变强」；空出一回合再变强，读到的就是
   * 「我把它打崩了，它正在爬起来」。护盾是补上这回合少掉的输出压力，
   * 让跳过不成为纯粹的送分。
   */
  if (battle.phaseBreak) {
    var p2b = phase2Of(battle);
    battle.phaseBreak = false;
    battle.enemyShield += p2b && typeof p2b.shield === "number" ? p2b.shield : 12;
    battle.lastEnemyDamage = 0;
    // 日志是倒序显示的（最新在最上），所以先推「规则说明」再推「呼应」再推「崩开」再推「重组」，
    // 玩家从上往下读才是「重组 / 它裂开了 / 那句话对上了 / 这套新打法是什么 / 刚才那一下命中」。
    if (p2b && p2b.tip) pushBattleLog(battle, p2b.tip);
    /**
     * 呼应：登场卡上那句「预感」在这一刻兑现。
     *
     * 它是**先 push 的**，所以在倒序日志里排在「崩开描述」下面一行——
     * 读起来是「它裂开了 / 「那句话对上了」」，事件在前、醒悟在后。
     * 用「」括起来表示这是玩家脑子里的声音，不是战场播报；
     * 不加引号就会读成第三段旁白，和 tip 糊成一片。
     *
     * 只在「当时真的看过那张卡」时才写（`introHint` 存在）：老存档、以及没有
     * phase2 的对手都没有这句铺垫，硬凑一句通用的「你想起了什么」比不写更尴尬。
     */
    if (p2b && p2b.callback && battle.introHint) {
      pushBattleLog(battle, "「" + p2b.callback + "」");
    }
    pushBattleLog(battle, (p2b && p2b.line)
      || (battle.name + " 的外壳崩开，露出里面的第二层——它比刚才更凶了。"));
    pushBattleLog(battle, battle.name + " 停在原地重组躯壳，暂时没有还手。");
    writeTelegraph(battle);
    battle.turn += 1;
    run.stats.turns += 1;
    battle.playerShield = 0;
    return;
  }

  var affix = battle.affix ? affixesApi.getById(battle.affix) : null;
  var dailyMul = modsOf(run).enemyDamageMul;

  if (affix && affix.shieldEvery && battle.turn % affix.shieldEvery === 0) {
    battle.enemyShield += affix.shieldAmount;
    pushBattleLog(battle, battle.name + " 立起壁垒，获得 " + affix.shieldAmount + " 点护盾。");
  }

  if (battle.trait === "idol" && battle.turn % 3 === 0) {
    battle.enemyShield += 10;
    pushBattleLog(battle, battle.name + " 固守姿态，获得 10 点护盾。");
  }
  if (battle.trait === "wisp" && battle.turn % 2 === 1) {
    var heal = Math.min(6, battle.maxHp - battle.hp);
    battle.hp += heal;
    if (heal > 0) pushBattleLog(battle, battle.name + " 吸收残光，恢复 " + heal + " 点生命。");
  }
  if (battle.boss && battle.turn % 2 === 0) {
    battle.enemyShield += 8;
    pushBattleLog(battle, battle.name + " 进入强化姿态，获得 8 点护盾。");
  }
  // 取出上一回合末尾写下的预告（取完即清，避免重复生效）。
  // 预告比效果早整整一个玩家回合——这个回合就是留给玩家的反应窗口。
  var tele = battle.telegraph || null;
  battle.telegraph = null;
  if (battle.trait === "enrage" && !battle.enraged && battle.hp < battle.maxHp * 0.5) {
    battle.enraged = true;
    pushBattleLog(battle, battle.name + " 撕开自己的外壳，攻势骤然变猛。");
  }

  var damage = rng.int(battle.damageRange[0], battle.damageRange[1]);
  // 赌徒：伤害在 50%—170% 之间剧烈浮动，逼你留够血线而不是算平均值
  if (battle.trait === "gambler") {
    damage = Math.round(damage * (0.5 + Math.random() * 1.2));
  }
  if (battle.trait === "enrage" && battle.enraged) damage = Math.round(damage * 1.45);
  if (affix && affix.damageMul) damage = Math.round(damage * affix.damageMul);
  if (dailyMul !== 1) damage = Math.round(damage * dailyMul);
  if (battle.enemyCharge > 0) {
    damage += 8 * battle.enemyCharge;
    battle.enemyCharge = 0;
    // 给表现层一个「这刀是蓄出来的」信号：重击需要比普通反击更重的震动与音色，
    // 否则玩家蓄势预警看了三回合，兑现时和普通挨打没区别，预警就白做了
    battle.lastChargedHit = true;
    pushBattleLog(battle, battle.name + " 释放蓄势重击。");
  } else {
    battle.lastChargedHit = false;
  }
  if (tele && tele.kind === "swarm") {
    damage += Math.round(damage * 0.55);
    pushBattleLog(battle, battle.name + " 成群扑咬，一回合连击两次。");
  }
  // 黏网在「预告后的那一回合」才落下：玩家看到吐丝提示时还有一次机会先防御或抢杀
  if (tele && tele.kind === "weave") {
    battle.webbed = true;
    pushBattleLog(battle, battle.name + " 的黏网罩下来，你的下一击会被拖慢。");
  }
  if (state.player.sanity < 30) {
    var reduction = clamp(run.effects.lowSanityDamageReduction, 0, 0.8);
    damage = Math.round(damage * (1 - reduction));
  }
  /**
   * 第二形态的伤害改装。
   *
   * 三个开关都只在这一处生效（敌方伤害的唯一出口），所以「查票」不可能漏判、
   * 「过载」也不可能在某条分支上忘了乘。加新形态只需要往数据里加字段。
   */
  var p2 = battle.phase >= 2 ? phase2Of(battle) : null;
  if (p2 && p2.dmgMul) damage = Math.round(damage * p2.dmgMul);
  var punished = false;
  if (p2 && p2.repeatPunish && battle.lastAction && battle.lastAction === battle.prevAction) {
    damage = Math.round(damage * (1 + p2.repeatPunish));
    punished = true;
  }

  /**
   * 分段：双影每回合两段、脱轨有概率追加一段。
   *
   * 拆成「段」而不是「一次打死」，是为了让护盾和防御架势按段结算——
   * 一次攻击吃不完的护盾，两段就能吃两遍。所以双影总伤害几乎没涨，
   * 真正变强的部分是「蹲下换来的免伤只剩一半」。
   */
  var segs = [damage];
  var hitCount = 1;
  var si;
  if (p2 && p2.hits > 1) {
    hitCount = Math.round(p2.hits);
    var per = Math.max(1, Math.round(damage * (p2.hitScale || 0.6)));
    segs = [];
    for (si = 0; si < hitCount; si += 1) segs.push(per);
  } else if (p2 && p2.extraChance && Math.random() < p2.extraChance) {
    segs.push(Math.max(1, Math.round(damage * (p2.extraScale || 0.55))));
  }

  // 防御架势只保第一段。多段攻击下「蹲下」挡住的从来只是先到的那一下，
  // 这是双影真正难打的原因，也是它和「伤害 +3」的区别。
  if (battle.defenseStance) {
    battle.defenseStance = false;
    segs[0] = Math.round(segs[0] * 0.6);
  }

  // 迅捷 / 召唤：额外的一次攻击，同样要过护盾，但不吃防御架势的减伤
  var extra = 0;
  if (affix) {
    if (affix.swiftTurn && battle.turn === affix.swiftTurn) {
      extra += Math.round(rng.int(battle.damageRange[0], battle.damageRange[1]) * 0.6);
      pushBattleLog(battle, battle.name + " 抢先出手，连击两次。");
    }
    if (affix.summonTurns && affix.summonTurns.indexOf(battle.turn) >= 0) {
      extra += affix.summonDamage;
      pushBattleLog(battle, "被召来的小体扑上来，额外撕咬 " + affix.summonDamage + " 点。");
    }
  }
  segs[0] += extra;

  var remaining = 0;
  for (si = 0; si < segs.length; si += 1) {
    var seg = segs[si];
    if (battle.playerShield > 0) {
      var absorbed = Math.min(battle.playerShield, seg);
      battle.playerShield -= absorbed;
      seg -= absorbed;
    }
    remaining += seg;
  }

  state.player.hp = clamp(state.player.hp - remaining, 0, state.player.maxHp);
  battle.lastEnemyDamage = remaining;
  // 惩罚必须说出口，否则玩家只会觉得「这一下莫名其妙特别疼」
  if (punished) pushBattleLog(battle, "它认得这个动作——你上一回合也是这么做的。");
  if (hitCount > 1) {
    pushBattleLog(battle, battle.name + " 连击 " + hitCount + " 次，共造成 " + remaining + " 点伤害。");
  } else if (segs.length > 1) {
    pushBattleLog(battle, battle.name + " 补上一记，共造成 " + remaining + " 点伤害。");
  } else {
    pushBattleLog(battle, battle.name + " 反击，造成 " + remaining + " 点伤害。");
  }

  // 换宿主：这一下不打在身上，直接从里面扣——护盾对它无效，
  // 「再蹲一回合」这条最省事的解法被它拿掉了
  if (p2 && p2.dotOnPlayer && state.player.hp > 0) {
    state.player.hp = clamp(state.player.hp - p2.dotOnPlayer, 0, state.player.maxHp);
    battle.lastEnemyDamage = remaining + p2.dotOnPlayer;
    pushBattleLog(battle, "它在你体内翻了个身，穿盾扣掉 " + p2.dotOnPlayer + " 点生命。");
  }

  // 毒化：命中后挂 3 回合中毒，之后每回合额外掉血
  if (affix && affix.poison && remaining > 0) {
    battle.poison = 3;
    pushBattleLog(battle, battle.name + " 的毒液渗入伤口。");
  }

  // 上一口毒结算（不吃护盾，直接掉血）
  if (battle.poison > 0) {
    var dot = 3;
    battle.poison -= 1;
    state.player.hp = clamp(state.player.hp - dot, 0, state.player.maxHp);
    battle.lastEnemyDamage = remaining + dot;
    pushBattleLog(battle, "毒素发作，额外损失 " + dot + " 点生命。");
  }

  // 寄生：命中后挂卵，两回合后孵化。孵化那一下不打折也不吃护盾——
  // 想躲只能在这两回合里结束战斗，这是这条特性唯一给的解。
  if (battle.trait === "parasite" && remaining > 0 && !battle.egg) {
    battle.egg = 2;
    pushBattleLog(battle, battle.name + " 在你身上产下一枚卵。");
  }
  if (battle.egg > 0) {
    battle.egg -= 1;
    if (battle.egg === 0) {
      var hatch = 12;
      state.player.hp = clamp(state.player.hp - hatch, 0, state.player.maxHp);
      battle.hp = clamp(battle.hp + 10, 0, battle.maxHp);
      battle.lastEnemyDamage = remaining + hatch;
      pushBattleLog(battle, "卵孵化了，你损失 " + hatch + " 点生命，" + battle.name + " 吸收了养分。");
    } else {
      pushBattleLog(battle, "体内的卵在蠕动，还有 " + battle.egg + " 回合。");
    }
  }

  // 狂暴：每次出手自伤，但不会把自己打死
  if (affix && affix.selfDamage) {
    battle.hp = Math.max(1, battle.hp - affix.selfDamage);
  }

  // 过载：锅炉反噬。和狂暴词缀同一条思路——它变强的方式是把自己烧掉，
  // 所以玩家的最优解从「扛住」变成「拖住」，多撑一回合就等于多打一下。
  if (p2 && p2.selfBleed) {
    battle.hp = Math.max(1, battle.hp - p2.selfBleed);
    pushBattleLog(battle, "过载的锅炉反噬自身，它损失 " + p2.selfBleed + " 点生命。");
  }

  // 吸血特性：按实际打出的伤害回血，打空（被护盾吃光）就不回
  if (battle.trait === "vampire" && remaining > 0) {
    var drain = Math.min(Math.max(1, Math.round(remaining * 0.4)), battle.maxHp - battle.hp);
    if (drain > 0) {
      battle.hp += drain;
      pushBattleLog(battle, battle.name + " 汲取了 " + drain + " 点生命。");
    }
  }

  if (state.player.hp <= 0) {
    if (run.effects.autoReviveOnce) {
      run.effects.autoReviveOnce = false;
      var reviveHp = 20 + run.effects.reviveHealBonus;
      state.player.hp = clamp(reviveHp, 1, state.player.maxHp);
      pushBattleLog(battle, "应急针剂自动触发，你恢复了 " + state.player.hp + " 点生命。");
      writeTelegraph(battle);
      battle.turn += 1;
      return;
    }
    battle.over = true;
    battle.result = "lose";
    pushBattleLog(battle, "你倒在了裂隙深处。");
    return;
  }

  // 写下下回合的预告。预告在玩家行动之前就写进状态，UI 才画得出来——
  // 有预警的动作才有「应对」可言，没有预警的特殊招式只是突然挨打。
  writeTelegraph(battle);

  battle.turn += 1;
  run.stats.turns += 1;

  // 护盾是一次性吸收：本回合没被打破的部分不结转到下一回合，
  // 否则「防御」可以无限叠盾，战斗永远打不完。
  battle.playerShield = 0;

  // 回合上限兜底：极端构筑下也不允许无限对峙
  if (battle.turn > 40) {
    battle.over = true;
    battle.result = "lose";
    pushBattleLog(battle, "战斗拖得太久，裂隙开始闭合，你被迫撤退。");
    state.player.hp = 1;
    state.run.battle = null;
    state.current.modal = null;
    endRun(state, false, "战斗超时，本次探索被迫终止。");
  }
}

/**
 * 镜影反伤：打中镜面类敌人会反弹固定伤害。
 * 返回是否弹死了玩家（调用方据此结束战斗，不再进敌方回合）。
 */
function applyMirrorReflect(state, battle) {
  if (!battle) return false;
  var reflect = battle.trait === "mirror" ? 3 : 0;
  var affix = battle.affix ? affixesApi.getById(battle.affix) : null;
  if (affix && affix.reflect) reflect += affix.reflect;
  if (reflect <= 0) return false;
  state.player.hp = clamp(state.player.hp - reflect, 0, state.player.maxHp);
  pushBattleLog(battle, battle.name + " 的镜面反弹，你受到 " + reflect + " 点反伤。");
  if (state.player.hp <= 0) {
    battle.over = true;
    battle.result = "lose";
    pushBattleLog(battle, "反伤耗尽了你的体力，你倒下了。");
    return true;
  }
  return false;
}

/**
 * 记下这一步动作，供第二形态的「查票」比对上一回合。
 *
 * 只记真正消耗回合的行动：逃跑、重战卡、看广告复活都不算——
 * 它们不产生回合，也就不该被当成「你又用了一次同一招」。
 */
function markAction(battle, actionId) {
  if (!battle) return;
  battle.prevAction = battle.lastAction || null;
  battle.lastAction = actionId;
}

function battleAction(state, actionId) {
  var run = state.run;
  var battle = run && run.battle;
  if (!battle || battle.over) return { ok: false };
  if (state.player.hp <= 0) return { ok: false };

  // 药剂 / 秒杀卡在各自分支里记：没货的那一次不该算作一次行动
  if (actionId === "precise" || actionId === "power" || actionId === "defend") {
    markAction(battle, actionId);
  }

  if (actionId === "precise") {
    var d1 = calcPlayerDamage(state, config.preciseBonus);
    battle.strikeUsed = true;
    // 暴击只挂在「精准」上：强力本来就是赌命中，再叠暴击会变成赌博的上位替代，
    // 精准反而没人用。让两条路各有各的赌法。
    var critRate = clamp(run.effects.critChance, 0, 0.6);
    var isCrit = critRate > 0 && Math.random() < critRate;
    if (isCrit) {
      d1 = Math.round(d1 * 1.8);
      battle.lastCrit = true;
    } else {
      battle.lastCrit = false;
    }
    var r1 = dealEnemyDamage(run, battle, d1);
    pushBattleLog(battle, isCrit
      ? "精准射击命中要害，造成 " + r1.dealt + " 点暴击伤害。"
      : "精准射击命中，造成 " + r1.dealt + " 点伤害。");
    if (battle.hp <= 0) return winBattle(state);
    if (applyMirrorReflect(state, battle)) return { ok: true, reflected: true };
    enemyTurn(state);
    return { ok: true, crit: isCrit };
  }

  if (actionId === "power") {
    if (Math.random() > config.powerHitRate) {
      pushBattleLog(battle, "强力射击偏离了轨迹。");
      enemyTurn(state);
      return { ok: true, missed: true };
    }
    if (battle.trait === "wolf" && Math.random() < 0.35) {
      pushBattleLog(battle, battle.name + " 敏捷侧闪，躲开了强力射击。");
      enemyTurn(state);
      return { ok: true, dodged: true };
    }
    if (battle.trait === "assassin" && Math.random() < 0.2) {
      pushBattleLog(battle, battle.name + " 借残影偏移身位，削弱了这次进攻。");
      enemyTurn(state);
      return { ok: true, dodged: true };
    }
    var d2 = calcPlayerDamage(state, config.powerBonus);
    battle.strikeUsed = true;
    battle.lastCrit = false;
    var r2 = dealEnemyDamage(run, battle, d2);
    pushBattleLog(battle, "强力射击轰中目标，造成 " + r2.dealt + " 点伤害。");
    if (battle.hp <= 0) return winBattle(state);
    if (applyMirrorReflect(state, battle)) return { ok: true, reflected: true };
    enemyTurn(state);
    return { ok: true };
  }

  if (actionId === "defend") {
    var shieldGain = config.defendShield + run.effects.defendShieldBonus;
    battle.playerShield += shieldGain;
    battle.defenseStance = true;
    pushBattleLog(battle, "你摆出防御架势，获得 " + shieldGain + " 点护盾。");
    enemyTurn(state);
    return { ok: true };
  }

  if (actionId === "potion") {
    if (state.player.inventory.potion <= 0) {
      pushBattleLog(battle, "背包里没有回血药剂。");
      return { ok: false, message: "没有回血药剂。" };
    }
    state.player.inventory.potion -= 1;
    var healAmt = config.potionHeal + run.effects.potionBonus
      + state.progress.trainUpgrades.medbay * config.medbayHealBonus;
    // 换宿主：药还是那瓶药，只是喝下去有一半被它先喝了
    var p2h = battle.phase >= 2 ? phase2Of(battle) : null;
    if (p2h && p2h.healCut) {
      healAmt = Math.max(1, Math.round(healAmt * (1 - p2h.healCut)));
    }
    state.player.hp = clamp(state.player.hp + healAmt, 0, state.player.maxHp);
    pushBattleLog(battle, "你使用回血药剂，恢复 " + healAmt + " 点生命。");
    markAction(battle, "potion");
    enemyTurn(state);
    return { ok: true };
  }

  if (actionId === "execute") {
    if (state.player.inventory.executeCard <= 0) {
      pushBattleLog(battle, "你没有秒杀卡。");
      return { ok: false, message: "没有秒杀卡。" };
    }
    state.player.inventory.executeCard -= 1;
    markAction(battle, "execute");
    if (battle.boss) {
      var dmg = Math.floor(battle.maxHp * 0.5);
      var r3 = dealEnemyDamage(run, battle, dmg);
      pushBattleLog(battle, "秒杀卡对 Boss 造成 " + r3.dealt + " 点重创。");
      if (battle.hp <= 0) return winBattle(state);
      enemyTurn(state);
      return { ok: true };
    }
    dealEnemyDamage(run, battle, battle.hp + battle.enemyShield);
    pushBattleLog(battle, "秒杀卡直接击破了敌人。");
    return winBattle(state);
  }

  if (actionId === "escape") {
    var cost = run.effects.escapeFree ? 0 : config.escapeCost;
    if (state.player.ether < cost) {
      pushBattleLog(battle, "以太碎片不足，无法撤离。");
      return { ok: false, message: "以太不足。" };
    }
    state.player.ether -= cost;
    run.battle = null;
    state.current.modal = null;
    pushLog(state, "撤离", cost > 0 ? "你付出 " + cost + " 以太碎片撤离。" : "你利用强化效果免费撤离。");
    return { ok: true, escaped: true };
  }

  if (actionId === "retry") {
    if (state.player.hp > 0 || state.player.inventory.retryCard <= 0) return { ok: false };
    state.player.inventory.retryCard -= 1;
    state.player.hp = state.player.maxHp;
    battle.over = false;
    battle.result = null;
    pushBattleLog(battle, "重战卡启动，你以满状态重新站稳。");
    return { ok: true, revived: true };
  }

  if (actionId === "adRevive") {
    if (state.player.hp > 0) return { ok: false };
    if (!canWatchAd(state, Date.now())) return { ok: false, message: "今日广告次数已用完。" };
    return { ok: true, needsAd: true };
  }

  return { ok: false };
}

/** 广告复活由 main 在广告回调后调用 */
function applyAdRevive(state) {
  var battle = state.run && state.run.battle;
  if (!battle) return false;
  if (!canWatchAd(state, Date.now())) return false;
  state.meta.adViewsToday += 1;
  state.player.hp = config.adReviveHp;
  battle.over = false;
  battle.result = null;
  pushBattleLog(battle, "激励复活生效，你恢复了 " + config.adReviveHp + " 点生命。");
  return true;
}

function winBattle(state) {
  var run = state.run;
  var battle = run.battle;
  var hpAtWin = state.player.hp;

  // 残响词缀：首次死亡时以 40% 生命复活，战斗继续而不是结算
  var affixDef = battle.affix ? affixesApi.getById(battle.affix) : null;
  if (battle.hp <= 0 && affixDef && affixDef.reviveRatio && !battle.revived) {
    battle.revived = true;
    battle.hp = Math.max(1, Math.round(battle.maxHp * affixDef.reviveRatio));
    battle.over = false;
    battle.result = null;
    pushBattleLog(battle, battle.name + " 的残响让它重新站了起来。");
    return { ok: true, revived: true };
  }

  // 自爆特性：死亡时炸玩家一下，但保底留 1 点血——
  // 「赢了却被打死」在单机 Roguelike 里只会让玩家觉得被耍。
  if (battle.trait === "bomber") {
    state.player.hp = clamp(state.player.hp - 10, 1, state.player.maxHp);
    pushBattleLog(battle, battle.name + " 崩解自爆，余烬灼伤了你。");
  }

  var gold = battle.reward.gold + run.effects.battleBonusGold;
  // 贪婪词缀：赏金翻倍（代价是攻击更狠，在 enemyTurn 里已生效）
  if (affixDef && affixDef.goldMul) gold = Math.round(gold * affixDef.goldMul);
  // 车厢主题（焚炉）整体加金币
  var goldMul = modsOf(run).goldMul;
  if (goldMul !== 1) gold = Math.round(gold * goldMul);
  grantCurrency(state, { ether: battle.reward.ether, gold: gold });
  run.stats.battlesWon += 1;
  pushLog(state, "战斗胜利", "击败 " + battle.name + "，获得 " + battle.reward.ether + " 以太。");

  if (run.effects.healAfterBattle > 0) {
    state.player.hp = clamp(state.player.hp + run.effects.healAfterBattle, 0, state.player.maxHp);
  }
  // 基础容错回血：让非酋玩家也有机会走到 Boss
  state.player.hp = clamp(state.player.hp + config.healAfterWin, 0, state.player.maxHp);

  // 图鉴与跨局统计：击败才记「已击败」，只是遇到只记「见过」
  markEnemyDefeated(state, battle.enemyId);
  checkCodexReward(state);
  state.progress.stats.battlesWon += 1;
  if (battle.boss) run.stats.hpAtBossWin = hpAtWin;

  var wasBoss = battle.boss;
  var wasElite = battle.elite;
  run.battle = null;
  state.current.modal = null;

  if (wasBoss) {
    state.progress.runsCleared += 1;
    state.progress.bossClears += 1;
    endRun(state, true, battle.name + " 倒下了，你带着整局成果返回列车。");
    return { ok: true, battleWon: true, runCleared: true };
  }

  var count = wasElite ? config.eliteEnhanceBase + run.effects.extraEliteEnhanceChoice : 3;
  openEnhance(state, count);
  return { ok: true, battleWon: true };
}

/* ---------------- 强化 / 遗物 ---------------- */

function openEnhance(state, count) {
  var run = state.run;
  var n = count || 3;
  if (run) n += modsOf(run).enhanceChoiceDelta;
  var picks = enhApi.draw(rng.shuffle, clamp(n, 2, 5));
  state.run.pendingEnhancements = picks.map(function (item) {
    return { id: item.id, name: item.name, desc: item.desc, tag: item.tag };
  });
  state.current.modal = "enhance";
}

function chooseEnhancement(state, id) {
  var run = state.run;
  var pending = run.pendingEnhancements || [];
  var found = null;
  var i;
  for (i = 0; i < pending.length; i += 1) {
    if (pending[i].id === id) found = pending[i];
  }
  if (!found) return { ok: false };
  var def = enhApi.getById(id);
  if (def) {
    effectsApi.addEffects(run.effects, def.effects);
    if (def.effects && def.effects.maxHpBonus) {
      state.player.maxHp += def.effects.maxHpBonus;
      state.player.hp = clamp(state.player.hp + def.effects.maxHpBonus, 0, state.player.maxHp);
    }
  }
  run.enhancements.push({ id: found.id, name: found.name, desc: found.desc });
  markEnhancementObtained(state, found.id);
  checkCodexReward(state);
  run.pendingEnhancements = null;
  state.current.modal = null;
  pushLog(state, "强化获得", "你选择了「" + found.name + "」。");
  return { ok: true, enhancement: found };
}

/* ---------------- 遗物序列（套装） ---------------- */

/** 本局已收集的某序列件数 */
function setOwnedCount(run, set) {
  var count = 0;
  var i;
  for (i = 0; i < run.relics.length; i += 1) {
    if (set.members.indexOf(run.relics[i].id) >= 0) count += 1;
  }
  return count;
}

/**
 * 序列进度（只读，给界面用）。
 * granted 是「已经发过奖励的档位数」，不是「当前满足的档位数」——
 * 两者在正常流程里一致，但读档补算前可能不同，界面应显示前者，
 * 否则玩家会看到「已激活」却没拿到属性。
 */
function setProgress(run) {
  var list = [];
  var i;
  var j;
  var sets = relicSetsApi.RELIC_SETS;
  for (i = 0; i < sets.length; i += 1) {
    var set = sets[i];
    var count = run ? setOwnedCount(run, set) : 0;
    var granted = (run && run.setActive && run.setActive[set.id]) || 0;
    var tiers = [];
    for (j = 0; j < set.tiers.length; j += 1) {
      tiers.push({
        need: set.tiers[j].need,
        desc: set.tiers[j].desc,
        active: j < granted
      });
    }
    list.push({
      id: set.id,
      name: set.name,
      accent: set.accent,
      count: count,
      total: set.members.length,
      granted: granted,
      tiers: tiers,
      nextNeed: granted < set.tiers.length ? set.tiers[granted].need : 0
    });
  }
  return list;
}

/**
 * 结算序列奖励：把「新达成但还没发过」的档位补发一次。
 *
 * 幂等：靠 run.setActive 记账，重复调用不会二次加属性。
 * 读档后也调用一次，老存档（没有 setActive 字段）会自动补齐应得的档位。
 */
function applySetBonuses(state) {
  var run = state.run;
  if (!run || !run.active) return [];
  if (!run.setActive) run.setActive = {};
  var activated = [];
  var i;
  var j;
  var sets = relicSetsApi.RELIC_SETS;
  for (i = 0; i < sets.length; i += 1) {
    var set = sets[i];
    var count = setOwnedCount(run, set);
    var granted = run.setActive[set.id] || 0;
    for (j = granted; j < set.tiers.length; j += 1) {
      var tier = set.tiers[j];
      if (count < tier.need) break;
      effectsApi.addEffects(run.effects, tier.effects);
      if (tier.effects && tier.effects.maxHpBonus) {
        state.player.maxHp += tier.effects.maxHpBonus;
        state.player.hp = clamp(state.player.hp + tier.effects.maxHpBonus, 1, state.player.maxHp);
      }
      run.setActive[set.id] = j + 1;
      activated.push({ set: set, tier: tier });
    }
  }
  for (i = 0; i < activated.length; i += 1) {
    pushLog(state, "序列激活",
      "「" + activated[i].set.name + "」第 " + activated[i].tier.need + " 件达成：" + activated[i].tier.desc + "。");
  }
  return activated;
}

/** 读档后补算：老档没有 setActive，或者存档被改乱时用 */
function reconcileSets(state) {
  if (!state.run || !state.run.active) return [];
  if (!state.run.setActive) state.run.setActive = {};
  return applySetBonuses(state);
}

function obtainRelic(state, relic) {
  var run = state.run;
  if (!relic) return null;
  var owned = run.relics.some(function (item) { return item.id === relic.id; });
  if (owned) {
    grantCurrency(state, { ether: 20, gold: 1 });
    pushLog(state, "遗物重复", "已拥有「" + relic.name + "」，折算为资源。");
    return { duplicated: true, relic: relic };
  }
  run.relics.push({ id: relic.id, name: relic.name, desc: relic.desc, rarity: relic.rarity });
  markRelicObtained(state, relic.id);
  checkCodexReward(state);
  effectsApi.addEffects(run.effects, relic.effects);
  if (relic.effects && relic.effects.maxHpBonus) {
    state.player.maxHp += relic.effects.maxHpBonus;
    state.player.hp = state.player.maxHp;
  }
  pushLog(state, "遗物获得", "你获得了「" + relic.name + "」。");
  var sets = applySetBonuses(state);
  return { duplicated: false, relic: relic, sets: sets };
}

function openChest(state) {
  var relic = relicsApi.roll(rng.pick, state.run.relics.map(function (item) { return item.id; }));
  state.run.pendingRelicId = relic ? relic.id : null;
  state.current.modal = "chest";
  return relic;
}

function confirmChest(state) {
  var run = state.run;
  var relic = relicsApi.getById(run.pendingRelicId);
  var result = null;
  if (relic) result = obtainRelic(state, relic);
  run.pendingRelicId = null;
  state.current.modal = null;
  openEnhance(state, 3);
  return result;
}

/* ---------------- 事件 ---------------- */

function openEvent(state) {
  var run = state.run;
  // 链事件优先：到了一层该说的那句台词，先说。说完就记进度，不重复。
  var chainPick = eventsApi.nextChainEvent(run.chains, run.layer, Math.random);
  var event;
  if (chainPick) {
    event = chainPick.event;
    run.chains[chainPick.chain] = chainPick.stage;
    run.eventChain = { id: chainPick.chain, name: chainPick.chainName, stage: chainPick.stage, total: chainPick.total };
    pushLog(state, "线索", "「" + chainPick.chainName + "」第 " + chainPick.stage + " / " + chainPick.total + " 段。");
  } else {
    event = eventsApi.roll(rng.pick, run.layer, run.recentEvents, run.theme);
    run.eventChain = null;
  }
  run.eventId = event.id;
  run.eventResult = null;
  run.eventChoiceIndex = -1;
  run.recentEvents.unshift(event.id);
  if (run.recentEvents.length > 2) run.recentEvents = run.recentEvents.slice(0, 2);
  state.current.modal = "event";
  return event;
}

/** 判断某个选项当前能否选（成本是否够） */
function canChooseEventOption(state, choice) {
  if (!choice) return true;
  // 负数 items 是「交出去的道具」，和 cost 一样要有货才能选，否则等于凭空领奖励
  if (choice.items) {
    var key;
    for (key in choice.items) {
      if (!Object.prototype.hasOwnProperty.call(choice.items, key)) continue;
      if (choice.items[key] < 0 && (state.player.inventory[key] || 0) + choice.items[key] < 0) {
        return false;
      }
    }
  }
  if (!choice.cost) return true;
  var cost = choice.cost;
  if (cost.ether && state.player.ether < cost.ether) return false;
  if (cost.gold && state.player.gold < cost.gold) return false;
  if (cost.hp && state.player.hp <= cost.hp) return false;
  if (cost.sanity && state.player.sanity < cost.sanity) return false;
  return true;
}

function applyEventGain(state, gain) {
  if (!gain) return;
  var boost = 1 + state.run.effects.eventRewardBoost;
  var goldMul = modsOf(state.run).goldMul;
  if (gain.ether) grantCurrency(state, { ether: Math.round(gain.ether * boost) });
  if (gain.gold) grantCurrency(state, { gold: Math.round(gain.gold * goldMul) });
  if (gain.hp) state.player.hp = clamp(state.player.hp + gain.hp, 1, state.player.maxHp);
  if (gain.sanity) state.player.sanity = clamp(state.player.sanity + gain.sanity, 0, config.maxSanity);
  if (gain.hunger) state.player.hunger = clamp(state.player.hunger + gain.hunger, 0, config.maxHunger);
}

/**
 * 选择事件选项：结算成本、收益、风险、后续动作。
 * 返回 { ok, text, followUp: 'enhance'|'relic'|null }
 */
function chooseEventOption(state, index) {
  var run = state.run;
  var event = eventsApi.getById(run.eventId);
  if (!event || !event.choices[index]) return { ok: false };
  var choice = event.choices[index];
  if (!canChooseEventOption(state, choice)) {
    return { ok: false, message: "资源不足，无法选择。" };
  }

  // 成本
  if (choice.cost) {
    if (choice.cost.ether) state.player.ether -= choice.cost.ether;
    if (choice.cost.gold) state.player.gold -= choice.cost.gold;
    if (choice.cost.hp) state.player.hp = clamp(state.player.hp - choice.cost.hp, 1, state.player.maxHp);
    if (choice.cost.sanity) state.player.sanity = clamp(state.player.sanity - choice.cost.sanity, 0, config.maxSanity);
  }

  grantItems(state, choice.items);
  applyEventGain(state, choice.gain);

  var followUp = choice.action || null;
  var text = choice.text || "你做出了选择。";

  if (choice.risk) {
    var success = Math.random() < choice.risk.chance;
    var branch = success ? choice.risk.ok : choice.risk.bad;
    text = success ? (choice.risk.okText || text) : (choice.risk.badText || text);
    if (branch && branch.action) followUp = branch.action;
    if (branch) {
      // 风险分支同样可能给道具（例如售货机卡出来的药剂），之前漏了这一步
      if (branch.items) grantItems(state, branch.items);
      applyEventGain(state, {
        ether: branch.ether,
        gold: branch.gold,
        hp: branch.hp,
        sanity: branch.sanity,
        hunger: branch.hunger
      });
    }
  }

  run.eventResult = text;
  run.eventChoiceIndex = index;
  run.eventFollowUp = followUp;
  pushLog(state, "事件", text);
  state.current.modal = "eventResult";
  return { ok: true, text: text, followUp: followUp };
}

/** 事件结果页「继续」：处理遗留动作（强化/遗物）再关闭 */
function confirmEventResult(state) {
  var run = state.run;
  // 结果页只负责把「选择时算好的后续动作」执行掉，不重算概率
  var followUp = run.eventFollowUp || null;
  run.eventFollowUp = null;
  run.eventId = null;
  run.eventResult = null;
  run.eventChoiceIndex = -1;
  state.current.modal = null;

  if (followUp === "enhance") {
    openEnhance(state, 3);
    return { followUp: "enhance" };
  }
  if (followUp === "relic") {
    var relic = relicsApi.roll(rng.pick, run.relics.map(function (item) { return item.id; }));
    obtainRelic(state, relic);
    return { followUp: "relic", relic: relic };
  }
  return { followUp: null };
}

/* ---------------- 营地 / 商店 ---------------- */

function campRest(state) {
  var heal = 22 + state.run.effects.campHealBonus;
  state.player.hp = clamp(state.player.hp + heal, 0, state.player.maxHp);
  state.player.sanity = clamp(state.player.sanity + 10, 0, config.maxSanity);
  state.player.hunger = clamp(state.player.hunger + 15, 0, config.maxHunger);
  pushLog(state, "营地", "你休息了一会儿，恢复 " + heal + " 生命与 10 精神。");
  state.current.modal = null;
  return { ok: true, message: "恢复 " + heal + " 生命 / 10 精神 / 15 饱食" };
}

function campPrepare(state) {
  pushLog(state, "营地", "你没有休息，完成了一次整备。");
  openEnhance(state, 3);
  return { ok: true };
}

function shopPrice(state, item) {
  var run = state.run;
  if (!run || !run.active) return item.cost;
  var price = item.cost;
  if (typeof run.effects.firstShopDiscount === "number") {
    price = Math.ceil(price * run.effects.firstShopDiscount);
  }
  // 每日条件与主题的价格系数已在 modsOf 里相乘，这里只乘一次
  price = Math.ceil(price * modsOf(run).shopPriceMul);
  return price;
}

function buyItem(state, shopItemId) {
  var shopItem = null;
  var i;
  for (i = 0; i < itemsApi.SHOP_ITEMS.length; i += 1) {
    if (itemsApi.SHOP_ITEMS[i].id === shopItemId) shopItem = itemsApi.SHOP_ITEMS[i];
  }
  if (!shopItem) return { ok: false };
  var price = shopPrice(state, shopItem);
  if (!spendCurrency(state, shopItem.costType, price)) {
    return { ok: false, message: "资源不足。" };
  }
  var grant = {};
  grant[shopItem.itemId] = shopItem.amount;
  grantItems(state, grant);
  if (state.run && state.run.active && typeof state.run.effects.firstShopDiscount === "number") {
    state.run.effects.firstShopDiscount = null;
  }
  pushLog(state, "商店", "购买了 " + (itemsApi.ITEMS[shopItem.itemId] || {}).name + "。");
  return { ok: true, message: "购买成功。" };
}

/* ---------------- 结算 ---------------- */

function computeSummary(state) {
  var run = state.run;
  var engineLevel = state.progress.trainUpgrades.engine;
  var etherBonus = 1 + engineLevel * config.engineEtherBonus;
  var baseReward = run.completed ? 40 + run.layer * 12 : 10 + run.layer * 6;
  // 每日挑战走独立奖励，不吃普通结算，避免「跑一趟挑战拿两份钱」
  var reward = run.daily ? 0 : Math.round(baseReward * etherBonus);
  return {
    cleared: run.completed,
    layer: run.layer,
    nodes: run.nodesVisited,
    battlesWon: run.stats.battlesWon,
    damageDealt: run.stats.damageDealt,
    etherEarned: run.stats.etherGained,
    daily: !!run.daily,
    reward: reward,
    relics: run.relics.slice(),
    enhancements: run.enhancements.slice()
  };
}

function endRun(state, cleared, message) {
  var run = state.run;
  if (!run) return null;
  var summary = computeSummary(state);

  // 跨局统计：成就指标都从这里来（结算时一次性写，避免每帧判断）
  var stats = state.progress.stats;
  stats.maxRelics = Math.max(stats.maxRelics, run.relics.length);
  stats.maxEnhancements = Math.max(stats.maxEnhancements, run.enhancements.length);
  if (cleared) {
    if (run.stats.hpAtBossWin >= state.player.maxHp) stats.perfectBossWins += 1;
    if (state.player.sanity < 30) stats.lowSanityClears += 1;
    if (!run.relics.length) stats.noRelicClears += 1;
  }

  grantCurrency(state, { ether: summary.reward, gold: cleared ? 3 : 0 });

  // 每日挑战：还原钱包（挑战只结算奖励，不动玩家攒下的资产），再单独发挑战奖励
  if (run.daily) {
    var obs = state.progress.trainUpgrades.observatory || 0;
    var dailyReward = 0;
    if (cleared) {
      dailyReward = Math.round((config.daily.baseReward + run.layer * config.daily.rewardPerLayer)
        * (1 + obs * config.daily.rewardBonusPerLevel));
      state.progress.daily.clears += 1;
    }
    if (run.layer > state.progress.daily.bestLayer) state.progress.daily.bestLayer = run.layer;
    restoreWallet(state, run.daily.wallet);
    if (dailyReward > 0) grantCurrency(state, { ether: dailyReward });
    summary.dailyReward = dailyReward;
  }

  run.active = false;
  run.completed = !!cleared;
  run.failed = !cleared;
  run.battle = null;
  run.pendingEnhancements = null;
  run.eventId = null;
  run.eventResult = null;
  state.current.scene = "train";
  state.current.modal = "summary";
  state.current.modalData = { summary: summary, message: message || "" };
  pushLog(state, cleared ? "通关" : "探索终止", message || "");

  // 成就与图鉴放在最后检查：此时 progress 已经是最新值
  summary.unlockedAchievements = evaluateAchievements(state);
  checkCodexReward(state);
  return summary;
}

function abandonRun(state) {
  if (!state.run || !state.run.active) return { ok: false };
  endRun(state, false, "你主动结束了本次探索。");
  return { ok: true };
}

function closeSummary(state) {
  state.current.modal = null;
  state.current.modalData = null;
}

/* ---------------- 广告配额 ---------------- */

function canWatchAd(state, now) {
  var today = formatDateKey(now);
  if (state.meta.adViewDate !== today) {
    state.meta.adViewDate = today;
    state.meta.adViewsToday = 0;
  }
  return state.meta.adViewsToday < config.adDailyLimit;
}

module.exports = {
  // 基础
  createDefaultState: createDefaultState,
  formatDateKey: formatDateKey,
  parseDateKey: parseDateKey,
  clamp: clamp,
  // 局外
  handleDailyLogin: handleDailyLogin,
  restoreSanity: restoreSanity,
  sanityCooldownLeft: sanityCooldownLeft,
  claimFreeFood: claimFreeFood,
  usePortableFood: usePortableFood,
  upgradeCost: upgradeCost,
  upgradeTrain: upgradeTrain,
  grantCurrency: grantCurrency,
  spendCurrency: spendCurrency,
  grantItems: grantItems,
  // 局内
  startRun: startRun,
  getAvailableNodes: getAvailableNodes,
  travelTo: travelTo,
  // 战斗
  startBattle: startBattle,
  dismissBattleIntro: dismissBattleIntro,
  battleAction: battleAction,
  enemyTurn: enemyTurn,
  calcPlayerDamage: calcPlayerDamage,
  applyAdRevive: applyAdRevive,
  // 强化与遗物
  openEnhance: openEnhance,
  chooseEnhancement: chooseEnhancement,
  obtainRelic: obtainRelic,
  setProgress: setProgress,
  applySetBonuses: applySetBonuses,
  reconcileSets: reconcileSets,
  openChest: openChest,
  confirmChest: confirmChest,
  // 事件
  openEvent: openEvent,
  chooseEventOption: chooseEventOption,
  canChooseEventOption: canChooseEventOption,
  confirmEventResult: confirmEventResult,
  // 营地 / 商店
  campRest: campRest,
  campPrepare: campPrepare,
  shopPrice: shopPrice,
  buyItem: buyItem,
  // 结算
  computeSummary: computeSummary,
  endRun: endRun,
  abandonRun: abandonRun,
  closeSummary: closeSummary,
  // 图鉴 / 成就 / 每日挑战
  codexSummary: codexSummary,
  checkCodexReward: checkCodexReward,
  markEnemySeen: markEnemySeen,
  achievementCount: achievementCount,
  evaluateAchievements: evaluateAchievements,
  computeMetrics: computeMetrics,
  dailyInfo: dailyInfo,
  dailyUnlocked: dailyUnlocked,
  startDaily: startDaily,
  // 车厢主题
  modsOf: modsOf,
  themeSummary: themeSummary,
  themeUnlocked: themeUnlocked,
  selectedThemeId: selectedThemeId,
  selectTheme: selectTheme,
  unlockTheme: unlockTheme,
  // 广告
  canWatchAd: canWatchAd,
  pushLog: pushLog,
  makeLog: makeLog
};

});

define("js/game/storage.js", function(module, exports, require) {
/**
 * storage.js —— 存档：版本迁移 + 白名单深合并 + 数值夹取
 *
 * 三条硬约束：
 * 1. 读档绝不能让脏数据进运行时：类型不符回退默认值，数值全部 clamp。
 * 2. 场景与数据必须自洽：route 场景没有地图就退回主城；battle 弹窗没有战斗就关掉。
 * 3. 存档里不存函数、不存循环引用（强化/遗物只存 id + 展示字段）。
 */

var config = require("./config");
var stateApi = require("./state");
var themesApi = require("./data/themes");
var materialsApi = require("./data/materials");
var enemiesApi = require("./data/enemies");
var platform = require("../platform/platform");

var SCENES = { home: 1, train: 1, route: 1 };
var MODALS = {
  battle: 1, event: 1, eventResult: 1, enhance: 1, shop: 1,
  camp: 1, chest: 1, summary: 1, info: 1, settings: 1, trainUpgrade: 1, guide: 1,
  codex: 1, daily: 1, themes: 1
};

function toInt(value, min, max, fallback) {
  var n = Number(value);
  if (!isFinite(n)) return typeof fallback === "number" ? fallback : min;
  return Math.round(Math.max(min, Math.min(max, n)));
}

function readRaw(key) {
  var raw;
  try {
    raw = platform.readStorage(key);
  } catch (error) {
    return null;
  }
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }
  return raw;
}

function read() {
  var current = readRaw(config.storageKey);
  if (current) return current;
  var legacy = config.legacyKeys || [];
  var i;
  for (i = 0; i < legacy.length; i += 1) {
    var old = readRaw(legacy[i]);
    if (old) return old;
  }
  return null;
}

function clampPlayer(raw, base) {
  var p = raw || {};
  var inv = p.inventory || {};
  var maxHp = toInt(p.maxHp, 20, 500, config.maxHp);
  return {
    hp: toInt(p.hp, 0, maxHp, maxHp),
    maxHp: maxHp,
    hunger: toInt(p.hunger, 0, config.maxHunger, config.maxHunger),
    sanity: toInt(p.sanity, 0, config.maxSanity, config.maxSanity),
    ether: toInt(p.ether, 0, config.maxEther, config.starterEther),
    gold: toInt(p.gold, 0, config.maxGold, config.starterGold),
    baseAttack: toInt(p.baseAttack, 1, 999, config.baseAttack),
    inventory: {
      portableFood: toInt(inv.portableFood, 0, 99, 0),
      potion: toInt(inv.potion, 0, 99, 0),
      retryCard: toInt(inv.retryCard, 0, 99, 0),
      executeCard: toInt(inv.executeCard, 0, 99, 0)
    }
  };
}

function clampMeta(raw) {
  var m = raw || {};
  var pattern = /^\d{4}-\d{2}-\d{2}$/;
  var today = stateApi.formatDateKey(Date.now());
  return {
    createdAt: toInt(m.createdAt, 0, 9999999999999, Date.now()),
    lastLoginDate: pattern.test(m.lastLoginDate) ? m.lastLoginDate : today,
    loginStreak: toInt(m.loginStreak, 1, 9999, 1),
    lastFreeFoodDate: pattern.test(m.lastFreeFoodDate || "") ? m.lastFreeFoodDate : null,
    lastSanityRestoreAt: toInt(m.lastSanityRestoreAt, 0, 9999999999999, 0),
    adViewDate: pattern.test(m.adViewDate) ? m.adViewDate : today,
    adViewsToday: toInt(m.adViewsToday, 0, config.adDailyLimit, 0),
    tutorialSeen: m.tutorialSeen === true,
    totalPlayMs: toInt(m.totalPlayMs, 0, 9999999999999, 0),
    // 老存档只有 soundOn：映射到 sfxOn，BGM 默认开
    soundOn: m.soundOn !== false,
    bgmOn: m.bgmOn !== false,
    sfxOn: m.sfxOn !== undefined ? m.sfxOn !== false : m.soundOn !== false,
    vibrationOn: m.vibrationOn !== false
  };
}

/** 只保留「id → 数值」的映射，长度有上限，防止脏档撑爆存档体积 */
function sanitizeIdMap(raw, limit) {
  var out = {};
  if (!raw || typeof raw !== "object") return out;
  var count = 0;
  var key;
  for (key in raw) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    if (count >= limit) break;
    if (typeof key !== "string" || key.length > 40) continue;
    out[key] = 1;
    count += 1;
  }
  return out;
}

/** 敌人图鉴多一层「击败次数」 */
function sanitizeEnemyCodex(raw, limit) {
  var out = {};
  if (!raw || typeof raw !== "object") return out;
  var count = 0;
  var key;
  for (key in raw) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    if (count >= limit) break;
    if (typeof key !== "string" || key.length > 40) continue;
    var entry = raw[key];
    out[key] = {
      seen: entry && entry.seen === 0 ? 0 : 1,
      defeats: toInt(entry && entry.defeats, 0, 99999, 0)
    };
    count += 1;
  }
  return out;
}

/** 主题白名单：未知 id 一律丢弃（防改档写入不存在的主题导致渲染取不到配色） */
function sanitizeThemeList(raw) {
  var known = themesApi.ids();
  var out = ["rust"];
  if (!Array.isArray(raw)) return out;
  raw.forEach(function (id) {
    if (typeof id !== "string") return;
    if (known.indexOf(id) < 0) return;
    if (out.indexOf(id) >= 0) return;
    out.push(id);
  });
  return out;
}

function sanitizeThemeSelected(raw) {
  if (typeof raw !== "string") return "rust";
  return themesApi.getById(raw) ? raw : "rust";
}

function clampProgress(raw) {
  var p = raw || {};
  var up = p.trainUpgrades || {};
  var codex = p.codex || {};
  var stats = p.stats || {};
  var daily = p.daily || {};
  var achievements = {};
  var id;
  for (id in (p.achievements || {})) {
    if (!Object.prototype.hasOwnProperty.call(p.achievements, id)) continue;
    if (typeof id !== "string" || id.length > 40) continue;
    achievements[id] = toInt(p.achievements[id], 0, 9999999999999, Date.now());
  }
  return {
    runsStarted: toInt(p.runsStarted, 0, 999999, 0),
    runsCleared: toInt(p.runsCleared, 0, 999999, 0),
    bossClears: toInt(p.bossClears, 0, 999999, 0),
    bestLayer: toInt(p.bestLayer, 0, 99, 0),
    totalEther: toInt(p.totalEther, 0, 99999999, 0),
    trainUpgrades: {
      diner: toInt(up.diner, 0, 5, 0),
      medbay: toInt(up.medbay, 0, 5, 0),
      engine: toInt(up.engine, 0, 5, 0),
      cargo: toInt(up.cargo, 0, 5, 0),
      observatory: toInt(up.observatory, 0, 5, 0)
    },
    codex: {
      enemies: sanitizeEnemyCodex(codex.enemies, 200),
      relics: sanitizeIdMap(codex.relics, 200),
      enhancements: sanitizeIdMap(codex.enhancements, 200),
      tier: toInt(codex.tier, 0, 4, 0)
    },
    achievements: achievements,
    stats: {
      battlesWon: toInt(stats.battlesWon, 0, 9999999, 0),
      maxRelics: toInt(stats.maxRelics, 0, 99, 0),
      maxEnhancements: toInt(stats.maxEnhancements, 0, 99, 0),
      perfectBossWins: toInt(stats.perfectBossWins, 0, 99999, 0),
      lowSanityClears: toInt(stats.lowSanityClears, 0, 99999, 0),
      noRelicClears: toInt(stats.noRelicClears, 0, 99999, 0)
    },
    daily: {
      lastDate: /^\d{4}-\d{2}-\d{2}$/.test(daily.lastDate || "") ? daily.lastDate : null,
      streak: toInt(daily.streak, 0, 9999, 0),
      clears: toInt(daily.clears, 0, 999999, 0),
      attempts: toInt(daily.attempts, 0, 999999, 0),
      bestLayer: toInt(daily.bestLayer, -1, 99, -1)
    },
    // 主题：只接受 themes.js 里存在的 id，rust 永远解锁（防止改档锁死自己）
    themeUnlocked: sanitizeThemeList(p.themeUnlocked),
    themeSelected: sanitizeThemeSelected(p.themeSelected)
  };
}

/** 路线图重建：按 seed 重新生成，再用存档里记录的类型/访问状态覆盖 */
function sanitizeLayers(raw, seed) {
  if (!Array.isArray(raw) || !raw.length) return null;
  var mapApi = require("./map");
  var fresh = mapApi.generate(seed);
  if (fresh.length !== raw.length) return fresh;

  var i;
  var j;
  for (i = 0; i < fresh.length; i += 1) {
    if (!Array.isArray(raw[i]) || raw[i].length !== fresh[i].length) return fresh;
    for (j = 0; j < fresh[i].length; j += 1) {
      var saved = raw[i][j];
      if (!saved || typeof saved !== "object") return fresh;
      // 结构与生成器必须完全一致，否则视为脏档整体重建
      if (saved.id !== fresh[i][j].id) return fresh;
      fresh[i][j].type = typeof saved.type === "string" ? saved.type : fresh[i][j].type;
      fresh[i][j].visited = saved.visited === true;
    }
  }
  return fresh;
}

function clampStrings(list, limit) {
  if (!Array.isArray(list)) return [];
  return list.filter(function (item) {
    return item && typeof item === "object" && typeof item.id === "string";
  }).slice(0, limit).map(function (item) {
    return {
      id: item.id.slice(0, 40),
      name: typeof item.name === "string" ? item.name.slice(0, 20) : "",
      desc: typeof item.desc === "string" ? item.desc.slice(0, 80) : "",
      rarity: typeof item.rarity === "string" ? item.rarity : undefined
    };
  });
}

function sanitizeEffects(raw) {
  var effectsApi = require("./data/effects");
  var base = effectsApi.emptyEffects();
  if (!raw || typeof raw !== "object") return base;
  var key;
  for (key in base) {
    if (!Object.prototype.hasOwnProperty.call(base, key)) continue;
    if (typeof base[key] === "number") {
      base[key] = toInt(raw[key], -999, 9999, 0);
    } else if (typeof base[key] === "boolean") {
      base[key] = raw[key] === true;
    } else {
      base[key] = typeof raw[key] === "number" ? raw[key] : null;
    }
  }
  return base;
}

/**
 * 战斗材质：存档里可能没有（0.6 及更早的档）、也可能被改坏。
 * 优先信任合法值，其次按 enemyId 反查模板，最后回退材质默认值。
 * 这里绝不允许失败——材质只是表现层，读档不能因为它整局作废。
 */
function materialOf(raw) {
  if (materialsApi.isId(raw.material)) return raw.material;
  var template = enemiesApi.getById(raw.enemyId);
  if (template && materialsApi.isId(template.material)) return template.material;
  return materialsApi.DEFAULT;
}

/**
 * 战斗动作 id 白名单。
 * 「查票」靠 lastAction / prevAction 判定重复，这两个字段来自存档——
 * 不白名单化的话，改存档就能把任意字符串塞进战斗对象，进而影响伤害判定。
 */
function sanitizeActionId(value) {
  if (value === "precise" || value === "power" || value === "defend"
    || value === "potion" || value === "execute") return value;
  return null;
}

/**
 * 战斗预告（下一回合敌人要干什么）。
 * 只认白名单里的 kind，label/detail 截断长度：存档是可被改的，
 * 不能让一段任意文本顺着这里流进渲染层。
 */
function sanitizeTelegraph(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.kind !== "charge" && raw.kind !== "swarm" && raw.kind !== "weave") return null;
  return {
    kind: raw.kind,
    label: typeof raw.label === "string" ? raw.label.slice(0, 6) : "预警",
    detail: typeof raw.detail === "string" ? raw.detail.slice(0, 20) : "",
    log: ""
  };
}

function sanitizeBattle(raw) {
  if (!raw || typeof raw !== "object") return null;
  var maxHp = toInt(raw.maxHp, 1, 9999, 1);
  var logs = Array.isArray(raw.logs) ? raw.logs.filter(function (line) {
    return typeof line === "string";
  }).slice(0, 24) : [];
  return {
    kind: raw.kind === "elite" ? "elite" : raw.kind === "boss" ? "boss" : "normal",
    enemyId: typeof raw.enemyId === "string" ? raw.enemyId : "strayHound",
    name: typeof raw.name === "string" ? raw.name.slice(0, 20) : "未知敌人",
    // 材质只影响音色与粒子色：字段坏了就按 enemyId 反查模板，查不到回退默认
    material: materialOf(raw),
    figure: raw.figure === "boss" ? "boss" : raw.figure === "elite" ? "elite" : "normal",
    color: typeof raw.color === "string" ? raw.color : "#9FB0BA",
    trait: typeof raw.trait === "string" ? raw.trait : "normal",
    affix: typeof raw.affix === "string" ? raw.affix.slice(0, 24) : null,
    affixName: typeof raw.affixName === "string" ? raw.affixName.slice(0, 12) : null,
    affixDesc: typeof raw.affixDesc === "string" ? raw.affixDesc.slice(0, 60) : null,
    poison: toInt(raw.poison, 0, 9, 0),
    revived: raw.revived === true,
    // 战斗内的临时状态：不补这几个字段，读档后「被缠住的下一击」「胸口里的卵」会凭空消失
    egg: toInt(raw.egg, 0, 9, 0),
    webbed: raw.webbed === true,
    enraged: raw.enraged === true,
    strikeUsed: raw.strikeUsed === true,
    lastCrit: raw.lastCrit === true,
    intro: typeof raw.intro === "string" ? raw.intro.slice(0, 80) : "",
    // 登场卡开着时存档（比如切后台），读回来还得是开着的——否则玩家会看到
    // 一张没有标题、没有「迎战」按钮的战斗面板，不知道自己在等什么
    introOpen: raw.introOpen === true,
    introHint: typeof raw.introHint === "string" ? raw.introHint.slice(0, 60) : null,
    hp: toInt(raw.hp, 0, maxHp, maxHp),
    maxHp: maxHp,
    damageRange: Array.isArray(raw.damageRange) && raw.damageRange.length === 2
      ? [toInt(raw.damageRange[0], 1, 99, 5), toInt(raw.damageRange[1], 1, 99, 10)]
      : [5, 10],
    reward: {
      ether: toInt(raw.reward && raw.reward.ether, 0, 999, 0),
      gold: toInt(raw.reward && raw.reward.gold, 0, 99, 0)
    },
    boss: raw.boss === true,
    elite: raw.elite === true,
    // 阶段必须存下来：读档丢掉它，一场打到一半的 Boss 战会退回第一形态，
    // 伤害区间也跟着回退——玩家辛苦打掉的半管血等于白打
    phase: toInt(raw.phase, 1, 2, 1),
    // 形态名与段数：读档必须跟着回来。丢了它，UI 会把「双影」显示成默认的
    // 「第二阶段」，而两段攻击的形态会退化成一段——存档等于偷偷改了难度
    phaseLabel: typeof raw.phaseLabel === "string" && raw.phaseLabel
      ? raw.phaseLabel.slice(0, 6) : null,
    phaseHits: toInt(raw.phaseHits, 1, 3, 1),
    lastAction: sanitizeActionId(raw.lastAction),
    prevAction: sanitizeActionId(raw.prevAction),
    phaseBreak: raw.phaseBreak === true,
    enemyShield: toInt(raw.enemyShield, 0, 999, 0),
    playerShield: toInt(raw.playerShield, 0, 999, 0),
    turn: toInt(raw.turn, 1, 999, 1),
    defenseStance: raw.defenseStance === true,
    enemyCharge: toInt(raw.enemyCharge, 0, 9, 0),
    telegraph: sanitizeTelegraph(raw.telegraph),
    over: raw.over === true,
    result: raw.result === "lose" ? "lose" : null,
    logs: logs.length ? logs : ["战斗继续。"]
  };
}

/**
 * 每日挑战存档：限制条件不信任存档，按 dateKey 重新推导。
 * 这样即使存档被改，也不会造出「自己给自己发奖励」的挑战条件。
 */
function sanitizeDaily(raw) {
  if (!raw || typeof raw !== "object") return null;
  var dailyApi = require("./data/daily");
  var dateKey = typeof raw.dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.dateKey)
    ? raw.dateKey : null;
  if (!dateKey) return null;
  var seed = dailyApi.seedFromDate(dateKey);
  var modifiers = dailyApi.rollModifiers(seed);
  var wallet = raw.wallet && typeof raw.wallet === "object" ? raw.wallet : null;
  return {
    dateKey: dateKey,
    seed: seed,
    modifierIds: modifiers.map(function (m) { return m.id; }),
    modifierNames: modifiers.map(function (m) { return m.name; }),
    combined: dailyApi.combine(modifiers),
    wallet: {
      ether: toInt(wallet && wallet.ether, 0, config.maxEther, 0),
      gold: toInt(wallet && wallet.gold, 0, config.maxGold, 0),
      inventory: (function () {
        var inv = (wallet && wallet.inventory) || {};
        return {
          portableFood: toInt(inv.portableFood, 0, 99, 0),
          potion: toInt(inv.potion, 0, 99, 0),
          retryCard: toInt(inv.retryCard, 0, 99, 0),
          executeCard: toInt(inv.executeCard, 0, 99, 0)
        };
      })()
    }
  };
}

/**
 * 事件链进度：只保留登记过的链 id，数值夹在 0—段数之间。
 * 这里必须白名单化——否则改档写个 { someChain: 99 } 进来，
 * nextChainEvent 会取到 undefined 的段，表现为「点了事件没反应」。
 */
function sanitizeChains(raw) {
  var eventsApi = require("./data/events");
  var out = {};
  if (!raw || typeof raw !== "object") return out;
  var id;
  for (id in eventsApi.CHAINS) {
    if (!Object.prototype.hasOwnProperty.call(eventsApi.CHAINS, id)) continue;
    var total = eventsApi.CHAINS[id].stages.length;
    out[id] = toInt(raw[id], 0, total, 0);
  }
  return out;
}

/**
 * 序列档位记账：只保留已知序列 id，档位数夹在 0—该序列档位总数之间。
 * 这一项决定「奖励是否已经发过」，宁可少记也不能多记——多记会让读档后
 * 补算逻辑跳过应得的档位，玩家白丢属性。
 */
function sanitizeSetActive(raw) {
  var relicSetsApi = require("./data/relicSets");
  var out = {};
  if (!raw || typeof raw !== "object") return out;
  var i;
  for (i = 0; i < relicSetsApi.RELIC_SETS.length; i += 1) {
    var set = relicSetsApi.RELIC_SETS[i];
    var value = toInt(raw[set.id], 0, set.tiers.length, 0);
    if (value > 0) out[set.id] = value;
  }
  return out;
}

function sanitizeRun(raw) {
  var base = stateApi.createDefaultState(Date.now()).run;
  if (!raw || typeof raw !== "object" || raw.active !== true) return base;

  var seed = toInt(raw.seed, 1, 4294967295, 1);
  var layers = sanitizeLayers(raw.layers, seed);
  var run = {
    seed: seed,
    active: true,
    completed: false,
    failed: false,
    layers: layers || [],
    currentNodeId: typeof raw.currentNodeId === "string" ? raw.currentNodeId : null,
    layer: toInt(raw.layer, -1, 99, -1),
    route: Array.isArray(raw.route) ? raw.route.filter(function (t) { return typeof t === "string"; }).slice(0, 40) : [],
    nodesVisited: toInt(raw.nodesVisited, 0, 99, 0),
    battle: sanitizeBattle(raw.battle),
    eventId: typeof raw.eventId === "string" ? raw.eventId : null,
    eventChoiceIndex: toInt(raw.eventChoiceIndex, -1, 9, -1),
    eventResult: typeof raw.eventResult === "string" ? raw.eventResult.slice(0, 200) : null,
    eventFollowUp: typeof raw.eventFollowUp === "string" ? raw.eventFollowUp : null,
    pendingEnhancements: Array.isArray(raw.pendingEnhancements) ? clampStrings(raw.pendingEnhancements, 5) : null,
    pendingRelicId: typeof raw.pendingRelicId === "string" ? raw.pendingRelicId : null,
    daily: sanitizeDaily(raw.daily),
    effects: sanitizeEffects(raw.effects),
    relics: clampStrings(raw.relics, 30),
    setActive: sanitizeSetActive(raw.setActive),
    enhancements: clampStrings(raw.enhancements, 40),
    recentEvents: Array.isArray(raw.recentEvents)
      ? raw.recentEvents.filter(function (id) { return typeof id === "string"; }).slice(0, 3)
      : [],
    chains: sanitizeChains(raw.chains),
    theme: themesApi.getById(raw.theme) ? raw.theme : "rust",
    eventChain: raw.eventChain && typeof raw.eventChain === "object"
      ? {
        id: typeof raw.eventChain.id === "string" ? raw.eventChain.id.slice(0, 24) : null,
        name: typeof raw.eventChain.name === "string" ? raw.eventChain.name.slice(0, 20) : null,
        stage: toInt(raw.eventChain.stage, 1, 9, 1),
        total: toInt(raw.eventChain.total, 1, 9, 3)
      }
      : null,
    stats: {
      battlesWon: toInt(raw.stats && raw.stats.battlesWon, 0, 9999, 0),
      damageDealt: toInt(raw.stats && raw.stats.damageDealt, 0, 999999, 0),
      etherGained: toInt(raw.stats && raw.stats.etherGained, 0, 999999, 0),
      turns: toInt(raw.stats && raw.stats.turns, 0, 9999, 0),
      shopsVisited: toInt(raw.stats && raw.stats.shopsVisited, 0, 999, 0),
      hpAtBossWin: toInt(raw.stats && raw.stats.hpAtBossWin, 0, 9999, 0)
    }
  };

  // 自洽性修补
  var mapApi = require("./map");
  if (!run.layers.length) return base;
  if (run.currentNodeId && !mapApi.findById(run.layers, run.currentNodeId)) {
    run.currentNodeId = null;
    run.layer = -1;
  }
  return run;
}

function sanitizeCurrent(raw, run) {
  var c = raw || {};
  var scene = SCENES[c.scene] ? c.scene : "home";
  var modal = MODALS[c.modal] ? c.modal : null;
  var modalData = c.modalData && typeof c.modalData === "object" ? c.modalData : null;

  if (scene === "route" && (!run || !run.active)) {
    scene = "home";
    modal = null;
  }
  if (modal === "battle" && !(run && run.battle)) modal = null;
  if (modal === "enhance" && !(run && run.pendingEnhancements && run.pendingEnhancements.length)) modal = null;
  if (modal === "event" && !(run && run.eventId)) modal = null;
  if (modal === "eventResult" && !(run && run.eventResult)) modal = null;
  if (modal === "chest" && !(run && run.pendingRelicId)) modal = null;
  if (modal === "summary" && !(modalData && modalData.summary)) modal = null;

  return { scene: scene, modal: modal, modalData: modalData };
}

function sanitizeLogs(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(function (entry) {
    return entry && typeof entry === "object" && typeof entry.title === "string" && typeof entry.text === "string";
  }).slice(0, 20).map(function (entry) {
    return {
      id: typeof entry.id === "string" ? entry.id : String(Math.random()).slice(2),
      title: entry.title.slice(0, 12),
      text: entry.text.slice(0, 120)
    };
  });
}

function migrate(raw) {
  var base = stateApi.createDefaultState(Date.now());
  if (!raw || typeof raw !== "object") return base;

  var run = sanitizeRun(raw.run);
  var merged = {
    schemaVersion: config.schemaVersion,
    player: clampPlayer(raw.player, base.player),
    meta: clampMeta(raw.meta),
    progress: clampProgress(raw.progress),
    run: run,
    current: sanitizeCurrent(raw.current, run),
    logs: sanitizeLogs(raw.logs)
  };
  if (!merged.logs.length) merged.logs = base.logs;
  return merged;
}

function load() {
  var raw = read();
  if (!raw) return null;
  try {
    return migrate(raw);
  } catch (error) {
    return null;
  }
}

function save(data) {
  try {
    data.schemaVersion = config.schemaVersion;
    return platform.writeStorage(config.storageKey, data);
  } catch (error) {
    return false;
  }
}

function clear() {
  platform.removeStorage(config.storageKey);
  (config.legacyKeys || []).forEach(function (key) {
    platform.removeStorage(key);
  });
  return true;
}

module.exports = {
  load: load,
  save: save,
  clear: clear,
  migrate: migrate,
  sanitizeRun: sanitizeRun
};

});

define("js/game/ui-common.js", function(module, exports, require) {
/**
 * ui-common.js —— 游戏内共用视觉片段（HUD、标题栏、日志、资源条）
 *
 * 只做「画」，不做状态修改；所有可点元素通过 ui.pushHit 注册动作 id。
 */

var draw = require("../core/draw");
var ui = require("../core/ui");

var P = draw.PALETTE;

/** 顶部：标题 + 返回/设置按钮 */
function header(ctx, screen, title, subtitle, right) {
  var r = screen.header();
  var s = screen.s;
  draw.text(ctx, title, r.x, r.y + screen.px(2), {
    size: screen.fz(21),
    bold: true,
    color: P.ink
  });
  if (subtitle) {
    draw.text(ctx, subtitle, r.x, r.y + screen.px(30), {
      size: screen.fz(11),
      color: P.inkFaint
    });
  }
  if (right && right.label) {
    var w = Math.round(60 * s);
    var btn = { x: r.x + r.w - w, y: r.y + screen.px(4), w: w, h: Math.round(28 * s) };
    ui.button(ctx, {
      id: right.id,
      rect: btn,
      label: right.label,
      style: "ghost",
      size: screen.fz(12)
    });
  }
  return r;
}

/** 三资源条 + 货币（紧凑一行，占两行高度） */
function resourceBar(ctx, screen, state, rect) {
  var s = screen.s;
  var h = Math.round(10 * s);
  var labW = Math.round(26 * s);
  var rows = screen.col(rect, 3, Math.round(7 * s));
  var p = state.player;

  var items = [
    { label: "生命", value: p.hp, max: p.maxHp, color: "#D8574A" },
    { label: "饱食", value: p.hunger, max: 100, color: "#E0B15C" },
    { label: "精神", value: p.sanity, max: 100, color: "#4FC0B0" }
  ];

  var i;
  for (i = 0; i < items.length; i += 1) {
    var row = rows[i];
    var item = items[i];
    draw.text(ctx, item.label, row.x, row.y + row.h / 2 - screen.fz(9) * 0.7, {
      size: screen.fz(9),
      color: P.inkFaint
    });
    var barRect = {
      x: row.x + labW,
      y: row.y + (row.h - h) / 2,
      w: row.w - labW - Math.round(46 * s),
      h: h
    };
    draw.bar(ctx, barRect, item.value / item.max, {
      color: item.color,
      track: "rgba(255,255,255,0.09)"
    });
    draw.text(ctx, Math.round(item.value) + "/" + Math.round(item.max), row.x + row.w, row.y + row.h / 2 - screen.fz(9) * 0.7, {
      size: screen.fz(9),
      color: P.inkDim,
      align: "right"
    });
  }

  // 货币行
  var moneyY = rect.y + rect.h + Math.round(6 * s);
  draw.text(ctx, "以太 " + Math.round(p.ether) + "   金币 " + Math.round(p.gold), rect.x, moneyY, {
    size: screen.fz(11),
    color: P.gold,
    bold: true
  });
  return moneyY;
}

/** 道具栏：4 个格子，可点 */
function inventoryBar(ctx, screen, state, rect, opts) {
  var s = screen.s;
  var cells = screen.row(rect, 4, Math.round(8 * s));
  var itemsApi = require("./data/items");
  var order = ["portableFood", "potion", "retryCard", "executeCard"];
  var enabled = opts && opts.enabled;
  var i;
  for (i = 0; i < order.length; i += 1) {
    var key = order[i];
    var def = itemsApi.ITEMS[key];
    var count = state.player.inventory[key] || 0;
    var cell = cells[i];
    var usable = enabled && count > 0;
    ui.button(ctx, {
      id: "item:" + key,
      rect: cell,
      label: def.name.slice(0, 2) + " ×" + count,
      style: usable ? "ghost" : "ghost",
      disabled: !usable,
      size: screen.fz(11)
    });
  }
}

/** 日志区：最近 3 条 */
function logPanel(ctx, screen, state, rect) {
  var s = screen.s;
  draw.panel(ctx, rect, { radius: Math.round(10 * s), fillTop: "#111F29", fillBottom: "#0C1820" });
  var pad = Math.round(10 * s);
  var y = rect.y + pad;
  var logs = state.logs.slice(0, 3);
  var i;
  for (i = 0; i < logs.length; i += 1) {
    var alpha = 1 - i * 0.28;
    var line = "[" + logs[i].title + "] " + logs[i].text;
    var used = draw.text(ctx, line, rect.x + pad, y, {
      size: screen.fz(10),
      color: P.inkDim,
      wrap: rect.w - pad * 2,
      lineHeight: Math.round(13 * s),
      alpha: alpha
    });
    y += used + Math.round(4 * s);
    if (y > rect.y + rect.h - Math.round(12 * s)) break;
  }
}

/** 节点圆标：类型色圆 + 单字 */
function nodeMark(ctx, screen, nodeDef, cx, cy, radius, opts) {
  var o = opts || {};
  var s = screen.s;
  ctx.save();
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;

  if (o.glow) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius + Math.round(5 * s), 0, Math.PI * 2);
    ctx.fillStyle = "rgba(224,177,92,0.22)";
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = o.fill || "#132633";
  ctx.fill();
  ctx.lineWidth = o.selected ? Math.round(2.5 * s) : Math.round(1.6 * s);
  ctx.strokeStyle = o.stroke || nodeDef.color;
  ctx.stroke();

  // 图标用几何图形，不用「战/精/商」这类首字：字形在不同机型上字重不一，且与界面脱节
  draw.nodeGlyph(ctx, cx, cy, radius * 0.62, nodeDef.glyph, o.labelColor || nodeDef.color);
  ctx.restore();
}

/** 小标题 + 分割线 */
function sectionTitle(ctx, screen, label, x, y, width) {
  return ui.section(ctx, label, x, y, width);
}

/** 空态提示 */
function empty(ctx, screen, text, rect) {
  draw.text(ctx, text, rect.x + rect.w / 2, rect.y + rect.h / 2, {
    size: screen.fz(12),
    color: P.inkFaint,
    align: "center"
  });
}

/** 弹窗信封：返回面板矩形（居中、留边、不超屏） */
function modalPanel(screen, heightPx) {
  var maxH = screen.height - screen.safeTop - screen.safeBottom - screen.px(36);
  var h = Math.min(maxH, heightPx || screen.px(460));
  var w = screen.width - screen.pad * 2;
  return { x: screen.pad, y: (screen.height - h) / 2, w: w, h: h };
}

/** 弹窗内的标题区，返回内容起始 y */
function modalTitle(ctx, screen, panel, title, subtitle) {
  var s = screen.s;
  var pad = screen.px(16);
  draw.text(ctx, title, panel.x + pad, panel.y + pad, {
    size: screen.fz(18),
    bold: true,
    color: P.ink
  });
  var y = panel.y + pad + screen.px(28);
  if (subtitle) {
    draw.text(ctx, subtitle, panel.x + pad, y, {
      size: screen.fz(11),
      color: P.inkFaint
    });
    y += screen.px(18);
  }
  return y;
}

module.exports = {
  header: header,
  resourceBar: resourceBar,
  inventoryBar: inventoryBar,
  logPanel: logPanel,
  nodeMark: nodeMark,
  sectionTitle: sectionTitle,
  empty: empty,
  modalPanel: modalPanel,
  modalTitle: modalTitle
};

});

define("js/main.js", function(module, exports, require) {
/**
 * main.js —— 装配层：画布 / 状态 / 存档 / 广告 / 调度
 *
 * 这里是唯一把「引擎、平台、玩法」接在一起的地方。
 * 场景与弹窗只拿到 app 门面，不直接碰 storage / tt / canvas。
 */

var platform = require("./platform/platform");
var storage = require("./game/storage");
var stateApi = require("./game/state");
var config = require("./game/config");
var registry = require("./game/registry");
var createScreen = require("./core/screen").createScreen;
var createEngine = require("./core/engine");
var createAdManager = require("./platform/ad");
var audioApi = require("./platform/audio");
var bgmApi = require("./platform/bgm");
var diagnosticsApi = require("./platform/diagnostics");
var text = require("./game/data/text");

/* ---------------- 画布 ---------------- */

var systemInfo = platform.getSystemInfo();
var screen = createScreen(systemInfo);
var canvas = platform.createMainCanvas(screen.width, screen.height);

function applyCanvasSize(info) {
  var next = createScreen(info);
  var dpr = next.dpr || 2;
  canvas.width = Math.round(next.width * dpr);
  canvas.height = Math.round(next.height * dpr);
  if (canvas.style) {
    canvas.style.width = next.width + "px";
    canvas.style.height = next.height + "px";
  }
  var context = canvas.getContext("2d");
  if (dpr !== 1 && context && typeof context.setTransform === "function") {
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  } else if (dpr !== 1 && context && typeof context.scale === "function") {
    context.scale(dpr, dpr);
  }
  screen = next;
  return context;
}

var ctx = applyCanvasSize(systemInfo);

/* ---------------- 状态 ---------------- */

var state = storage.load();
if (!state) {
  state = stateApi.createDefaultState(platform.now());
}
stateApi.handleDailyLogin(state, platform.now());
// 老存档（序列上线前）没有 setActive 记账，这里补发应得的序列档位；
// 已有记账的存档调用是空操作，不会二次加属性。
stateApi.reconcileSets(state);

/* ---------------- 存档（节流 + 后台立即落盘） ---------------- */

var saveTimer = null;
var savePending = false;

function doSave() {
  storage.save(state);
}

function commit() {
  savePending = true;
  if (saveTimer) return;
  saveTimer = setTimeout(function () {
    saveTimer = null;
    if (savePending) {
      savePending = false;
      doSave();
    }
  }, config.saveThrottleMs || 500);
}

function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  savePending = false;
  doSave();
}

/* ---------------- 音效 ---------------- */

var audio = audioApi.createAudio({
  basePath: config.audio.sfxBasePath,
  enabled: state.meta.sfxOn !== false
});

var bgm = bgmApi.createBgm({
  basePath: config.audio.bgmBasePath,
  volume: config.audio.bgmVolume,
  fadeMs: config.audio.bgmFadeMs,
  enabled: state.meta.bgmOn !== false
});

/* ---------------- 诊断 ---------------- */

var diagnostics = diagnosticsApi.createDiagnostics();
diagnostics.install();
diagnostics.info("boot", "启动完成，版本 schema " + state.schemaVersion);

/** 场景/弹窗变化后选曲：战斗优先于场景，结算回主城曲 */
function syncBgm() {
  if (state.meta.bgmOn === false) {
    bgm.stop(false);
    return;
  }
  var track;
  if (state.current.modal === "battle" && state.run && state.run.battle) {
    track = config.audio.trackBattle;
  } else if (state.current.scene === "route") {
    track = config.audio.trackByScene.route || "bgm_route";
  } else {
    track = config.audio.trackByScene[state.current.scene] || "bgm_home";
  }
  if (bgm.currentName() !== track) {
    diagnostics.info("bgm", "切换 " + track);
    bgm.play(track);
  }
}

/* ---------------- 广告 ---------------- */

var engine = null;

var adManager = createAdManager(function (message) {
  if (engine) engine.toast(message);
});

function requestAd(kind, onReward) {
  if (!stateApi.canWatchAd(state, platform.now())) {
    if (engine) engine.toast("今日广告次数已用完");
    return;
  }
  adManager.showRewarded({
    onReward: function () {
      onReward();
      flushSave();
    },
    onCancel: function (payload) {
      if (engine && payload && payload.reason === "not-ended") {
        engine.toast("未看完广告，本次不发放奖励");
      }
      commit();
    }
  });
}

/* ---------------- app 门面 ---------------- */

var app = {
  get state() { return state; },
  now: function () { return platform.now(); },
  commit: commit,
  toast: function (message) {
    if (engine) engine.toast(message);
  },
  vibrate: function () {
    if (state.meta.vibrationOn === false) return;
    platform.vibrateShort();
  },
  /** 音效：喊名字即可，平台差异由 platform/audio 消化 */
  sound: function (name, volume) {
    audio.play(name, volume);
  },
  applyAudioSetting: function () {
    var sfxOn = state.meta.sfxOn !== false;
    var bgmOn = state.meta.bgmOn !== false;
    audio.setEnabled(sfxOn);
    if (!sfxOn) audio.pauseAll();
    bgm.setEnabled(bgmOn);
    syncBgm();
    diagnostics.info("audio", "sfx=" + sfxOn + " bgm=" + bgmOn);
  },
  /** 兼容旧调用点 */
  applySoundSetting: function () {
    app.applyAudioSetting();
  },
  copyDiagnostics: function () {
    var textDump = diagnostics.snapshot(state) + "\n--- 帧率 ---\n" + (engine && engine.getPerf ? engine.getPerf() : "n/a");
    platform.setClipboard(textDump, function (ok) {
      app.toast(ok ? "诊断信息已复制" : "复制失败，可截图反馈");
    });
    diagnostics.info("diag", "导出诊断信息");
  },
  /** 特效层：伤害飘字 / 粒子 / 震屏，由场景按需调用 */
  fx: function () { return engine ? engine.fx : null; },
  go: function (sceneId) {
    if (!registry.scenes[sceneId]) return;
    state.current.scene = sceneId;
    state.current.modal = null;
    state.current.modalData = null;
    commit();
    syncBgm();
    if (engine) engine.transition();
  },
  openModal: function (modalId, data) {
    state.current.modal = modalId;
    state.current.modalData = data || null;
    commit();
    syncBgm();
  },
  openInfo: function (view) {
    state.current.modal = "info";
    state.current.modalData = { view: view };
    commit();
  },
  closeModal: function () {
    state.current.modal = null;
    state.current.modalData = null;
    commit();
    syncBgm();
  },
  share: function (options) {
    platform.share(options, function (ok) {
      if (!ok && engine) engine.toast("分享未完成");
    });
  },
  requestAd: requestAd,
  get animator() { return engine ? engine.animator : null; },
  resetSave: function () {
    storage.clear();
    state = stateApi.createDefaultState(platform.now());
    stateApi.handleDailyLogin(state, platform.now());
    flushSave();
    if (engine) {
      engine.toast("存档已重置");
      engine.invalidate();
    }
  }
};

/* ---------------- 调度 ---------------- */

function dispatch(action) {
  try {
    var modalId = state.current.modal;
    if (modalId) {
      var modal = registry.modals[modalId];
      if (modal && typeof modal.onAction === "function" && modal.onAction(action, state, app)) {
        syncBgm();
        return;
      }
      // 弹窗存在时，底下的场景不允许穿透点击
      return;
    }
    var scene = registry.scenes[state.current.scene];
    if (scene && typeof scene.onAction === "function" && scene.onAction(action, state, app)) {
      syncBgm();
      return;
    }
  } catch (error) {
    // 一次点击出错不应该让整个游戏停摆：记录并提示，继续渲染
    diagnostics.error("dispatch", (action && action.id) + " " + (error && error.message));
    platform.reportError(error, "dispatch:" + (action && action.id));
    if (engine) engine.toast("操作出错了，已记录");
  }
}

/* ---------------- 引擎 ---------------- */

/**
 * 哪些视图需要「待机动画」（即持续重绘）。
 * 只有战斗值得：那里有活物在呼吸与扑咬。路线图、主界面都是静态排版，
 * 为了一个呼吸动作把帧率与电池烧掉不划算——引擎会按 12fps 限速，但那是下限不是免费。
 */
function isLiveView(s) {
  return s.current.modal === "battle";
}

engine = createEngine({
  canvas: canvas,
  ctx: ctx,
  screen: screen,
  platform: platform,
  audio: audio,
  instrument: !config.perf || config.perf.instrument !== false,
  isLiveView: isLiveView,
  scenes: registry.scenes,
  modals: registry.modals,
  getState: function () { return state; },
  getSceneId: function (s) { return s.current.scene; },
  getModalId: function (s) { return s.current.modal; },
  dispatch: dispatch
});

/* ---------------- 生命周期 ---------------- */

platform.onHide(function () {
  flushSave();
  audio.pauseAll();
  bgm.pause();
});

platform.onShow(function () {
  try {
    stateApi.handleDailyLogin(state, platform.now());
    commit();
    syncBgm();
    bgm.resume();
    if (engine) engine.invalidate();
  } catch (error) {
    diagnostics.error("onshow", error && error.message);
    platform.reportError(error, "onshow");
  }
});

platform.onWindowResize(function (info) {
  systemInfo = info;
  var nextCtx = applyCanvasSize(info);
  // 重建引擎以拿到新的 screen（场景只依赖传入的 screen，无内部状态）
  engine = createEngine({
    canvas: canvas,
    ctx: nextCtx,
    screen: screen,
    platform: platform,
    audio: audio,
    instrument: !config.perf || config.perf.instrument !== false,
    isLiveView: isLiveView,
    scenes: registry.scenes,
    modals: registry.modals,
    getState: function () { return state; },
    getSceneId: function (s) { return s.current.scene; },
    getModalId: function (s) { return s.current.modal; },
    dispatch: dispatch
  });
  engine.bindInput();
  engine.start();
});

platform.enableShare({ title: text.share.title });

engine.bindInput();
engine.start();
syncBgm();
commit();
diagnostics.info("boot", "引擎启动，场景 " + state.current.scene);

// 无头测试入口：只有显式设置 global.__TM_TEST__ 才暴露
if (typeof global !== "undefined" && global.__TM_TEST__) {
  global.__TM_TEST__ = {
    getState: function () { return state; },
    getEngine: function () { return engine; },
    getScreen: function () { return screen; },
    dispatch: dispatch,
    app: app,
    diagnostics: diagnostics,
    bgm: bgm,
    resetSave: app.resetSave,
    flush: flushSave
  };
}

});

define("js/platform/ad.js", function(module, exports, require) {
/**
 * ad.js —— 激励视频封装（含风控）
 *
 * 风控要点：
 * 1. 未配置广告位 / 加载失败 / onError → 一律不发奖。
 * 2. onClose 必须 isEnded 为真，且用 once 锁保证只发一次。
 * 3. onError 不把 available 永久置 false，只做 15 秒冷却。
 */

var config = require("../game/config");
var platform = require("./platform");

var RETRY_COOLDOWN_MS = 15000;

function createAdManager(onLog) {
  var ad = null;
  var initialized = false;
  var loading = false;
  var lastErrorAt = 0;

  function log(text) {
    if (typeof onLog === "function") onLog(text);
  }

  function isConfigured() {
    return platform.isTT() &&
      typeof tt.createRewardedVideoAd === "function" &&
      !!config.rewardedVideoAdUnitId &&
      config.rewardedVideoAdUnitId.indexOf("REPLACE") !== 0;
  }

  function init() {
    if (initialized) return !!ad;
    initialized = true;
    if (!isConfigured()) {
      log("未配置广告位，激励视频不可用（不发奖）。");
      return false;
    }
    try {
      ad = tt.createRewardedVideoAd({ adUnitId: config.rewardedVideoAdUnitId });
      ad.onError(function (err) {
        lastErrorAt = Date.now();
        log("广告不可用（" + ((err && (err.errCode || err.errorCode)) || "unknown") + "）。");
      });
      if (typeof ad.load === "function") ad.load().catch(function () {});
      return true;
    } catch (error) {
      ad = null;
      log("广告实例初始化失败（不发奖）。");
      return false;
    }
  }

  function showRewarded(options) {
    var onReward = (options && options.onReward) || function () {};
    var onCancel = (options && options.onCancel) || function () {};
    init();

    if (!ad) {
      log("激励视频暂不可用，本次不发放奖励。");
      onCancel({ reason: "unavailable" });
      return;
    }
    if (loading) {
      onCancel({ reason: "busy" });
      return;
    }
    if (lastErrorAt && Date.now() - lastErrorAt < RETRY_COOLDOWN_MS) {
      onCancel({ reason: "cooldown" });
      return;
    }

    loading = true;
    var finished = false;

    function finish(ok, payload) {
      if (finished) return;
      finished = true;
      loading = false;
      if (typeof ad.offClose === "function") ad.offClose(closeHandler);
      if (ok) {
        onReward(payload || { isEnded: true });
      } else {
        onCancel(payload || { reason: "not-ended" });
      }
    }

    function closeHandler(res) {
      if (res && res.isEnded) {
        finish(true, res);
      } else {
        log("激励视频未看完，本次不发放奖励。");
        finish(false, { reason: "not-ended" });
      }
    }

    ad.onClose(closeHandler);

    ad.show().catch(function () {
      return ad.load().then(function () { return ad.show(); });
    }).catch(function (err) {
      lastErrorAt = Date.now();
      log("广告展示失败（" + ((err && (err.errCode || err.errorCode)) || "unknown") + "）。");
      finish(false, { reason: "error" });
    });
  }

  return {
    init: init,
    showRewarded: showRewarded,
    isAvailable: function () { return !!ad; }
  };
}

module.exports = createAdManager;

});

define("js/platform/audio.js", function(module, exports, require) {
/**
 * platform/audio.js —— 音效播放（tt / 浏览器 / Node 三态）
 *
 * 设计约束：
 * - 音效是「锦上添花」，任何一步失败都必须静默降级，绝不能因为音频炸掉游戏。
 * - 每个音效维持一个小池（同一帧多次触发不互相掐断）。
 * - Node（无头测试）下整体是空实现，不产生定时器与句柄，避免测试挂住进程。
 * - 关音效只关播放，不销毁实例，切回来立刻有声。
 */

/**
 * 音效清单 = assets/audio 里实际存在的文件。
 * 名字写错了不会报错，只会静默无声——所以 test-headless 会校验
 * 「数据层引用的音效名都在这里，且对应 wav 文件真的存在」。
 *
 * hit_* 是打击的材质层（见 game/data/materials.js）：
 * 同一套「出手」动作，打铁、打肉、打布、打虚空听感必须不同。
 */
var SOUND_NAMES = [
  "tap", "bow", "hit", "crit", "shield", "heal",
  "coin", "win", "lose", "step", "select", "alert",
  "hit_metal", "hit_flesh", "hit_cloth", "hit_void"
];

var DEFAULT_BASE = "assets/audio/";

function createAudio(options) {
  var opts = options || {};
  var base = opts.basePath || DEFAULT_BASE;
  var poolSize = opts.poolSize || 2;
  var isNodeEnv = typeof window === "undefined" && typeof tt === "undefined";
  var isTTEnv = typeof tt !== "undefined" && tt && typeof tt.createInnerAudioContext === "function";
  var isBrowser = !isNodeEnv && typeof window !== "undefined" && typeof window.Audio === "function";

  var pools = {};
  var cursor = {};
  var enabled = opts.enabled !== false;

  function url(name) {
    return base + name + ".wav";
  }

  function buildOne(name) {
    if (isTTEnv) {
      try {
        var ctx = tt.createInnerAudioContext();
        ctx.src = url(name);
        ctx.volume = 1;
        // 小游戏里 audio 出错（缺文件/解码失败）不应打断任何逻辑
        ctx.onError(function () {});
        return ctx;
      } catch (error) {
        return null;
      }
    }
    if (isBrowser) {
      try {
        var el = new window.Audio(url(name));
        el.preload = "auto";
        return el;
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  /**
   * 按需建池：只有真的播到某个音效时才建它的实例。
   * 一次性把 16 个音效全建出来会瞬间占用 32 个 InnerAudioContext，
   * 低端机上容易撞到宿主上限（超出的会静默失败，听起来像「音效丢了」）。
   */
  function buildPool(name) {
    if (pools[name]) return pools[name];
    var list = [];
    if (!isNodeEnv) {
      var k;
      for (k = 0; k < poolSize; k += 1) {
        var item = buildOne(name);
        if (item) list.push(item);
      }
    }
    pools[name] = list;
    cursor[name] = 0;
    return list;
  }

  /** 预热（可选）：想提前建满所有池时调用，正常流程不需要 */
  function init() {
    var i;
    for (i = 0; i < SOUND_NAMES.length; i += 1) buildPool(SOUND_NAMES[i]);
  }

  function play(name, volume) {
    if (!enabled) return;
    var list = buildPool(name);
    if (!list || !list.length) return;
    var index = cursor[name] % list.length;
    cursor[name] = index + 1;
    var item = list[index];
    try {
      if (isTTEnv) {
        // InnerAudioContext 重复 play 前必须 stop，否则第二次无声
        item.stop();
        if (typeof volume === "number") item.volume = Math.max(0, Math.min(1, volume));
        item.play();
      } else if (isBrowser) {
        item.currentTime = 0;
        if (typeof volume === "number") item.volume = Math.max(0, Math.min(1, volume));
        var p = item.play();
        if (p && typeof p.catch === "function") p.catch(function () {});
      }
    } catch (error) {
      /* 静默：音效失败不影响玩法 */
    }
  }

  function setEnabled(value) {
    enabled = value !== false;
  }

  function isEnabled() {
    return enabled;
  }

  /** 切后台时暂停所有实例，回前台不需要恢复（都是短音效） */
  function pauseAll() {
    var name;
    for (name in pools) {
      if (!Object.prototype.hasOwnProperty.call(pools, name)) continue;
      var list = pools[name];
      var i;
      for (i = 0; i < list.length; i += 1) {
        try {
          list[i].stop();
        } catch (error) { /* ignore */ }
      }
    }
  }

  return {
    play: play,
    init: init,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    pauseAll: pauseAll,
    SOUND_NAMES: SOUND_NAMES
  };
}

module.exports = {
  createAudio: createAudio,
  SOUND_NAMES: SOUND_NAMES
};

});

define("js/platform/bgm.js", function(module, exports, require) {
/**
 * platform/bgm.js —— 背景音乐（loop / 淡入淡出 / 三态降级）
 *
 * 与音效分开成两个通道，原因是它们的失败模式不同：
 * - 音效失败顶多「没声音」，音乐失败可能卡住启动（大文件解码慢）。
 * - 玩家也常常只想静音音乐、保留音效。
 *
 * 约束：Node（无头测试）下完全空实现，不建实例、不建定时器。
 */

function createBgm(options) {
  var opts = options || {};
  var base = opts.basePath || "assets/audio/";
  var volume = typeof opts.volume === "number" ? opts.volume : 0.42;
  var fadeMs = typeof opts.fadeMs === "number" ? opts.fadeMs : 600;
  var isNodeEnv = typeof window === "undefined" && typeof tt === "undefined";
  var isTTEnv = typeof tt !== "undefined" && tt && typeof tt.createInnerAudioContext === "function";
  var isBrowser = !isNodeEnv && typeof window !== "undefined" && typeof window.Audio === "function";

  var enabled = opts.enabled !== false;
  var currentName = null;
  var current = null;
  var fadeTimer = null;

  function build(name) {
    if (isTTEnv) {
      try {
        var ctx = tt.createInnerAudioContext();
        ctx.src = base + name + ".wav";
        ctx.loop = true;
        ctx.volume = 0;
        ctx.onError(function () {});
        return ctx;
      } catch (error) {
        return null;
      }
    }
    if (isBrowser) {
      try {
        var el = new window.Audio(base + name + ".wav");
        el.loop = true;
        el.volume = 0;
        return el;
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  function clearFade() {
    if (fadeTimer) {
      clearTimeout(fadeTimer);
      fadeTimer = null;
    }
  }

  /** 音量渐变：短步进，避免 tt 容器上直接改 volume 造成爆音 */
  function fadeTo(target, done) {
    if (!current) return;
    var from = typeof current.volume === "number" ? current.volume : 0;
    if (isNodeEnv) return;
    var steps = 8;
    var step = 0;
    clearFade();
    function tick() {
      step += 1;
      var k = step / steps;
      try {
        current.volume = Math.max(0, Math.min(1, from + (target - from) * k));
      } catch (error) { /* ignore */ }
      if (step >= steps) {
        fadeTimer = null;
        if (done) done();
        return;
      }
      fadeTimer = setTimeout(tick, Math.max(16, fadeMs / steps));
    }
    fadeTimer = setTimeout(tick, Math.max(16, fadeMs / steps));
  }

  function safePlay(ctx) {
    try {
      var p = ctx.play();
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (error) { /* 自动播放被拦：静默，等下一次切曲再试 */ }
  }

  function play(name) {
    if (!enabled || !name) return;
    if (currentName === name) return;
    stop(true);
    currentName = name;
    current = build(name);
    if (!current) return;
    safePlay(current);
    fadeTo(volume);
  }

  function stop(immediate) {
    clearFade();
    if (!current) {
      currentName = null;
      return;
    }
    var ctx = current;
    current = null;
    currentName = null;
    if (immediate) {
      try { ctx.stop(); } catch (error) { /* ignore */ }
      return;
    }
    try { ctx.stop(); } catch (error) { /* ignore */ }
  }

  function setEnabled(value) {
    enabled = value !== false;
    if (!enabled) {
      stop(false);
    }
    return enabled;
  }

  function isEnabled() {
    return enabled;
  }

  function pause() {
    clearFade();
    if (!current) return;
    try { current.pause(); } catch (error) { /* ignore */ }
  }

  function resume() {
    if (!enabled || !current) return;
    safePlay(current);
    fadeTo(volume);
  }

  return {
    play: play,
    stop: stop,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    pause: pause,
    resume: resume,
    currentName: function () { return currentName; }
  };
}

module.exports = {
  createBgm: createBgm
};

});

define("js/platform/diagnostics.js", function(module, exports, require) {
/**
 * platform/diagnostics.js —— 运行诊断：环形日志 + 环境快照
 *
 * 为什么需要：小游戏上线后最痛的是「用户说闪退但你复现不了」。
 * 环形日志只保留最近 N 条，成本极低，但能把「他在哪个界面、什么机型、卡在哪一步」带回来。
 *
 * 约束：不落盘（避免写坏存档）、不弹窗、任何异常都吞掉。
 */

var MAX_ENTRIES = 60;

function createDiagnostics(options) {
  var opts = options || {};
  var entries = [];
  var startedAt = Date.now();
  var isNodeEnv = typeof window === "undefined" && typeof tt === "undefined";

  function stamp() {
    var ms = Date.now() - startedAt;
    return (ms / 1000).toFixed(1) + "s";
  }

  function push(level, tag, message) {
    try {
      entries.push({
        t: stamp(),
        level: level || "info",
        tag: tag || "-",
        msg: String(message === undefined ? "" : message).slice(0, 200)
      });
      if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
    } catch (error) { /* 诊断本身绝不能抛 */ }
  }

  function info(tag, message) { push("info", tag, message); }
  function warn(tag, message) { push("warn", tag, message); }
  function error(tag, message) { push("error", tag, message); }

  function envSnapshot() {
    var out = [];
    try {
      if (typeof tt !== "undefined" && tt && typeof tt.getSystemInfoSync === "function") {
        var sys = tt.getSystemInfoSync() || {};
        out.push("平台=" + (sys.platform || "?") + " 系统=" + (sys.system || "?"));
        out.push("机型=" + (sys.model || "?") + " 抖音=" + (sys.appVersion || "?"));
        out.push("屏幕=" + sys.screenWidth + "x" + sys.screenHeight + " dpr=" + sys.pixelRatio);
        out.push("基础库=" + (sys.SDKVersion || "?"));
      } else if (!isNodeEnv) {
        out.push("平台=browser 视口=" + window.innerWidth + "x" + window.innerHeight + " dpr=" + window.devicePixelRatio);
      } else {
        out.push("平台=node");
      }
    } catch (e) {
      out.push("环境信息读取失败");
    }
    return out;
  }

  function snapshot(state) {
    var lines = [];
    lines.push("=== 列车秘境 诊断信息 ===");
    lines.push("时间=" + new Date().toISOString());
    var env = envSnapshot();
    var i;
    for (i = 0; i < env.length; i += 1) lines.push(env[i]);
    if (state) {
      try {
        lines.push("版本=schema " + state.schemaVersion + " 局数=" + state.progress.runsStarted + " 通关=" + state.progress.bossClears);
        lines.push("进度=图鉴 " + Object.keys(state.progress.codex.enemies || {}).length + " 敌 成就 " +
          Object.keys(state.progress.achievements || {}).length + " 条");
        lines.push("当前=场景 " + state.current.scene + " 弹窗 " + (state.current.modal || "无"));
        lines.push("玩家=HP " + Math.round(state.player.hp) + "/" + state.player.maxHp +
          " 饱食 " + Math.round(state.player.hunger) + " 精神 " + Math.round(state.player.sanity));
      } catch (e) {
        lines.push("状态读取失败");
      }
    }
    lines.push("--- 最近日志 ---");
    for (i = entries.length - 1; i >= 0; i -= 1) {
      var item = entries[i];
      lines.push("[" + item.t + "][" + item.level + "][" + item.tag + "] " + item.msg);
    }
    return lines.join("\n");
  }

  /** 挂全局异常：抖音走 tt.onError，浏览器走 window.onerror */
  function install() {
    try {
      if (typeof tt !== "undefined" && tt && typeof tt.onError === "function") {
        tt.onError(function (err) {
          error("tt", (err && (err.message || err.errMsg)) || "unknown");
        });
      }
      if (!isNodeEnv && typeof window !== "undefined" && window.addEventListener) {
        window.addEventListener("error", function (event) {
          error("window", (event && event.message) || "unknown");
        });
        window.addEventListener("unhandledrejection", function (event) {
          var reason = event && event.reason;
          error("promise", (reason && reason.message) || String(reason));
        });
      }
    } catch (e) { /* ignore */ }
  }

  return {
    info: info,
    warn: warn,
    error: error,
    snapshot: snapshot,
    install: install,
    entries: function () { return entries.slice(); },
    clear: function () { entries.length = 0; }
  };
}

module.exports = {
  createDiagnostics: createDiagnostics
};

});

define("js/platform/platform.js", function(module, exports, require) {
/**
 * platform.js —— 平台能力薄封装（抖音小游戏 / 浏览器 / Node 无头三态）
 *
 * 三态的意义：
 * - 抖音：走 tt.* 真实能力
 * - 浏览器：走 DOM（本地调试）
 * - Node：返回 stub，供 tools/test-headless.js 跑完整链路
 */

function isTT() {
  return typeof tt !== "undefined" && tt && typeof tt.getSystemInfoSync === "function";
}

function isNode() {
  return typeof window === "undefined" && typeof document === "undefined" && !isTT();
}

function getSystemInfo() {
  if (isTT()) {
    var info = tt.getSystemInfoSync() || {};
    if (!info.screenWidth && info.windowWidth) info.screenWidth = info.windowWidth;
    if (!info.screenHeight && info.windowHeight) info.screenHeight = info.windowHeight;
    return info;
  }
  if (typeof window !== "undefined") {
    return {
      screenWidth: window.innerWidth || 375,
      screenHeight: window.innerHeight || 667,
      pixelRatio: window.devicePixelRatio || 2,
      safeArea: { top: 0, bottom: window.innerHeight || 667 }
    };
  }
  return {
    screenWidth: 375,
    screenHeight: 812,
    pixelRatio: 2,
    safeArea: { top: 24, left: 0, right: 375, bottom: 812 }
  };
}

/** 无头环境的空 ctx：吞掉所有绘制调用，measureText 给估算值 */
function createStubContext() {
  var noop = function () {};
  var gradient = { addColorStop: noop };
  var ctx = {
    canvas: null,
    font: "14px sans-serif",
    fillStyle: "#fff",
    strokeStyle: "#fff",
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: "left",
    textBaseline: "top",
    shadowColor: "#000",
    shadowBlur: 0,
    globalCompositeOperation: "source-over",
    measureText: function (text) {
      var str = String(text);
      var size = 14;
      var m = /(\d+(?:\.\d+)?)px/.exec(ctx.font);
      if (m) size = parseFloat(m[1]);
      var width = 0;
      var i;
      for (i = 0; i < str.length; i += 1) {
        width += str.charCodeAt(i) > 255 ? size : size * 0.55;
      }
      return { width: width };
    },
    createLinearGradient: function () { return gradient; },
    createRadialGradient: function () { return gradient; },
    createPattern: function () { return null; }
  };
  var methods = [
    "save", "restore", "scale", "translate", "rotate", "transform", "setTransform",
    "beginPath", "closePath", "moveTo", "lineTo", "arc", "arcTo", "ellipse", "rect",
    "quadraticCurveTo", "bezierCurveTo", "fill", "stroke", "clip", "fillRect", "strokeRect",
    "clearRect", "fillText", "strokeText", "drawImage", "putImageData"
  ];
  methods.forEach(function (name) {
    ctx[name] = noop;
  });
  return ctx;
}

function createStubCanvas(width, height) {
  var canvas = {
    width: width || 375,
    height: height || 667
  };
  var ctx = createStubContext();
  ctx.canvas = canvas;
  canvas.getContext = function () { return ctx; };
  return canvas;
}

function createMainCanvas(width, height) {
  if (isTT() && typeof tt.createCanvas === "function") {
    return tt.createCanvas();
  }
  if (typeof document !== "undefined") {
    var canvas = document.createElement("canvas");
    canvas.width = width || 375;
    canvas.height = height || 667;
    // 逻辑像素 ↔ CSS 像素必须 1:1，否则 dpr 会把画面放大裁切
    canvas.style.width = (width || 375) + "px";
    canvas.style.height = (height || 667) + "px";
    if (document.body) {
      document.body.style.margin = "0";
      document.body.style.background = "#0B1520";
      document.body.appendChild(canvas);
    }
    return canvas;
  }
  return createStubCanvas(width, height);
}

function createOffscreenCanvas(width, height) {
  if (isTT() && typeof tt.createCanvas === "function") {
    return tt.createCanvas();
  }
  if (typeof document !== "undefined") {
    return document.createElement("canvas");
  }
  return createStubCanvas(width, height);
}

/**
 * 触摸事件。onStart / onMove / onEnd 都拿到逻辑像素坐标。
 * 抖音 touch 的 clientX/clientY 已经是逻辑像素，不需要再除 dpr。
 */
function bindTouch(handlers) {
  var h = handlers || {};
  var startX = 0;
  var startY = 0;

  if (isTT() && typeof tt.onTouchStart === "function") {
    tt.onTouchStart(function (event) {
      var t = event.touches && event.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
      if (h.onStart) h.onStart(startX, startY);
    });
    tt.onTouchMove(function (event) {
      var t = event.touches && event.touches[0];
      if (t && h.onMove) h.onMove(t.clientX, t.clientY);
    });
    tt.onTouchEnd(function (event) {
      var t = event.changedTouches && event.changedTouches[0];
      if (!t) return;
      // 位移过大视为滑动而非点击
      var dx = t.clientX - startX;
      var dy = t.clientY - startY;
      if (dx * dx + dy * dy > 900) {
        if (h.onCancel) h.onCancel();
        return;
      }
      if (h.onEnd) h.onEnd(t.clientX, t.clientY);
    });
    tt.onTouchCancel(function () {
      if (h.onCancel) h.onCancel();
    });
    return;
  }

  if (typeof document !== "undefined") {
    var canvasRoot = document;
    canvasRoot.addEventListener("touchstart", function (e) {
      var t = e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
      if (h.onStart) h.onStart(startX, startY);
    }, { passive: true });
    canvasRoot.addEventListener("touchend", function (e) {
      var t = e.changedTouches[0];
      if (!t) return;
      if (h.onEnd) h.onEnd(t.clientX, t.clientY);
    }, { passive: true });
    document.addEventListener("mousedown", function (e) {
      startX = e.clientX;
      startY = e.clientY;
      if (h.onStart) h.onStart(startX, startY);
    });
    document.addEventListener("mouseup", function (e) {
      if (h.onEnd) h.onEnd(e.clientX, e.clientY);
    });
  }
}

function onHide(handler) {
  if (isTT() && tt.onHide) tt.onHide(handler);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) handler();
    });
  }
}

function onShow(handler) {
  if (isTT() && tt.onShow) tt.onShow(handler);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) handler();
    });
  }
}

function onWindowResize(handler) {
  if (isTT() && tt.onWindowResize) {
    tt.onWindowResize(function () { handler(getSystemInfo()); });
  } else if (typeof window !== "undefined") {
    window.addEventListener("resize", function () { handler(getSystemInfo()); });
  }
}

function vibrateShort() {
  try {
    if (isTT() && tt.vibrateShort) tt.vibrateShort({ type: "light" });
  } catch (error) {
    /* 震动失败不影响玩法 */
  }
}

function vibrateLong() {
  try {
    if (isTT() && tt.vibrateLong) tt.vibrateLong();
  } catch (error) {
    /* ignore */
  }
}

function enableShare(options) {
  if (!isTT() || !tt.showShareMenu) return;
  try {
    tt.showShareMenu({});
    if (tt.onShareAppMessage) {
      tt.onShareAppMessage(function () {
        return {
          title: (options && options.title) || "列车秘境：一局一条路线，穿过裂隙",
          imageUrl: options && options.imageUrl,
          query: (options && options.query) || ""
        };
      });
    }
  } catch (error) {
    /* 分享能力缺失时静默降级 */
  }
}

/** 主动分享（结算页冲榜用），失败静默 */
function share(options, callback) {
  if (isTT() && tt.shareAppMessage) {
    try {
      tt.shareAppMessage({
        title: (options && options.title) || "列车秘境：一局一条路线，穿过裂隙",
        imageUrl: options && options.imageUrl,
        query: (options && options.query) || "",
        success: function () { if (callback) callback(true); },
        fail: function () { if (callback) callback(false); }
      });
      return;
    } catch (error) {
      /* fallthrough */
    }
  }
  if (callback) callback(false);
}

/** 复制到剪贴板：诊断信息导出用，失败静默返回 false */
function setClipboard(text, callback) {
  var value = String(text === undefined ? "" : text);
  function done(ok) {
    if (callback) callback(ok);
  }
  try {
    if (isTT() && tt.setClipboardData) {
      tt.setClipboardData({
        data: value,
        success: function () { done(true); },
        fail: function () { done(false); }
      });
      return;
    }
    if (!isNode() && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(value).then(function () { done(true); }, function () { done(false); });
      return;
    }
    if (!isNode() && typeof document !== "undefined") {
      var area = document.createElement("textarea");
      area.value = value;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(area);
      done(ok);
      return;
    }
  } catch (error) {
    /* ignore */
  }
  done(false);
}

function reportError(error, tag) {
  var message = error && error.stack ? error.stack : String(error);
  if (isTT() && tt.reportError) {
    try {
      tt.reportError({ msg: "[" + (tag || "app") + "] " + message });
    } catch (e) {
      /* ignore */
    }
  }
  if (typeof console !== "undefined" && console.error) {
    console.error("[" + (tag || "app") + "]", message);
  }
}

var lastNow = 0;

/** 单调递增时间戳：系统时间被回拨时不倒退 */
function now() {
  var t = Date.now();
  if (t < lastNow) t = lastNow;
  lastNow = t;
  return t;
}

/** 本地存档读写（storage.js 用，屏蔽三态差异） */
function readStorage(key) {
  try {
    if (isTT() && tt.getStorageSync) return tt.getStorageSync(key);
    if (typeof localStorage !== "undefined") return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
  return null;
}

function writeStorage(key, value) {
  try {
    if (isTT() && tt.setStorageSync) {
      tt.setStorageSync(key, value);
      return true;
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
      return true;
    }
  } catch (error) {
    return false;
  }
  return true;
}

function removeStorage(key) {
  try {
    if (isTT() && tt.removeStorageSync) {
      tt.removeStorageSync(key);
      return true;
    }
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
      return true;
    }
  } catch (error) {
    return false;
  }
  return true;
}

module.exports = {
  isTT: isTT,
  isNode: isNode,
  getSystemInfo: getSystemInfo,
  createMainCanvas: createMainCanvas,
  createOffscreenCanvas: createOffscreenCanvas,
  createStubCanvas: createStubCanvas,
  bindTouch: bindTouch,
  onHide: onHide,
  onShow: onShow,
  onWindowResize: onWindowResize,
  vibrateShort: vibrateShort,
  vibrateLong: vibrateLong,
  enableShare: enableShare,
  share: share,
  setClipboard: setClipboard,
  reportError: reportError,
  now: now,
  readStorage: readStorage,
  writeStorage: writeStorage,
  removeStorage: removeStorage
};

});
})(window);