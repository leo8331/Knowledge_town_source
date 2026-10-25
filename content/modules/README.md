# 工作台模块清单

这里存放工作台可选择的内容模块。老师的工作台只需要读取 `visual-themes.json`，就可以展示主题卡片、缩略图和可用场景。

模块职责分开：知识库决定“教什么”；教学模板决定“怎么教”；视觉主题决定“在哪里学”；游戏能力决定“怎么练习和复习”。

## 选择结果

```json
{"themeId":"knowledge-town-forest","sceneIds":["grove","town","harbor","observatory"],"templateId":"course-exploration","knowledgePackId":"kb-example"}
```

`themeId` 必填；`sceneIds` 为空时使用主题默认场景。图片路径以 `dist/` 为根，发布时由课程编译器校验场景 ID 是否属于所选主题。

当前主题：`knowledge-town-forest`（连续课程）和 `knowledge-town-adventures`（海边、冬日独立冒险）。
