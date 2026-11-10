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
function figShadow(ctx, cx, cy, size) {
  ctx.save();
  ctx.globalAlpha = 0.30;
  ctx.fillStyle = "#04090D";
  ctx.translate(cx, cy + size * 0.44);
  ctx.scale(1, 0.22);
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.32, 0, Math.PI * 2);
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
 */
function figure(ctx, cx, cy, size, kind, color, variant) {
  var c = color || PALETTE.teal;
  figShadow(ctx, cx, cy, size);
  ctx.save();
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
  var w = screen.width;
  var h = screen.height;

  clear(ctx, w, h, t === "light" ? "#0E1C28" : PALETTE.bg0);

  ctx.save();
  // 远景：顶部光晕
  if (typeof ctx.createLinearGradient === "function") {
    var g = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    g.addColorStop(0, "rgba(79,192,176,0.16)");
    g.addColorStop(1, "rgba(79,192,176,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h * 0.55);

    // 中景：斜向光带（车窗透进来的光），随 offset 缓慢移动
    var beam = ctx.createLinearGradient(0, h * 0.12, w, h * 0.62);
    beam.addColorStop(0, "rgba(224,177,92,0.10)");
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
