# B 教学逻辑专项报告 · revision5

## 2026-10-23 截图请求复核与交接增量

截图中的文字仅作为问题证据，不执行其中的英文代码输入要求。现有B5替代产物与独立反馈补充已满足本次教学侧要求，本轮未重写冻结教学包，也未将历史题重新加入必做流程。复核先沿用 `packages/learning-design/revision5-feedback-plan.md` 的专项计划，核对实际替代、诊断、登记与独立评审后运行验收。

截图原题 `repair-mapping` 的旧答案为 input=history、output=forecast、eventA=infer、eventB=train；截图中前两项已对，A/B填反。B5用 `inspect-model-work` 的业务资料/估计/参数变化判断替代机械输入。旧课程仍使用原题时，可选已审 `candidates/playtest-fix/decision-task.js` 作自然语言操作适配：beginLegacy保留四项原选择，判定按项目解释，A未更新参数属于推理，B根据样本调整参数属于训练；只修改学习者主动更正的项目。两条接入路线不能混为新B5掌握记录。

四章全面审查结果仍为139单元、38节及原13节；323个引导/独立活动均有目标、项目定位解释和知识回看指针。70项被替换单元与原13节的活动、旧答案及签名见 `packages/learning-design/candidates/feedback-v5/reviewed/replacement-register.v5.json`；逐节保留/修改/删除及理由见 `packages/learning-design/generated/B-section-audit.v5.md`。完整教学链为 `generated/teaching-logic.v5.json` 与 `generated/legacy-teaching-logic.v5.json`，不是只交改题建议。

本次实际重新执行：`node scripts/test-module.cjs design` 39/39；`node scripts/check-contracts.cjs` PASS；`node --test tests/pipeline-contracts.test.cjs packages/learning-design/candidates/playtest-fix/decision-task.test.cjs` 16/16（契约9、旧题适配7），全部0失败。未重新生成冻结产物。不同模型gpt-6-astra既有评审PASS记录分别为 `authored/feedback-review.v5.json` 与 `candidates/playtest-fix/review.json`；本轮没有源码变更，未冒称新增模型评审或真实浏览器验收。

D/C接入要求：按 `packages/learning-design/C-feedback-handoff.v5.md` 校验主B5/补充摘要，再显示逐项message、reason及对应知识入口；回看返回不得清草稿。相同题目的错误订正保留正确项；已替换情境的旧代码草稿只读归档，不自动翻译或继承新题通过。按实际整节activity签名隔离不兼容记录，保留找到、收藏、归档及无关进度；不要全档重置。知识自由回看，学习活动按先修解锁，帮助后的订正不冒充独立应用，正式90%要求不变。旧题适配必须匹配完整baseline，不能只按同名ID接管其它题。

本轮变更仅本报告。输入仍为冻结A3增强知识包，教学输出revision5/schemaVersion1，独立反馈补充revision5及旧题候选schemaVersion1；没有共享接口变更。当前分支main、检查时HEAD `039861f0e7aebf5a53cc8f48282485987847d6c3`，B无新增提交，不表示该HEAD为B提交。页面渲染、知识入口点击、实际保存/刷新和触屏仍需D/C在最终集成验证；B没有修改游戏、dist、服务或联系其他对话。

交接棒：截图接线修复台已纳入专项，取消用户端代码抄写；A推理/B训练逐项定位，正确项与旧草稿保留策略明确。全四章323活动及70单元/13节替换登记可追溯，本次39+9+7测试通过。请D按本报告和C接入说明集成并完成真实页面验收。

## D集中集成：最小接入顺序与适配边界（2026-10-22）

本次仅汇总说明，无生成、无新审计、无冻结文件修改。账户刚读usedPercent67、剩余33%，未触发10%。主B5已冻结；精确诊断是**另行评审的独立候选补充**，并未纳入主manifest的成员摘要，不能因文件名带v5就自动混装。

