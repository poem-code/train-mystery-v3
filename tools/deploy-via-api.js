/**
 * deploy-via-api.js —— 把网页演示版发布到 gh-pages（走 REST API）
 *
 * 与 tools/deploy-preview.sh 等价，只是不依赖 git 传输（本机到 github.com 的
 * 443 时常被代理 502，api.github.com 是通的）。
 *
 * 做的是一次「整树替换」：新 tree 不带 base_tree，等于删掉旧站点里的所有文件，
 * 只保留本次上传的 index.html / preview-bundle.js / assets / .nojekyll。
 *
 * 用法：node tools/deploy-via-api.js
 */

var execSync = require("child_process").execSync;
var fs = require("fs");
var path = require("path");

var OWNER = "poem-code";
var REPO = "train-mystery-v3";
var BRANCH = "gh-pages";
var API = "https://api.github.com";
var ROOT = path.resolve(__dirname, "..");

var token = execSync("gh auth token", { encoding: "utf8" }).trim();

function api(method, urlPath, body) {
  var cmd = [
    "curl -sS -X " + method,
    "-H \"Authorization: Bearer " + token + "\"",
    "-H \"Accept: application/vnd.github+json\"",
    "-H \"Content-Type: application/json\"",
    "-H \"X-GitHub-Api-Version: 2022-11-28\"",
    "\"" + API + urlPath + "\""
  ];
  if (body) cmd.push("--data-binary @-");
  var res = execSync(cmd.join(" "), {
    input: body ? JSON.stringify(body) : undefined,
    maxBuffer: 256 * 1024 * 1024
  });
  try {
    return JSON.parse(res.toString("utf8"));
  } catch (error) {
    console.error("响应不是 JSON：" + res.toString("utf8").slice(0, 300));
    process.exit(1);
  }
}

// 站点文件清单：入口改名 index.html，其余按原路径
var site = [
  { path: "index.html", local: "tools/preview.html" },
  { path: "preview-bundle.js", local: "tools/preview-bundle.js" }
];

function walk(dir, prefix) {
  fs.readdirSync(dir).forEach(function (name) {
    var full = path.join(dir, name);
    var rel = prefix ? prefix + "/" + name : name;
    if (fs.statSync(full).isDirectory()) walk(full, rel);
    else site.push({ path: "assets/" + rel, local: "assets/" + rel });
  });
}
walk(path.join(ROOT, "assets"), "");

var entries = [];
site.forEach(function (item) {
  var buf = fs.readFileSync(path.join(ROOT, item.local));
  var blob = api("POST", "/repos/" + OWNER + "/" + REPO + "/git/blobs", {
    content: buf.toString("base64"),
    encoding: "base64"
  });
  if (!blob.sha) {
    console.error("blob 失败：" + item.path);
    process.exit(1);
  }
  entries.push({ path: item.path, mode: "100644", type: "blob", sha: blob.sha });
});
// .nojekyll 让 Pages 不跑 Jekyll
entries.push({
  path: ".nojekyll", mode: "100644", type: "blob",
  sha: api("POST", "/repos/" + OWNER + "/" + REPO + "/git/blobs", {
    content: "", encoding: "utf8"
  }).sha
});
console.log("上传 " + entries.length + " 个文件");

var tree = api("POST", "/repos/" + OWNER + "/" + REPO + "/git/trees", { tree: entries });
if (!tree.sha) {
  console.error("tree 失败：" + JSON.stringify(tree).slice(0, 300));
  process.exit(1);
}

var existing = api("GET", "/repos/" + OWNER + "/" + REPO + "/git/ref/heads/" + BRANCH);
var parents = existing && existing.object ? [existing.object.sha] : [];

var commit = api("POST", "/repos/" + OWNER + "/" + REPO + "/git/commits", {
  message: "build(preview): 发布网页演示版 " + new Date().toISOString().slice(0, 16).replace("T", " "),
  tree: tree.sha,
  parents: parents
});
if (!commit.sha) {
  console.error("commit 失败：" + JSON.stringify(commit).slice(0, 300));
  process.exit(1);
}

var ref = parents.length
  ? api("PATCH", "/repos/" + OWNER + "/" + REPO + "/git/refs/heads/" + BRANCH, { sha: commit.sha, force: true })
  : api("POST", "/repos/" + OWNER + "/" + REPO + "/git/refs", { ref: "refs/heads/" + BRANCH, sha: commit.sha });

if (ref && ref.message) {
  console.error("更新 ref 失败：" + JSON.stringify(ref).slice(0, 300));
  process.exit(1);
}
console.log("已发布：" + commit.sha.slice(0, 7) + " → " + BRANCH);
console.log("https://poem-code.github.io/train-mystery-v3/");
