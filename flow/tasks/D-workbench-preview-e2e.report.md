# D · 工作台生成→预览→地图完整验收（2026-10-24）

## 本轮结果
已用真实浏览器、真实本地8782与用户所选Toklens · gpt-6.1-sol完成：自定义场景生成→第三步课程生成→第四步预览→打开完整预览→进入地图→逐项答题→8/8完成→刷新恢复8/8。用户现有Firefox课程和存档未清除，测试在独立的内置浏览器中进行。已更新原开始游戏.cmd使用的本地服务，没有提交或上传GitHub。

## 根因与增量
1. preview.html把url("图片地址")直接插入双引号style属性，属性被截断。统一course-presentation.js，使用DOM img.src赋值；预览、工作台、地图共享图片选择逻辑，图片失败有明确说明。
2. custom-game只加载customImage，内置模板没有背景；现模板使用本地assets，避免依赖GitHub远程图片，也不会被之前自定义图覆盖。
3. 资料开头的Markdown围栏被当作课程标题。标题提取跳过围栏，现存无意义标题回退知识点名称。
4. 第四步仍显示硬编码课程信息，现读取实际保存课程。预览链接改同页导航，避免内置浏览器新窗口未打开；资料输入/文件读取保存本机，返回可恢复。
5. 实际浏览器发现窄窗口任务点重叠，点击命中另一题；现窄屏或检测到碰撞时排列任务点，唯一任务编号aria，返回地图隐藏答题面板；完成和刷新有明确通关状态。
6. 跨模型评审发现场景重试可能与课程生成并发，迟到响应覆盖新课程。统一sceneBusy涵盖初次生成和重试；双向排斥课程生成，课程背景使用启动时快照。延迟响应回归通过，复评P2关闭。

## 变更文件
- dist/course-presentation.js（新）
- dist/preview.html、dist/workbench.html、dist/custom-game.html
- tests/course-presentation.test.cjs、tests/map-layout.test.cjs（新）
- tests/workbench-selected-model.test.cjs
- flow/plan.md、flow/进展.md、flow/decisions.md、flow/踩坑记录.md及本报告
当前新工作台是dist中的实际源文件，未运行会覆盖新首页的旧根game构建。未修改B教学设计。

## 真实验收证据
- 用户所选模型：Toklens · gpt-6.1-sol；真实生成过程中遇429，等待后完成，未换模型。
- 真场景图：/generated-scenes/74e1db92-7b7e-4b81-abc9-438759f6f47a.png，浏览器naturalWidth=1536。
- 真课程：森林邮局：规则与学习，题库kb329507e0，7单选+1多选。
- 浏览器操作：第三步完成8题→点击第四步→点击完整预览→点击开始互动任务→实际选择全部答案→完成8/8。故意单选答错和多选漏选，进度均不增加；重新答对可继续。刷新后8/8与图片恢复，无console error/warn。
- 自定义预览（含原截图的围栏标题）与内置森林模板分别加载成功。
- 专项：node --test tests/workbench-selected-model.test.cjs tests/map-layout.test.cjs tests/course-presentation.test.cjs tests/kb-bridge.test.cjs，17/17 PASS。
- 布局回归覆盖280/360/590/800/1180宽度的12个聚集任务点，均无重叠。
- 不同模型review_preview_pipeline只读评审，已修P2后无新P1/P2。
- 原CMD已重启，buildId ae5fcf715c6cad4e2c72189dc6571335fdeb8fc5d55346a947eafe31fec1f503；再次启动正确复用。工作台/预览/地图/展示脚本/旧game入口HTTP200。
- artifacts/runtime/workbench-e2e/result.json、preview.png、completed.png为本轮证据。

## 保留范围
本轮真实课程覆盖单选/多选；其他四种题型由已有bridge专项回归，未宣称本轮逐项浏览器实操。地图狭窄视口实际操作通过，其他尺寸为布局算法测试。跨设备分享仍依赖本机课程数据，不宣称发布链接可异地完整游玩。生成质量（例如部分题的知识点标签过宽）属于B教学内容，未在本轮擅自重写。服务商限流仍由上游决定。

## 试玩
继续原开始游戏.cmd；原页面Ctrl+F5刷新，已生成课程可直接打开预览→开始互动任务，不必为了这次背景修复重新生成。
