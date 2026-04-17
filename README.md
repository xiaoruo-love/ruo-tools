# Ruo Tools

一个基于 **WXT + Manifest V3** 构建的模块化浏览器扩展。  
核心设计：插件像手机桌面，每个子功能是一个独立 **App**，点击图标进入，互不干扰，持续扩展只需新增一个模块。

---

## 设计理念

| 原则 | 说明 |
|---|---|
| 注册即接入 | 在 `features/registry.ts` 注册一条元数据，popup 自动展示图标 |
| 每个子应用独立 | 每个 App 有自己的目录、逻辑和样式，不影响其他功能 |
| 单向数据流 | popup/options → background → storage；content script 直读 storage |
| 类型安全 | 全链路 TypeScript：注册表、消息、存储、UI 共享同一套类型定义 |
| 最小副作用 | `popup-only` 类型的 App 仅在用户主动打开时才运行，不注入页面 |

---

## 项目结构

```
src/
├── app.config.ts               # 全局配置（feature toggles 按需添加）
├── features/
│   └── registry.ts             # 功能注册中心 — 每个子应用一条记录
├── shared/
│   ├── types.ts                # 全局共享类型（FeatureDefinition、FeatureRuntimeState …）
│   ├── storage.ts              # 底层存储工具
│   ├── messaging.ts            # 消息类型契约
│   ├── feature-service.ts      # popup / options 专用高层 API
│   └── content-script.ts      # content script 引导器
├── utils/
│   └── dom.ts                  # 通用 DOM 工具
└── entrypoints/
    ├── background/             # Service Worker — 处理运行时消息
    ├── options/                # 完整设置页
    └── popup/                  # 浏览器 Action 弹窗（App 启动器）
        ├── index.html
        ├── main.ts             # Shell：路由、首页 grid、生命周期管理
        ├── style.css           # 共享 Design Token + Shell 布局
        └── apps/               # ★ 每个子应用一个子目录
            ├── types.ts        # PopupApp 接口
            ├── index.ts        # 注册所有 Apps
            └── table-export/
                ├── index.ts    # Table Export 完整逻辑
                └── style.css   # Table Export 专属样式

public/
└── table-export-bridge.js      # 注入到页面的桥接脚本（chrome.scripting 调用）
```

---

## 两种子应用类型

### `popup-only`（弹窗内独立视图）

适合需要与页面交互但不持续注入的工具（如扫描 table、操作 DOM）。

- 不注册为 content script，不在后台运行
- 用户点击 App 图标后，popup 调用 `chrome.scripting.executeScript` 按需注入桥接脚本
- 整个逻辑在 `entrypoints/popup/apps/{id}/` 下，完全自包含

### `content`（持续注入型）

适合需要在页面加载时自动运行的功能（如清理追踪参数、修改页面样式）。

- 注册为独立 WXT entrypoint（`entrypoints/{id}/index.ts`）
- 由 `runFeatureContentScript` 统一处理开关检查和配置读取
- 由 background 协调写 storage，content script 直接读取

---

## 当前子应用

| App | 类型 | 功能 |
|---|---|---|
| Table Export | `popup-only` | 扫描当前页面所有 `<table>`，一键导出为 xlsx，支持合并单元格 |

---

## 如何添加新子应用

### 方案 A：`popup-only` App（推荐用于页面工具）

**第 1 步 — 注册元数据**（`src/features/registry.ts`）

```ts
{
  id: 'my-app',
  name: '我的工具',
  description: '功能说明。',
  category: 'productivity',
  version: '1.0.0',
  type: 'popup-only',
  matches: [],
  enabledByDefault: true,
},
```

**第 2 步 — 实现 PopupApp**（`src/entrypoints/popup/apps/my-app/index.ts`）

```ts
import type { PopupApp } from '../types';
import './style.css';   // 可选，专属样式

const myApp: PopupApp = {
  id: 'my-app',
  icon: {
    bg: 'oklch(95% 0.018 145)',   // 图标背景色
    svg: `<svg .../>`,            // 内联 SVG 图标
  },
  async mount(container, signal) {
    container.innerHTML = `<p>Hello from My App</p>`;
    // signal.aborted 为 true 时应停止异步操作
  },
  async unmount() {
    // 清理高亮、定时器、页面副作用等
  },
};

export default myApp;
```

