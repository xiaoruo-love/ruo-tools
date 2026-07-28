import type { ExtensionRequest } from '@/shared/messaging';
import type { PopupApp } from '../types';
import './style.css';

interface SummaryResponse {
  summary: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

const FEATURE_ID = 'teacher-profile-writer';

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('没有找到当前标签页');
  if (!tab.url || !/^https?:/i.test(tab.url)) throw new Error('当前页面不支持（非 http/https）');
  return tab;
}

async function getPageBodyDom(tabId: number): Promise<string> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const body = document.body;
      if (!body) throw new Error('当前页面不存在 body');

      const clone = body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('script, style, noscript, iframe, svg').forEach((node) => node.remove());
      const html = clone.innerHTML.trim();
      return html.length > 20000 ? html.slice(0, 20000) : html;
    },
  });

  const [res] = results ?? [];
  if (!res) throw new Error('页面脚本未返回结果');
  return String(res.result ?? '').trim();
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

  async mount(container: HTMLElement): Promise<void> {
    container.innerHTML = `
      <div class="tpw-app">
        <section class="tpw-hero">
          <button class="tpw-primary-btn" data-action="generate-summary" type="button">生成简介</button>
        </section>

        <section class="tpw-panel">
          <div class="tpw-status" data-role="status" role="status" aria-live="polite">准备就绪。</div>
        </section>

        <section class="tpw-panel">
          <div class="tpw-panel__head">
            <div>
              <p class="tpw-panel__label">生成结果</p>
              <p class="tpw-panel__meta" data-role="summary-usage">等待生成</p>
            </div>
            <button class="tpw-secondary-btn" data-action="copy-summary" type="button">复制简介</button>
          </div>
          <textarea class="tpw-textarea tpw-textarea--result" data-role="summary" placeholder="这里会输出教师简介。" readonly></textarea>
        </section>
      </div>
    `;

    const summaryArea = container.querySelector<HTMLTextAreaElement>('[data-role="summary"]')!;
    const statusEl = container.querySelector<HTMLElement>('[data-role="status"]')!;
    const summaryUsageEl = container.querySelector<HTMLElement>('[data-role="summary-usage"]')!;
    const generateSummaryBtn = container.querySelector<HTMLButtonElement>('[data-action="generate-summary"]')!;
    const copySummaryBtn = container.querySelector<HTMLButtonElement>('[data-action="copy-summary"]')!;

    function setStatus(message: string, tone: 'info' | 'ok' | 'error' = 'info'): void {
      statusEl.textContent = message;
      statusEl.dataset.tone = tone;
    }

    async function loadCurrentPageDom(): Promise<{ bodyDom: string; pageUrl: string }> {
      const tab = await getActiveTab();
      const bodyDom = await getPageBodyDom(tab.id!);
      if (!bodyDom) {
        throw new Error('当前页面 body DOM 为空');
      }
      return { bodyDom, pageUrl: tab.url ?? '' };
    }

    generateSummaryBtn.addEventListener('click', async () => {
      generateSummaryBtn.disabled = true;
      copySummaryBtn.disabled = true;
      summaryArea.value = '';
      summaryUsageEl.textContent = '生成中...';
      setStatus('正在读取当前页面 body DOM 并生成教师简介，请稍候。', 'info');
      try {
        const { bodyDom } = await loadCurrentPageDom();
        const response = (await chrome.runtime.sendMessage({
          type: 'teacher-profile:generate-summary',
          payload: {
            rawText: bodyDom,
          },
        } satisfies ExtensionRequest)) as SummaryResponse;

        summaryArea.value = response.summary;
        const total = response.usage?.totalTokens;
        summaryUsageEl.textContent = typeof total === 'number' ? `总 tokens：${total}` : '生成完成';
        setStatus('教师简介生成完成。建议人工快速复核后再使用。', 'ok');
        copySummaryBtn.disabled = false;
      } catch (error) {
        summaryUsageEl.textContent = '生成失败';
        setStatus(`生成失败：${(error as Error).message}`, 'error');
      } finally {
        generateSummaryBtn.disabled = false;
      }
    });

    copySummaryBtn.addEventListener('click', async () => {
      const value = summaryArea.value;
      if (!value.trim()) {
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