1. **先主课程**：用冻结A3增强KnowledgePack，调用 `designLearning(pack, {design:createAibDesignAdapter({revision:5})})`；该适配器检查输入知识快照与输出方案摘要。或直接读取冻结 `generated/aib-course.v5.json`，按现有编译/导入校验进入D的版本隔离目录。不能用A原始v3包或A新增distinctions候选替换增强快照。
2. **再主教学链**：AIB接 `generated/teaching-logic.v5.json`；原13节接 `generated/legacy-teaching-logic.v5.json`。按主manifest与 `authored/review-v5.json` 校验。两种1.1不同，不能交叉套活动。`createLearningFlow`是B4教学地图参考，不接受B5教学链JSON作为其teachingMap；B5阶段/门控由D正在建设的运行适配层落实。
3. **再提前微判断**：读取主manifest已经绑定的 `generated/micro-checkpoints.v5.json`。调用 `teachingLogicV5.canOfferMicro(checkpoint,{reviewedUnitIds})`；只有完整递归先修知识已看过才开放，与收藏数量无关。微判断复用同一guided练习，晚些的面板不再强制做第二次；不增加独立应用或正式测验门槛。
4. **最后显式选择诊断补充**：只从 `candidates/feedback-v5/reviewed/` 读三个文件，并读取 `authored/feedback-review.v5.json`。`feedback-manifest.baseManifestHash`必须等于主manifest规范化JSON摘要，且knowledgeHash/planHash及两个数据文件摘要均匹配；这是补充单向绑定主B5，**主manifest本身并没有绑定该候选**。`candidates/feedback-v5/`根层为未冻结生成候选，`candidates/v5/`为旧主课程生成候选，均不得通配加载。
5. **反馈调用**：`const {teachingLogicV5:T}=require('./packages/learning-design')`；按题目完整key查activeEntries，调用 `T.diagnoseRound(canonicalRound,answer,entry)`。canonicalRound必须是该entry绑定的原始题对象：AIB来自主teaching-logic对应guided/independent.round，legacy来自legacy独立activity.rounds。不要直接传经过编译、追加skills、翻译或删unitIds后的题对象，整题roundHash会拒绝。D可按稳定节/轮映射关联UI题与规范题，不能跳过摘要校验或仅按重名roundId匹配。
6. **UI与通过语义**：显示checks的message和reason、reviewLinks知识标题；保留返回draft及正确操作，按行汇总矩阵错项。调用 `T.gradeStage(stage,canonicalRound,answer,{solutionRevealed})`。B函数只接收这一布尔帮助标记，C已负责将其UI中的解释/答案/具体失败诊断等辅助状态归一；不要把C的其它字段直接透传后以为B会识别。完成与独立信用分开，原90%正式测验不变。
7. **迁移与最小验证**：replacement-register供旧新题与答案审计，单元级签名不是实际章节存档键。按实际加载整节activity签名隔离不兼容草稿，保留找到/收藏/归档/阅读及无关进度；archiveOnly截图题只读回看，不再成为必做。D验截图正确项保留、A/B具体错因与知识回看、刷新帮助标记、两种1.1、三语言和旧档；B未声称这些UI接线已完成。

主B5 manifest摘要仍为 `c333ad6fbb06e5931af0060be6ac724691f0a5b8bee99b1a9293ea0fe98db35c`；独立补充的反馈/替换登记/诊断源码摘要与下一节一致。A新增知识区分候选未接入、未作为新独立考题。本轮只更新本报告，不改变数据或运行源码；沿用最近模块39/39、契约9/9实测，未为文档重跑全部测试。

## 最新增量：截图“接线修复台”反馈专项（2026-10-22）

状态：截图已明确纳入，独立补充实现与不同模型复审PASS。**D正在接入的主B5 generated、manifest与review-v5全部保持冻结摘要；本轮新增内容只放独立候选，不覆盖主产物。** 最新模块验收39/39、契约9/9、固定样例PASS。下面原B5报告的34/34是上一轮结果，当前以本段为准。

发现并修复：主B5已替换抄写题，但原diagnoseRound只标具体项目对错、message仍偏泛，不能独自满足截图要求。本轮新增323个活动的逐项自然语言说明、知识原文/证据回看链接，并可按实际作答说明分配题总成本、超额、价值缺口及缺少/不可用项目。正确项和原draft保持不变；反馈揭示答案后记辅助订正。主知识、正式题、蓝图及学习方案没有改动。

