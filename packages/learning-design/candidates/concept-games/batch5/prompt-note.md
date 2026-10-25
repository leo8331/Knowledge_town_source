# 提示组件与版本实验候选

来源读取增强冻结知识原文：1.3-lesson-1明确任务/背景/约束/输出及代表测试；1.3.1-unit-1强调资料指令分隔但不保证安全、不替代权限；1.3.1-unit-2强调典型/边界/失败、版本、成功标准及示例不泄漏测试答案。三份definition分别绑定三个源，root负责原文证据与完整摘要。全部故障记录、组件行为和评分为明示合成演练，不调用LLM、不声称真实模型行为。

UMD `ConceptPromptGames`，Node require prompt-games.js，导出kinds/init/step。所有动作纯函数返回{data,feedback,passed}，反馈逐责任/测试案例附知识ID；不清其它组件或运行历史。root负责先教acknowledge、事件重放与收藏门禁，不能直信passed。真实浏览器未验。

## prompt-workbench：两源的组件装配

组件职责为目标、相关资料、约束、输出格式及资料边界。初始提示有实际错误，先选一例run看到逐项故障，再用组件卡修复；普通、缺时间、含伪指令三例在同一修复snapshot全部重跑通过后解释验证范围。不是只点最完整提示就过，也不能用旧版本跑过的记录替代新版本验证。

动作：configure{slotId,optionId}、run{caseId}、conclude{decision}。UI展示slots.id/label、options.id/label、cases.id/category/label/material及config.rule，先跑一次再修复。运行结果取data.runs[].output（字段结构、引用、未知/凭空时间及伪指令误执行的可见对照），failComponents解释由feedback给出；不要提前渲染options.valid、cases.required、privateExpected。内部ID由控件提交，不要求用户输入。输出为教学模拟职责对照，并不是真实语言模型生成。

通过要求观察一次失败、当前版本三例实际通过及有限结论。第一源重点整体任务可测试，第二源通过embedded伪指令与缺资料用例观察资料边界/证据约束职责。组件正确不宣称真实模型免疫提示注入；服务端权限控制始终独立。

## prompt-testbench：第三源的代表性与泄漏控制

玩家自行组成测试集，选独立少样本或含当前测试标准答案的泄漏示例；实际运行v1和v2，按统一成功标准观察典型/边界/失败结果。v1只在典型案例模拟通过，v2在三类模拟通过。相同测试集与示例的snapshot才可比较，选项变化必须重跑，历史记录保留。

动作：select{caseId,include:boolean}、example{exampleId}、run{versionId}、conclude{decision}。UI展示cases.id/category/label/material、examples.id/label、versions.id/label、successCriteria、conclusions.id/label，不提前展示examples.leaks或privateExpected。代表性类别是明确目标，用户仍要真的选覆盖并运行。v2好成绩若由答案泄漏获得也不验收；只漂亮普通例子不验收；只跑一个版本不验收。

命令：node --test packages/learning-design/candidates/concept-games/batch5/prompt-games.test.cjs。8项通过，覆盖逐项误解、旧版本失效、漏步骤、泄漏污染、漂亮样例不足、同一集比较及不突变。不同模型复核由root安排。只写本批四文件，未改冻结包、其它批次、前端、dist或正式测验。
