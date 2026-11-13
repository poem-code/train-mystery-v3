/**
 * ui-audit.js —— 分辨率 × 界面 的排版走查（无头、可重复）
 *
 * 用法：node tools/ui-audit.js [--verbose]
 *
 * 为什么不用截图：截图只能证明「我看到的那一帧没问题」，换一档分辨率、
 * 换一段文案就得重看一遍；而排版问题的本质是**坐标算错**，那就直接量坐标。
 *
 * 三条判据：
 * 1. **点击区越界**：`ui.getHits()` 的矩形必须落在屏幕内。点不到 = 用户点不到。
 * 2. **文字写出屏**：钩住 `fillText`，按 textAlign 还原左右边界。右边缘被裁掉的字
 *    在截图里很不显眼，但它就是玩家看不到的信息。
 * 3. **按钮互相压住**：两个可点区重叠超过六成，点击就变成掷骰子。
 *    只比按钮（kind=button），卡片的整块可点区天然覆盖内部，不算问题。
 *
 * 退出码：0 全绿 / 1 有失败项（可直接挂进 CI）。
 */

var draw = require("../js/core/draw");
var ui = require("../js/core/ui");
var tween = require("../js/core/tween");
var screenApi = require("../js/core/screen");
var platform = require("../js/platform/platform");
var registry = require("../js/game/registry");
var stateApi = require("../js/game/state");

var VERBOSE = process.argv.indexOf("--verbose") >= 0;

var RESOLUTIONS = [
  { label: "360×640", w: 360, h: 640 },
  { label: "390×844", w: 390, h: 844 },
  { label: "768×1024", w: 768, h: 1024 }
];

/** 记录一次 fillText 的边界，用来抓「写出屏」 */
function recordingCtx(inner, screen) {
  var records = { texts: [], overflows: [] };
  var originalFillText = inner.fillText;
  inner.fillText = function (str, x, y, maxWidth) {
    var raw = String(str);
    var size = 14;
    var m = /(\d+(?:\.\d+)?)px/.exec(inner.font || "");
    if (m) size = parseFloat(m[1]);
    var bold = (inner.font || "").indexOf("bold") >= 0;
    var textW = draw.measure(inner, raw, size, bold);
    var align = inner.textAlign || "left";
    var left = align === "center" ? x - textW / 2 : align === "right" ? x - textW : x;
    var right = left + textW;
    var rec = { text: raw, left: left, right: right, y: y };
    records.texts.push(rec);
    if (left < -1 || right > screen.width + 1) records.overflows.push(rec);
    return originalFillText.apply(inner, arguments);
  };
  return records;
}

function baseState() {
  var st = stateApi.createDefaultState(Date.now());
  st.player.hp = 62;
  st.player.maxHp = 100;
  return st;
}

var CASES = [];

CASES.push({
  id: "home",
  label: "首页",
  build: function (res) {
    var st = baseState();
    st.current.scene = "home";
    return st;
  }
});

CASES.push({
  id: "train",
  label: "列车主城",
  build: function (res) {
    var st = baseState();
    st.current.scene = "train";
    st.player.ether = 640;
    st.player.gold = 9;
    return st;
  }
});

CASES.push({
  id: "route",
  label: "路线图",
  build: function (res) {
    var st = baseState();
    stateApi.startRun(st, Date.now());
    st.current.scene = "route";
    st.current.modal = null;
    return st;
  }
});

