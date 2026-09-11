# Inkleaf · 墨页阅读

本地优先的 EPUB 阅读器，支持 AI 协作阅读、实时翻译和互动便签。

[English](README.md) · [产品设计](docs/PRODUCT.md) · [联网搜索设计](docs/WEB_SEARCH.md)

## 功能

- EPUB 书库：导入、打开、重命名、移除与最近阅读。
- 互动笔记：高亮、便签、翻译记录和每本书独立的 AI 对话。
- AI 共读：围绕当前选文与笔记进行解释、追问、比较和反思。
- 本地保存：书籍、笔记与对话保存在用户指定的书库文件夹中。
- 零依赖运行：只需要 Node.js，不需要数据库或云端账户。

## 系统要求

- Windows 10 或 Windows 11
- [Node.js](https://nodejs.org/) 18 或更高版本
- Microsoft Edge 或其他现代浏览器
- 可选：用于翻译和 AI 共读的 OpenAI 兼容模型 API

目前完整桌面流程以 Windows 为主，因为选择书库、导入 EPUB 和导出笔记使用 Windows 系统文件窗口。

## 最快使用方法

1. 下载或克隆项目。
2. 双击 `start-windows.cmd`。
3. 第一次打开时点击“选择书库文件夹”。
4. 点击“导入 EPUB”。
5. 如需翻译或 AI 共读，在设置中填写 Base URL、API Key、模型和目标语言。

也可以在项目目录运行：

```powershell
npm start
```

网页地址为 <http://127.0.0.1:43128>，仅限本机访问。

## 数据保存

```text
书库/
├─ 墨页书库.json
├─ 书籍/
│  └─ *.epub
└─ 笔记/
   └─ <book-id>/
      └─ notebook.json
```

`notebook.json` 保存便签、标注、翻译、AI 对话和阅读位置。备份整个书库文件夹即可同时备份书籍和笔记。

API 配置保存在 `%LOCALAPPDATA%\Inkleaf\settings.json`，不会写进 Git 项目或书库。只有用户主动交给 AI 的选文与上下文会发送给所配置的模型服务。

Gemini 的 OpenAI 兼容接口可以将 Base URL 填为 `https://generativelanguage.googleapis.com/v1beta`，Inkleaf 会自动补全兼容路径。

## 更新

```powershell
git pull --ff-only
npm test
npm start
```

更新项目不会移动或重写书库。

## 常见问题

- **打不开**：先运行 `node --version`，确认版本不低于 18；再在项目目录运行 `npm start` 查看提示。
- **页面空白**：直接打开 <http://127.0.0.1:43128> 并刷新，然后运行 `npm test`。
- **端口被占用**：先执行 `$env:INKLEAF_PORT=43129`，再执行 `npm start`。
- **旧设置不见了**：新版本会在首次启动时读取 `%LOCALAPPDATA%\墨页阅读网页\settings.json`；保存一次设置后会迁移到 Inkleaf 配置目录。

## 开发检查

```powershell
npm run check
npm test
```

自动检查使用临时配置，不会打开或修改真实书库。

## 设计文档

- [AI 协作阅读核心设计](docs/PRODUCT.md)
- [本地笔记与证据模型](docs/DATA_MODEL.md)
- [联网搜索工具设计](docs/WEB_SEARCH.md)
- [Socratic Reader 参考分析](docs/REFERENCE.md)

## 许可证

[MIT](LICENSE)。内置开源库保留各自许可证，详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
