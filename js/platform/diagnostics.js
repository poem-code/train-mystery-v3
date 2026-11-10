/**
 * platform/diagnostics.js —— 运行诊断：环形日志 + 环境快照
 *
 * 为什么需要：小游戏上线后最痛的是「用户说闪退但你复现不了」。
 * 环形日志只保留最近 N 条，成本极低，但能把「他在哪个界面、什么机型、卡在哪一步」带回来。
 *
 * 约束：不落盘（避免写坏存档）、不弹窗、任何异常都吞掉。
 */

var MAX_ENTRIES = 60;

function createDiagnostics(options) {
  var opts = options || {};
  var entries = [];
  var startedAt = Date.now();
  var isNodeEnv = typeof window === "undefined" && typeof tt === "undefined";

  function stamp() {
    var ms = Date.now() - startedAt;
    return (ms / 1000).toFixed(1) + "s";
  }

  function push(level, tag, message) {
    try {
      entries.push({
        t: stamp(),
        level: level || "info",
        tag: tag || "-",
        msg: String(message === undefined ? "" : message).slice(0, 200)
      });
      if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
    } catch (error) { /* 诊断本身绝不能抛 */ }
  }

  function info(tag, message) { push("info", tag, message); }
  function warn(tag, message) { push("warn", tag, message); }
  function error(tag, message) { push("error", tag, message); }

  function envSnapshot() {
    var out = [];
    try {
      if (typeof tt !== "undefined" && tt && typeof tt.getSystemInfoSync === "function") {
        var sys = tt.getSystemInfoSync() || {};
        out.push("平台=" + (sys.platform || "?") + " 系统=" + (sys.system || "?"));
        out.push("机型=" + (sys.model || "?") + " 抖音=" + (sys.appVersion || "?"));
        out.push("屏幕=" + sys.screenWidth + "x" + sys.screenHeight + " dpr=" + sys.pixelRatio);
        out.push("基础库=" + (sys.SDKVersion || "?"));
      } else if (!isNodeEnv) {
        out.push("平台=browser 视口=" + window.innerWidth + "x" + window.innerHeight + " dpr=" + window.devicePixelRatio);
      } else {
        out.push("平台=node");
      }
    } catch (e) {
      out.push("环境信息读取失败");
    }
    return out;
  }

  function snapshot(state) {
    var lines = [];
    lines.push("=== 列车秘境 诊断信息 ===");
    lines.push("时间=" + new Date().toISOString());
    var env = envSnapshot();
    var i;
    for (i = 0; i < env.length; i += 1) lines.push(env[i]);
    if (state) {
      try {
        lines.push("版本=schema " + state.schemaVersion + " 局数=" + state.progress.runsStarted + " 通关=" + state.progress.bossClears);
        lines.push("进度=图鉴 " + Object.keys(state.progress.codex.enemies || {}).length + " 敌 成就 " +
          Object.keys(state.progress.achievements || {}).length + " 条");
        lines.push("当前=场景 " + state.current.scene + " 弹窗 " + (state.current.modal || "无"));
        lines.push("玩家=HP " + Math.round(state.player.hp) + "/" + state.player.maxHp +
          " 饱食 " + Math.round(state.player.hunger) + " 精神 " + Math.round(state.player.sanity));
      } catch (e) {
        lines.push("状态读取失败");
      }
    }
    lines.push("--- 最近日志 ---");
    for (i = entries.length - 1; i >= 0; i -= 1) {
      var item = entries[i];
      lines.push("[" + item.t + "][" + item.level + "][" + item.tag + "] " + item.msg);
    }
    return lines.join("\n");
  }

  /** 挂全局异常：抖音走 tt.onError，浏览器走 window.onerror */
  function install() {
    try {
      if (typeof tt !== "undefined" && tt && typeof tt.onError === "function") {
        tt.onError(function (err) {
          error("tt", (err && (err.message || err.errMsg)) || "unknown");
        });
      }
      if (!isNodeEnv && typeof window !== "undefined" && window.addEventListener) {
        window.addEventListener("error", function (event) {
          error("window", (event && event.message) || "unknown");
        });
        window.addEventListener("unhandledrejection", function (event) {
          var reason = event && event.reason;
          error("promise", (reason && reason.message) || String(reason));
        });
      }
    } catch (e) { /* ignore */ }
  }

  return {
    info: info,
    warn: warn,
    error: error,
    snapshot: snapshot,
    install: install,
    entries: function () { return entries.slice(); },
    clear: function () { entries.length = 0; }
  };
}

module.exports = {
  createDiagnostics: createDiagnostics
};
