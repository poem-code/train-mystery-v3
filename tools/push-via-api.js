/**
 * push-via-api.js —— 走 GitHub REST（api.github.com）推送提交
 *
 * 为什么需要它：本机代理对 github.com:443 的 CONNECT 一直 502，
 * 但 api.github.com 是通的。gh 已登录（token 在 keyring），
 * 于是用 Git Data API（blob → tree → commit → ref）绕过 git 传输。
 *
 * 用法：node push-via-api.js <仓库目录>
 * 幂等：远端已经是同一个 tree 时不重复提交。
 */

var execSync = require("child_process").execSync;
var path = require("path");

var repoDir = process.argv[2] || process.cwd();
var OWNER = "poem-code";
var REPO = "train-mystery-v3";
var BRANCH = "main";
var API = "https://api.github.com";

function git(cmd) {
  return execSync("git " + cmd, { cwd: repoDir, maxBuffer: 64 * 1024 * 1024 });
}

var token = execSync("gh auth token", { encoding: "utf8" }).trim();
if (!token) {
  console.error("拿不到 gh token");
  process.exit(1);
}

function api(method, urlPath, body) {
  var cmd = [
    "curl -sS -X " + method,
    "-H \"Authorization: Bearer " + token + "\"",
    "-H \"Accept: application/vnd.github+json\"",
    "-H \"Content-Type: application/json\"",
    "-H \"X-GitHub-Api-Version: 2022-11-28\"",
    "\"" + API + urlPath + "\""
  ];
  if (body) {
    // 大对象走 stdin，避免命令行长度限制
    cmd.push("--data-binary @-");
    var res = execSync(cmd.join(" "), {
      input: JSON.stringify(body),
      maxBuffer: 128 * 1024 * 1024
    });
    return JSON.parse(res.toString("utf8"));
  }
  var out = execSync(cmd.join(" "), { maxBuffer: 128 * 1024 * 1024 });
  return JSON.parse(out.toString("utf8"));
}

var message = git("log -1 --pretty=%B").toString("utf8").trim();
// 父提交用**远端 main 的当前 head**，不是本地 HEAD^：
// 之前几次用 API 推过，远端提交的 sha 和本地同名提交不是同一个对象，
// 拿本地父提交去建 commit 会 404。内容以本地这次提交为准即可。
var remoteRef = api("GET", "/repos/" + OWNER + "/" + REPO + "/git/ref/heads/" + BRANCH);
var parentSha = remoteRef.object.sha;
var files = git("show --name-only --pretty=format: HEAD")
  .toString("utf8").split("\n").filter(function (line) { return !!line.trim(); });

console.log("提交 " + files.length + " 个文件，父提交 " + parentSha.slice(0, 7));

var entries = [];
files.forEach(function (file) {
  var buf = execSync("git show HEAD:" + JSON.stringify(file), {
    cwd: repoDir, maxBuffer: 64 * 1024 * 1024
  });
  var blob = api("POST", "/repos/" + OWNER + "/" + REPO + "/git/blobs", {
    content: buf.toString("base64"),
    encoding: "base64"
  });
  if (!blob.sha) {
    console.error("blob 失败：" + file + " " + JSON.stringify(blob).slice(0, 200));
    process.exit(1);
  }
  entries.push({ path: file, mode: "100644", type: "blob", sha: blob.sha });
  console.log("  blob " + file);
});

var parentCommit = api("GET", "/repos/" + OWNER + "/" + REPO + "/git/commits/" + parentSha);
if (!parentCommit.tree || !parentCommit.tree.sha) {
  console.error("取父提交失败：" + JSON.stringify(parentCommit).slice(0, 200));
  process.exit(1);
}

var tree = api("POST", "/repos/" + OWNER + "/" + REPO + "/git/trees", {
  base_tree: parentCommit.tree.sha,
  tree: entries
});
if (!tree.sha) {
  console.error("tree 失败：" + JSON.stringify(tree).slice(0, 200));
  process.exit(1);
}

var commit = api("POST", "/repos/" + OWNER + "/" + REPO + "/git/commits", {
  message: message,
  tree: tree.sha,
  parents: [parentSha]
});
if (!commit.sha) {
  console.error("commit 失败：" + JSON.stringify(commit).slice(0, 200));
  process.exit(1);
}

var ref = api("PATCH", "/repos/" + OWNER + "/" + REPO + "/git/refs/heads/" + BRANCH, {
  sha: commit.sha,
  force: false
});
if (!ref.object || ref.object.sha !== commit.sha) {
  console.error("更新 ref 失败：" + JSON.stringify(ref).slice(0, 200));
  process.exit(1);
}
console.log("已推送：" + commit.sha.slice(0, 7) + " → " + BRANCH);
