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
- `tween` **任意**补间在跑（`animator.anyRunning()`）
- `fx` 有存活的粒子 / 飘字 / 震屏 / 闪白
- `toast` 存活
- **当前视图是「会动的」**（`isLiveView`），且距上次待机重绘 ≥ 80ms
- 场景主动 `invalidate()`（切场景、数据变化）

静态界面（主城、图鉴翻页后不动）在低端机上几乎不耗 GPU。
这也是能在千元安卓机上稳 60fps 的主要原因。

### 待机动画：为什么要先声明「会动」

待机呼吸是**常驻**动画，天然和脏渲染冲突：不重绘就不动，每帧重绘就等于
在主界面上常开 60fps。折中办法是两道闸：

1. `main.js` 注入 `isLiveView(state)`，只有战斗页返回 true；
   引擎不认「battle」这个词，业务语义留在业务层。
2. 即便声明了「会动」，也只在 `clock - lastLivePaint >= 80ms` 时置脏，
   即上限 ~12fps。呼吸幅度只有 2px，12fps 已经足够顺；换成 60fps 除了多耗电看不出区别。
   实测一场战斗的待机重绘是 4 次 / 320ms，而不是 20 次/帧。

`clock` 是引擎累计的毫秒数（不是帧数），通过 `render(ctx, screen, state, animator, clock)`
透传到界面。动画相位一律由 `clock` 算出来，**任何界面都不许存动画中间状态**——
一旦存了，回前台、切分辨率、存档读档三处都要各自处理一遍。

### 形变在 draw 层做，不在业务层做

`draw.figure(ctx, cx, cy, size, kind, color, variant, pose)` 的第八个参数是可选的
`{ bob, sx, sy, rot }`，画的时候临时做一次 `translate → rotate → scale → translate`。
好处是四个调用面（战斗、路线图、图鉴、结局）自动共享同一套形变规则，
不需要各自算坐标；`pose` 缺省时产生的绘制指令与旧版逐条一致。

只让身体形变、影子留在地上，是这一层唯一的硬约束：
影子跟着身体一起上下浮动，角色就不像在呼吸，像贴在屏幕上的一张纸在抖。
所以 `figShadow()` 多接一个 `lift`，离地越高影子越小越淡。

**为什么还要 `rot`**：只有 `bob/sx/sy` 时，想表达「前倾」只能整体平移，
读起来是「挪了一步」。人的重心在脚上，身体倾出去而脚不动，才像在使劲。
旋转绕脚底中心做，倾角再大脚也不会离地。

**动作曲线必须显式要线性**。`animator.progress()` 默认套 `easeOutCubic`，
按「前 35% 后仰、后 65% 前扑」设计的分段动作，会被压成「前 100ms 走完 70%」，
画面上直接看不见。凡是按真实时间比例分段写的动作都要传 `linearEase`，
缓动交给包络（`sin`），不要交给 progress。

### 预告：状态领先画面一个回合

敌人的特殊招式（蓄势重击 / 连击 / 黏网）走一条固定管线：

```
敌方回合末尾 writeTelegraph(battle)    →  battle.telegraph = { kind, label, detail }
玩家回合期间 render() 只读 telegraph    →  气泡 + 蓄力姿态 + 防御按钮高亮
下一个敌方回合开头 tele = telegraph; telegraph = null  →  按 kind 结算
```

三条规矩：

1. **UI 不许自己推「敌人下一步要干嘛」**。判断只写一次（`writeTelegraph`），
   渲染层读状态。否则两处逻辑迟早分叉，玩家会看到「预警说连击、实际却重击」。
2. **预告里的数字就是结算时的数字**。蓄势层数的累加因此挪到预告时进行，
   而不是结算时——写成「约 +8」等于没写。
3. **预告必须先于玩家的行动出现**。所以写入点在敌方回合末尾，而不是玩家点击之后；
   玩家看到气泡时，这一回合的操作还没发生，这才是「反应窗口」。

由此带来的一个副作用要在测试里钉住：预告不能改变任何玩法数值。
`test-headless` 有一条「有预告的回合玩家照常输出」，就是防这一条。

