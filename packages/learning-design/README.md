# B 教学设计适配器

```js
const {designLearning, createDesignAdapter} = require('./packages/learning-design');
const pack = require('./packages/contracts/fixtures/knowledge.v1.json');
const blueprint = require('./packages/learning-design/examples/blueprint.v1.json');
const plan = await designLearning(pack, {design: createDesignAdapter(blueprint), signal});
```

`examples/learning-plan.v1.json` 是上述完整可执行输出。无模型连接、无密钥、无发布副作用。输入输出均 schemaVersion=1；蓝图是包内作者格式，不是新共享契约。适配器接受显式的四章 `chapters[{title,unitIds}]` 和 `units[id]{activity,questions,knowledgeBasis?}`。活动/题目使用冻结格式；题目 quote 必须显式来自知识 evidence。未知单元缺少作者设计时明确失败，不复制固定题。

每章按先修拓扑排序并补齐跨章依赖。默认每单元一节；作者可用包内 `maxUnitsPerSection` 指定顺序分组，AIB 每节最多4单元，逐单元保留活动与题目，避免超过每章20节。补学使用同一作者活动，正式题加章节上下文避免重复ID/题干冲突。超过冻结上限或覆盖不足交给契约校验拒绝。知识基础摘要可选，但固定蓝图已启用：原文解释或证据改变必须重新审阅任务。摘要不是语义真实性证明。

| 内容 | 教学选择与理解证据 | 典型错误与反馈 |
|---|---|---|
| 概念/业务分流 | sort 区分固定审批与预测，再 choose 选择决策依据 | 不按 AI 标签分类；回看明确条件与数据模式的区别 |
| 数值 | number 同时填写完整成本、净收益、ROI；正式题诊断150%的错误 | 漏运行成本或把总收益当净收益；反馈完整计算链和回看方向 |
| 权限 | matrix 在角色×资料表中同时处理必需与禁止访问 | 漏选和多选均错误；逐格对照角色任务，不能全选 |
| 流程 | order 重排打乱的步骤，再 choose 在中途状态选择下一步 | 跳过比较直接上线；回看基线→测试→受控上线，仅限案例 |

先读知识卡→形成性应用→整章学习交付→正式练习→复习/错题，是面向 D/C 的集成顺序。v1 没有新的解锁字段；本模块通过 activity.brief 提示顺序，不能单独控制前端状态。每轮 reason 解释判定和错误回看路径；正式题 quote 给复习定位，不假装已有逐选项反馈字段。

复习建议：整章后先无提示检索，再混合四类任务；错题回看关联 unitIds 后重做，下一次学习再检索。迁移以改变表面情境或中途状态检验原理，数值/角色/流程变化必须提供新条件并重审答案，不能将演练数据写成事实。当前迁移限固定知识中的重新决策和错误诊断。延时调度、独立正式题池、错题存档由 D/C 实现。

## A 的139单元完整适配

```js
const {designLearning, createAibDesignAdapter} = require('./packages/learning-design');
const pack = require('./packages/knowledge/generated/knowledge.v1.json');
const plan = await designLearning(pack, {design: createAibDesignAdapter(), signal});
```

复现：`node packages/learning-design/generate-aib.cjs`；验收：`node scripts/test-module.cjs design`、`node scripts/check-contracts.cjs`。生成脚本只写本包 generated 与旧探测结果文件，无发布副作用。

`authored/chapter-1.cjs` 至 `chapter-4.cjs` 是139条人工教学设计真源；每单元有教学理由、误区、具体情景、判定、反馈、双语正式题和原证据引文。`authored/input-snapshot.v1.json` 固定审阅时的知识摘要，防止重跑脚本后把原文变化自动认证为可用。输入变化需要重审受影响活动并明确更新基线。运行适配器也拒绝不同版本或内容快照。

完整交付：`generated/aib-learning-plan.v1.json`；编译桥验收副本：`generated/aib-course.v1.json`；作者蓝图：`generated/aib-blueprint.v1.json`；逐单元教学理由/误区/复习/位置：`generated/aib-unit-audit.v1.json`；输入输出摘要与计数：`generated/aib-manifest.v1.json`。58目标、139独立单元，章内补学后142卡/142轮/142题；四章12/8/7/11节。第四章补学3个治理/监督单元，各章独立进入。七类操作：choose90、sort20、order15、number6、matrix5、edit4、allocate2。

控件选择：概念比较与业务判定需要选取证据或行动；结构边界/职责用sort；给定依赖链用order；成本、ROI、词元预算用number；角色与授权用matrix；硬约束资源取舍用allocate；契约记录和交接单修复用edit。未因追求八类数量滥用rate，教材没有统一证据刻度。所有数字、角色、阈值和给定顺序均作为显式演练条件。

正式题用于章后无提示检索和新情景诊断；第一章另编独立情景，避免照抄形成性题。跨章补学重复题只作为基础检索，不宣称新迁移。每单元1道正式题，尚不足代表穷尽式题库或心理测量有效性。

完整适配保留 A 的139条 needs-review，不代表官方内容/翻译已被认证。任意新材料仍需要人工或 D 注入模型编写活动蓝图；结构校验不能证明题意和来源的逻辑蕴含。本模块不接管模型服务、前端阶段锁、间隔复习调度或发布。D 可直接读取 LearningPlan 接入已有编译桥，并在实际页面验收学习顺序与练习解锁。

