/**
 * build-bundle.js —— 把 js/ 下的 CommonJS 模块打成一个浏览器可用的 bundle
 *
 * 用途：不装任何构建工具的前提下，在浏览器里跑同一套代码做视觉走查。
 * 抖音小游戏本身支持 require，不需要打包；这个脚本只服务本地预览。
 */

var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var ENTRY = "js/main.js";
var OUT = path.join(__dirname, "preview-bundle.js");

function walk(dir, acc) {
  var list = fs.readdirSync(dir);
  list.forEach(function (name) {
    var full = path.join(dir, name);
    var stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full, acc);
    } else if (/\.js$/.test(name)) {
      acc.push(full);
    }
  });
  return acc;
}

function normalize(id) {
  var parts = id.split("/");
  var out = [];
  parts.forEach(function (part) {
    if (part === "." || part === "") return;
    if (part === "..") out.pop();
    else out.push(part);
  });
  return out.join("/");
}

var files = walk(path.join(ROOT, "js"), []);
var chunks = [];

files.forEach(function (file) {
  var rel = normalize(path.relative(ROOT, file).replace(/\\/g, "/"));
  var code = fs.readFileSync(file, "utf8");
  chunks.push(
    "define(" + JSON.stringify(rel) + ", function(module, exports, require) {\n" +
    code +
    "\n});"
  );
});

var bundle = [
  "/* 自动生成，请勿手改。源：js/ —— 由 tools/build-bundle.js 打包 */",
  "(function(global){",
  "  var defs = {};",
  "  var cache = {};",
  "  function define(id, fn) { defs[id] = fn; }",
  "  function normalize(id) {",
  "    var parts = id.split('/'); var out = [];",
  "    for (var i = 0; i < parts.length; i += 1) {",
  "      var p = parts[i];",
  "      if (p === '.' || p === '') continue;",
  "      if (p === '..') out.pop(); else out.push(p);",
  "    }",
  "    return out.join('/');",
  "  }",
  "  function resolve(from, request) {",
  "    var base = from.split('/').slice(0, -1).join('/');",
  "    var id = request.charAt(0) === '.' ? (base ? base + '/' + request : request) : request;",
  "    id = normalize(id);",
  "    if (!/\\.js$/.test(id)) id += '.js';",
  "    return id;",
  "  }",
  "  function load(id) {",
  "    if (cache[id]) return cache[id].exports;",
  "    var mod = { exports: {} };",
  "    if (!defs[id]) throw new Error('模块未找到: ' + id);",
  "    cache[id] = mod;",
  "    defs[id](mod, mod.exports, function(request){ return load(resolve(id, request)); });",
  "    return mod.exports;",
  "  }",
  "  global.__TM_LOAD__ = load;",
  "  global.__TM_ENTRY__ = " + JSON.stringify(ENTRY) + ";",
  chunks.join("\n\n"),
  "})(window);"
].join("\n");

fs.writeFileSync(OUT, bundle, "utf8");
console.log("已生成 " + path.relative(ROOT, OUT) + "（" + files.length + " 个模块，" + Math.round(bundle.length / 1024) + " KB）");
