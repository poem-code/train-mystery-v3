/**
 * core/fx.js —— 轻量特效层（粒子 / 飘字 / 震屏 / 闪白 / 涟漪）
 *
 * 定位：只负责「让动作有反馈」，不含任何玩法判断。
 * 使用方式：场景在渲染末尾调用 render(ctx)；engine 每帧 tick，并读取 getShake() 做画面位移。
 *
 * 性能约束（抖音低端机）：
 * - 粒子总数上限 MAX_PARTICLES，超出后丢弃新粒子而不是卡顿
 * - 每个特效都是简单几何（圆/环/字），不用阴影、不用图片
 * - 全部对象用普通 JS 对象 + 数组，避免每帧创建闭包
 */

var MAX_PARTICLES = 96;
var MAX_FLOATS = 12;
var MAX_RINGS = 8;

function createFx() {
  var particles = [];
  var floats = [];
  var rings = [];
  var shakeState = null;
  var flashState = null;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function burst(x, y, opts) {
    var o = opts || {};
    var count = o.count || 12;
    var color = o.color || "#FFB199";
    var speed = o.speed || 150;
    var gravity = o.gravity === undefined ? 620 : o.gravity;
    var size = o.size || 3;
    var spread = o.spread === undefined ? Math.PI * 2 : o.spread;
    var dir = o.dir === undefined ? -Math.PI / 2 : o.dir;
    var i;
    for (i = 0; i < count; i += 1) {
      if (particles.length >= MAX_PARTICLES) break;
      var angle = dir + rand(-spread / 2, spread / 2);
      var v = speed * rand(0.45, 1);
      particles.push({
        x: x + rand(-4, 4),
        y: y + rand(-4, 4),
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        age: 0,
        life: o.life || rand(260, 460),
        size: size * rand(0.6, 1.3),
        color: color,
        gravity: gravity,
        drag: o.drag === undefined ? 0.92 : o.drag
      });
    }
  }

  function float(x, y, label, opts) {
    var o = opts || {};
    if (floats.length >= MAX_FLOATS) floats.shift();
    floats.push({
      x: x,
      y: y,
      text: String(label),
      age: 0,
      life: o.life || 720,
      color: o.color || "#FFB199",
      size: o.size || 20,
      rise: o.rise === undefined ? 46 : o.rise,
      bold: o.bold !== false,
      drift: o.drift || 0
    });
  }

  function ring(x, y, opts) {
    var o = opts || {};
    if (rings.length >= MAX_RINGS) rings.shift();
    rings.push({
      x: x,
      y: y,
      age: 0,
      life: o.life || 340,
      from: o.from === undefined ? 6 : o.from,
      to: o.to === undefined ? 54 : o.to,
      color: o.color || "#4FC0B0",
      width: o.width || 3
    });
  }

  function shake(strength, duration) {
    // 取较强的一次，避免连续小震动把大震动覆盖掉
    if (shakeState && shakeState.strength > strength) return;
    shakeState = { strength: strength || 4, age: 0, life: duration || 180 };
  }

  function flash(color, duration, alpha) {
    flashState = {
      color: color || "rgba(255,255,255,0.35)",
      age: 0,
      life: duration || 140,
      alpha: alpha === undefined ? 0.35 : alpha
    };
  }

  function tick(dt) {
    var i;
    for (i = particles.length - 1; i >= 0; i -= 1) {
      var p = particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += (p.gravity * dt) / 1000;
      p.vx *= Math.pow(p.drag, dt / 16);
      p.x += (p.vx * dt) / 1000;
      p.y += (p.vy * dt) / 1000;
    }
    for (i = floats.length - 1; i >= 0; i -= 1) {
      floats[i].age += dt;
      if (floats[i].age >= floats[i].life) floats.splice(i, 1);
    }
    for (i = rings.length - 1; i >= 0; i -= 1) {
      rings[i].age += dt;
      if (rings[i].age >= rings[i].life) rings.splice(i, 1);
    }
    if (shakeState) {
      shakeState.age += dt;
      if (shakeState.age >= shakeState.life) shakeState = null;
    }
    if (flashState) {
      flashState.age += dt;
      if (flashState.age >= flashState.life) flashState = null;
    }
  }

  function isActive() {
    return particles.length > 0 || floats.length > 0 || rings.length > 0 ||
      !!shakeState || !!flashState;
  }

  /** 当前画面位移，随着时间快速衰减 */
  function getShake() {
    if (!shakeState) return { x: 0, y: 0 };
    var k = 1 - shakeState.age / shakeState.life;
    var amp = shakeState.strength * k * k;
    return {
      x: (Math.random() * 2 - 1) * amp,
      y: (Math.random() * 2 - 1) * amp
    };
  }

  function render(ctx) {
    var i;

    // 冲击环
    for (i = 0; i < rings.length; i += 1) {
      var g = rings[i];
      var gp = g.age / g.life;
      var radius = g.from + (g.to - g.from) * gp;
      ctx.save();
      ctx.globalAlpha = (1 - gp) * 0.8;
      ctx.beginPath();
      ctx.arc(g.x, g.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = g.color;
      ctx.lineWidth = Math.max(1, g.width * (1 - gp));
      ctx.stroke();
      ctx.restore();
    }

    // 粒子
    for (i = 0; i < particles.length; i += 1) {
      var p = particles[i];
      var pp = p.age / p.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - pp * pp);
      ctx.fillStyle = p.color;
      var r = p.size * (1 - pp * 0.55);
      if (r <= 0.6) {
        ctx.restore();
        continue;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 飘字
    for (i = 0; i < floats.length; i += 1) {
      var f = floats[i];
      var fp = f.age / f.life;
      var ease = 1 - (1 - fp) * (1 - fp);
      var alpha = fp < 0.75 ? 1 : Math.max(0, 1 - (fp - 0.75) / 0.25);
      // 出现时有轻微放大，像「弹」出来
      var scale = fp < 0.12 ? 0.72 + (fp / 0.12) * 0.34 : 1.06 - Math.min(0.06, (fp - 0.12) * 0.2);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(f.x + f.drift * ease, f.y - f.rise * ease);
      ctx.scale(scale, scale);
      ctx.font = (f.bold ? "bold " : "") + f.size + "px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = Math.max(2, f.size * 0.18);
      ctx.strokeStyle = "rgba(4,9,13,0.72)";
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }

    // 全屏闪
    if (flashState) {
      var fa = flashState.age / flashState.life;
      ctx.save();
      ctx.globalAlpha = flashState.alpha * (1 - fa);
      ctx.fillStyle = flashState.color;
      ctx.fillRect(0, 0, 4096, 4096);
      ctx.restore();
    }
  }

  function clear() {
    particles.length = 0;
    floats.length = 0;
    rings.length = 0;
    shakeState = null;
    flashState = null;
  }

  return {
    burst: burst,
    float: float,
    ring: ring,
    shake: shake,
    flash: flash,
    tick: tick,
    render: render,
    isActive: isActive,
    getShake: getShake,
    clear: clear,
    count: function () {
      return particles.length + floats.length + rings.length;
    }
  };
}

module.exports = {
  createFx: createFx
};
