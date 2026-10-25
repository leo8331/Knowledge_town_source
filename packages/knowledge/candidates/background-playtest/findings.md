# 训练／推理／预测：后台一轮只读核对候选

2026-10-23；未整合、未发布。供D/B作者审阅，不直接给玩家作为未见考核题；以下例子为原创说明，不是实测学习效果。业务题A/B答案与判分保持不变。

## 绑定输入与复现

- dist/teaching-catalog-v5.js UTF-8文件SHA256：d2e64e109a6708446ff346c2c1614cba4262b9a15d091c400209d08cef14499c。
- PlaytestDecisionTask.task的JSON.stringify SHA256：95c767d878f2c87ae6f51215ac5459d56c297d2437c09e24117c4b015d72fc35。
- 发布的dist/playtest-decision-task.js与packages/learning-design/candidates/playtest-fix/decision-task.js逐字相同；本轮仅读取，不修改任何一份。输入变化后须重新审阅，不能盲套建议。

## A-BG-01：旧路线预测例子少了一半英文（明确双语遗漏）

位置：TeachingCatalogV5.legacy，course-87vtar，节1.1，卡1.1-lesson-12，sourceUnitId=1.1-lesson-5。

当前中文：“需求高估可能造成库存积压；低估则可能造成缺货。”

当前英文：“Overestimating demand can increase excess inventory.”

英文未否认中文，但遗漏了低估与缺货的风险分支。建议仅将该卡英文例示补为：

> Overestimating demand may create excess inventory; underestimating it may cause stockouts.

此为翻译补全，不改变预测定义、测验答案或先修。aib路线节1.3的1.3-lesson-4已有两分支英文，不需重复修。原中文用“可能”，候选英文保留may，不能改成必然因果。

## A-BG-02：业务题目标／基础说明缺参数模型适用范围（补充候选）

任务business-model-decisions-v1。A明确“已保存且未修改的权重生成回复”，B明确“样本误差调整权重并保存新参数”。A判断推理、B判断训练均成立，无需换答案、退役题目或改判分。

风险在通用goal/foundation：“用参数是否改变判断训练或推理／训练根据样本学习并调整参数”，若脱离本题具体权重条件，被当作所有ML的唯一定义，会漏掉实例学习。scikit-learn最近邻分类是保存训练实例的反例；不能反过来把任意存文本都叫训练。

建议goal双语替换（供未来独立候选采用）：

- 中文：能分清模型使用的资料和产生的结果；在本题明确给定的参数学习模型中，结合执行记录与权重变化判断训练或推理。
- English: Distinguish the data a model uses from the results it produces; for the parameter-learning model explicitly specified in this task, use execution records and weight changes to identify training or inference.

建议foundation双语替换：

- 中文：输入是模型处理的资料，输出是模型产生的结果。本题以参数学习模型为例：根据样本调整权重是训练，使用已保存且未修改的权重生成结果是推理。新工单或新文字本身不证明发生训练；其他学习方法应结合具体算法与学习状态判断。
- English: Inputs are data the model processes; outputs are results it produces. This task uses a parameter-learning model: adjusting weights from examples is training, while generating results with saved, unchanged weights is inference. New tickets or text alone do not establish training; other learning methods must be judged by their algorithm and learned state.

不扩大到本轮修改学习卡定义；既有范围注释候选也不自动接入。D/B决定将来是否在题目intro中加这段，不覆盖当前用户试玩版本。

## A-BG-03：预测是结果，不是训练／推理之外第三个互斥过程（作者说明候选）

当前预测卡说“估计未知结果”，没有错误地限定必须未来；店铺例子选择明日需求也合理。无需为制造差异改写现有定义。可在后续讲解需要时补：

- 中文：这里“训练／推理”在描述模型做什么过程，“预测”在描述模型产生的估计。固定模型估计明日需求：执行过程是推理，杯数估计是预测结果；经理据此备料是后续行动。预测也可估计当前未知类别，并不只指未来。训练的前向计算也可产生预测再与标签比较，所以看见“预测”一词不能证明只有推理、没有训练。
- English: Here, training and inference describe model processes, while a prediction is an estimate produced by a model. With a fixed model estimating tomorrow's demand, the process is inference and the cup estimate is a prediction; the manager's supply decision is a downstream action. A prediction may also estimate a currently unknown class, not just a future event. A training forward pass can produce predictions for comparison with labels, so the word prediction alone does not establish inference without training.

业务B已同时写预测与误差更新，支持该区分；不要把题目中出现prediction误判为B应选推理。此段为解释参考，不能当学习者已独立掌握的证据。

## 本轮重新读取的一手依据

核对日期2026-10-23，仅公开文档；非官方课程认证。

1. Google Machine Learning Glossary，inference、prediction、backpropagation条目：https://developers.google.com/machine-learning/glossary 。prediction短锚点：“A model's output.”；backpropagation短锚点：“During the forward pass”。对应内容说明传统模型推理产生预测、LLM推理生成回复、训练前向输出预测后与标签求损失。短锚点只定位，不代替全文语义。
2. scikit-learn Nearest Neighbors §1.6.2：https://scikit-learn.org/stable/modules/neighbors.html#nearest-neighbors-classification 。短锚点：“simply stores instances of the training data.”。这是实例学习范围对照；不表示无配置、不表示不能预测新样本，也不表示任意存储都是训练。

## 接入与停止边界

仅三项作者候选说明，A-BG-01为直接翻译补全；A-BG-02为范围提示；A-BG-03为可选讲解，不声称当前三概念定义全错。只在本目录与A-background.report.md写入，不生成游戏预览、不操作8782、不接线。D等用户玩完后再择要安排；不改bank、答案ID、权重判断或当前进度。
