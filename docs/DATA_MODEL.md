# 本地笔记与证据模型

## 原则

- 书库可整体复制，不依赖云端数据库。
- 每本书的笔记独立保存，损坏不会影响其他书。
- 普通 JSON 保证可迁移；后续可附加 SQLite 索引，但索引必须可重建。
- AI 只能通过明确操作写笔记，并保留撤销记录。

## 建议结构

```json
{
  "version": 3,
  "bookId": "content-hash",
  "location": "epubcfi(...) ",
  "annotations": [],
  "notes": [],
  "translations": [],
  "conversations": [],
  "weakPoints": [],
  "links": [],
  "updatedAt": 0
}
```

一条笔记至少包含：

- `id`、创建和修改时间；
- `kind`：便签、问题、观点、反例、摘录、复习卡；
- `body`：读者可编辑的富文本块；
- `anchor`：CFI、章节 href、引文文本指纹；
- `author`：`reader`、`ai-draft` 或 `coauthored`；
- `evidence`：书内引文或外部链接；
- `history`：可撤销的修改记录。

## AI 写入规则

AI 默认只读。允许的写入流程为：

1. AI 返回结构化的笔记建议；
2. 界面显示将要写入的标题、正文、位置与来源；
3. 用户确认、修改或拒绝；
4. 服务端原子写入并保存上一个版本；
5. 界面提供撤销。

API 密钥与搜索密钥不能写入书库，也不能出现在导出笔记或 Git 历史中。