### 状态跃迁挂在唯一收口上，不挂调用点

Boss 换阶段（`checkBossPhase`）的触发写在 `dealEnemyDamage()` 里，而不是四个攻击分支上。

`dealEnemyDamage` 是所有对敌伤害的唯一出口——普通攻击三条、秒杀卡、未来任何新伤害源
都要过它。挂在调用点上要加五处，加第六个伤害源时必然漏；挂在收口上，
新伤害源天生自动接入，漏不掉。

代价是 `dealEnemyDamage` 从「纯计算」变成「可能改阶段」，所以要守两条：

1. **它仍然不写日志**。日志倒序显示（最新在最上），在这里写会得到「崩开 → 命中」，
   玩家从上往下读是反的。崩开的日志改在 `enemyTurn()` 的换阶段分支里补，
   按时间顺序 push，显示出来才是对的。
2. **返回值语义不变**。调用方仍然只关心 `{ dealt, absorbed }`，
   阶段变化由调用方自己对比 `battle.phase` 前后值得知（`battle.js` 的 `phaseBroke`）。
   让收口函数返回「顺便还换了阶段」，等于逼每个调用点都去判断这个副作用。

第三条约束是数据层的：**一击致死不放行**（`battle.hp <= 0` 直接返回），
否则会出现「刚裂开就死了」的动画——血条都空了，还在播第二阶段。

### 第二形态是数据，不是 if

五个 Boss 的第二形态各不相同（双影 / 查票 / 过载 / 脱轨 / 换宿主），但逻辑侧
**没有一处按敌人 id 分支**：`enemies.js` 的模板上挂一个 `phase2` 对象，
`state.js` 用 `phase2Of(battle)` 取出来，只认字段：

| 字段 | 作用 | 谁读 |
|---|---|---|
| `label` / `line` / `tip` | 徽标文案、崩开描述、规则说明 | `checkBossPhase` 写进 `battle.phaseLabel`；日志与徽标只读它 |
| `hits` / `hitScale` | 一回合打几段、每段系数 | `enemyTurn` 分段结算 |
| `extraChance` / `extraScale` | 追加一段的概率与系数 | 同上 |
| `repeatPunish` | 重复上回合动作的加伤比例 | 同上，对比 `battle.lastAction` / `prevAction` |
| `dmgMul` / `selfBleed` | 伤害倍率、每回合自损 | 同上 |
| `dotOnPlayer` / `healCut` | 穿盾固定伤害、治疗削减 | 同上 / 药剂分支 |
| `shield` / `cadence` / `dmgAdd` | 换阶段护盾、预告节奏、伤害区间加成 | 换阶段分支 / `writeTelegraph` |

理由和「唯一收口」是同一条：**加第六个 Boss 不该改逻辑**。写在 `if (enemyId === "xxx")`
里，加形态就要改五处，测试也只能逐个人肉验证。放在数据里，新增形态只要写一个对象，
测试的「字段组合互不相同」护栏会自动覆盖它。

两个副作用必须一起处理，否则读档等于改难度：

- `phaseLabel` / `phaseHits` 要进存档。丢了 `phaseHits`，读档后双影退化成单体。
- `lastAction` / `prevAction` 要白名单化。它们是「查票」的判定依据，
  来自可被篡改的存档，不白名单化就等于让存档文件决定伤害。

表现层同理：`battle.js` 只读 `battle.phaseHits > 1` 决定要不要多画一具剪影，
读 `battle.phaseLabel` 决定徽标写什么——它不查敌人表，也不猜。

### 登场卡是一个状态，不是第六个弹窗

Boss 战开局那张卡没有自己的 `modal` 名，它是 `battle` 里的一个布尔：

```js
if (battle.introOpen && !battle.over && state.player.hp > 0) {
  renderBossIntro(ctx, screen, r, battle, clock);
  return;                       // 这一帧到此为止，不画血条、不画日志、不画行动按钮
}
```

做成独立弹窗需要：注册表加一行、`main.js` 的路由多一个分支、返回键多一种语义、
退出路径多一条「卡开着的战斗怎么退出」。而这些都给不出任何好处——
玩家的感知里它就是战斗的第一屏。