|被替换活动|旧判定答案（仅历史）|新操作|
|---|---|---|
|原1.1 `repair-mapping`，即截图四槽|input=history、output=forecast、eventA=infer、eventB=train|`inspect-model-work`矩阵，根据维修资料、模型估计及权重变化记录判断职责，不输入代码|
|AIB `1.1-lesson-2/v4-1`|input=history、output=forecast|测量资料、估计输出、人员行动分类|
|AIB `1.1-lesson-14/v4-1`|a=infer、b=train|依实际日志区分同参运行、权重更新和文档维护|

完整替换登记包含70项非retain单元和原13节的旧活动/旧答案、新活动、原因/目标、旧新signature，见下列replacement-register。69项保留的依据仍在原139单元审查中。本轮检查全部323个引导/应用入口，均有项目定位、双语解释、目标及来源回看；活动仍无概念替代字符串作答，不只是更正正确答案。

截图回归实际结果：保留input=history、output=forecast为正确项；eventA明确反馈“A没有更新参数，使用已有模型回答新工单，属于推理”，链接推理知识；eventB明确反馈“B根据样本调整参数，改变了模型，属于训练”，链接训练知识。旧截图仅archiveOnly历史回看，不能让其重新成为新课程必做题。

交付路径（根目录下）：

- 接入说明：`packages/learning-design/C-feedback-handoff.v5.md`。
- 已审独立补充：`packages/learning-design/candidates/feedback-v5/reviewed/item-feedback.v5.json`、`replacement-register.v5.json`、`feedback-manifest.v5.json`。
- 新原料/生成器：`packages/learning-design/feedback-catalog.v5.cjs`、`generate-feedback-v5.cjs`。
- 评审记录：`packages/learning-design/authored/feedback-review.v5.json`；计划：`packages/learning-design/revision5-feedback-plan.md`；测试：`packages/learning-design/tests/item-feedback-v5.test.cjs`。
- 修改参考函数：`packages/learning-design/teaching-logic.v5.cjs`，只增加可选第三参数feedback及精确说明；旧二参数行为仍通过回归。其余本轮修改仅本报告，无游戏/契约/存档/发布修改。

输入仍为冻结A3/B5，补充schemaVersion1/revision5。绑定摘要：主manifest `c333ad6fbb06e5931af0060be6ac724691f0a5b8bee99b1a9293ea0fe98db35c`；反馈 `eace6f0bfb2abc69f4a733ad2b9144c59b537f1f3f930c05213b7b8cb06bd867`；替换登记 `b132f03f4b14f0d0014fd903827992f3d7a346c283cebd43c82a8e50deaff16b`；诊断源码 `83b246d0f9cf47f4225acb75bd097cc2cbad530380db4d51097b4847aaab9680`。补充manifest绑定这些摘要和原知识/方案，禁止混用不同题目的反馈。

实际命令：`node packages/learning-design/generate-feedback-v5.cjs --reviewed`退出0；`node scripts/test-module.cjs design`39/39通过；`node scripts/check-contracts.cjs`PASS；`node --test tests/pipeline-contracts.test.cjs`9/9通过。5项新回归覆盖截图A/B、323项完整性、概念矩阵保留正确行/拒绝错配、旧新登记、分配题超额及缺必选。独立审稿模型gpt-6-astra先发现allocate逐约束反馈泛化，修复后复审PASS，并核对补充三项摘要。主B5运行适配器及历史版本继续通过。

旧答案/旧草稿兼容要求：同题答错不清空草稿，正确操作保留；题型或情境已替换后，旧代码只能只读回看，不能自动翻译为新矩阵答案或继承新通过。单元级signature是审计记录，不是实际章节存档键；D须按实际加载的整节activity签名决定兼容。只使不兼容活动记录失效，不清空整档；保留知识、找到、收藏、归档及无关章节进度。新题从空草稿开始，旧正确项仍留历史中，不冒充新情境证据。不能可靠持久记录帮助状态时保守标订正。

待D选择接入本独立补充并由C/D验证：操作点逐项message与reason并列、知识回看可点击且不清草稿、旧题退休、新题无代码输入、刷新/旧存档/窄屏。B未改浏览器页面、未跑真实视觉验收、未更改共享schema或保存格式、未发布推送。分支仍main，HEAD仍`f0be257f880f56765641fd65f33675f4a1bfdf46`，本轮无提交。最近额度usedPercent55，未触发提前收尾。

