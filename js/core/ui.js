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

function pushHit(hit) {
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
