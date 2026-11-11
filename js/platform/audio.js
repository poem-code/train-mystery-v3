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
