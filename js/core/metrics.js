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
