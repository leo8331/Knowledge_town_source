# 学习内容与来源

| 文件 | 用途 |
| --- | --- |
| [四章大纲](sources/AI_Business_Strategist_Outline.md) | 用户提供的学习顺序、13个任务与58项技能 |
| [学习资料](sources/AIB_C01_Collected_Study_Materials.md) | 用户提供的学习伴读资料，用于编写练习与引用 |
| [概念原料](aib-concepts.tsv) | 题库生成使用的概念、题干、答案和解释原料 |

四章的基础解释和例子是依据大纲编写的教学补充，不能冒充大纲原文定义；游戏界面标明了这一区别。练习为原创学习练习，不是官方考题。

## 重建内置内容

从仓库根目录运行：

```sh
python scripts/build-chapter-course.py
python scripts/build-aib-pack.py
```

分别生成 `dist/chapter-course.js`，以及 `dist/aib-pack.js` / `dist/aib-practice-pack.json`。构建脚本放在 `scripts/`，输入原料放在这里；不要把临时运行日志放进内容目录。

用户自行上传资料并调用API生成的课程保存在当前浏览器里，不会自动写进仓库。密钥只配置在本机 `.env` 中。

## 系统知识清单与双语原料

- `knowledge-inventory.json`：139个单元及13个任务的目标映射。
- `knowledge-english.tsv`：原有69个单元的英文定义和示例，7个新增概念在补充脚本中维护。
- `practice-english.tsv`：58组题目原料的英文版本，覆盖模板生成的200道题。
- `interface-english.json`：小镇界面词条。

课程构建会同步重建知识清单与语言数据。题库重建后执行 `node scripts/build-i18n.cjs`。详见[玩法与知识设计](../docs/GAME_GUIDE.md#知识与交互设计)。

- `expanded-knowledge.tsv`：其余12个任务的63个细分中英文教学补充，包含定义、例子、易混边界与来源键。
- `knowledge-sources.json`：补充资料的官方来源登记。
- `knowledge-categories.json`：实际知识类别的英文名称。
- `task-activities.cjs`：12个装置的42轮情境数据、目标映射和判定条件；不是通用配对模板。
