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

function createEngine(options) {
  var ctx = options.ctx;
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
  var perf = { frames: 0, slowFrames: 0, renderMs: 0, worstRenderMs: 0, sampleStart: 0, fps: 0, windowFrames: 0, paints: 0 };
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
    /** 诊断用：最近一秒帧率、渲染耗时、慢帧数 */
    getPerf: function () {
      return "fps=" + perf.fps + " 渲染=" + perf.renderMs + "ms(最差 " + perf.worstRenderMs +
        "ms) 帧数=" + perf.frames + " 慢帧=" + perf.slowFrames;
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
