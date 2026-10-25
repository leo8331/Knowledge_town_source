# D · 场景模型与出题模型独立选择（2026-10-24）

用户最新要求覆盖此前“第三步沿用第一步”：第一步仍以imageProfileSelect生成场景，第三步新增courseProfileSelect，向既有安全代理提交自己的profileId；密钥仍只在后端。出题选择保存knowledgeTownCourseProfileId，首次继承已有场景选择，之后独立。删除已选出题配置后保持空占位，要求用户明确选择，不自动切到另一模型。生成时固定已选ID，禁用下拉框，失败/结束恢复。

变更：dist/workbench.html、tests/workbench-selected-model.test.cjs，以及本轮计划/进展/决策。保留原场景、资料、课程和存档，不改密钥和B教学设计。

验收：workbench-selected-model + course-presentation + kb-bridge合计16/16通过；包括独立恢复、首次迁移、删除后不静默切换、请求使用第三步ID、失败保留场景资料。不同模型review_preview_pipeline复核无P1/P2。
真实浏览器：第一步Toklens gpt-6.1-sol、第三步DeepSeek deepseek-chat，刷新后各自保留；验收后恢复原出题选择，让用户自行适配。截图artifacts/runtime/workbench-e2e/independent-models.png。本轮没有再次调用真实模型生成题库，不承诺所选服务商限流或输出质量已解决。

本地原CMD已重启，当前build可正确复用。未提交/上传GitHub。用户Ctrl+F5刷新工作台→第三步“出题模型”选择→开始生成；新增配置在右上“模型中心”。
