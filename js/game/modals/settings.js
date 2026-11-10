/**
 * modals/settings.js —— 设置：说明入口 / 音量 / 诊断 / 重置存档（两段确认）
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");

var P = draw.PALETTE;

function render(ctx, screen, state) {
  var s = screen.s;
  var panel = common.modalPanel(screen, screen.px(492));
  draw.panel(ctx, panel, {
    radius: Math.round(16 * s),
    fillTop: "#1B2C38",
    fillBottom: "#0F1B23",
    strokeColor: "rgba(42,74,92,0.95)"
  });

  var pad = screen.px(16);
  var y = common.modalTitle(ctx, screen, panel, "设置", "单机存档 · 本地保存");

  var rows = screen.col({
    x: panel.x + pad,
    y: y + screen.px(4),
    w: panel.w - pad * 2,
    h: screen.px(300)
  }, 7, screen.px(7));

  ui.button(ctx, { id: "settings:guide", rect: rows[0], label: "玩法说明", style: "ghost", size: screen.fz(13) });
  ui.button(ctx, { id: "settings:privacy", rect: rows[1], label: "隐私说明", style: "ghost", size: screen.fz(13) });
  ui.button(ctx, { id: "settings:about", rect: rows[2], label: "关于本作", style: "ghost", size: screen.fz(13) });

  var bgmOn = state.meta.bgmOn !== false;
  var sfxOn = state.meta.sfxOn !== false;
  ui.button(ctx, {
    id: "settings:bgm",
    rect: rows[3],
    label: "音乐：" + (bgmOn ? "开" : "关"),
    style: bgmOn ? "teal" : "ghost",
    size: screen.fz(13)
  });
  ui.button(ctx, {
    id: "settings:sound",
    rect: rows[4],
    label: "音效：" + (sfxOn ? "开" : "关"),
    style: sfxOn ? "teal" : "ghost",
    size: screen.fz(13)
  });
  ui.button(ctx, {
    id: "settings:diag",
    rect: rows[5],
    label: "复制诊断信息",
    style: "ghost",
    size: screen.fz(12)
  });

  var data = state.current.modalData || {};
  var confirmReset = data.confirmReset === true;
  ui.button(ctx, {
    id: "settings:reset",
    rect: rows[6],
    label: confirmReset ? "再点一次确认清空存档" : "重置存档",
    style: confirmReset ? "danger" : "ghost",
    size: screen.fz(13)
  });

  draw.text(ctx, "v4.0 · schema " + state.schemaVersion, panel.x + pad, panel.y + panel.h - pad - screen.px(58), {
    size: screen.fz(10),
    color: P.inkFaint
  });

  ui.button(ctx, {
    id: "settings:close",
    rect: {
      x: panel.x + pad,
      y: panel.y + panel.h - pad - screen.px(42),
      w: panel.w - pad * 2,
      h: screen.px(42)
    },
    label: "关闭",
    style: "primary",
    size: screen.fz(14)
  });
}

function onAction(action, state, app) {
  var id = action.id;

  if (id === "settings:close") {
    state.current.modal = null;
    state.current.modalData = null;
    app.commit();
    return true;
  }
  if (id === "settings:guide" || id === "settings:privacy" || id === "settings:about") {
    app.openInfo(id.slice("settings:".length));
    return true;
  }
  if (id === "settings:bgm") {
    state.meta.bgmOn = state.meta.bgmOn === false;
    if (app.applyAudioSetting) app.applyAudioSetting();
    app.commit();
    return true;
  }
  if (id === "settings:sound") {
    // soundOn 与 sfxOn 同步：老存档只有 soundOn，别让它变成两个互相矛盾的开关
    state.meta.sfxOn = state.meta.sfxOn === false;
    state.meta.soundOn = state.meta.sfxOn;
    if (app.applyAudioSetting) app.applyAudioSetting();
    if (state.meta.sfxOn) app.sound("select", 0.7);
    app.commit();
    return true;
  }
  if (id === "settings:diag") {
    if (app.copyDiagnostics) app.copyDiagnostics();
    return true;
  }
  if (id === "settings:reset") {
    var data = state.current.modalData || {};
    if (data.confirmReset === true) {
      app.resetSave();
      return true;
    }
    state.current.modalData = { confirmReset: true };
    app.toast("再次点击将清空全部进度");
    app.commit();
    return true;
  }
  return false;
}

module.exports = {
  render: render,
  onAction: onAction
};