`return` 而不是「画在上面」是刻意的：叠层会让玩家以为可以边看卡边点按钮，
而此刻四个行动按钮都还没有意义。代价是这一帧只有卡片自己注册了命中区，
点在卡片外的空白处会命中**底下的场景**（路线图节点）。这条路径是安全的：
`main.js` 的 `dispatch` 只要发现 `current.modal` 非空就只往弹窗转，
而弹窗的第一条判断就是「卡还开着 → 只关卡」，所以那一下不会把玩家送走。

关卡片也**不是一次战斗行动**：`dismissBattleIntro()` 只清布尔，不动回合、不调
`enemyTurn`、不掉血。并且 `onAction` 的第一条就是「卡还开着 → 只关卡，别的都别做」：

```js
if (command === "intro" || (state.run.battle && state.run.battle.introOpen)) { ... }
```

少了这条判断，卡片开着时手指落在上一场「精准射击」的位置，就会替玩家出一招——
他只是在读字，却白挨了一击，而且这一击和「读卡」毫无因果关系。

**埋点与回收必须写在同一份数据里。** 登场卡的 `phase2.hint` 与崩开时的
`phase2.callback` 是同一件事的两端，放在同一个对象上；`state.js` 的换阶段分支只读
`callback`，不重新组织措辞。两处文案分家，第二版就会变成「卡上说影子，日志里说别的」。

回收那两个还有两条小约束。**先 push 呼应再 push 崩开**：日志是倒序显示，
反过来读就成了「玩家先顿悟、敌人再裂开」。**没有铺垫就不写**：判据是
`battle.introHint` 是否存在——0.9.4 的老存档打到一半读回来，它没见过那张卡，
这时候冒出一句「你想起了什么」只会让人莫名其妙。

`figure()` 的坐标语义也在这里踩过一次：传给它的 `cy` 是**躯干中心**，
双角顶到 `cy - 0.66×size`、躯干底在 `cy + 0.52×size`。登场卡按这个比例算
剪影的上下边，名字才贴得住；第一版直接 `cy + 20` 当名字位置，名字写进了它的胸口。

### 补间必须能拦住「所有」动画

早期帧循环只检查转场那个 key：

```js
if (animator.isRunning(transitions.key)) dirty = true;   // 只盯一个
```

受击后坐力这类补间只能蹭粒子的重绘顺风车——粒子一停，角色就定在中间帧。
现在改成 `animator.anyRunning()`。这条 bug 在加待机动画时才暴露：
呼吸动画没有粒子陪着，一停就是「敌人卡在压扁状态」，非常显眼。

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

### 最小触控区：视觉不变，命中区外扩

界面按 390 宽排，`screen.px()` 在 360 宽的小屏上会把胶囊缩到 58×27、把路线图上的
主题胶囊缩到 56×19——**看起来没问题，手指点不中**。

解法是移动端的老办法：绘制按视觉尺寸，`pushHit` 时把命中区外扩到最小 44×44。
放在 `pushHit` 内部而不是 `ui.button` 里，是因为所有可点区域都走这一个入口
（按钮、卡片、场景自己 `pushHit` 的胶囊），改一处就全覆盖。

外扩必须带两条约束，缺一条就是拿一个 bug 换另一个：

1. **不越出屏幕**。越界的命中区等于把点击送给屏幕外，玩家体感是「点了没反应」。
2. **不与已注册的命中区重叠超过 25%**。地图节点通常比小胶囊先注册，
   外扩如果吃掉节点点击区，路线图就会点不动。冲突时**放弃外扩**，宁可保持小命中区。

代价是 `hit.rect` 不再等于视觉矩形。所以任何「按 hit 坐标反推布局」的代码都是错的——
hit 只用来判点击，不用来量排版。

### 绘制预算：两种口径，两个数

`core/metrics.js` 给 ctx 包一层，把「这一帧画了多少」变成可读的数。分两个口径：

