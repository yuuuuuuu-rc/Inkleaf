# 墨页阅读

面向 EPUB 与可重排文档的本地 AI 协作阅读器。书籍、标注、便签、阅读位置与 AI 对话均保存在用户指定的本地书库中；浏览器界面只连接 `127.0.0.1` 上的本机服务。

## 当前能力

- EPUB 书库：导入、打开、重命名、移除与最近阅读。
- 稳定定位：以书籍 ID、章节位置和 EPUB CFI 保存阅读位置与标注。
- 互动笔记：高亮、便签、翻译记录和每本书独立的 AI 对话。
- AI 共读：基于当前选文与笔记解释、追问、比较、提出反例。
- 实时翻译：兼容 OpenAI Chat Completions 风格接口，也适配 Gemini 的 OpenAI 兼容入口。
- 本地优先：书籍和笔记不会上传；只有用户交给 AI 的上下文会发送至所配置的模型接口。

## 启动

需要 Node.js 18 或更高版本：

```powershell
npm start
```

打开 `http://127.0.0.1:43128`。桌面快捷方式也会启动同一个本地网页。

## 数据位置

用户选择的书库保持可搬运：

```text
书库/
├─ 墨页书库.json
├─ 书籍/
│  └─ *.epub
└─ 笔记/
   └─ <book-id>/
      └─ notebook.json
```

`notebook.json` 保存便签、标注、翻译、AI 对话和阅读位置。API 密钥不放入 Git 项目或书库，而保存在当前 Windows 用户的本地配置目录。

## 产品方向

- [AI 协作阅读核心设计](docs/PRODUCT.md)
- [本地笔记与证据模型](docs/DATA_MODEL.md)
- [联网搜索工具设计](docs/WEB_SEARCH.md)
- [Socratic Reader 参考分析](docs/REFERENCE.md)

## 开发

当前版本零运行时依赖，服务端使用 Node.js 内置模块，网页成品在 `dist/`：

```powershell
npm run check
```

本项目仅供本地运行；不要把服务监听地址改成 `0.0.0.0`，也不要提交真实 API 密钥、书籍或个人笔记。

