# 上下文小游戏第四批

只写本批四文件，不接主catalog/前端。源知识来自增强冻结KnowledgePack的1.3-lesson-2（上下文上限和输入输出规划）、1.3.2-unit-1（指令/检索/历史/工具/输出全计）、1.3.2-unit-2（授权/相关/版本及真正支持回答）。root负责完整原文/证据/摘要绑定、acknowledge、重放门禁。全部政策、数字和预算计量均标演练假设，不冒称真实tokenizer；所有保留条件均在可读片段中。

UMD浏览器ConceptBudgetGames，Node require budget-games.js；导出kinds/init/step。step(descriptor,data,action)返回{data,feedback,passed}，无DOM/存储，不改输入；反馈逐项附sourceUnitId回看，错误不清其它已选操作。辅助演练通过不代表独立正式掌握。

## context-budget（两份不同成本配置，分别绑定两个知识单元）

界面显示五类预算：指令、授权当前政策、历史、工具消息、预留输出。每块模式卡显示双语text与cost，让学生实际选择保留/安全压缩/截断/移除；截断虽便宜却丢失条件。工具压缩保留当前版本与授权状态；无关历史可以移除。输出不能压到回答需要以下。

动作：mode{blockId,mode}、reserve{value}、run、answer{decision,evidenceIds}。run计全部输入成本+输出，定位溢出、输出不足、关键依据丢失，保留操作；之后选业务回答并选证据。预算通过只是中间状态，错误结论/错误引用仍不过。改模式/输出会使旧run失效，必须重新运行。

C可渲染白名单：config.limit/outputChoices/minimumOutput/initialOutput/question/countingRule；blocks.id/label和modes.id/cost/text；answers.id/label；evidenceChoices。不得渲染privateExpected或modes.preserves判定标记。玩家看得到政策约束本身，需保留条件并将其应用于具体申请，而非背内部代码。

## relevance-window

容量100点，四片段全部能装下，但当前政策、旧版、无关海报、未授权审批记录职责不同。先逐片段选择是否给当前回答→check逐项指出可读权限、版本或相关性→选择实际回答并引用所选片段。未选当前有效证据、未检查、引错片段或把申请等同批准均不能过。

动作：select{passageId,include:boolean}、check、answer{decision,evidenceIds}。C显示passages.id/label/text/cost及question/limit、answers.id/label；privateExpected不展示。authorized/current/relevant为判定标记，用户从label和text读情境，不另显示答案标签。无权片段text只有禁用说明，没有泄露真实受限内容。每次选择变化使check失效，保留其它选中片段。

验收：node --test packages/learning-design/candidates/concept-games/batch4/budget-games.test.cjs，9项涵盖两配置成功、未run、溢出、删除依据、截断条件、输出不足、错误引用、容量内错误资料、订正保留及纯函数。真实浏览器未验；root安排不同模型复核后绑定发布候选。
