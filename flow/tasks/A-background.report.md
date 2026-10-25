# A 用户试玩期间后台知识核对报告

时间：2026-10-23 06:34 PDT（13:34 UTC）。本轮仅一轮候选；遵守D-playtest-background.md，不恢复旧Goal或自动化。评审前codex周窗口usedPercent=22，剩78%，未触发≤10%收尾。

## 结果与候选范围

只读检查发布B5两条路线的训练／推理／预测卡，以及当前业务替代题business-model-decisions-v1四项问题。发现一处明确双语遗漏、一处适用范围提示机会，另给一条可选概念联系说明；未认定业务题A/B答案错误，不为了改而重写正确定义。

1. **明确遗漏**：legacy course-87vtar，节1.1，卡1.1-lesson-12（原单元1.1-lesson-5）的中文预测例子含“高估→库存积压、低估→缺货”，英文只含高估分支。候选补英文低估/缺货，保留may，不改变定义或判分。aib course-c5mcdg节1.3卡1.3-lesson-4已完整，不需再改。
2. **范围补充**：业务题A明确未修改权重生成回复，B明确样本误差调整权重并保存新参数；A推理、B训练均成立。通用goal/foundation可加“本题明确的参数学习模型”限定，避免将数值权重更新当作所有ML唯一学习机制。新增的goal/foundation双语建议不改任何问题、expected或答案ID。
3. **可选解释**：“训练／推理”描述过程，“预测”描述估计结果；固定模型估计明日需求可同时有推理过程和预测结果。预测不必仅指未来，训练前向计算也能产生预测供损失计算，所以看到prediction不证明该任务只有推理。现有预测卡“估计未知结果”正确，业务B也合理地同时有预测与训练，无需改答案或强制加新题。

候选全文、精确位置、替换文案、短引文、来源和适用限制见packages/knowledge/candidates/background-playtest/findings.md。不是未见独立考核、官方认证或学习效果实证。

## 本轮重新核对的一手依据

- Google Machine Learning Glossary的inference、prediction、backpropagation条目：https://developers.google.com/machine-learning/glossary 。实际读取推理/预测定义，以及训练前向输出预测并与标签比较的内容。
- scikit-learn Nearest Neighbors §1.6.2：https://scikit-learn.org/stable/modules/neighbors.html#nearest-neighbors-classification 。实例学习保存训练实例，用于限定“所有学习都更新数值权重”的外推；不推导为任意存文本都是训练、无配置或不能预测新样本。

原假设店铺例子不是以上来源的真实案例；英文翻译补全根据当前中文与aib已审表达，不伪装新研究结论。

## 实际改动与验证

仅A本轮新增：

- packages/knowledge/candidates/background-playtest/findings.md
- packages/knowledge/candidates/background-playtest/verify.cjs
- flow/tasks/A-background.report.md

命令：`node packages/knowledge/candidates/background-playtest/verify.cjs`，exit 0、PASS。它只读校验：发布B5目录固定字节hash、业务task固定内容hash、发布业务脚本与B候选逐字一致、legacy确有遗漏而aib完整、A/B明确权重条件及原答案。输入变化即拒绝复用结论；不自动应用建议。未运行全模块或整站回归。

绑定摘要：B5目录d2e64e109a6708446ff346c2c1614cba4262b9a15d091c400209d08cef14499c；业务task 95c767d878f2c87ae6f51215ac5459d56c297d2437c09e24117c4b015d72fc35。完整说明见候选。

不同模型gpt-6-astra只读复核：PASS，评审实际运行verify.cjs通过，确认遗漏与双语补译、A/B原答案、过程/结果区分及固定基线；未写入文件、构建或操作浏览器存储。

## 接入方式、未验和停止状态

当前**未接入**。用户结束试玩后，D/B可先采用legacy英文例示补全，再决定是否采用业务题范围提示和可选讲解；需按其原料/发布流程建立新候选与复核，不能由A直接改dist、冻结知识或B输入。这里没有供服务自动加载的补丁。

未做真实浏览器点击、英文布局、触屏、动画、学习效果或外部模型生成验收；本轮是知识文本审校，不把静态检查当视觉签收。无需游戏构建/预览，因此没有启动预览服务。

共享目录main；核对HEAD=039861f0e7aebf5a53cc8f48282485987847d6c3。本轮未提交/推送、不改dist（含assets）、8782、启动器、入口、根构建、共享契约或存档。git status存在其他对话的改动，未触碰或纳入A交付。

本轮已完成并停止新增工作，等用户试玩结束与D安排；不恢复旧Goal/自动化、不自动整合或发布。
