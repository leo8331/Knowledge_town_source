# D：第三步接入完整知识库出题器

2026-10-24，本地更新，未提交或上传GitHub。

撤下工作台简版表单，第三步进入首页原有knowledge/index.html，带入资料与场景。保留受众、题量、六题型、搜索、任务、题库功能；出题模型可独立选择，也可用原API配置。点击顶部“使用此题库，继续预览”才回传当前真实题库。拒绝失效衔接和示例库；失败回滚，旧进度不删除。

改动：dist/workbench.html、dist/workbench-course.js、dist/knowledge/{index.html,app.js,style.css,workbench-link.js}、tests/workbench-selected-model.test.cjs。

验证：19/19专项回归通过；gpt-6.1-sol独立复核通过，初始化竞态修复后复核无阻断。真实浏览器从第二步资料进入完整出题器，Toklens gpt-6.1-sol限流重试后生成1题，题库kba5fc57dd回到第四步、预览、地图完成1/1，刷新保留。背景自然宽度1536。未宣称本轮逐题型真实生成全测。

确认无运行中任务并核实项目进程身份后重启8782/8900，原开始游戏.cmd --no-open成功，启动器再次调用复用新构建；浏览器第三步重验通过。截图：artifacts/runtime/workbench-e2e/full-question-maker.png。

下一步：刷新工作台→第三步→生成或打开题库→顶部“使用此题库，继续预览”。
