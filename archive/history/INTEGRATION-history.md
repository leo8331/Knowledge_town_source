# 早期 A/B/C 集成说明（历史记录）

> 已从 docs/ 移入归档。当前状态以 [docs/GAME_GUIDE.md](../../docs/GAME_GUIDE.md) 和 flow/ 下的最新进展为准。


当前完整课程导入入口显示“教学5”；已保存的B3/B4和兼容课程仍独立保留。本页下方是早期B4/B3交接历史，不是当前发布状态。2026-10-23物件小游戏、场景动态、本地入口及发布验收请读[D本轮报告](../flow/tasks/D-six-hour-integration.report.md)，玩法见[游戏指南](GAME_GUIDE.md)。B后续设计另行交接，未交接候选不自动发布。

## 历史：2026-10-22 B4候选接线（当时未发布）

B4按独立课程保存，旧银行/旧进度继续保留。首次进入创建内置探索版4；已有课程通过“开启新版探索课程（旧进度保留）”进入。AIB4通过导入预览入口加入。原内置1.1为22单元8轮；AIB4的1.1为4单元4种操作，不按显示数字混绑。

浏览全章及收藏可选，不计掌握。显式基础确认按先修解锁，再用原TaskWorkshop判分完成应用。每银行保存该binding的教学快照；新版本新银行从零开始。构建核对已审哈希，恢复重建完整必做链。

真实浏览器连接尚不可用，本轮视觉/窄屏/点击避让清单待验，不能把下方上一版的验收当B4发布结论。最新状态见flow/tasks/D-integration.report.md。

---

# A/B/C 最终集成：revision 3

A原始materials.v3与knowledge.v3成对保留：139单元、58目标、96条无环先修、全supported、gaps空。supported表示AI领域/双语审校与来源支持，不是官方认证或穷尽考试知识。

D没有将B旧版教案仅改版本号：逐项复核139单元后修正紧急回退、规则与学习型AI、错误的交接/RAG误区、日志最小化与脱敏，补充风险、标注分歧与组织考核边界。两组独立模型分别审核75/64条，最终批准与完整蓝图哈希、逐单元哈希绑定在packages/learning-design/authored/review-v3.json。

## 来源与版本

复核发现部分A3短引偏离题目主题。D从NIST、Microsoft、UK Government、AWS一手页面增加11项有scope的摘录，覆盖16单元，不更改A原包。packages/course-compiler/enrich-aib.cjs产生独立ID aib-materials-integration / aib-knowledge-integration，材料与知识revision仍3；只增加evidence，正文、例子、状态和先修与原A3相同。aib-source-additions.v3.json保留链接、定位锚、核验日期及适用范围；manifest.provenance保留A3原始哈希。厂商/数据成熟度方法只作明确标识的参考，不作为统一组织标准。

B3绑定这对增强包；旧B1、A1/A2历史产物保留，混用被拒绝。新版四章仍使用原四领域名称，章内先修排序；四章38节、144张含补学卡、144轮互动、144道正式题，七类控件，独立知识139条。多出的5张是章内补学，不是新编知识。

## 游戏入口

运行node server.cjs后，从原index对应首页进入“导入知识库”→“预览完整课程（修订3）”。核对来源、知识和活动后确认，才创建独立课程与进度。原内置课程和旧银行不自动替换。也可在同一面板选择packages/learning-design/generated/aib-course.v3.json；此文件方式不调用模型。

GET /api/aib-course提供已审阅完整版本；POST /api/compile-course接收{materialBundle,knowledgePack,learningPlan}，依次通过A适配器、B适配器及编译桥；来源或版本无效返回400与诊断，跨站请求拒绝。编译已整理数据不发送外部请求。任意新教材仍走原/api/course-jobs与可配置模型服务，密钥只在本机环境中。

固定四章样例仍可用scripts/compile-learning.cjs编译到artifacts，不能绕过D写dist。完整B3重建用node packages/learning-design/generate-aib-v3.cjs --reviewed；不带参数只输出候选，修改输入后必须重审哈希。

## 验收证据与边界

- tests/aib-integration-ui.cjs：最新全量144轮实际控件事件、38节封存、基础学习门禁、四章完整测验、低于90%拒绝、错题修复、部分测验及完整进度恢复。阅读前置由学习引擎布置，不冒充144次真人阅读；模拟DOM。
- tests/integrated-pipeline.test.cjs：原A3与增强包来源/版本，真实HTTP、篡改及跨站拒绝；A2真实缺口继续阻断。
- tests/old-save-ui.cjs和integrated-pipeline-ui.cjs：非空9f7f67b示例旧存档，含收集、错误答题与旧会话；继续收集，导入新课后原银行/状态/答题进度/会话保留。
- 旧双语模拟测试改为映射与控件身份检查，实际文字由浏览器验证；旧未来机关测试改为按阶段显示，C模块同时验证后续阶段可操作。
- 实际浏览器和发布快照验收见D报告；证据范围不等同于全部触摸设备或完整无障碍认证。

原dist/index.html及三套经典入口保留。直接file协议被浏览器工具策略阻止，未绕过；静态入口与相对资源另有审计，真实浏览器通过同一index的本机HTTP入口验收。