交接增量：截图旧接线活动已替换并补齐A推理/B训练的逐项解释，323活动有反馈与知识入口，70单元/13节有旧答案及草稿兼容登记；主B5保持冻结，独立候选已审可交D接入，模块39/39、契约9/9通过。B未自行联系其它对话或合并发布。

---

更新：2026-10-22（America/Los_Angeles）。当前轮：主B5及老师微判断增补均已冻结、独立复审与验收通过，可供D一次接入，无前置决策阻塞。游戏接线、真实浏览器及发布未验。共享额度最近读数usedPercent51、剩余49%，未触发≤10%提前收尾。

## 完成内容与交互设计依据

全面审查AIB四章38节、139独立单元、58目标，并适配原内置四章13节。逐单元记录学习目标、思考、实际可观察证据及误解：69项保留、24项修改、46项删除替换。逐节表在 `packages/learning-design/generated/B-section-audit.v5.md` 和 `section-teaching-audit.v5.json`，139项明细在 `unit-teaching-audit.v5.json`。

每节具备目标→必要知识→带推理示范→引导练习→新情境独立应用→解释性反馈→整章正式测验。38个示范、38个引导、154轮独立应用、144道正式题；144张卡包含章内补学，独立知识仍139。原内置13节有131轮应用；原1.1单独8轮覆盖22单元及六个既有目标，不能与AIB1.1四单元混用。

- 删除history/forecast/train/infer、1/0及英文ID等概念替代输入。模型活动依据业务资料、估计、权重变化与实际使用记录作判断，区分输入、输出和人类行动。
- 示范展示答案和推理但不计掌握；引导可提示，再用不同证据、冲突或相反条件检验迁移。修改与正式题同事实同结论的前置案例，正式题和知识来源保持冻结。
- 按内容选择分类、依赖排序、情境判断、计算、矩阵、预算取舍和修复，不以控件数量证明教学质量。独立轮分布为sort42、choose74、order6、matrix6、number20、allocate5、edit1。
- 权限题根据一般政策交叉推导当班、资格和演练条件；价值题核算已结算账单及重复申报；治理/部署题包含条件已满足和不同故障分支。数字、阈值和角色政策标明为演练假设，不冒充真实规范。
- 审核证据限于实际提交的分类、选项、计算或操作，不宣称仅凭选择题采集了学习者自由解释。反馈给出的解释不等于学习者已经自行解释。
- 提供 `diagnoseRound` 逐项定位错误，保留正确草稿；空排序、漏步骤、重复选择和未知分类键都不能出现“判错却全绿”。完整解释可主动查看；具体失败诊断也保守记为帮助，之后正确属于订正完成，不冒充独立信用。
- 明确阅读、真实找到、收藏、归档、基础确认、应用完成和整章90%通过。预览不计发现，找到后才可收藏；收藏可选，入柜移出随身栏但素材箱可回看，取消收藏不能删除已归档资料。知识可自由回看，活动按先修解锁，四章独立进入。

## 产物路径

|用途|路径（根目录下）|
|---|---|
|完整AIB学习方案|`packages/learning-design/generated/aib-learning-plan.v5.json`|
|编译课程|`packages/learning-design/generated/aib-course.v5.json`|
|38节题面、初始状态、步骤、判定、提示、错误及完成反馈|`packages/learning-design/generated/teaching-logic.v5.json`|
|原内置13节与原1.1八轮|`packages/learning-design/generated/legacy-teaching-logic.v5.json`|
|相关知识后提前微判断入口|`packages/learning-design/generated/micro-checkpoints.v5.json`|
|C具体接入说明及旧草稿兼容要求|`packages/learning-design/C-handoff.v5.md`|
|摘要与计数|`packages/learning-design/generated/aib-manifest.v5.json`|
|不同模型逐项评审绑定|`packages/learning-design/authored/review-v5.json`|

## 输入输出版本

输入：KnowledgePack `aib-knowledge-integration` revision3；MaterialBundle `aib-materials-integration` revision3。输出：LearningPlan `aib-learning-plan` revision5，schemaVersion仍1，两套B/C教学侧车revision5。历史v1/v3/v4、正式题及knowledgeBasis未覆盖。显式使用 `createAibDesignAdapter({revision:5})`，默认版本未擅自修改。