## D 集成的 revision 3

用户要求接收 A3 后，D 对139单元教学逐项重新做语义复核，修正回退、交接/RAG误区、日志边界，并追加可定位的一手引用。原A3原始资料/知识包不改；`packages/course-compiler/enrich-aib.cjs` 生成独立ID的revision 3增强对，保留A3输入哈希和139单元正文。`authored/adaptations.v3.cjs` 只记录新版本教学修订，`authored/review-v3.json` 逐单元绑定新来源与教案哈希。

运行 `node packages/learning-design/generate-aib-v3.cjs --reviewed` 重建已审阅产物；不带参数仅在artifacts下生成候选。修改来源或候选会因审阅哈希失配拒绝发布，需重新逐项审阅。`createAibDesignAdapter({revision:3})` 只接受增强后的知识快照；原revision1调用保持兼容，不会把A1直接混入A3教案。

最新输出为 generated/aib-{blueprint,learning-plan,course,manifest}.v3.json：38节、144卡/轮/正式题、七类操作。增加的5次补学来自A3先修关系，独立知识仍139条、目标58项。旧v1输出保留用于追溯，不能跨版本拼接。使用游戏“导入知识库”→“预览完整课程（修订3）”，或选择最新aib-course.v3.json。具体整合来源与验收见 archive/history/INTEGRATION-history.md。

## B revision 4：差异化活动及C交接

本轮以已审阅D增强A3/B3为知识基线，教学revision=4、知识revision=3，schemaVersion仍1。历史v1/v3未覆盖。修改33单元的真实互动，保留139单元、58目标及全部已审正式题/来源。38节、144学习卡、145轮、144正式题；原单控件节8→0、三连同操作节11→0。首AIB 1.1为分类→情境→算法装配→接线修复，不能误认为原内置22单元的1.1。

原内置1.1新增8轮、五类操作模板 `templates/core-foundations.cjs`，从 `templates/strategist.cjs` 导出。根构建脚本仍有强制match的特例，需D解除；B未构建dist，当前页面不会仅因模板落地就自动更新。

交接入口：[C-handoff.v4.md](C-handoff.v4.md)；逐节职责/步骤/解锁：[generated/C-section-guide.v4.md](generated/C-section-guide.v4.md)。AIB38节与内置13节分别使用 `generated/aib-teaching-map.v4.json`、`generated/legacy-teaching-map.v4.json`。自由浏览/可选收集不计掌握；必做基础确认和应用提交按先修执行；整章通过必做才解锁正式练习。物件可复用美术，但操作判定按内容与control路由，不统一花盆或配对。

`createAibDesignAdapter({revision:4})` 输出 `generated/aib-learning-plan.v4.json`；`createLearningFlow({knowledgePack,plan,teachingMap})` 是C可执行的门控参考，非已接入浏览器的实现。它复核整个侧车依赖图、绑定知识/方案/侧车版本、拒绝错解/跳关/旧进度混用，允许自由浏览本章后续知识。用例见交接文档和 `tests/aib-v4.test.cjs`。

生成候选：`node packages/learning-design/generate-aib-v4.cjs`（只写本包candidates）。已审阅重现：`node packages/learning-design/generate-aib-v4.cjs --reviewed`；必须匹配 `authored/review-v4.json` 的来源、蓝图、方案和两份侧车摘要。33项变更由不同模型评审，106未改项精确继承v3审阅。输入改变不能通过自动更新哈希来冒充重新审阅。验收命令仍为design模块及冻结契约，浏览器接线/发布交D/C。

## B revision5：教学逻辑专项

revision5以同一A3快照为输入，逐139单元审查目标、思考、可观察证据及误解。38节均区分推理示范、有提示引导、新情境独立应用与整章90%测验；原内置13节另有适配。正式题和来源保持冻结，前置活动不能照抄内部代码或提前公布正式题同案例结论。旧revision1/3/4保留，默认适配器版本未改，显式使用 `createAibDesignAdapter({revision:5})`。

完整方案：`generated/aib-learning-plan.v5.json`；逐节链：`generated/teaching-logic.v5.json`；原课程：`generated/legacy-teaching-logic.v5.json`；逐节审查：`generated/B-section-audit.v5.md`。老师复查补充 `generated/micro-checkpoints.v5.json`：相关知识读完后可提前做低压力引导，原1.1无需读完22份才判断；不按固定卡数出题，不增加正式测验门槛。C/D接入见 [C-handoff.v5.md](C-handoff.v5.md)，最终状态及实测结果见根 `flow/tasks/B-teaching-audit.report.md`。

`teachingLogicV5`导出纯参考函数：`diagnoseRound`逐项定位错误并保留草稿，`gradeStage`区分订正完成与独立证据，`canFavorite/inventory`说明先发现再收藏、归档退出随身栏。失败后显示具体诊断也属帮助，刷新后不能恢复独立信用；知识回看仍始终允许。这些函数没有接管游戏或修改存档。

生成候选：`node packages/learning-design/generate-aib-v5.cjs`；冻结重现：追加 `--reviewed`，必须与不同模型评审的 `authored/review-v5.json`摘要及139项决定全部一致。验收：`node scripts/test-module.cjs design`、`node scripts/check-contracts.cjs`、`node --test tests/pipeline-contracts.test.cjs`。不运行根发布构建。