CASES.push({
  id: "battle",
  label: "战斗（Boss 二阶段）",
  build: function (res) {
    var st = baseState();
    stateApi.startRun(st, Date.now());
    st.current.scene = "route";
    st.current.modal = "battle";
    st.player.hp = 48;
    st.run.battle = {
      kind: "boss", enemyId: "riftWarden", name: "裂隙看守者", figure: "overlord",
      color: "#C0564A", trait: "armored", intro: "", hp: 54, maxHp: 120,
      damageRange: [12, 18], reward: { ether: 90, gold: 4 }, boss: true, elite: false,
      affixName: "残响", enemyShield: 8, playerShield: 0, turn: 5, defenseStance: false,
      enemyCharge: 2, phase: 2, phaseHits: 2, phaseLabel: "双影", phaseBreak: false,
      over: false, result: null,
      telegraph: { kind: "charge", label: "蓄势重击", detail: "下一击 +8" },
      logs: [
        "裂隙看守者 的外壳崩开，露出里面的第二层——它比刚才更凶了。",
        "「你终于看清了——它从来都不是一个。」",
        "双影：一回合打两段，防御架势只挡第一段。",
        "裂隙看守者 反击，造成 16 点伤害。"
      ]
    };
    return st;
  }
});

CASES.push({
  id: "battleIntro",
  label: "战斗（Boss 登场卡）",
  build: function (res) {
    var st = stateApi.createDefaultState(Date.now());
    stateApi.startRun(st, Date.now());
    st.current.scene = "route";
    st.current.modal = "battle";
    st.run.battle = {
      kind: "boss", enemyId: "thePassenger", name: "那位乘客", figure: "vampire",
      color: "#8E6BA8", trait: "parasite", intro: "", hp: 118, maxHp: 118,
      damageRange: [11, 17], reward: { ether: 104, gold: 5 }, boss: true, elite: false,
      enemyShield: 0, playerShield: 0, turn: 1, defenseStance: false,
      enemyCharge: 0, phase: 1, phaseBreak: false, over: false, result: null,
      introOpen: true, introHint: "它看着你，眼神像在找一个能住进去的地方。",
      logs: ["那位乘客 挡在车厢尽头。"]
    };
    return st;
  }
});

CASES.push({
  id: "codex",
  label: "永久图鉴",
  build: function (res) {
    var st = baseState();
    st.current.scene = "train";
    st.current.modal = "codex";
    st.progress.codex.enemies.riftWarden = { kills: 3, seen: true };
    st.progress.codex.relics.ticketPunch = true;
    return st;
  }
});

CASES.push({
  id: "daily",
  label: "每日挑战（已解锁）",
  build: function (res) {
    var st = baseState();
    st.current.scene = "train";
    st.current.modal = "daily";
    // 未解锁时会走「去升观景台」的早退分支，三颗按钮根本不会画出来——
    // 走查必须走解锁后的满配版面，否则查的是一张空卡。
    st.progress.trainUpgrades.observatory = 5;
    return st;
  }
});

CASES.push({
  id: "dailyLocked",
  label: "每日挑战（未解锁）",
  build: function (res) {
    var st = baseState();
    st.current.scene = "train";
    st.current.modal = "daily";
    return st;
  }
});

/**
 * 注意 hit 的形状：`{ id, rect, meta, kind }`——坐标在 `rect` 里。
 * 第一版按 `hit.x` 判，全是 undefined，比较结果恒为 false，
 * 于是「全绿」了但其实一条都没查（这种假绿比不查更糟：它会让人以为已经查过）。
 */
function rectOutside(hit, screen) {
  var r = hit.rect;
  if (!r) return true;
  var pad = 1;
  return r.x < -pad || r.y < -pad ||
    r.x + r.w > screen.width + pad || r.y + r.h > screen.height + pad;
}

function overlapRatio(a, b) {
  var ra = a.rect;
  var rb = b.rect;
  if (!ra || !rb) return 0;
  var x1 = Math.max(ra.x, rb.x);
  var y1 = Math.max(ra.y, rb.y);
  var x2 = Math.min(ra.x + ra.w, rb.x + rb.w);
  var y2 = Math.min(ra.y + ra.h, rb.y + rb.h);
  if (x2 <= x1 || y2 <= y1) return 0;
  var inter = (x2 - x1) * (y2 - y1);
  var smaller = Math.min(ra.w * ra.h, rb.w * rb.h);
  return smaller > 0 ? inter / smaller : 0;
}

