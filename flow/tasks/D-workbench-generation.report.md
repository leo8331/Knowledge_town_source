# D · 工作台第三步模型链路修复验收

## 范围与结论
2026-10-24。本轮沿用第一步用户所选profileId，用户确认toklens · gpt-6.1-sol；不自动换知识库默认模型。只更新本地，不提交或推送。

## 原因与修复
- 8782原主进程运行旧代码，/kb/*实际404；启动器仅认项目身份，误复用旧构建。现要求buildId一致，已核身份后只重启本项目8782/8900。
- 模型选择重读配置时可能回到第一条。工作台持久化profileId，打开模型中心及刷新后恢复；第三步读第一步同一选择。换模型不清资料/场景。
- 知识库网络重试与教学输出重试阶梯叠加，429可反复请求，最终被误报为材料问题。统一每次模型请求最多3次，401/402/403/404立即失败，429/5xx有限退避，尊重Retry-After（上限60秒），上游错误不再进入输出修复阶梯。
- 原取消接口未阻止在途任务继续接受题目。现取消可中止在途请求、退避及正文读取，解析后再次核取消，防止本轮取消后落盘/成功；已完成的旧题库不删除。
- 运行时身份排除热读私有配置、题库与生成图，仍追踪服务代码，避免每次出题后误判服务过期。

## 实际文件
scripts/launch-game.cjs、apps/server/identity.cjs、dist/workbench.html、dist/knowledge/server.cjs；新增tests/server-identity-runtime.test.cjs、kb-model-retry.test.cjs、workbench-selected-model.test.cjs。
注意当前dist首页/工作台是新产品直接产物，未运行会覆盖首页的旧根游戏构建。

## 证据
- node --test tests/kb-model-retry.test.cjs tests/launcher.test.cjs tests/server-identity-runtime.test.cjs tests/upstream-retry.test.cjs tests/kb-bridge.test.cjs：31/31。
- node --test tests/workbench-selected-model.test.cjs：2/2。验证实际函数恢复选择、请求提交第一步ID、失败保留资料/场景。
- 独立不同模型review_cmd_runtime只读评审发现正文读取脱离超时/取消的P2，已修并补阻塞正文测试；复核无新增P1/P2。
- 真实所选toklens生成曾429，约85秒后返回1题，pack kbe49b5af5，已转换可玩且正确答案判对；但旧服务诊断期间取消未生效，不能把该次当成正常未取消全流程。另一次不带profileId的默认模型诊断pack kb30af778f不得冒称所选模型证据。两者是明确标注的链路诊断题库，未删用户题库。
- 更新后原CMD启动8782，buildId f10a1c23001dabbd1fe2c676af26ad1b5123da05c0ff29179bea01eea07852db；首页、工作台、预览、自定义地图、旧game及/kb/api/types均200。三个私有配置路径404。再次启动可正确复用。

## 未验与下一步
更新后未再次消耗真实模型额度生成完整课程；新重试/取消由隔离测试验证，非真实浏览器视觉验收。服务商持续429仍需等待或用户第一步手动换模型。用户Ctrl+F5刷新工作台后继续第三步即可，不必重新上传或生成场景。未改密钥/模型配置，未上传GitHub。
