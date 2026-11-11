/**
 * modals/info.js —— 通用信息弹窗
 *
 * 承载：玩法说明 / 隐私 / 关于 / 服务 / 本局构筑 / 敌人特性
 * view 由 state.current.modalData.view 决定。
 */

var draw = require("../../core/draw");
var ui = require("../../core/ui");
var common = require("../ui-common");
var stateApi = require("../state");
var text = require("../data/text");
var relicsApi = require("../data/relics");
var enhApi = require("../data/enhancements");

var P = draw.PALETTE;

function staticView(view) {
  if (view === "privacy") return text.privacy;
  if (view === "about") return text.about;
  if (view === "service") return text.service;
  return text.guide;
}

function renderParagraphs(ctx, screen, panel, title, paragraphs) {
  var pad = screen.px(16);
  var y = common.modalTitle(ctx, screen, panel, title);
  var i;
  for (i = 0; i < paragraphs.length; i += 1) {
    var used = draw.text(ctx, paragraphs[i], panel.x + pad, y, {
      size: screen.fz(12),
      color: P.inkDim,
      wrap: panel.w - pad * 2,
      lineHeight: screen.px(20)
    });
    y += used + screen.px(8);
    if (y > panel.y + panel.h - screen.px(56)) break;
  }
}

function renderCollection(ctx, screen, panel, state) {
  var pad = screen.px(16);
  var run = state.run;
  var y = common.modalTitle(ctx, screen, panel, "本局构筑", "遗物与强化都会在本局结束时清空");
  var i;

  // 序列放在最前面：它是「这一局该往哪凑」的唯一提示，
  // 排在长串遗物后面的话，遗物一多就永远看不到。
  var sets = stateApi.setProgress(run);
  y = ui.section(ctx, "遗物序列", panel.x + pad, y, panel.w - pad * 2);
  for (i = 0; i < sets.length; i += 1) {
    var set = sets[i];
    var color = draw.PALETTE[set.accent] || P.inkDim;
    if (!set.count) color = P.inkFaint;
    var tail;
    if (set.count >= set.total) tail = "已集齐";
    else if (!set.nextNeed) tail = "档位全达成";
    else tail = "再 " + (set.nextNeed - set.count) + " 件进档";
    draw.text(ctx, set.name + " " + set.count + " / " + set.total, panel.x + pad, y, {
      size: screen.fz(11),
      color: color,
      bold: set.count > 0
    });
    draw.text(ctx, tail, panel.x + panel.w - pad, y, {
      size: screen.fz(10),
      align: "right",
      color: P.inkFaint
    });
    y += screen.px(17);
  }
  y += screen.px(6);

  y = ui.section(ctx, "遗物 " + (run.relics.length || 0), panel.x + pad, y, panel.w - pad * 2);
  if (!run.relics.length) {
    draw.text(ctx, "暂无遗物，宝箱与精英战斗会掉落。", panel.x + pad, y, {
      size: screen.fz(11),
      color: P.inkFaint
    });
    y += screen.px(20);
  } else {
    var shown = 0;
    for (i = 0; i < run.relics.length; i += 1) {
      if (y > panel.y + panel.h - screen.px(112)) break;
      draw.text(ctx, "· " + run.relics[i].name, panel.x + pad, y, {
        size: screen.fz(12),
        color: P.teal,
        bold: true
      });
      var used = draw.text(ctx, run.relics[i].desc, panel.x + pad + screen.px(10), y + screen.px(16), {
        size: screen.fz(10),
        color: P.inkDim,
        wrap: panel.w - pad * 2 - screen.px(10),
        lineHeight: screen.px(15)
      });
      y += used + screen.px(20);
      shown += 1;
    }
    // 装不下时给一句「还有 N 件」：直接截断会让人以为遗物丢了。
    // 遗物都放不下时强化更放不下，顺带把强化数量也报出来。
    if (shown < run.relics.length) {
      var rest = "…… 还有 " + (run.relics.length - shown) + " 件遗物未展开";
      if (run.enhancements.length) rest += " · 强化 " + run.enhancements.length + " 项";
      draw.text(ctx, rest, panel.x + pad, y, {
        size: screen.fz(10),
        color: P.inkFaint
      });
      y += screen.px(16);
    }
  }

  // 空间不够时整节不画：只画个「强化 2」标题、下面空空，
  // 比不画更像卡住了
  if (y < panel.y + panel.h - screen.px(96)) {
    y = ui.section(ctx, "强化 " + (run.enhancements.length || 0), panel.x + pad, y + screen.px(4), panel.w - pad * 2);
    if (!run.enhancements.length) {
      draw.text(ctx, "暂无强化，战斗胜利与营地整备会给。", panel.x + pad, y, {
        size: screen.fz(11),
        color: P.inkFaint
      });
    } else {
      for (i = 0; i < run.enhancements.length; i += 1) {
        if (y > panel.y + panel.h - screen.px(76)) break;
        draw.text(ctx, "· " + run.enhancements[i].name, panel.x + pad, y, {
          size: screen.fz(11),
          color: P.ink
        });
        y += screen.px(18);
      }
    }
  } else if (run.enhancements.length && y < panel.y + panel.h - screen.px(76)) {
    // 连标题都放不下时至少留一句，别让玩家以为自己没强化
    draw.text(ctx, "强化 " + run.enhancements.length + " 项（此处放不下，见路线图）", panel.x + pad, y, {
      size: screen.fz(10),
      color: P.inkFaint
    });
  }
}

