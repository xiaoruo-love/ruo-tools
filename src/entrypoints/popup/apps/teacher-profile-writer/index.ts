import { getFeatureState, setFeatureSettings } from '@/shared/feature-service';
import type { ExtensionRequest } from '@/shared/messaging';
import type { PopupApp } from '../types';
import './style.css';

interface SelectionState {
  status: 'idle' | 'selecting' | 'selected';
  selectedText: string;
  selectedTag: string;
  selectedPreview: string;
  pageTitle: string;
  pageUrl: string;
}

interface SummaryResponse {
  summary: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

const FEATURE_ID = 'teacher-profile-writer';

async function getActiveTabId(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('没有找到当前标签页');
  if (!tab.url || !/^https?:/i.test(tab.url)) throw new Error('当前页面不支持（非 http/https）');
  return tab.id;
}

async function injectBridge(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['teacher-profile-writer-bridge.js'],
  });
}

async function callBridge<T>(tabId: number, method: string, ...args: unknown[]): Promise<T> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (m: string, a: unknown[]) => {
      const bridge = (window as any).__ruoruoTeacherProfileWriter__;
      if (!bridge || typeof bridge[m] !== 'function') throw new Error('选区脚本未就绪');
      return bridge[m](...a);
    },
    args: [method, args],
  });
  const [res] = results ?? [];
  if (!res) throw new Error('页面脚本未返回结果');
  return res.result as T;
}

function cleanTeacherText(raw: string): string {
  const lines = String(raw || '')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);

  const noisePatterns = [
    /^联系我们$/,
    /^来源[:：]?$/,
    /^时间[:：]?\d{4}[-/年]\d{1,2}[-/月]\d{1,2}/,
    /^上一篇/,
    /^下一篇/,
    /^地址[:：]/,
    /^邮编[:：]/,
    /^电话[:：]/,
    /^校徽$/,
    /^天津中医药大学网络中心/,
  ];

  return lines
    .filter((line) => !noisePatterns.some((pattern) => pattern.test(line)))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function setText(el: HTMLElement, value: string): void {
  el.textContent = value;
}

