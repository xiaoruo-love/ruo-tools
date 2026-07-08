---
name: wechat-news-writer
description: 根据用户提供的主题、核心信息和写作目标，产出适合微信公众号阅读的结构化 JSON 文章结果。只要用户提到“写公众号文章”“根据主题扩写”“结合热点整理内容”“帮我搜资料再写成推文”“做一篇适合微信阅读的新闻稿/评论稿/解读稿”“按 schema 输出 JSON”，就应主动使用这个 skill，即使用户没有明确说“skill”或“公众号”。如果用户提到新闻解读、热点整理、家庭教育、中老年传播、下沉市场内容风格，也应优先使用本 skill。
---

# WeChat News Writer

把用户给出的主题和核心信息，扩展成一篇更完整、更可信、也更适合微信公众号阅读的内容。默认主产物不是普通正文字符串，而是结构化 JSON。

你的职责有三层：

1. 围绕用户重点补足背景、最新进展和可信来源
2. 根据目标受众选择合适的写法风格
3. 输出稳定、清晰、可被插件直接消费的 schema

## 何时使用

当用户有下面这些意图时，使用这个 skill：

- 给一个主题，要求写成公众号文章
- 给几条核心观点，要求扩写成可读性更强的内容
- 希望你先搜索相关新闻、数据、案例，再整合成文章
- 想把行业动态、政策变化、公司新闻、社会热点写成适合微信传播的文本
- 想要按固定 schema 返回 JSON 结果
- 想指定文章风格，例如新闻解读风、家庭教育风、中老年风、下沉市场传播风

如果用户只是要一句话摘要、纯事实问答、或完全不需要公众号文风，不要强行套用本 skill。

## 风格架构

本 skill 只有一套统一 schema，不拆成多个 skill。风格通过顶层字段 `writing_style` 表达。

当前仅支持两种风格：

- `news`
  适合新闻解读、热点梳理、公司动态、规则说明、产品观察、城市中青年阅读场景
- `mass_family`
  适合家庭教育、亲子关系、婚姻代际、生活判断、下沉市场传播、中老年与县城乡镇读者场景

默认规则：

- 用户明确指定风格时，严格使用用户指定值
- 用户未指定时，默认使用 `news`
- 只有当题材明显偏家庭关系、亲子教育、婚姻代际、底层生活经验表达时，才主动切到 `mass_family`

在写作前，必须先判断风格，然后再组织标题、段落、强调和小标题。

## 必读参考文件

根据 `writing_style` 选择并完整阅读对应参考文件：

- `writing_style = news`
  读取 `references/style-news.md`
- `writing_style = mass_family`
  读取 `references/style-mass-family.md`

不要两份都混着用。先选风格，再按该风格写作。

## 真正通用的规则

### 1. 先判断主轴和受众

不管是哪种风格，都先判断：

- 用户最想表达的是事实、观点、提醒，还是立场
- 文章核心受众是谁
- 这篇内容更适合解释、判断、共识传播，还是行动提醒

### 2. 主产物默认是 JSON，不是 HTML

默认不要返回 DOM / HTML 片段。即使用户提到“公众号排版”，也先返回结构化 JSON。

## 输出 schema

最外层返回值默认是 1 个 JSON 对象，至少包含：

- `writing_style`
- `title_candidates`
- `summary`
- `theme`
- `blocks`

推荐格式：

```json
{
  "writing_style": "news",
  "title_candidates": ["标题1", "标题2", "标题3"],
  "summary": "120个字符以内（含标点）的摘要",
  "theme": {
    "accent_color": "#6c7b95",
    "accent_name": "克制金棕",
    "reason": "这是一篇科技/规则解读稿，适合偏克制、稳定的强调色"
  },
  "blocks": [
    { "type": "paragraph", "variant": "lead", "text": "第一段正文" },
    { "type": "heading", "variant": "section_title", "text": "小标题" }
  ],
  "references": ["来源1", "来源2"]
}
```

## 顶层字段硬约束

- `writing_style` 必须是 `news` 或 `mass_family`
- `title_candidates` 必须正好提供 `3` 个标题
- `summary` 必须控制在 `120` 个字符以内，含标点
- `theme.accent_color` 必须是十六进制颜色
- 当 `writing_style = mass_family` 时，`theme.accent_color` 必须固定为 `#c14851`
- 正文中默认至少包含 `1` 到 `2` 个 `image` block，除非用户明确要求纯文字稿

## 风格文件职责

下面这些内容都不属于通用层，而属于具体风格层，必须在对应 reference 中定义和执行：

- 搜索口径和资料优先级
- 可用 block 组合与使用频率
- `paragraph / note / quote / numbered_list / pseudo_table / image` 的具体边界
- 内联强调策略
- 主题色偏好
- 去 AI 味策略
- 事实与风险控制强度

不要把某个风格特有的规则误当成所有风格的通用规则。

例如：

- `news` 更依赖规则说明、信息对比、时间口径、来源确认
- `mass_family` 更依赖生活场景、关系判断、代入感、口语节奏

## 执行顺序

1. 判断主题、核心信息、目标受众
2. 决定 `writing_style`
3. 读取对应的风格参考文件
4. 搜索并筛选资料
5. 组织标题、摘要、blocks、图片和引用
6. 输出符合 schema 的 JSON

## 最后要求

- 最终回复默认主产物必须是 JSON
- 不要返回大段 HTML
- 不要输出与 schema 无关的解释性长文
- 当用户只给很少信息时，也要尽量主动补足搜索、结构和表达
