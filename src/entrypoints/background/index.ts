import { featureRegistry } from '@/features/registry';
import { setFeatureEnabled, setFeatureSettings, toFeatureRuntimeStates } from '@/shared/storage';
import type { ExtensionRequest, ExtensionResponse } from '@/shared/messaging';

type ViewMode = 'popup' | 'sidepanel';
const STORAGE_KEY = 'ruo_view_mode';
const TEACHER_PROFILE_MODEL = 'qwen3.7-max';
const TEACHER_PROFILE_API_KEY = 'sk-9382b0b0304442749a4b456c4da7b98b';
const LEAD_SOURCE = '人工查询2026';

// Default = 'popup' to match manifest's default_popup; prevents race-condition mismatch.
let cachedMode: ViewMode = 'popup';

function applyMode(mode: ViewMode): void {
  const sp = (chrome as any).sidePanel;
  if (mode === 'sidepanel') {
    // Clear popup so action.onClicked fires (and openPanelOnActionClick can work).
    chrome.action.setPopup({ popup: '' });
    if (sp) {
      // Explicitly register the panel path (don't rely solely on manifest default).
      sp.setPanel?.({ path: 'sidepanel.html' }).catch?.(() => {});
      sp.setPanelBehavior?.({ openPanelOnActionClick: true }).catch?.(() => {});
    }
  } else {
    chrome.action.setPopup({ popup: chrome.runtime.getURL('popup.html') });
    sp?.setPanelBehavior?.({ openPanelOnActionClick: false }).catch?.(() => {});
  }
}

interface DashScopeUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

interface DashScopeResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  usage?: DashScopeUsage;
}

function extractAssistantText(content: DashScopeResponse['choices'][number]['message']['content']): string {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item?.text === 'string' ? item.text : ''))
      .join('\n')
      .trim();
  }
  return '';
}
const SYSTEM_PROMPT =`
你是一名高校教师简介编辑助手。请仅基于用户提供的教师页面材料，生成一段科学、精确、专业、克制的中文教师研究方向、履历的简介。

## 要求：
  1. 只能使用材料中明确出现的信息，不要补充、猜测、杜撰任何履历、职称、奖项、论文、项目或社会兼职。
  2. 语气客观、正式，不要使用夸张宣传语，不要使用“致力于”“深耕”“享有盛誉”等空泛词。
  3. 优先整合以下信息：姓名、学位/职称、任职单位、研究方向、教学工作、代表性履历或参与事项。
  4. 如果材料信息有限，就如实简洁概括，不要为了凑长度而扩写。
## 核心
  1. 不可以脱离用户提供的教师材料，不可以额外编造、杜撰
`

function mapUsage(data: DashScopeResponse) {
  return {
    inputTokens: data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens,
    totalTokens: data.usage?.total_tokens,
  };
}

async function generateTeacherProfileSummary(payload: {
  rawText: string;
}): Promise<Extract<ExtensionResponse, { summary: string }>> {
  if (!TEACHER_PROFILE_API_KEY.trim()) {
    throw new Error('请先在 background 中配置 TEACHER_PROFILE_API_KEY');
  }
  const user_prompt = [payload.rawText.trim()]
    .filter(Boolean)
    .join('\n');

  const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TEACHER_PROFILE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: TEACHER_PROFILE_MODEL,
      messages: [{ role: 'system', content: SYSTEM_PROMPT },{ role: 'user', content: user_prompt }],
      stream: false,
      top_p: 0.8,
      temperature: 0.4,
      enable_search: false,
      enable_thinking: false,
      thinking_budget: 4000,
      result_format: 'message',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DashScope 请求失败（${response.status}）：${errorText.slice(0, 240)}`);
  }

  const data = (await response.json()) as DashScopeResponse;
  const summary = extractAssistantText(data.choices?.[0]?.message?.content);
  if (!summary) {
    throw new Error('模型未返回有效摘要内容');
  }

  return {
    summary,
    usage: mapUsage(data),
  };
}

export default defineBackground(() => {
  // action.onClicked only fires when popup is cleared (= sidepanel mode).
  // Re-apply setPopup('') as a safety net in case Chrome reset it after SW restart.
  chrome.action.onClicked.addListener((tab) => {
    const sp = (chrome as any).sidePanel;
    if (!sp) return;
    chrome.action.setPopup({ popup: '' });
    Promise.resolve(sp.open?.({ windowId: tab.windowId })).catch(() => {});
  });

  // Restore saved mode on SW startup.
  chrome.storage.local.get(STORAGE_KEY).then((result) => {
    cachedMode = (result[STORAGE_KEY] as ViewMode) ?? 'popup';
    applyMode(cachedMode);
  });

  // React immediately when popup/sidepanel UI writes a new mode to storage.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && STORAGE_KEY in changes) {
      cachedMode = (changes[STORAGE_KEY].newValue as ViewMode) ?? 'popup';
      applyMode(cachedMode);
    }
  });

  browser.runtime.onMessage.addListener(
    async (message: ExtensionRequest | { type?: string; [key: string]: unknown }): Promise<ExtensionResponse> => {
      if (message.type === 'features:list') {
        return { features: await toFeatureRuntimeStates(featureRegistry) };
      }

      if (message.type === 'features:set-enabled') {
        await setFeatureEnabled(message.featureId, message.enabled);
        return { ok: true };
      }

      if (message.type === 'features:set-settings') {
        await setFeatureSettings(message.featureId, message.settings);
        return { ok: true };
      }

      if (message.type === 'features:get-state') {
        const states = await toFeatureRuntimeStates(featureRegistry);
        return (states.find((s) => s.featureId === message.featureId) ??
          null) as ExtensionResponse;
      }

      if (message.type === 'teacher-profile:generate-summary') {
        return await generateTeacherProfileSummary(message.payload);
      }

      throw new Error(`Unsupported message type: ${String(message?.type ?? '(unknown)')}`);
    },
  );
});
