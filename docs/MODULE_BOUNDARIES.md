# 已落地的模块边界

当前为同一仓库的多个模块，保留原 `dist/index.html` 及其他三个 HTML 入口；无需安装依赖。根 `server.cjs` 转发到 `apps/server`。

| 对话 | 独占源码 | 输入 → 输出 |
|---|---|---|
| A 知识库 | packages/knowledge，以及任务卡指定的知识原料 | MaterialBundle → KnowledgePack |
| B 教学设计 | packages/learning-design，包括原 task-activities 模板 | KnowledgePack → LearningPlan |
| C 游戏体验 | apps/game/src、模块测试和任务卡指定的界面译文 | PlayableCourse → 学习交互 |
| D 集成 | apps/server、packages/contracts、packages/course-compiler、根构建与跨模块测试 | 验证、编译、发布 |

具体允许路径、任务顺序、验收命令、报告格式以 [任务卡](../flow/tasks/README.md) 为准；接口、字段与错误规则以 [冻结契约 v1](contracts/pipeline-v1.md) 和 packages/contracts/types.d.ts 为准。

知识和教学的端口现已提供显式注入的适配器及固定样例，不代表通用知识整理算法已经完成。现有 API 两阶段生成继续运行，待 A/B 交付后由 D 接入新端口。

手工游戏源码位于 apps/game/src；四个共享兼容脚本位于 packages/contracts/runtime。dist 是发布副本，只有 D 更新。dist/assets 仍为共享美术真源，不得删除。现有生成数据仍由 D 用原构建脚本产生。content/task-activities.cjs 为兼容代理。

用户开启三个独立对话，推荐独立工作树；共用目录时严格分文件且不切分支、不清理、不提交其他对话改动。C 用 artifacts 下的独立预览；原入口仍可玩已发布版本。D 验收后构建到 dist，原入口获得集成结果。

本轮A3/B3/C正式集成已经完成，完整参考课程38节/144轮；来源增强、语义复核与旧存档验收见 [集成说明（归档）](../archive/history/INTEGRATION-history.md)。
