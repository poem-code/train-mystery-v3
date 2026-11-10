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