**第 3 步 — 注册到 Apps 列表**（`src/entrypoints/popup/apps/index.ts`）

```ts
import myApp from './my-app';
export const apps: PopupApp[] = [tableExport, myApp];
```

完成。popup 首页会自动出现新 App 图标。

---

### 方案 B：`content` script（持续注入型）

**第 1 步 — 注册元数据**（`src/features/registry.ts`）

```ts
{
  id: 'my-feature',
  name: '我的功能',
  description: '功能说明。',
  category: 'privacy',
  version: '1.0.0',
  type: 'content',
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  enabledByDefault: false,
  settingsSchema: [                    // 可选配置字段
    { key: 'color', label: '颜色', type: 'string', defaultValue: '#ff0000' },
  ],
},
```

**第 2 步 — 创建 entrypoint**（`src/entrypoints/my-feature/index.ts`）

```ts
import { runFeatureContentScript } from '@/shared/content-script';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main: () =>
    runFeatureContentScript('my-feature', false, ({ settings }) => {
      // 这里写功能逻辑，settings 包含用户配置
    }),
});
```

完成。popup 开关和 options 配置表单会自动出现。

---

## PopupApp 接口

```ts
interface PopupApp {
  readonly id: string;                 // 必须与 featureRegistry 中的 id 一致
  readonly icon: { svg: string; bg: string };
  mount(container: HTMLElement, signal: AbortSignal): Promise<void> | void;
  unmount?(): Promise<void> | void;
}
```

| 生命周期 | 时机 | 说明 |
|---|---|---|
| `mount(container, signal)` | 每次进入该 App 视图时调用 | `signal` 在导航离开前触发，应中止所有异步操作 |
| `unmount()` | 导航离开该 App 时调用 | 清理页面副作用（高亮、监听器、定时器等） |

---

## FeatureDefinition 字段说明

| 字段 | 必填 | 类型 | 说明 |
|---|---|---|---|
| `id` | ✅ | `string` | 唯一 kebab-case 标识符 |
| `name` | ✅ | `string` | UI 显示名称 |
| `description` | ✅ | `string` | UI 显示描述 |
| `category` | ✅ | `FeatureCategory` | `productivity \| privacy \| accessibility \| developer` |
| `version` | ✅ | `string` | Semver 版本号 |
| `type` | ✅ | `'content' \| 'popup-only'` | `popup-only`：仅在弹窗内运行；`content`：注入页面 |
| `matches` | ✅ | `string[]` | URL 匹配规则（`popup-only` 填 `[]`） |
| `runAt` | — | `FeatureRunAt` | 仅 `content` 类型有效，默认 `document_idle` |
| `enabledByDefault` | ✅ | `boolean` | 首次安装时的默认开关状态 |
| `settingsSchema` | — | `FeatureSettingField[]` | 配置字段声明，options 页自动渲染表单 |

---

## 数据流

```
── popup-only App ──────────────────────────────────────────

用户点击 App 图标
    │
    ▼
popup/apps/{id}/index.ts — mount()
    │  chrome.scripting.executeScript({ files: ['bridge.js'] })
    ▼
页面中的桥接脚本（window.__bridge__）
    │  chrome.scripting.executeScript({ func: ... })
    ▼
结果返回 popup 渲染

── content script ──────────────────────────────────────────

popup/options 切换开关 → feature-service → background → storage
                                                           │
页面加载 → content script → 直读 storage → feature logic
```

---

## 开发命令

```bash
npm install
npm run dev            # Chrome 开发构建（支持 HMR）
npm run build          # Chrome 生产构建 → .output/chrome-mv3/
npm run zip            # 打包 Chrome Web Store 上传包
```

加载扩展：打开 `chrome://extensions` → 开启开发者模式 → 加载已解压的扩展 → 选择 `.output/chrome-mv3/`

---

## 后续演进方向

1. **设置页完善**：options 页按 `category` 分组展示，支持每个 App 的配置表单
2. **按需权限**：`popup-only` App 在首次使用时请求 host permission，而非全量声明
3. **App 排序 / 隐藏**：用户可在设置中拖拽排序或隐藏不常用 App
4. **国际化**：通过 `_locales` + `chrome.i18n` 支持多语言
5. **自动化测试**：为 background 消息处理和 shared storage 添加单元测试


---