| 口径 | 包含 | 战斗最重帧实测 | 预算 |
|---|---|---|---|
| **光栅化调用** | fill / stroke / 文字 / 贴图 / clearRect | **291** | ≤ 400 |
| **全部指令** | 上面这些 + 路径构造 + save/restore | 960—1110（峰值 1262） | ≤ 1300 |

**为什么要分开**：`lineTo` 只改路径、不落像素；`fill` 才是一次真正的绘制提交。
混成一个数，看不出瓶颈是「路径拼得太碎」还是「填充次数太多」——前者靠合并路径修，
后者靠分层缓存修，方向完全不同。

**第二个数是回归护栏，不是性能指标**。它会随粒子数量与动画相位波动（实测差 150 条），
所以取实测峰值的 1.2 倍；超过 1300 就不是波动，是真的把背景画了两遍。

包一层转发在低端机上是真实开销，所以留了 `config.perf.instrument = false`
整层关掉的口子：关掉后计数恒为 0，渲染行为不变。默认开着，是因为
「掉帧时能看出是不是画得太多」这件事，比那零点几毫秒值钱。

### 走查：为什么不用截图

截图只能证明「我看到的那一帧没问题」：换分辨率、换一段文案、换一个 Boss 名字，
就得重看一遍。而排版问题的本质是**坐标算错**，那就直接量坐标。

`tools/ui-audit.js` 用无头渲染跑 7 个界面 × 3 档分辨率（360×640 / 390×844 / 768×1024），
三条判据：点击区越界、文字写出屏、按钮互相重叠超过六成。

**文字出屏**靠钩住 `fillText`：读取 `ctx.font` 与 `textAlign`，还原左右边界再和屏宽比。
右边缘被裁掉的字在截图里极不显眼，但它就是玩家看不到的信息。

**这个脚本第一版是假绿。** `hit` 的形状是 `{ id, rect, meta, kind }`——坐标在 `rect` 里，
第一版按 `hit.x` 判，全是 `undefined`，`undefined < -1` 恒为 false，于是 21 格全绿。
所以现在带 `--selftest`：故意画一条超长文字、一个越界按钮、一对重叠按钮，
三项必须都报红。**检查器自己也会坏，得有一条断言盯着它。**

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

### 打击音效分层：数据决定音色

敌人带 `material` 字段（`data/materials.js`），战斗只负责「按材质取音层」：

```js
materialsApi.layersFor(battle.material, { crit: dealt >= 20 })
// → [{name:"crit",volume:0.78},{name:"hit_metal",volume:0.40}]  重击
// → [{name:"hit_flesh",volume:0.66}]                              普通命中
```

返回**数组**而不是单个名字，是为了让调用处直接 for 循环播：
以后要加「破盾层」「属性层」不用改调用处签名。

三处设计取舍：

- **音层要拼，不要逐敌人配**。4 材质 × 2 强度 = 8 条音轨；逐敌人配是 60 条，包体先炸。
- **材质是纯表现**。测试里有一条「材质不参与数值计算」：同一场战斗换成别的材质，
  玩家与敌人的血量变化必须完全一致。一旦让材质影响伤害，它就成了第 5 个隐藏属性。
- **按需建池**。`audio.play()` 第一次播某个名字时才创建它的实例池，
  一口气建满 16 个音效会瞬间占用 32 个 `InnerAudioContext`，低端机上容易撞宿主上限，
  超出的实例静默失败——听起来就是「某些音效丢了」。

名字写错不会报错，只会无声。所以测试会校验两层：
`materials.hit` 必须在 `audio.SOUND_NAMES` 里，且 `assets/audio/<hit>.wav` 真的存在。

---

## 四、存档与迁移

`schemaVersion` 当前 **5**。改 `state` 结构必须 +1 并在 `storage.migrate` 补迁移。

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
engine.__tick(dt)   // 强制重绘一帧（等价于「有输入发生」）
engine.__step(dt)   // 只推进时钟与脏标记，不强制重绘
```

两个入口共用同一个 `step()`，所以测试跑的是线上那条路径。
`__step` 是给「待机节流是否生效」这类断言用的：把脏标记关掉，
观察 320ms 里到底重绘了几次，多一次少一次都能量出来。

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