function renderEnemy(ctx, screen, panel, state) {
  var battle = state.run && state.run.battle;
  var pad = screen.px(16);
  var y = common.modalTitle(ctx, screen, panel, battle ? battle.name : "敌人");
  if (!battle) return;
  var lines = [
    battle.intro || "没有额外特性。",
    "血量 " + Math.round(battle.hp) + " / " + battle.maxHp + "，攻击 " + battle.damageRange[0] + "—" + battle.damageRange[1] + "。",
    battle.boss ? "Boss：每 2 回合加 8 护盾，每 3 回合蓄势重击。" : "",
    battle.elite ? "精英：击败后会有 4 个强化候选。" : ""
  ].filter(function (line) { return !!line; });
  var i;
  for (i = 0; i < lines.length; i += 1) {
    var used = draw.text(ctx, lines[i], panel.x + pad, y, {
      size: screen.fz(12),
      color: P.inkDim,
      wrap: panel.w - pad * 2,
      lineHeight: screen.px(20)
    });
    y += used + screen.px(8);
  }
}

function render(ctx, screen, state) {
  var s = screen.s;
  var data = state.current.modalData || {};
  var view = data.view || "guide";

  // 面板高度按内容自适应：固定高度会让「只有 1 件遗物」的构筑页留下大片空白，
  // 看起来像资源没加载出来。
  var height = 470;
  if (view === "collection") {
    var run = state.run;
    // 210 是「标题 + 两个分节头 + 底部按钮」的固定开销，46/18/17 是各类条目的行高。
    var body = 210 + stateApi.setProgress(run).length * 17 +
      run.relics.length * 46 + run.enhancements.length * 18;
    height = Math.max(260, Math.min(560, body));
  } else if (view === "enemy") {
    height = 250;
  }
  var panel = common.modalPanel(screen, screen.px(height));
  draw.panel(ctx, panel, {
    radius: Math.round(16 * s),
    fillTop: "#1C2E3A",
    fillBottom: "#101C25",
    strokeColor: "rgba(42,74,92,0.95)"
  });

  if (view === "collection") {
    renderCollection(ctx, screen, panel, state);
  } else if (view === "enemy") {
    renderEnemy(ctx, screen, panel, state);
  } else {
    var content = staticView(view);
    renderParagraphs(ctx, screen, panel, content.title, content.body);
  }

  var pad = screen.px(16);
  ui.button(ctx, {
    id: "info:close",
    rect: {
      x: panel.x + pad,
      y: panel.y + panel.h - pad - screen.px(42),
      w: panel.w - pad * 2,
      h: screen.px(42)
    },
    label: "知道了",
    style: "ghost",
    size: screen.fz(14)
  });
}

function onAction(action, state, app) {
  if (action.id === "info:close") {
    state.current.modal = null;
    state.current.modalData = null;
    app.commit();
    return true;
  }
  return false;
}

module.exports = {
  render: render,
  onAction: onAction
};
