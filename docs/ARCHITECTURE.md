# 架构说明

> 面向接手的人。看完这份能知道「东西该放哪」「为什么这么放」「改哪里会炸」。

---

## 一、四层边界

```
main.js          组装层：注册场景/弹窗、分发输入、同步音频、全局错误兜底
  ├─ js/core/      引擎层（换题材可整体复用，不含任何业务词）
  ├─ js/platform/  宿主层（把 tt / 浏览器 / Node 的差异吃在这里）
  ├─ js/game/      玩法层
  │    ├─ scenes/ modals/   渲染层：只画，不改数据
  │    ├─ state.js          逻辑层：只改数据，不碰画布/存档/平台
  │    ├─ storage.js        持久层：读盘、迁移、夹取
  │    └─ data/             纯数据：只放值，不放函数
  └─ assets/       静态资源
```

### 为什么这么切

| 层 | 硬性约束 | 破坏后会怎样 |
|---|---|---|
| `core/` | 不得出现「列车 / 裂隙 / 以太 / 遗物」等业务词 | 换皮时要逐行改引擎 |
| `platform/` | 不得出现玩法判断（不许写 `if (hp < 0)`） | 三态分支失控，真机与预览行为不一致 |
| `state.js` | 不得落盘、弹窗、toast、碰 canvas | 无法无头测试；Node 下 require 就崩 |
| `scenes/modals` | 不得直接读 `tt.*` 或 `storage` | 绕过存档夹取，脏档能写回 |
| `data/` | **不得放函数** | 存档 `JSON.stringify` 丢函数，读回来是 `undefined` |

最后一条踩过坑：早期把 `events.js` 的奖励写成 `function(player){...}`，
存档能写但读回来表达式变成 `undefined`，表现为「读档后事件选项全失效」。

### 检查手段

`tools/test-headless.js` 里有一组一致性测试，用正则反查源码：

- 每个 `trait` 必须在 `state.js` 里有对应分支（`enemyTurn` / `applyMirrorReflect` 等）
- 每个词缀字段必须在 `state.js` 里被消费
- `effects` 的每个字段必须在白名单里
- 事件选项的 `require` 字段必须是已知资源名

新增内容忘了写行为？测试直接红，不用等玩家发现「这个敌人怎么不打我」。

---

## 二、渲染：脏标记 + 命中区栈

### 脏渲染

`engine.js` 不是每帧全量重绘，而是：

```
dirty === true  →  重绘
dirty === false →  跳过 canvas 调用，只跑 tick
```

`invalidate()` 是唯一入口。下列情况会置脏：

- 用户输入（点击 / 触摸）
- `tween` 有活跃补间
- `fx` 有存活的粒子 / 飘字 / 震屏 / 闪白
- `toast` 存活
- 场景主动 `invalidate()`（切场景、数据变化）

静态界面（主城、图鉴翻页后不动）在低端机上几乎不耗 GPU。
这也是能在千元安卓机上稳 60fps 的主要原因。

### 命中区栈

**没有 DOM，就没有事件冒泡**。手写一套：

```js
ui.beginFrame(screen, time);   // 清空命中区栈
ui.button(ctx, {...});         // 绘制的同时 pushHit({ id, rect })
// ... 弹窗最后画，所以最后 push，在栈顶
var hit = ui.hitTest(x, y);    // 从栈顶往下找第一个包含点的矩形
```

好处是**绘制顺序天然等于遮挡顺序**：弹窗盖住场景，点击就落在弹窗上，
不需要「先判断有没有弹窗」这类 if 分支。这也顺手解决了「弹窗开着能点到底下按钮」的经典 bug。

### 分辨率

`core/screen.js` 是唯一坐标来源：

- 逻辑分辨率按设计稿 375×812 等比缩放，短边贴合、长边留白
- 安全区从 `tt.getSystemInfoSync()` 的 `safeArea` 取，刘海屏顶部自动让位
- 所有绘制代码只认 `screen.w` / `screen.h` / `screen.safeTop`，禁止写死像素

---

## 三、平台层三态

`platform/platform.js` 在 require 时**探测一次**环境，之后所有调用走同一套分支：

