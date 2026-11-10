/**
 * ad.js —— 激励视频封装（含风控）
 *
 * 风控要点：
 * 1. 未配置广告位 / 加载失败 / onError → 一律不发奖。
 * 2. onClose 必须 isEnded 为真，且用 once 锁保证只发一次。
 * 3. onError 不把 available 永久置 false，只做 15 秒冷却。
 */

var config = require("../game/config");
var platform = require("./platform");

var RETRY_COOLDOWN_MS = 15000;

function createAdManager(onLog) {
  var ad = null;
  var initialized = false;
  var loading = false;
  var lastErrorAt = 0;

  function log(text) {
    if (typeof onLog === "function") onLog(text);
  }

  function isConfigured() {
    return platform.isTT() &&
      typeof tt.createRewardedVideoAd === "function" &&
      !!config.rewardedVideoAdUnitId &&
      config.rewardedVideoAdUnitId.indexOf("REPLACE") !== 0;
  }

  function init() {
    if (initialized) return !!ad;
    initialized = true;
    if (!isConfigured()) {
      log("未配置广告位，激励视频不可用（不发奖）。");
      return false;
    }
    try {
      ad = tt.createRewardedVideoAd({ adUnitId: config.rewardedVideoAdUnitId });
      ad.onError(function (err) {
        lastErrorAt = Date.now();
        log("广告不可用（" + ((err && (err.errCode || err.errorCode)) || "unknown") + "）。");
      });
      if (typeof ad.load === "function") ad.load().catch(function () {});
      return true;
    } catch (error) {
      ad = null;
      log("广告实例初始化失败（不发奖）。");
      return false;
    }
  }

  function showRewarded(options) {
    var onReward = (options && options.onReward) || function () {};
    var onCancel = (options && options.onCancel) || function () {};
    init();

    if (!ad) {
      log("激励视频暂不可用，本次不发放奖励。");
      onCancel({ reason: "unavailable" });
      return;
    }
    if (loading) {
      onCancel({ reason: "busy" });
      return;
    }
    if (lastErrorAt && Date.now() - lastErrorAt < RETRY_COOLDOWN_MS) {
      onCancel({ reason: "cooldown" });
      return;
    }

    loading = true;
    var finished = false;

    function finish(ok, payload) {
      if (finished) return;
      finished = true;
      loading = false;
      if (typeof ad.offClose === "function") ad.offClose(closeHandler);
      if (ok) {
        onReward(payload || { isEnded: true });
      } else {
        onCancel(payload || { reason: "not-ended" });
      }
    }

    function closeHandler(res) {
      if (res && res.isEnded) {
        finish(true, res);
      } else {
        log("激励视频未看完，本次不发放奖励。");
        finish(false, { reason: "not-ended" });
      }
    }

    ad.onClose(closeHandler);

    ad.show().catch(function () {
      return ad.load().then(function () { return ad.show(); });
    }).catch(function (err) {
      lastErrorAt = Date.now();
      log("广告展示失败（" + ((err && (err.errCode || err.errorCode)) || "unknown") + "）。");
      finish(false, { reason: "error" });
    });
  }

  return {
    init: init,
    showRewarded: showRewarded,
    isAvailable: function () { return !!ad; }
  };
}

module.exports = createAdManager;
