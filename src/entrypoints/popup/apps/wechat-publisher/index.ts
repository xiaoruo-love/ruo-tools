import type { PopupApp } from '../types';
import './style.css';

interface WechatArticlePayload {
  title_candidates?: string[];
  summary?: string;
  cover_title?: string;
  cover_image?: {
    query?: string;
    image_url?: string;
    source_page?: string;
    reason?: string;
  };
  blocks?: Array<Record<string, unknown>>;
}

const STORAGE_KEY = 'ruo-tools:wechat-publisher-payload';

async function getActiveTabId(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('没有找到当前标签页');
  if (!tab.url || !/^https?:/i.test(tab.url)) throw new Error('当前页面不支持（非 http/https）');
  return tab.id;
}

async function injectBridge(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['wechat-publisher-bridge.js'],
  });
}

async function callBridge<T>(tabId: number, method: string, ...args: unknown[]): Promise<T> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (m: string, a: unknown[]) => {
      const bridge = (window as any).__ruoruoWechatPublisher__;
      if (!bridge || typeof bridge[m] !== 'function') throw new Error('桥接脚本未就绪');
      return bridge[m](...a);
    },
    args: [method, args],
  });
  const [res] = results ?? [];
  if (!res) throw new Error('页面脚本未返回结果');
  return res.result as T;
}

function parsePayload(raw: string): WechatArticlePayload {
  const parsed = JSON.parse(raw) as WechatArticlePayload;
  if (!parsed || typeof parsed !== 'object') throw new Error('JSON 结构无效');
  if (!Array.isArray(parsed.title_candidates) || !parsed.title_candidates.length) {
    throw new Error('缺少 title_candidates[0]');
  }
  if (!Array.isArray(parsed.blocks)) {
    throw new Error('缺少 blocks 数组');
  }
  return parsed;
}

async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl, { credentials: 'omit' });
  if (!response.ok) {
    throw new Error(`图片抓取失败: ${response.status}`);
  }
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('图片转 data URL 失败'));
    reader.readAsDataURL(blob);
  });
}

async function preparePayloadForInsert(payload: WechatArticlePayload): Promise<WechatArticlePayload> {
  const cloned: WechatArticlePayload = {
    ...payload,
    blocks: Array.isArray(payload.blocks)
      ? payload.blocks.map((block) => ({ ...block }))
      : [],
  };

  if (!Array.isArray(cloned.blocks)) return cloned;

  for (let index = 0; index < cloned.blocks.length; index += 1) {
    const block = cloned.blocks[index] as Record<string, unknown>;
    if (block?.type !== 'image') continue;
    const imageUrl = typeof block.image_url === 'string' ? block.image_url : '';
    if (!imageUrl) throw new Error(`第 ${index + 1} 个图片 block 缺少 image_url`);
    if (typeof block.data_url === 'string' && block.data_url) continue;
    block.data_url = await imageUrlToDataUrl(imageUrl);
  }

  return cloned;
}

function summarizePayload(payload: WechatArticlePayload): string {
  const title = payload.title_candidates?.[0] ?? '未命名';
  const blocks = Array.isArray(payload.blocks) ? payload.blocks.length : 0;
  const images = Array.isArray(payload.blocks)
    ? payload.blocks.filter((item) => item && item.type === 'image' && item.image_url).length
    : 0;
  return `标题 1 个 · 正文块 ${blocks} 个 · 正文图片 ${images} 张`;
}