function auditCase(caseDef, res) {
  var st = caseDef.build(res);
  var screen = screenApi.createScreen({
    screenWidth: res.w,
    screenHeight: res.h,
    pixelRatio: 2,
    safeArea: null
  });
  var canvas = platform.createStubCanvas(res.w, res.h);
  var inner = canvas.getContext("2d");
  var records = recordingCtx(inner, screen);
  var animator = tween.createAnimator();

  ui.beginFrame(screen, 1);
  try {
    var scene = registry.scenes[st.current.scene];
    if (scene && scene.render) scene.render(inner, screen, st, animator, 0);
    var modal = st.current.modal ? registry.modals[st.current.modal] : null;
    if (modal && modal.render) {
      inner.save();
      inner.globalAlpha = 0.72;
      inner.fillStyle = "#04090D";
      inner.fillRect(0, 0, screen.width, screen.height);
      inner.restore();
      modal.render(inner, screen, st, animator, 0);
    }
  } catch (error) {
    return { caseDef: caseDef, res: res, error: error, hits: [], overflows: [], overlaps: [] };
  }

  var hits = ui.getHits().slice();
  var outside = [];
  var i;
  for (i = 0; i < hits.length; i += 1) {
    if (rectOutside(hits[i], screen)) outside.push(hits[i]);
  }

  // 只比按钮：卡片/整块的点击区天然覆盖内部元素，比进去全是噪声
  var buttons = [];
  for (i = 0; i < hits.length; i += 1) {
    if (hits[i].kind === "button") buttons.push(hits[i]);
  }
  var overlaps = [];
  var a;
  var b;
  for (a = 0; a < buttons.length; a += 1) {
    for (b = a + 1; b < buttons.length; b += 1) {
      var ratio = overlapRatio(buttons[a], buttons[b]);
      if (ratio > 0.6) {
        overlaps.push({
          a: buttons[a].id, b: buttons[b].id, ratio: Math.round(ratio * 100)
        });
      }
    }
  }

  /**
   * 点击区太小：不算失败（不影响功能），但手指点不中等于半个功能。
   * 抖音侧的建议值是 40×40，这里只在低于该值时提示，不拦。
   */
  var small = [];
  var si;
  for (si = 0; si < hits.length; si += 1) {
    var sr = hits[si].rect;
    if (sr && (sr.w < 40 || sr.h < 40)) {
      small.push(hits[si].id + " " + Math.round(sr.w) + "x" + Math.round(sr.h));
    }
  }

  return {
    caseDef: caseDef,
    res: res,
    error: null,
    hits: hits,
    outside: outside,
    overflows: records.overflows,
    overlaps: overlaps,
    small: small
  };
}

/**
 * 自检：检查器自己也会坏。第一版把坐标读成 `hit.x`（实际在 `hit.rect` 里），
 * 结果 21 格全绿——那不是「没问题」，是「没在查」。所以给检查器本身配一条断言：
 * 故意画一条超出屏幕的文字 + 一个越界按钮 + 一对重叠按钮，三项必须都红。
 */
