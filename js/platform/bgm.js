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