const wechatPublisherApp: PopupApp = {
  id: 'wechat-publisher',

  icon: {
    bg: 'oklch(97% 0.013 150)',
    html: `
      <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="3" y="3" width="36" height="36" rx="12" fill="#22C55E"/>
        <path d="M13 16.5C13 13.4624 15.6863 11 19 11H27C30.3137 11 33 13.4624 33 16.5C33 19.5376 30.3137 22 27 22H23.6L19.6 25.2C19.2024 25.5181 18.6113 25.235 18.6113 24.7235V22H19C15.6863 22 13 19.5376 13 16.5Z" fill="white"/>
        <path d="M9 21.2C9 18.6605 11.1949 16.6 13.9024 16.6H20.0976C22.8051 16.6 25 18.6605 25 21.2C25 23.7395 22.8051 25.8 20.0976 25.8H17.445L13.9138 28.4732C13.5036 28.7838 12.8887 28.4985 12.8887 27.977V25.8H13.9024C11.1949 25.8 9 23.7395 9 21.2Z" fill="#DCFCE7"/>
        <circle cx="17" cy="18.7" r="1.2" fill="#16A34A"/>
        <circle cx="22.2" cy="18.7" r="1.2" fill="#16A34A"/>
        <circle cx="23.6" cy="15.8" r="1.1" fill="#15803D"/>
        <circle cx="27.8" cy="15.8" r="1.1" fill="#15803D"/>
      </svg>`,
  },

  async mount(container: HTMLElement, signal: AbortSignal): Promise<void> {
    container.innerHTML = `
      <div class="wp-app">
        <section class="wp-hero">
          <div class="wp-hero__copy">
            <p class="wp-hero__eyebrow">公众号 JSON 插入器</p>
            <h2 class="wp-hero__title">当前页一键写标题、正文、正文图</h2>
            <p class="wp-hero__desc">把符合最新版 schema 的文章 JSON 粘进来，插件会把标题、正文和正文图写入当前公众号编辑页。</p>
          </div>
          <div class="wp-hero__badge">Beta</div>
        </section>

        <section class="wp-panel">
          <div class="wp-panel__head">
            <div>
              <p class="wp-panel__label">文章 JSON</p>
              <p class="wp-panel__meta" data-role="summary">等待输入</p>
            </div>
            <button class="wp-ghost-btn" data-action="format" type="button">格式化</button>
          </div>

          <textarea
            class="wp-textarea"
            data-role="textarea"
            spellcheck="false"
            placeholder='请粘贴包含 title_candidates / blocks / cover_image 的新版 JSON；正文图片需作为 image block 放在 blocks 中'
          ></textarea>

          <div class="wp-actions">
            <button class="wp-secondary-btn" data-action="insert-title" type="button">仅插入标题</button>
            <button class="wp-secondary-btn" data-action="insert-body" type="button">仅插入正文+正文图</button>
            <button class="wp-primary-btn" data-action="insert-all" type="button">插入标题+正文+正文图</button>
          </div>

          <div class="wp-status" data-role="status" role="status" aria-live="polite"></div>
        </section>
      </div>
    `;

    const textarea = container.querySelector<HTMLTextAreaElement>('[data-role="textarea"]')!;
    const summaryEl = container.querySelector<HTMLElement>('[data-role="summary"]')!;
    const statusEl = container.querySelector<HTMLElement>('[data-role="status"]')!;
    const formatBtn = container.querySelector<HTMLButtonElement>('[data-action="format"]')!;
    const insertTitleBtn = container.querySelector<HTMLButtonElement>('[data-action="insert-title"]')!;
    const insertBodyBtn = container.querySelector<HTMLButtonElement>('[data-action="insert-body"]')!;
    const insertAllBtn = container.querySelector<HTMLButtonElement>('[data-action="insert-all"]')!;
    const actionButtons = [formatBtn, insertTitleBtn, insertBodyBtn, insertAllBtn];

    function setStatus(message: string, tone: 'info' | 'ok' | 'error' = 'info') {
      if (signal.aborted) return;
      statusEl.textContent = message;
      statusEl.dataset.tone = tone;
    }

    function updateSummary() {
      try {
        const payload = parsePayload(textarea.value);
        summaryEl.textContent = summarizePayload(payload);
      } catch {
        summaryEl.textContent = '等待有效 JSON';
      }
    }

    function persistDraft() {
      localStorage.setItem(STORAGE_KEY, textarea.value);
    }

    function setBusy(busy: boolean) {
      actionButtons.forEach((btn) => {
        btn.disabled = busy;
      });
    }

    async function ensureWechatEditor(tabId: number) {
      await injectBridge(tabId);
      const ok = await callBridge<boolean>(tabId, 'isWechatEditor');
      if (!ok) throw new Error('当前标签页不是公众号编辑页，或编辑器尚未加载完成');
    }

    async function runInsert(options: {
      includeTitle: boolean;
      includeBody: boolean;
      includeImages: boolean;
      replaceBody: boolean;
    }) {
      let payload: WechatArticlePayload;
      try {
        payload = parsePayload(textarea.value);
      } catch (error) {
        setStatus(`JSON 解析失败：${(error as Error).message}`, 'error');
        return;
      }

      setBusy(true);
      setStatus('正在连接当前公众号编辑页...', 'info');

      try {
        if (options.includeImages) {
          setStatus('正在预抓取正文图片...', 'info');
          payload = await preparePayloadForInsert(payload);
          setStatus('正文图片已准备完成，正在连接编辑页...', 'info');
        }
        const tabId = await getActiveTabId();
        await ensureWechatEditor(tabId);
        setStatus('正在写入编辑器...', 'info');
        const result = await callBridge<{
          success: boolean;
          title: string | null;
          blockCount: number;
          imageResults: Array<{ success: boolean }>;
        }>(tabId, 'insertPayload', payload, options);

        const successImages = (result.imageResults || []).filter((item) => item.success).length;
        const totalImages = (result.imageResults || []).length;
        setStatus(
          `写入完成：标题 ${options.includeTitle ? '已处理' : '跳过'} · 正文块 ${result.blockCount} 个 · 图片 ${successImages}/${totalImages} 张`,
          'ok',
        );
      } catch (error) {
        setStatus(`插入失败：${(error as Error).message}`, 'error');
      } finally {
        setBusy(false);
      }
    }

    textarea.value = localStorage.getItem(STORAGE_KEY) ?? '';
    updateSummary();
    setStatus('请先打开公众号编辑页，再粘贴 JSON 执行插入。', 'info');

    textarea.addEventListener('input', () => {
      persistDraft();
      updateSummary();
    });

    formatBtn.addEventListener('click', () => {
      try {
        const payload = parsePayload(textarea.value);
        textarea.value = JSON.stringify(payload, null, 2);
        persistDraft();
        updateSummary();
        setStatus('已格式化 JSON', 'ok');
      } catch (error) {
        setStatus(`无法格式化：${(error as Error).message}`, 'error');
      }
    });

    insertTitleBtn.addEventListener('click', async () => {
      await runInsert({
        includeTitle: true,
        includeBody: false,
        includeImages: false,
        replaceBody: false,
      });
    });

    insertBodyBtn.addEventListener('click', async () => {
      await runInsert({
        includeTitle: false,
        includeBody: true,
        includeImages: true,
        replaceBody: true,
      });
    });

    insertAllBtn.addEventListener('click', async () => {
      await runInsert({
        includeTitle: true,
        includeBody: true,
        includeImages: true,
        replaceBody: true,
      });
    });
  },
};

export default wechatPublisherApp;