| 环境 | 判定 | canvas | 音频 | 存储 | 分享 |
|---|---|---|---|---|---|
| tt | `typeof tt !== "undefined"` | `tt.createCanvas()` | `tt.createInnerAudioContext()` | `tt.getStorageSync` | `tt.shareAppMessage` |
| 浏览器 | `typeof window !== "undefined"` | `document.createElement("canvas")` | `new Audio()` | `localStorage` | `navigator.share` 降级为复制链接 |
| Node | 其余 | 传入的 stub | no-op | 内存 Map | no-op |

这带来的直接收益是 `tools/test-headless.js` **不需要模拟器**：
在 Node 里 stub 一个 canvas（所有绘图方法都是空函数），跑的是和真机完全相同的分支。

### 音频双通道

`audio.js`（音效）与 `bgm.js`（音乐）故意分开：

- 失败模式不同：音效短、并发多、失败无声无息；音乐长、单实例、失败要能恢复
- 玩家诉求不同：很多人只想关音乐保留音效
- tt 容器对 `volume` 的响应有延迟，改音量会爆音，所以 `bgm.fadeTo()` 拆成 8 步渐变

---

## 四、存档与迁移

`schemaVersion` 当前 **4**。改 `state` 结构必须 +1 并在 `storage.migrate` 补迁移。

### 读档管线

```
readRaw(key)          依次尝试新 key → legacyKeys → 返回 null
  ↓
migrate(raw)          按 schemaVersion 逐级升级（v2→v3→v4）
  ↓
sanitize*(raw)        每个字段过一遍白名单 + clamp
  ↓
load()                合并默认值，缺失字段补齐
```

### 为什么每个字段都要 sanitize

本地存档可以被改（改包、改内存、root）。所有数值都是**不可信输入**：

- `toInt(value, min, max, fallback)` —— 越界夹取，`NaN` 走 fallback
- `sanitizeIdMap` —— 只保留已知 id，未知 id 直接丢弃（防止注入不存在的遗物）
- `sanitizeLayers` —— 地图按 seed 重新生成，不信任存档里的坐标
- `sanitizeDaily` —— **不信任存档里的限制条件，按 `dateKey` 重新推导**
  （否则改档能把「脆弱躯壳」改成无限制，白拿奖励）

### 迁移要点

- v2→v3：新增 `progress.codex` / `progress.achievements` / `progress.daily`，老档补空对象
- v3→v4：`settings.soundOn` 拆成 `sfxOn` + `bgmOn`，老档把 `soundOn` 映射到两者
- v4→v5：新增 `progress.themeUnlocked` / `progress.themeSelected` / `run.theme`，老档补 `rust`
- 每一步迁移都写测试（`v3 老档迁移后补齐新字段` / `老档音效开关映射到 sfxOn` / `旧档无主题字段时补默认值`）

**迁移函数必须幂等**：同一个档跑两次迁移结果一致。否则「读档-存档-读档」会滚雪球。

### 修正符合并：`modsOf(run)`

「每日限制条件」与「车厢主题」本质是同一类东西：一组对数值的修正。所以两边共用一套字段形状，
由 `state.modsOf(run)` 合并成一个对象给消费点用：

```js
// daily.combine() 的输出          theme.mods
{ enemyDamageMul: 1.2,     +      { enemyDamageMul: 0.85, hungerPerNodeDelta: 1 }
  sanityCostMul: 2 }               }
        ↓
modsOf(run) = { enemyDamageMul: 1.02, sanityCostMul: 2, hungerPerNodeDelta: 1, ... }
```

规则：**加法字段相加（delta），乘法字段相乘（mul）**。

为什么不让消费点各自判断来源：上一个版本里 `run.daily ? run.daily.combined.x : 1` 散在
6 个地方（开局血量、精神消耗、每层饱食、敌人伤害、强化候选数、商店价格），
加主题就得改 6 处，漏一处就是「主题只在部分系统里生效」的隐性 bug。

**新增任何修正来源时，只改 `modsOf` 一个函数**，消费点不用动。

### 内容权重而不是硬过滤

主题影响「遇到谁」的方式是权重：`themes` 字段命中的 ×3，明确属于别的主题的 ×0.4，
没打标签的 ×1。**不做硬过滤**——硬过滤会让低层数下池子变空，最后仍要 fallback，
等于白写一层逻辑，还会让「霜封车厢只有两种怪」的体感更差。

### 序列奖励的记账：`run.setActive`

遗物序列（套装）不能在每次读取时「按当前件数实时算加成」——那样`run.effects`
会随着遗物增删反复累加，而 `effects` 是一张只增不减的汇总表，没有「撤销」这一说。

