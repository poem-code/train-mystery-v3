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

engine = createEngine({
  canvas: canvas,
  ctx: ctx,
  screen: screen,
  platform: platform,
  audio: audio,
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
