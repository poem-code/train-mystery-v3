/**
 * rng.js —— 可复现随机数（mulberry32）
 *
 * 为什么不用 Math.random：
 * 路线图按 seed 生成，存档只存 seed 就能还原同一张地图；
 * 读档后地图不会突然变形，也便于排查「同 seed 不同结果」的 bug。
 */

function createRng(seed) {
  var s = (seed >>> 0) || 1;
  function next() {
    s = (s + 0x6D2B79F5) >>> 0;
    var t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function int(min, max) {
    return Math.floor(next() * (max - min + 1)) + min;
  }

  function pick(list) {
    if (!list || !list.length) return null;
    return list[Math.floor(next() * list.length)];
  }

  function shuffle(list) {
    var arr = list.slice();
    var i;
    for (i = arr.length - 1; i > 0; i -= 1) {
      var j = Math.floor(next() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  return {
    next: next,
    int: int,
    pick: pick,
    shuffle: shuffle,
    /** 按权重表抽取 key，weights = { battle: 5, event: 3 } */
    weighted: function (weights) {
      var keys = [];
      var total = 0;
      var key;
      for (key in weights) {
        if (!Object.prototype.hasOwnProperty.call(weights, key)) continue;
        total += weights[key];
        keys.push({ key: key, w: weights[key] });
      }
      if (!total) return null;
      var roll = next() * total;
      var acc = 0;
      var i;
      for (i = 0; i < keys.length; i += 1) {
        acc += keys[i].w;
        if (roll <= acc) return keys[i].key;
      }
      return keys[keys.length - 1].key;
    }
  };
}

/** 全局默认随机（战斗伤害用，不需要复现） */
var globalRng = createRng(Date.now() & 0x7FFFFFFF);

module.exports = {
  createRng: createRng,
  int: globalRng.int,
  pick: globalRng.pick,
  shuffle: globalRng.shuffle
};
