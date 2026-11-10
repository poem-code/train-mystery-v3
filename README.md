# 列车秘境 · 抖音小游戏工程（V3）

分支路线轻 Roguelike。单局 9 层、12—16 个节点、5—8 分钟。
Canvas 全自绘，无 DOM 依赖，无第三方库，纯 ES5（`var` 到底），包体 ~1.3 MB。

> 本工程与 `train-mystery/`（H5 原型）、`train-mystery-douyin/`（V2 的 8×8 格子版）**不共用代码**，
> 只承接 V3 的玩法设计与数值口径。V2 工程保留作历史对照，不再往里加功能。

---

## 一、跑起来

```bash
# 1) 无头回归（不需要任何环境，Node 直接跑）
node tools/test-headless.js          # 75 项

# 2) 数值平衡模拟（批量跑局，统计通关率与死亡分布）
node tools/sim-balance.js 300

# 3) 本地视觉走查（浏览器打开，注入假 tt 对象，跑的是真机同一套分支）
node tools/build-bundle.js
start tools/preview.html

# 4) 重新合成音频（需要 Python 3，无第三方库）
python tools/gen-audio.py
```

进抖音开发者工具：

1. 打开抖音开发者工具 → 导入项目 → 选择本目录
2. 把 `project.config.json` 的 `appid` 换成你的小游戏 AppID
3. 把 `js/game/config.js` 的 `rewardedVideoAdUnitId` 换成真实激励视频广告位
4. 编译 → 真机预览

> 没配 AppID 也能编译预览，只是不能上传；没配广告位时激励视频按钮会提示不可用，**不会发奖**（刻意的风控）。

### 在线演示（不是产品形态）

**<https://poem-code.github.io/train-mystery-v3/>** —— 由 `gh-pages` 分支托管，同一套代码、同一套玩法分支，注入假 `tt` 走浏览器分支。用途只有三个：

1. 申请抖音小游戏**开发权限**时，平台要求填「可体验的测试链接」
2. 没有 AppID 时看效果、做截图走查
3. 给评审/队友一个点开就能玩的链接

**交付物只有一份：这个目录打出来的 tt 小游戏包。** 网页版缺少广告、分享、震动、真机性能，不能替代真机验收。

重新发布（改了代码后想更新线上演示）：

```bash
bash tools/deploy-preview.sh        # 重新打包 → 推到 gh-pages 分支
```

AppID 与广告位怎么申请、卡在哪一步，见 [`docs/DOUYIN_SETUP.md`](docs/DOUYIN_SETUP.md)。

### 预览页参数

| URL | 效果 |
|---|---|
| `preview.html` | 首页开始 |
| `preview.html?scene=train` | 直接进列车主城 |
| `preview.html?scene=route&advance=4` | 自动开一局并推进 4 个节点 |
| `preview.html?modal=battle` | 直接进战斗 |
| `preview.html?modal=battle&affix=frenzy` | 战斗界面强挂指定精英词缀 |
| `preview.html?modal=battle&fx=1` | 打一拳后停在 80ms，检查伤害飘字与粒子位置 |
| `preview.html?modal=enhance` / `shop` / `event` / `chest` / `camp` / `summary` | 对应弹窗 |
| `preview.html?modal=settings` / `trainUpgrade` | 设置 / 列车升级 |
| `preview.html?modal=info&view=collection` | 本局构筑图鉴 |
| `preview.html?modal=codex&tab=enemies` | 永久图鉴（`tab` = enemies / relics / enhancements / achievements） |
| `preview.html?modal=codex&tab=enhancements&page=2` | 图鉴指定页 |
| `preview.html?modal=daily` | 每日挑战 |
| `preview.html?w=375&h=812` | 指定逻辑分辨率（测小屏 / 大屏） |

---

## 二、目录结构