|绑定|SHA256（规范化JSON）|
|---|---|
|KnowledgePack|`1b31c336a5ddcfd0a78e22d581102c1d293b3cf835a72124d99cb2344f7c8f80`|
|LearningPlan|`43f2b577b6f3b3ff6e96a2ab27299b2d9f38e62bd8fe84c4e14b76fe7152d175`|
|蓝图|`5515e41a68499edbefb1d157b6bf655f5250124fe21fbd40879d36298006197d`|
|38节教学链|`5e611cf268d9d2218bc131b7dceddec39e3cf41a6df9661ef3783d6fbcf65ecf`|
|原13节链|`00a16d60f4304cdd34ef21c904cd66e139d5a13066e52c8585f1714960f666bf`|
|单元审查|`766d7ae514e95fd0e0d95415a1e565c7a5acf8800029ecc5b7904a2c6895ae94`|
|节审查|`826e74bdbc7d2238228a0aa62a00f64e5b3effe5ef8a05882e9a236863b54236`|
|微判断入口|`8c7cf5b83f789813a7782fec2f3229ccbbaeb8d56f1cc04fb60398fa4fbedce0`|

## 验收命令与实际结果

|命令|实际结果|
|---|---|
|`node packages/learning-design/generate-aib-v5.cjs`|退出0，候选可复现，知识诊断为空|
|`node packages/learning-design/generate-aib-v5.cjs --reviewed`|退出0，全部摘要及139项教学哈希匹配，写入本模块generated|
|`node scripts/test-module.cjs design`|最终34/34通过，0失败、0跳过；包含旧版本回归及8项B5专项|
|`node scripts/check-contracts.cjs`|PASS，固定v1样例编译4章4题|
|`node --test tests/pipeline-contracts.test.cjs`|9/9通过，0失败、0跳过|
|`npm run test:design-module`|环境未找到npm；已通过该脚本的等价Node入口完成上述模块验收|

独立模型逐轮复核38引导+154主链应用+131原课程应用，共323轮：空初始不通过、标准解通过；有意义错解拒绝。原料、生成产物、双语、来源及摘要已核对。运行适配器拒绝知识快照变化和教学摘要不匹配。

## 独立评审结果

审稿模型为不同于产出执行模型的 `gpt-6-astra`。三个独立范围均最终PASS：第一章45单元/12节及原1.1八轮；第二至四章94单元/100轮及正式题独立性；教学链、诊断、归档、摘要及C说明。

首审实际找到授权矩阵逐格照抄、数字标签泄答、示范提前公布正式题答案、相同事实重复、证据表述越界和诊断全绿等问题，均修复后复审。最终结论绑定实际候选摘要；139项全部重新审查，没有将未审旧决定冒充本轮评审。结论不包含浏览器呈现或真实学习效果。

## 老师意见吸纳与实际产物

已读 `flow/tasks/D-teacher-review-intake.md` 及原文指针；按当前产物判断，不沿用旧12装置/42轮、8766端口或不存在guide-spotlight的结论。

|意见|本轮处理与指针|
|---|---|
|收齐不能等于学会|已落实：learnerGoals/evidenceOfUnderstanding、分阶段意义；能力证据不靠收藏数量|
|阅读过长、判断过晚|已落实：新增micro-checkpoints.v5.json，38个AIB入口与13组原课程入口，共76条引用；依知识主题和递归先修，不是每三卡一题。原1.1首题仅需两份、训练推理需四份，六个主题入口可选、不扣分、不增必做轮，综合应用仍在完整基础后|
|反馈过远、笼统|B已提供diagnoseRound及每轮知识/误解定位、保留草稿；C/D需在操作点显示并提供原文与证据回看，真实位置未验|
|示范/辅助不算独立掌握|已落实gradeStage和C说明；具体失败反馈也算帮助，刷新后保守标订正，90%正式测验保留|
|取消搬运/降低门槛/升级schema|不采纳：保留先找、收藏、归档、素材箱和90%，未修改共享契约或存档|
|引导重叠、导入备份、声音与动效|属于C/D接线范围；B不越权修改，不声称已修|
|3名新手、两周复测|待真实参与者执行，未伪造时长、成效或长期保持数据|