所以改成**事件式发放 + 记账**：

```js
run.setActive = { arsenal: 2 }   // 军械序列前两档已经发过奖
```

- `applySetBonuses(state)` 在「获得遗物」后调用，只补发 `index >= setActive[id]` 且件数够的档位，
  发完写回 `setActive`
- **幂等**：重复调用不会二次加属性（测试里有断言）
- **读档补算**：启动时 `reconcileSets()` 跑一次，老存档（没有 `setActive`）会补齐应得档位；
  已有记账的存档是空操作
- 生命上限类奖励要**同时**写 `run.effects.maxHpBonus` 和 `player.maxHp`，
  只写一边会出现「面板显示 +6」但实际不生效

记录「已发过第几档」而不是「满足第几档」是刻意的：前者是事实，后者是推断。
用推断值做幂等键，一旦遗物列表被存档清洗改动（比如旧档 relics 是字符串数组），
就会重复发奖。

---

## 五、确定性随机

`rng.js` 是 LCG，`createRng(seed)` 返回 `next()` / `int(n)` / `pick(arr)` / `shuffle(arr)`。

- 一局的路线图由 `run.seed` 决定，**只存 seed 不存图层结构**
- 读档时按 seed 重放，得到完全相同的地图
- 每日挑战的 seed 由 `FNV-1a("YYYY-MM-DD")` 生成，同一天所有人路线一致
- 词缀抽取、强化候选、事件结果全部走同一 rng，保证可复现

好处：存档体积小、可以回放、可以做「每日同屏」、bug 能按 seed 精确复现。

### 必须走 seed rng 与允许 Math.random 的边界

这条边界是刻意划的，不是漏了：

| 场景 | 用什么 | 理由 |
|---|---|---|
| 路线图生成、节点类型、连通性修补 | **必须** `createRng(run.seed)` | 读档要能重放出同一张图 |
| 强化候选、遗物池、词缀抽取 | **必须** seed rng | 每日挑战要「同一天同一组候选」 |
| 战斗命中判定、反伤骰、事件风险掷骰 | `Math.random()` 可以 | 这类不需要复现；强行确定性反而让同一天所有人打出一模一样的过程，失去操作空间 |

所以「每日挑战」的承诺是**路线与条件一致，过程与结果由你打**，不是「全员同一盘录像」。
`state.js` 里出现 `Math.random()` 的全部是后者（命中 / 掷骰），一眼可分。

---

## 六、主循环与错误边界

```js
engine.__tick(dt)   // 测试可直接调用，手动推进帧
```

`main.js` 的 `dispatch()` 外包了 try/catch：

```js
try { ...分发点击... }
catch (err) {
  diagnostics.reportError(err);   // 记环形日志
  toast("刚才那下没成功，已记录");  // 告诉玩家
}
```

一次点击出错不应让整局停摆。配合 `platform/diagnostics.js` 的
`tt.onError` 挂载 + 环形日志（60 条）+ 环境快照 + `snapshot()` 一键复制，
解决「用户说闪退但我复现不了」这类问题。

设置页的「复制诊断信息」会一起写 `engine.getPerf()` 的帧统计
（fps / renderMs / worstRenderMs / slowFrames），低端机卡顿能直接看到量化数据。

---

## 七、加内容的正确姿势

| 想加什么 | 改哪里 | 别忘了 |
|---|---|---|
| 新敌人 | `data/enemies.js` | 若带新 `trait`，必须在 `state.enemyTurn` 加分支，否则一致性测试红 |
| 新词缀 | `data/affixes.js` | 同上，且在 `config` 里确认 `eliteHpMul` 还成立 |
| 新遗物 / 强化 | `data/relics.js` / `enhancements.js` | `effects` 字段必须在白名单里；图鉴会自动纳入（总数变了要同步文案） |
| 新事件 | `data/events.js` | 只放数据；概率分支用 `chance`，别塞函数 |
| 新成就 | `data/achievements.js` | `metric` 必须在 `state.computeMetrics` 里有产出 |
| 新节点类型 | `data/nodes.js` + `scenes/route.js` + `state` | 权重表按层配置，注意保底逻辑 |
| 新数值 | `config.js` | **只改 config**，场景里不许出现魔法数字 |

改完跑：

```bash
node tools/test-headless.js && node tools/sim-balance.js 300
```

测试绿 + 通关率在 40%—60% 区间，才算改完。