```
game.js                  入口，只 require js/main.js
game.json                小游戏配置（竖屏）
project.config.json      开发者工具配置（改 appid）

js/
  core/                  ——与玩法无关的引擎层，换题材可整体复用
    screen.js            逻辑分辨率 / 安全区 / 栅格（唯一坐标来源）
    draw.js              绘图原语：圆角面板、文字换行、进度条、剪影、节点字形、视差背景
    ui.js                按钮/卡片/徽标 + 命中区栈（后绘制者优先）
    tween.js             补间与缓动
    engine.js            主循环、脏渲染、输入分发、Toast、帧统计

  platform/              ——宿主差异收敛在这里
    platform.js          tt / 浏览器 / Node 三态封装（含剪贴板、震动、分享）
    audio.js             音效通道（12 个合成音）
    bgm.js               音乐通道（3 首循环，独立音量，渐变淡入淡出）
    ad.js                激励视频（含「不发奖」风控）
    diagnostics.js       环形日志 + 环境快照 + 一键复制

  game/
    config.js            所有数值（调参只改这里）
    rng.js               可复现随机（地图按 seed 还原）
    map.js               分支路线图生成与连通性修补
    state.js             纯玩法逻辑（无渲染/无存档/无平台依赖，可单测）
    storage.js           存档迁移、白名单合并、数值夹取
    ui-common.js         HUD、标题栏、日志、节点标记、弹窗信封
    registry.js          场景与弹窗注册表

    data/                纯数据，禁止放函数（否则存档不可序列化）
      enemies.js         30 个敌人模板（19 普通 / 6 精英 / 5 Boss）
      affixes.js         8 个精英词缀
      relics.js          26 件遗物
      enhancements.js    34 项局内强化
      events.js          32 个随机事件 + 3 条事件链
      items.js           道具与商店
      nodes.js           节点类型与每层权重
      achievements.js    12 条成就（声明式：metric + target + reward）
      daily.js           7 个每日限制条件 + 日期种子
      effects.js         效果字段定义与合并
      text.js            静态文案

    scenes/              home / train / route
    modals/              battle / event / enhance / shop / camp / chest /
                         summary / info / settings / trainUpgrade / codex / daily

assets/
  audio/                 12 个音效 + 3 首 BGM（合计约 928 KB，程序合成，无版权风险）

tools/
  test-headless.js       无头回归（75 项）
  sim-balance.js         批量模拟，输出通关率与死亡分布
  gen-audio.py           程序合成音效与 BGM
  build-bundle.js        把 js/ 打成浏览器可跑的 bundle（仅本地预览用）
  preview.html           注入假 tt 的本地预览，跑的是真机同一套分支

docs/                    架构 / 内容表 / 调参手册 / 上线清单 / 完善方案
```

### 分层规矩（改代码前先看这条）

| 层 | 可以做什么 | 不可以做什么 |
|---|---|---|
| `core/` | 任何题材都能用的绘制与交互 | 出现"列车""裂隙""以太"等业务词 |
| `platform/` | 封装 `tt.*` | 出现玩法判断 |
| `game/state.js` | 改数据、返回结果对象 | 落盘、弹窗、toast、碰 canvas |
| `game/scenes` `modals` | 画界面、调 `state` 与 `app` | 直接读写 `tt` 或 `storage` |
| `data/` | 纯数据 | 放函数（存档会坏） |

详见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

---

## 三、当前完成度

已实现（可玩闭环）：

- 首页 → 列车主城 → 出发 → 路线图 → 8 层节点 + Boss → 结算
- 节点类型：战斗、精英、事件、营地、商店、宝箱、Boss（全图保底各类至少 1 个）
- 回合战斗：精准 / 强力 / 防御 / 药剂 / 秒杀卡 / 撤离 / 重战卡 / 激励复活
- **30 个敌人**（19 普通 + 6 精英 + 5 Boss），**14 种行为特性**：
  反扑、立盾、吸能、蓄势、重甲、吸血、群袭、镜影、自爆、统御、
  **织网（缠住削弱下一击）、寄生（挂卵孵化）、狂化（半血永久加攻）、赌徒（伤害大幅浮动）**
