/**
 * map.js —— 分支路线图生成（纯函数，输入 seed 输出图）
 *
 * 结构：
 *   run.map = [ layer0[], layer1[], ... , bossLayer[] ]
 *   node = { id, layer, lane, type, visited, links: [下一层节点 id] }
 *
 * 生成规则：
 * 1. 每层 2—4 个节点，相邻层之间按「归一化横向距离」连边，形成分叉观感。
 * 2. 生成后修补连通性：每个节点至少一条出边（Boss 层除外），每个节点至少一条入边。
 * 3. 全图保底：至少 1 商店、1 营地、1 宝箱、1 精英，避免一局缺少关键构筑节点。
 */

var config = require("./config");
var nodes = require("./data/nodes");

function makeId(layer, lane) {
  return "n-" + layer + "-" + lane;
}

function connect(layers, rng) {
  var i;
  var j;
  for (i = 0; i < layers.length - 1; i += 1) {
    var cur = layers[i];
    var next = layers[i + 1];
    var curMax = Math.max(1, cur.length - 1);
    var nextMax = Math.max(1, next.length - 1);

    for (j = 0; j < cur.length; j += 1) {
      var p1 = j / curMax;
      var links = [];
      var k;
      for (k = 0; k < next.length; k += 1) {
        var p2 = k / nextMax;
        // 距离阈值随两层节点数放宽，避免窄层全连
        var limit = 0.55 + (0.2 * Math.min(cur.length, next.length)) / 4;
        if (Math.abs(p1 - p2) <= limit) {
          links.push(next[k].id);
        }
      }
      if (!links.length) {
        // 退化：连最近的一个
        var best = 0;
        var bestDist = 9;
        for (k = 0; k < next.length; k += 1) {
          var d = Math.abs(p1 - k / nextMax);
          if (d < bestDist) {
            bestDist = d;
            best = k;
          }
        }
        links.push(next[best].id);
      }
      cur[j].links = links;
    }

    // 入边修补：确保下一层每个节点都能被走到
    for (j = 0; j < next.length; j += 1) {
      var hasIn = cur.some(function (node) {
        return node.links.indexOf(next[j].id) >= 0;
      });
      if (!hasIn) {
        var pickIndex = rng.int(0, cur.length - 1);
        cur[pickIndex].links.push(next[j].id);
      }
    }
  }
  return layers;
}

/** 保底：确保关键节点类型存在 */
function ensureCoverage(layers) {
  var required = ["shop", "camp", "chest", "elite"];
  var present = {};
  var candidates = [];
  var i;
  var j;

  for (i = 1; i < layers.length - 1; i += 1) {
    for (j = 0; j < layers[i].length; j += 1) {
      present[layers[i][j].type] = true;
      candidates.push(layers[i][j]);
    }
  }

  var missing = required.filter(function (type) {
    return !present[type];
  });

  // 用「普通战斗」节点改造，避免破坏事件密度
  var spare = candidates.filter(function (node) {
    return node.type === "battle";
  });

  missing.forEach(function (type, index) {
    var target = spare[index];
    if (target) target.type = type;
  });

  return layers;
}

function generate(seed) {
  var rng = require("./rng").createRng(seed || 1);
  var layers = [];
  var layerCount = config.routeLayers;
  var i;
  var j;

  for (i = 0; i < layerCount; i += 1) {
    var count;
    if (i === 0) {
      count = 2;
    } else {
      count = rng.int(config.layerMinNodes, config.layerMaxNodes);
    }
    var layer = [];
    var weights = nodes.weightsForLayer(i);
    for (j = 0; j < count; j += 1) {
      var type = i === 0 ? "battle" : rng.weighted(weights);
      layer.push({
        id: makeId(i, j),
        layer: i,
        lane: j,
        type: type || "battle",
        visited: false,
        links: []
      });
    }
    layers.push(layer);
  }

  // Boss 层
  layers.push([
    {
      id: makeId(layerCount, 0),
      layer: layerCount,
      lane: 0,
      type: "boss",
      visited: false,
      links: []
    }
  ]);

  ensureCoverage(layers);
  connect(layers, rng);

  return layers;
}

function findById(map, nodeId) {
  var i;
  var j;
  if (!map) return null;
  for (i = 0; i < map.length; i += 1) {
    for (j = 0; j < map[i].length; j += 1) {
      if (map[i][j].id === nodeId) return map[i][j];
    }
  }
  return null;
}

/** 当前可前往的节点：无当前节点则第一层全开，否则走上一次的 links */
function available(map, currentNodeId) {
  if (!map || !map.length) return [];
  if (!currentNodeId) return map[0] || [];
  var current = findById(map, currentNodeId);
  if (!current) return [];
  var out = [];
  var i;
  for (i = 0; i < current.links.length; i += 1) {
    var node = findById(map, current.links[i]);
    if (node) out.push(node);
  }
  return out;
}

module.exports = {
  generate: generate,
  findById: findById,
  available: available,
  makeId: makeId
};