微判断只复用已审引导题，提前入口和晚些的引导面板共用一次练习状态，不能重复强制完成。必须检查完整requiredReviewedKnowledgeIds，包含跨章先修回看；不能只检查legacy直接先修列表。不同模型追加复审PASS，逐项移除任一所需知识均拒绝开放，候选与源码重建摘要一致。主LearningPlan/蓝图/38节链/legacy摘要没有因此改变，manifest新增microHash绑定。增补期间曾因旧评审记录缺microHash而出现1项绑定测试失败，补齐已审绑定并重生成后最终34/34通过。

## 本专项变更文件

以下文件除flow两项外均在 `packages/learning-design/`：

- 修改：`README.md`、`index.cjs`、`aib-adapter.cjs`。
- 新增作者原料：`authored/teaching-audit.v5.chapter1.cjs`、`authored/teaching-audit.v5.chapter2.cjs`、`authored/teaching-audit.v5.chapter34.cjs`、`authored/section-scaffolds.v5.cjs`、`authored/section-designs.v5.cjs`、`authored/review-v5.json`、`authored/micro-checkpoints.v5.cjs`。
- 新增生成/参考/说明/测试：`generate-aib-v5.cjs`、`teaching-logic.v5.cjs`、`templates/core-foundations.v5.cjs`、`C-handoff.v5.md`、`tests/teaching-audit-v5.test.cjs`。
- 新增generated：`aib-blueprint.v5.json`、`aib-learning-plan.v5.json`、`aib-course.v5.json`、`aib-manifest.v5.json`、`teaching-logic.v5.json`、`legacy-teaching-logic.v5.json`、`unit-teaching-audit.v5.json`、`section-teaching-audit.v5.json`、`B-section-audit.v5.md`、`micro-checkpoints.v5.json`。同名candidates/v5仅为候选。
- 开工专项计划：`flow/tasks/B-teaching-audit.md`；独占报告：本文件。没有覆盖旧B/C/D报告。本轮未写共享进展、游戏、服务、根脚本、契约或dist；其它对话已有改动未清理。

## C/D接入、未完成范围与限制

1. D按manifest+review接入B5：AIB读取LearningPlan和38节链，原课程读取legacy链，两种1.1不可混用。游戏当前revision4限制及目录接线由D处理，不能在接B5时重新套回1.1强制配对。B未改变构建入口。
2. C/D按C-handoff接物件职责、阶段展示、保留草稿及逐项反馈。知识/收藏/基础确认不计掌握，自由浏览不解锁必做活动；活动按先修完成，整章90%正式测验独立。真实场景发现、素材箱持续回看和可选收藏须在页面验收。
3. 新活动signature不同，旧草稿不能按新答案重放。D仅处理对应不兼容活动状态，不清空整份存档；保留知识、发现、收藏及其它进度。B4完成不自动证明B5完成。若现存档不能持久记录帮助状态，保守标“订正完成，待正式测验确认”，不能刷新后恢复独立信用。
4. 接口建议：在适配层区分applicationCompleted/applicationCredit及本题帮助状态；是否扩展记录由D决定。本轮没有修改共享schema或存档。legacy先修回看ID需要解析到冻结知识包，不能把资料引用当已阅读；四章独立进入时提供本章补学。
5. 正式题数量有限，重复接触可能记忆答案；不能据此宣称心理测量效度、长期保持或抗背题效果。后续需要实际学习者观察和独立平行题。教学中英已验，三语言混排、窄屏及可访问性未做真实浏览器验收。
6. 未完成范围为C/D游戏接入、实际保存/加载和视觉验收；B本轮实现与验收已完成。未启动/重启8782、未运行根发布构建、未合并、未推送。

分支：共用目录现有 `main`；起始/当前HEAD `f0be257f880f56765641fd65f33675f4a1bfdf46`。本轮无新增提交号，无switch/reset/clean，无自行合并或发布。

交接增量：B5已用新情境及解释性诊断替换抄写和泄题活动；139单元审查、38节链和原13节产物已冻结，模块34/34、契约9/9及固定样例通过，不同模型复审PASS。请原D集成对话从本报告和manifest取交接，按C-handoff接线并验旧档与页面；B未向其它对话发送消息。
