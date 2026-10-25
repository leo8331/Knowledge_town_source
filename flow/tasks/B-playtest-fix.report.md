# B 本地试玩替题报告

状态：实现、7项定向测试及不同模型gpt-6-astra独立复核均PASS，D可接入本地试玩。本轮仅本地，不提交/推送，不改变冻结B5。独占候选为packages/learning-design/candidates/playtest-fix/；未改游戏、index、dist或服务。

## D即刻可接入

- `decision-task.js`：浏览器UMD全局PlaytestDecisionTask，提供visibleTask、beginLegacy、legacyFieldFor、legacyValueFor、evaluate、legacyMatches。
- `baseline.json`：原题完整语义投影和摘要；legacyMatches严格匹配原prompt、字段label/id/expected，不能仅凭repair-mapping同名接管自定义题。
- `README.md`：原draft.values原位恢复、选择保存、反馈与原submit的最小接线顺序。
- `decision-task.test.cjs`：定向回归。

**D应使用beginLegacy(work.draft)，而不是begin()。** 输入history/输出forecast被恢复为自然语言的已有正确选择；eventA=train/eventB=infer恢复为原来的错误选择，不清空也不自动交换。选择后只更新对应旧字段，其它正确字段不动。最终旧判分仍要求input=history/output=forecast/A=infer/B=train，但玩家只点业务判断，不输入或背这四个代码。

## 可见教学替换

目标：区分模型资料/结果，并依据参数是否改变判断训练与推理。先用一小段店铺需求估计情境识别资料与结果，再判断A使用保存权重答新工单、B将样本误差用于改权重。使用2个资料选择和2个事件判断，每个事件还提供“记录不足”干扰项，必须利用实际证据，不能只凭出现新输入判断训练。

目标和概念依据可在原题直接查看，不要求切B5或重读22份知识。错误项A明确解释“没有更新参数，使用已有模型，属于推理”，B解释“根据样本误差调整参数，属于训练”；正确项保持原位。每项带来源知识ID和双语文案，回看应按sourceUnitId映射，不能把来源unit ID误认为重新编号的运行lesson ID。

本候选仅为旧轮可见订正/应用完成；beginLegacy永远不宣称独立掌握。旧activity/saves签名不变，不能将旧题通过当新B5通过、不能清空旧档或重复提交已完成轮。原90%正式测验与其它进度保留。

## 验收与范围

`node --test packages/learning-design/candidates/playtest-fix/decision-task.test.cjs`：7/7通过、0失败。验证真实旧rubric匹配/自定义同名不同prompt拒绝；前台无内部代码和答案键；正确业务判断桥接原判分；截图A/B错因与正确项保留；旧草稿正确/错误值原位恢复；旧全对草稿不作为独立证据；缺项及所有单项错选不通过。

只改上述候选和本报告；没有更改冻结KnowledgePack、B5或正式题。D正接线的游戏实际DOM、刷新/存档回归、原位知识回看、真实浏览器显示尚未由B验证，不能把候选测试当已修复页面。本轮待用户本地试玩，不推送GitHub。

独立复核：gpt-6-astra只读核验并实跑7/7，未发现阻断。已验证旧题投影/完整原题摘要一致、恢复不自动改错、前台不泄代码、参数依据和双语、正确项保留、旧稿无独立信用。最终字节摘要已复核，评审记录已落候选目录review.json；源码SHA256 `c3aa67b5e0c42a8fbf44bff767f167323974d6c7ef4eace0b3ff0997b83347b6`，baseline文件SHA256 `9c494a1c8b50a5eb83e3b1a98deab283d5fb4d220298b951300cc126da4c0b9d`。签名未被B改变，若D进一步修改候选需重新核对相关回归。

接口建议：不改共享schema，采用原题可见层适配；来源知识ID回看需D映射实际课程sourceUnitId。无B新增提交，不切换/重置/清理共享目录。交接增量：旧四槽可就地显示业务判断，原草稿正误都保留，A推理/B训练逐项解释；D负责游戏接线与本地构建，待用户试玩后再决定发布。

补充复核：两个事件选择“记录不足”后的旧值桥接及恢复同样保留该错误选择，不能因重绘丢失；不同模型复核当前源码SHA一致并PASS。独立记录不计新B5通过。
