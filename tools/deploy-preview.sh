#!/usr/bin/env bash
#
# deploy-preview.sh —— 把网页演示版发布到 gh-pages 分支
#
# 做了什么：
#   1. 跑无头测试（红就不发）
#   2. 打包 js/ 成浏览器可跑的 bundle
#   3. 在 gh-pages 分支上只放 index.html + preview-bundle.js + assets/
#   4. 推送到 origin
#
# 为什么不用 GitHub Actions：
#   推 workflow 文件需要 token 带 workflow scope，个人 token 常常没有。
#   分支部署不需要任何额外权限，也不依赖 CI。
#
# 用法：
#   bash tools/deploy-preview.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BRANCH="gh-pages"
SITE="$(mktemp -d)"

echo "==> 1/5 无头回归"
node tools/test-headless.js | tail -3

echo "==> 2/5 打包 bundle"
node tools/build-bundle.js

echo "==> 3/5 组装站点到临时目录"
cp tools/preview.html "$SITE/index.html"
cp tools/preview-bundle.js "$SITE/preview-bundle.js"
cp -r assets "$SITE/assets"
touch "$SITE/.nojekyll"
du -sh "$SITE"

CUR_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo "==> 4/5 在 $BRANCH 分支提交"
git checkout --orphan "$BRANCH" 2>/dev/null || git checkout "$BRANCH"
git rm -rf . -q
cp -r "$SITE"/. .
rm -rf "$SITE"
git add -A
git commit -q -m "build(preview): 发布网页演示版 $(date +%Y-%m-%d\ %H:%M)" || echo "（无变化，跳过提交）"

echo "==> 5/5 推送"
git push -f origin "$BRANCH"

git checkout "$CUR_BRANCH"

echo
echo "完成。线上地址：https://poem-code.github.io/train-mystery-v3/"
echo "首次使用需要在仓库 Settings → Pages 把 Source 设为 $BRANCH 分支根目录。"