const teacherProfileWriterApp: PopupApp = {
  id: FEATURE_ID,

  icon: {
    bg: 'oklch(97% 0.02 65)',
    html: `
      <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="3" y="3" width="36" height="36" rx="12" fill="#FB923C"/>
        <path d="M14 14.5C14 12.567 15.567 11 17.5 11H29V25.5C29 27.433 27.433 29 25.5 29H14V14.5Z" fill="#FFF7ED"/>
        <path d="M17 17H25" stroke="#EA580C" stroke-width="2" stroke-linecap="round"/>
        <path d="M17 21H25" stroke="#EA580C" stroke-width="2" stroke-linecap="round"/>
        <path d="M17 25H22" stroke="#EA580C" stroke-width="2" stroke-linecap="round"/>
        <path d="M11 17.5L13.5 20L18.5 15" stroke="#7C2D12" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
  },

  async mount(container: HTMLElement, signal: AbortSignal): Promise<void> {
    container.innerHTML = `
      <div class="tpw-app">
        <section class="tpw-hero">
          <div>
            <p class="tpw-hero__eyebrow">Teacher Profile Writer</p>
            <h2 class="tpw-hero__title">框选教师履历，生成专业简介</h2>
            <p class="tpw-hero__desc">适用于高校教师主页、学院新闻详情页和简介页。先在页面中选中履历或简介区域，再调用 DashScope 生成单段教师描述。</p>
          </div>
          <button class="tpw-primary-btn" data-action="select" type="button">开始选区</button>
        </section>

        <section class="tpw-panel">
          <div class="tpw-panel__head">
            <div>
              <p class="tpw-panel__label">模型配置</p>
              <p class="tpw-panel__meta">API Key 和模型参数仅保存在本地浏览器存储中</p>
            </div>
          </div>

          <label class="tpw-field">
            <span>DashScope API Key</span>
            <input class="tpw-input" data-role="api-key" type="password" placeholder="sk-..." autocomplete="off" />
          </label>

          <div class="tpw-field-row">
            <label class="tpw-field">
              <span>模型</span>
              <input class="tpw-input" data-role="model" type="text" placeholder="qwen3.7-max" />
            </label>
            <label class="tpw-field">
              <span>附加要求</span>
              <input class="tpw-input" data-role="extra-instruction" type="text" placeholder="可选：突出研究方向和教学任务" />
            </label>
          </div>

          <div class="tpw-actions">
            <button class="tpw-secondary-btn" data-action="save-settings" type="button">保存配置</button>
            <button class="tpw-secondary-btn" data-action="clear-selection" type="button">清空选区</button>
          </div>
        </section>

        <section class="tpw-panel">
          <div class="tpw-panel__head">
            <div>
              <p class="tpw-panel__label">抽取文本</p>
              <p class="tpw-panel__meta" data-role="selection-meta">尚未选择页面区域</p>
            </div>
            <button class="tpw-secondary-btn" data-action="generate" type="button">生成简介</button>
          </div>
          <div class="tpw-status" data-role="status" role="status" aria-live="polite">点击“开始选区”后，回到页面里单击教师履历区域。</div>
          <textarea class="tpw-textarea" data-role="raw-text" placeholder="选中的页面文本会显示在这里，生成前可手动微调。"></textarea>
        </section>

        <section class="tpw-panel">
          <div class="tpw-panel__head">
            <div>
              <p class="tpw-panel__label">生成结果</p>
              <p class="tpw-panel__meta" data-role="usage">等待生成</p>
            </div>
            <button class="tpw-secondary-btn" data-action="copy" type="button">复制结果</button>
          </div>
          <textarea class="tpw-textarea tpw-textarea--result" data-role="summary" placeholder="这里会输出教师简介。" readonly></textarea>
        </section>
      </div>
    `;

    const apiKeyInput = container.querySelector<HTMLInputElement>('[data-role="api-key"]')!;
    const modelInput = container.querySelector<HTMLInputElement>('[data-role="model"]')!;
    const extraInstructionInput = container.querySelector<HTMLInputElement>('[data-role="extra-instruction"]')!;
    const rawTextArea = container.querySelector<HTMLTextAreaElement>('[data-role="raw-text"]')!;
    const summaryArea = container.querySelector<HTMLTextAreaElement>('[data-role="summary"]')!;
    const statusEl = container.querySelector<HTMLElement>('[data-role="status"]')!;
    const selectionMetaEl = container.querySelector<HTMLElement>('[data-role="selection-meta"]')!;
    const usageEl = container.querySelector<HTMLElement>('[data-role="usage"]')!;
    const selectBtn = container.querySelector<HTMLButtonElement>('[data-action="select"]')!;
    const generateBtn = container.querySelector<HTMLButtonElement>('[data-action="generate"]')!;
    const saveSettingsBtn = container.querySelector<HTMLButtonElement>('[data-action="save-settings"]')!;
    const clearSelectionBtn = container.querySelector<HTMLButtonElement>('[data-action="clear-selection"]')!;
    const copyBtn = container.querySelector<HTMLButtonElement>('[data-action="copy"]')!;

    let tabId: number | null = null;
    let currentSelection: SelectionState | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    function setStatus(message: string, tone: 'info' | 'ok' | 'error' = 'info'): void {
      if (signal.aborted) return;
      setText(statusEl, message);
      statusEl.dataset.tone = tone;
    }

    function stopPolling(): void {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    async function saveSettings(): Promise<void> {
      await setFeatureSettings(FEATURE_ID, {
        apiKey: apiKeyInput.value.trim(),
        model: modelInput.value.trim() || 'qwen3.7-max',
        extraInstruction: extraInstructionInput.value.trim(),
      });
    }

    function renderSelection(selection: SelectionState | null): void {
      currentSelection = selection;
      if (!selection || !selection.selectedText) {
        selectionMetaEl.textContent = '尚未选择页面区域';
        if (!rawTextArea.value.trim()) rawTextArea.value = '';
        return;
      }

      const cleaned = cleanTeacherText(selection.selectedText);
      rawTextArea.value = cleaned;
      selectionMetaEl.textContent = `${selection.pageTitle || '当前页面'} · <${selection.selectedTag || 'block'}> · ${cleaned.length} 字`;
    }

    async function pollSelectionState(): Promise<void> {
      if (!tabId) return;
      try {
        const state = await callBridge<SelectionState>(tabId, 'getSelectionState');
        if (state.status === 'selected' && state.selectedText) {
          stopPolling();
          renderSelection(state);
          setStatus('已抓取选区文本，可以直接生成或手动微调。', 'ok');
          selectBtn.disabled = false;
          selectBtn.textContent = '重新选区';
        } else if (state.status === 'selecting') {
          setStatus('请回到页面里单击教师履历、研究方向或简介区域。', 'info');
        }
      } catch (error) {
        stopPolling();
        selectBtn.disabled = false;
        selectBtn.textContent = '开始选区';
        setStatus(`选区状态读取失败：${(error as Error).message}`, 'error');
      }
    }

    async function startSelection(): Promise<void> {
      tabId = await getActiveTabId();
      await injectBridge(tabId);
      await callBridge(tabId, 'startSelection');
      rawTextArea.value = '';
      summaryArea.value = '';
      usageEl.textContent = '等待生成';
      selectionMetaEl.textContent = '正在页面中等待用户点选...';
      setStatus('已进入选区模式。请回到页面里单击教师履历区域，按 Esc 可取消。', 'info');
      selectBtn.textContent = '等待选区中...';
      selectBtn.disabled = true;
      stopPolling();
      pollTimer = setInterval(() => {
        void pollSelectionState();
      }, 500);
    }

    async function clearSelection(): Promise<void> {
      rawTextArea.value = '';
      summaryArea.value = '';
      usageEl.textContent = '等待生成';
      selectionMetaEl.textContent = '尚未选择页面区域';
      currentSelection = null;
      stopPolling();
      if (tabId) {
        try {
          await callBridge(tabId, 'clearSelection');
        } catch {
          // ignore
        }
      }
    }

    signal.addEventListener('abort', () => {
      stopPolling();
      if (!tabId) return;
      void callBridge(tabId, 'stopSelection').catch(() => {});
    });

    const featureState = await getFeatureState(FEATURE_ID);
    apiKeyInput.value = String(featureState?.settings.apiKey ?? '');
    modelInput.value = String(featureState?.settings.model ?? 'qwen3.7-max');
    extraInstructionInput.value = String(featureState?.settings.extraInstruction ?? '');

    saveSettingsBtn.addEventListener('click', async () => {
      saveSettingsBtn.disabled = true;
      try {
        await saveSettings();
        setStatus('模型配置已保存到本地。', 'ok');
      } catch (error) {
        setStatus(`保存失败：${(error as Error).message}`, 'error');
      } finally {
        saveSettingsBtn.disabled = false;
      }
    });

    clearSelectionBtn.addEventListener('click', async () => {
      await clearSelection();
      setStatus('已清空当前选区。', 'info');
    });

    selectBtn.addEventListener('click', async () => {
      try {
        await startSelection();
      } catch (error) {
        selectBtn.disabled = false;
        selectBtn.textContent = '开始选区';
        setStatus(`启动选区失败：${(error as Error).message}`, 'error');
      }
    });

    generateBtn.addEventListener('click', async () => {
      const apiKey = apiKeyInput.value.trim();
      const model = modelInput.value.trim() || 'qwen3.7-max';
      const rawText = cleanTeacherText(rawTextArea.value);

      if (!apiKey) {
        setStatus('请先填写 DashScope API Key。', 'error');
        apiKeyInput.focus();
        return;
      }

      if (!rawText) {
        setStatus('请先完成页面选区，或手动粘贴教师履历文本。', 'error');
        rawTextArea.focus();
        return;
      }

      generateBtn.disabled = true;
      copyBtn.disabled = true;
      summaryArea.value = '';
      usageEl.textContent = '生成中...';
      setStatus('正在调用 DashScope 生成教师简介，请稍候。', 'info');

      try {
        await saveSettings();
        const response = (await chrome.runtime.sendMessage({
          type: 'teacher-profile:generate-summary',
          payload: {
            apiKey,
            model,
            pageTitle: currentSelection?.pageTitle || document.title,
            pageUrl: currentSelection?.pageUrl || '',
            rawText,
            extraInstruction: extraInstructionInput.value.trim(),
          },
        } satisfies ExtensionRequest)) as SummaryResponse;

        summaryArea.value = response.summary;
        const total = response.usage?.totalTokens;
        usageEl.textContent = typeof total === 'number' ? `总 tokens：${total}` : '生成完成';
        setStatus('教师简介生成完成。建议人工快速复核后再使用。', 'ok');
        copyBtn.disabled = false;
      } catch (error) {
        usageEl.textContent = '生成失败';
        setStatus(`生成失败：${(error as Error).message}`, 'error');
      } finally {
        generateBtn.disabled = false;
      }
    });

    copyBtn.addEventListener('click', async () => {
      const value = summaryArea.value.trim();
      if (!value) {
        setStatus('当前没有可复制的简介内容。', 'error');
        return;
      }

      try {
        await navigator.clipboard.writeText(value);
        setStatus('已复制生成结果。', 'ok');
      } catch (error) {
        setStatus(`复制失败：${(error as Error).message}`, 'error');
      }
    });
  },
};

export default teacherProfileWriterApp;
