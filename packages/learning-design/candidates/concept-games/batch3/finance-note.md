# 财务概念小游戏候选：两个不同操作

来源：A `packages/knowledge/candidates/concept-games/batch2.v1.json` 中roi-evidence-ledger和volume-cost-simulator。增强知识源单元分别2.2.3-unit-1与2.2.5-unit-1。definitions直接读取A已审数据，不生成知识事实；root负责冻结知识/课程正文绑定、acknowledge和重放门禁。所有金额/业务量/结果都是演练假设，同月人民币，非真实效果或财务建议。只用于辅助学习，不替代独立正式测验。

UMD：Node require finance-games.js；浏览器全局ConceptFinanceGames。导出kinds/init(descriptor)/step(descriptor,data,action)。step不修改输入，返回{data,feedback,passed}，feedback含itemId/correct/message双语/knowledgeIds。所有错误保留其它账项、输入或实验记录；非法类型/ID抛错。纯插件不负责存档兼容，root必须回放事件而非信任passed。

## cost-ledger

UI显示config.policy、formula、entries的label/amount/category/evidence，逐项提供纳入/另列按钮。category仅表示成本/收益，不能提前渲染是否应纳入。让玩家填写net与roiPercent两个字段；合并提交避免错误后清掉正确字段。动作：

- {type:'entry',entryId,include:boolean}
- {type:'values',values:{net?:number,roiPercent?:number}}
- {type:'check'}

通过需要9条账目决策全部正确，以及净收益2000和百分数25正确。检查逐笔解释人工复核等完整成本不能漏、释放产能未兑现所以另列、同笔现金不得重复；逐数值定位分母/百分数。数值正确但未完成账本不能过。`privateExpected`仅判定端使用，前台白名单禁止渲染。check可以给计算答案，订正后通过只代表练习通过，不宣称独立掌握。

## volume-simulator

UI显示fixedCosts、computePerRequest、reviewHoursPerRequest、reviewHourlyRate、model以及可选volumes；提供业务量拨杆/按钮→运行→结果实验表，最后依据记录选择解释。动作：

- {type:'setVolume',value:1000|5000}
- {type:'run'}
- {type:'conclude',decision:config.conclusions[].id}

必须真的运行两种不同业务量；不能反复同量或先猜结论过关。结果表仅来自data.experiments，不提前提供A原trials答案。保留人工复核，观察总额2800→5200但单位2.8→1.04，不把单位下降等同总成本下降或复核免费。`privateExpected`禁止提前渲染。这里只计算已给两点的同月假设，不声称任意规模仍满足容量/质量条件。

验收：node --test packages/learning-design/candidates/concept-games/batch3/finance-games.test.cjs。8项包含缺操作、错误项定位、数字单位纠正、记录不丢、不同量实验、纯函数。真实浏览器未验；交root安排不同模型评审，当前未接前端、未改主批次/冻结包/dist。
