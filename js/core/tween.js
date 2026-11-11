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