- **8 个精英词缀**：6 精英 × 8 词缀 = 48 种组合，全部有真实行为分支
- **34 项局内强化**（3 选 1）：暴击流 / 盾流 / 残血流 / 先手流四条线各自能成型
- **26 件遗物**、**32 个随机事件 + 3 条 3 段式事件链**（链进度存档、跳段不惩罚）
- **永久图鉴 90 条目**（敌人 30 / 遗物 26 / 强化 34），25/50/75/100% 四档奖励
- **12 条成就**，声明式指标，奖励只给以太不给战力（不破坏平衡）
- **每日挑战**：日期哈希种子 + 3 条随机限制条件 + 独立奖励 + 钱包快照还原
- 局外：每日签到、免费补给、精神恢复冷却、**五模块列车升级**（餐车/医务室/动力室/货舱/观景台）、重置存档
- 存档：schema 3→4 迁移、白名单深合并、脏档自洽修补、地图按 seed 还原、每日限制按日期重推导
- 平台：激励视频风控、分享、震动、前后台落盘、错误上报、音效/音乐双通道三态封装
- **美术**：15 个按 trait 区分的矢量剪影原型（含织网/寄生/狂化/赌徒）+ 地面投影 + 高光弧 + 7 个几何节点字形 + 三层视差背景
- **打击感**：伤害飘字、粒子溅射、震屏、闪白、受击后坐力、12 个程序合成音效、3 首循环 BGM
- **可诊断**：环形日志（60 条）+ 环境快照 + 帧统计（fps / renderMs / 慢帧）+ 一键复制
- 隐私说明 / 用户服务 / 玩法说明 / 关于（提审必备页）

自动化验证：

| 手段 | 规模 | 结果 |
|---|---|---|
| `test-headless.js` | 75 项 | 75 / 75 通过 |
| `sim-balance.js` | 300 局 | 通关率 43.7%，平均 7.69 层，失败集中在 L9 Boss |

测试覆盖：整机启动、全链路自动通关（Math.random 固定种子，结果可复现）、存档往返与迁移、脏档与越界点击、
内容数据一致性（特性有分支 / 词缀字段有分支 / 效果字段有消费点 / 事件字段合法）、
14 种特性行为、8 个词缀行为、4 个新效果字段、事件链顺序与推进、
图鉴与成就发放、每日挑战确定性、建造保底语义、卡死保护。

---

## 四、待扩充（按优先级）

1. **真人美术资源**：目前是纯矢量剪影；接图集后替换 `draw.figure` 与节点图标，剪影已按 trait 分流，替换时按 `variant` 挂图即可
2. **多主题地图**：`data/nodes.js` 的权重表按主题配置化，配 3 套配色
3. **音效采样化**：现有音效是「能听出动作」的水平，正式版建议换真人采样
4. **服务端校验**：排行榜与付费上线前必须补 reward token 校验，否则本地存档可改
5. **社交与排行**：抖音侧的好友榜 / 挑战分享，需要开放平台权限

## 五、提审前材料清单（非代码）

- [ ] 小游戏 AppID、开发者资质 —— 见 [`docs/DOUYIN_SETUP.md`](docs/DOUYIN_SETUP.md)
- [ ] 图标 512×512、启动图、4—6 张商店截图（`_shots/` 已有一批可裁切）
- [ ] 隐私政策链接（游戏内已有说明页，但平台要求外链版本）
- [ ] 软著 / 版号评估结论（休闲无内购可先按平台要求走备案）
- [ ] 激励视频广告位 ID
- [ ] 版本说明与审核备注（写明"单机、无内购、无社交"）

详见 [`docs/RELEASE.md`](docs/RELEASE.md)。

---

## 六、文档索引

| 文档 | 内容 |
|---|---|
| [`docs/DOUYIN_SETUP.md`](docs/DOUYIN_SETUP.md) | **AppID 与广告位 ID 怎么申请**、开发权限申请、备案、卡点与耗时 |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | 四层边界、脏渲染、命中区栈、存档迁移、三态平台层 |
| [`docs/CONTENT.md`](docs/CONTENT.md) | 敌人 / 词缀 / 遗物 / 强化 / 事件 / 成就 / 每日条件全表 |
| [`docs/TUNING.md`](docs/TUNING.md) | 数值口径、调参入口、平衡模拟用法、常见失衡症状 |
| [`docs/RELEASE.md`](docs/RELEASE.md) | 提审材料、包体预算、真机自测清单、风控点 |
| [`docs/PLAN_V1.md`](docs/PLAN_V1.md) | 剩余部分完善方案（含明确不做清单与风险对策） |
| [`CHANGELOG.md`](CHANGELOG.md) | 版本记录 |