function selfTest() {
  var screen = screenApi.createScreen({ screenWidth: 360, screenHeight: 640, pixelRatio: 2 });

  /**
   * 越界判据：不能靠 pushHit 造（外扩时会把越界矩形夹回屏幕内，
   * 这正是 0.9.7 加的保护）。所以直接喂一个越界矩形给判据本身——
   * 自检测的是「判据会不会红」，不是「能不能造出越界」。
   */
  var fakeOut = rectOutside({ rect: { x: 340, y: 20, w: 100, h: 44 } }, screen);
  var fakeIn = rectOutside({ rect: { x: 20, y: 20, w: 100, h: 44 } }, screen);

  // 出屏判据：一句明显超出屏宽的文字
  var canvas = platform.createStubCanvas(360, 640);
  var inner = canvas.getContext("2d");
  var records = recordingCtx(inner, screen);
  draw.text(inner, "这是一句故意写得很长很长很长很长很长很长很长的文字，它一定会超出屏幕右边", 8, 30, { size: 20 });
  draw.text(inner, "居中短句", 180, 80, { size: 18, align: "center" });
  var longCaught = false;
  var oi;
  for (oi = 0; oi < records.overflows.length; oi += 1) {
    if (records.overflows[oi].text.indexOf("故意写得") >= 0) longCaught = true;
  }

  // 重叠判据：两个几乎重合的按钮
  ui.beginFrame(screen, 1);
  ui.button(inner, { id: "overA", rect: { x: 20, y: 300, w: 120, h: 48 }, label: "A" });
  ui.button(inner, { id: "overB", rect: { x: 30, y: 305, w: 120, h: 48 }, label: "B" });
  var hits = ui.getHits();
  var overlaps = 0;
  var i;
  var j;
  for (i = 0; i < hits.length; i += 1) {
    for (j = i + 1; j < hits.length; j += 1) {
      if (overlapRatio(hits[i], hits[j]) > 0.6) overlaps += 1;
    }
  }

  // 外扩保护：注册过的命中区必须都在屏幕内
  var escaped = hits.filter(function (h) { return rectOutside(h, screen); }).length;

  var pass = fakeOut === true && fakeIn === false && longCaught && overlaps === 1 && escaped === 0;
  console.log("自检：越界判据 " + (fakeOut && !fakeIn) + " · 出屏抓到长句 " + longCaught +
    " · 重叠判据 " + overlaps + "（应 1）· 外扩越界 " + escaped + "（应 0）");
  console.log(pass ? "  ✓ 检查器可用" : "  ✗ 检查器失灵，先修它再看走查结果");
  process.exit(pass ? 0 : 1);
}

function pad(s, n) {
  s = String(s);
  while (s.length < n) s += " ";
  return s;
}

if (process.argv.indexOf("--selftest") >= 0) {
  selfTest();
}

console.log("界面 × 分辨率走查（" + CASES.length + " × " + RESOLUTIONS.length + "）\n");
console.log(pad("界面", 22) + pad("分辨率", 12) + pad("可点", 6) + pad("越界", 6) +
  pad("文字出屏", 10) + "按钮重叠");

var failures = 0;
var total = 0;
var ci;
var ri;
for (ci = 0; ci < CASES.length; ci += 1) {
  for (ri = 0; ri < RESOLUTIONS.length; ri += 1) {
    total += 1;
    var r = auditCase(CASES[ci], RESOLUTIONS[ri]);
    var bad = !!(r.error || r.outside.length || r.overflows.length || r.overlaps.length || !r.hits.length);
    if (bad) failures += 1;
    console.log(
      pad(r.caseDef.label, 22) + pad(r.res.label, 12) +
      pad(r.hits.length, 6) + pad(r.outside.length, 6) +
      pad(r.overflows.length, 10) + (r.overlaps.length || "") +
      (bad ? "  ✗" : "")
    );
    if (r.error) console.log("    异常：" + (r.error && r.error.message));
    if (VERBOSE && r.small && r.small.length) {
      console.log("    点不大（建议 ≥40）" + r.small.join(" | "));
    }
    if (VERBOSE) {
      var k;
      for (k = 0; k < r.outside.length; k += 1) {
        var or = r.outside[k].rect || {};
        console.log("    越界 " + r.outside[k].id + " @" +
          Math.round(or.x) + "," + Math.round(or.y) +
          " " + Math.round(or.w) + "x" + Math.round(or.h));
      }
      for (k = 0; k < r.overflows.length; k += 1) {
        console.log("    出屏「" + r.overflows[k].text.slice(0, 18) + "」 " +
          Math.round(r.overflows[k].left) + "→" + Math.round(r.overflows[k].right));
      }
      for (k = 0; k < r.overlaps.length; k += 1) {
        console.log("    重叠 " + r.overlaps[k].a + " / " + r.overlaps[k].b +
          " " + r.overlaps[k].ratio + "%");
      }
    }
  }
}

console.log("\n" + (failures === 0 ? "全绿" : failures + " / " + total + " 格有问题"));
process.exit(failures === 0 ? 0 : 1);
