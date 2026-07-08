# 今日头条 JSON 约束

当前 `头条姬` 只支持今日头条编辑器原生可保存的结构。

## 顶层字段

必填：

- `publish_platform`
  固定为 `toutiao`
- `writing_style`
  `news` 或 `mass_family`
- `title_candidates`
  必须正好 3 个标题
- `summary`
  120 个字符以内（含标点）
- `blocks`

## 支持的 block

只允许：

- `heading`
- `paragraph`
- `blockquote`
- `bullet_list`
- `numbered_list`
- `divider`
- `table`
- `image`

## 各 block 格式

### `heading`

```json
{ "type": "heading", "text": "小标题" }
```

映射到头条原生 `h1`。

### `paragraph`

```json
{
  "type": "paragraph",
  "text": "普通正文"
}
```

或：

```json
{
  "type": "paragraph",
  "segments": [
    { "text": "普通文本" },
    { "text": "加粗重点", "marks": ["bold"] }
  ],
  "align": "left"
}
```

约束：

- `marks` 只允许 `bold`
- `align` 只允许 `left`、`center`、`right`
- 不支持 `accent`
- 不支持 `underline`

### `blockquote`

```json
{ "type": "blockquote", "text": "一段需要单独拎出来的话" }
```

### `bullet_list`

```json
{
  "type": "bullet_list",
  "items": ["并列点一", "并列点二"]
}
```

### `numbered_list`

```json
{
  "type": "numbered_list",
  "items": ["第一点", "第二点", "第三点"]
}
```

### `divider`

```json
{ "type": "divider" }
```

### `table`

```json
{
  "type": "table",
  "headers": ["列1", "列2"],
  "rows": [
    ["A", "B"],
    ["C", "D"]
  ]
}
```

### `image`

```json
{
  "type": "image",
  "image_url": "https://example.com/example.jpg",
  "source_name": "Example News",
  "source_page": "https://example.com/article"
}
```

说明：

- 图片来源会写入头条图片 caption
- 不要再额外生成一个“图片来源段落”
- 不要用 `svg`

## 不支持的内容

不要输出这些：

- `note`
- `quote`
- `pseudo_table`
- `statement`
- 颜色强调
- 下划线强调
- DOM / HTML 片段
- 大段自定义样式
