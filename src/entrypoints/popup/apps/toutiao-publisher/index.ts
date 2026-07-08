import type { PopupApp } from '../types';
import './style.css';

interface ToutiaoArticlePayload {
  writing_style?: 'news' | 'mass_family';
  title_candidates?: string[];
  selected_title?: string;
  summary?: string;
  blocks?: Array<Record<string, unknown>>;
}

const ALLOWED_BLOCK_TYPES = new Set([
  'heading',
  'paragraph',
  'blockquote',
  'bullet_list',
  'numbered_list',
  'divider',
  'table',
  'image',
]);

function normalizeBlock(block: Record<string, unknown>, index: number): Record<string, unknown> {
  const type = String(block.type || '').trim();
  if (!ALLOWED_BLOCK_TYPES.has(type)) {
    throw new Error(`第 ${index + 1} 个 block 类型不受头条支持：${type || '(空)'}`);
  }

  if (type === 'heading') {
    return {
      type: 'heading',
      text: String(block.text || block.content || '').trim(),
    };
  }

  if (type === 'paragraph') {
    const align = String(block.align || '').trim();
    const segments = Array.isArray(block.segments)
      ? block.segments
          .map((segment) => {
            const text = String((segment as Record<string, unknown>)?.text || '').trim();
            if (!text) return null;
            const marks = Array.isArray((segment as Record<string, unknown>)?.marks)
              ? ((segment as Record<string, unknown>).marks as unknown[])
                  .map((mark) => String(mark || '').trim())
                  .filter((mark) => mark === 'bold')
              : [];
            return marks.length ? { text, marks } : { text };
          })
          .filter(Boolean)
      : [];
    const normalized: Record<string, unknown> = {
      type: 'paragraph',
      text: String(block.text || block.content || '').trim(),
    };
    if (segments.length) {
      normalized.segments = segments;
    }
    if (align === 'center' || align === 'right' || align === 'left') {
      normalized.align = align;
    }
    return normalized;
  }

  if (type === 'blockquote') {
    return {
      type: 'blockquote',
      text: String(block.text || block.content || '').trim(),
    };
  }

  if (type === 'bullet_list' || type === 'numbered_list') {
    return {
      type,
      items: Array.isArray(block.items) ? block.items.map((item) => String(item ?? '').trim()).filter(Boolean) : [],
    };
  }

  if (type === 'divider') {
    return { type: 'divider' };
  }

  if (type === 'table') {
    const headers = Array.isArray(block.headers)
      ? block.headers
      : Array.isArray((block.data as Record<string, unknown> | undefined)?.headers)
        ? ((block.data as Record<string, unknown>).headers as unknown[])
        : [];
    const rows = Array.isArray(block.rows)
      ? block.rows
      : Array.isArray((block.data as Record<string, unknown> | undefined)?.rows)
        ? ((block.data as Record<string, unknown>).rows as unknown[])
        : [];
    return {
      type: 'table',
      headers: headers.map((item) => String(item ?? '').trim()),
      rows: rows.map((row) =>
        Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : [],
      ),
    };
  }

  if (type === 'image') {
    return { ...block, type: 'image' };
  }

  return block;
}

const STORAGE_KEY = 'ruo-tools:toutiao-publisher-payload';
const BRIDGE_FILE = 'toutiao-publisher-bridge.js';
const BRIDGE_GLOBAL = '__ruoruoToutiaoPublisher__';

function normalizeWritingStyle(style: unknown): 'news' | 'mass_family' {
  return String(style || '').trim() === 'mass_family' ? 'mass_family' : 'news';
}

async function getActiveTabId(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('没有找到当前标签页');
  if (!tab.url || !/^https?:/i.test(tab.url)) throw new Error('当前页面不支持（非 http/https）');
  return tab.id;
}

async function injectBridge(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [BRIDGE_FILE],
    world: 'MAIN',
  });
}

async function callBridge<T>(tabId: number, method: string, ...args: unknown[]): Promise<T> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (globalName: string, m: string, a: unknown[]) => {
      const bridge = (window as any)[globalName];
      if (!bridge || typeof bridge[m] !== 'function') {
        return { ok: false, error: '桥接脚本未就绪' };
      }
      try {
        const value = bridge[m](...a);
        if (value && typeof value.then === 'function') {
          return value
            .then((data: unknown) => ({ ok: true, data }))
            .catch((error: unknown) => ({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            }));
        }
        return { ok: true, data: value };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    args: [BRIDGE_GLOBAL, method, args],
    world: 'MAIN',
  });

  const [res] = results ?? [];
  if (!res) throw new Error('页面脚本未返回结果');
  if (!res.result || typeof res.result !== 'object') throw new Error('页面脚本未返回有效结果');
  const payload = res.result as { ok?: boolean; data?: T; error?: string };
  if (!payload.ok) throw new Error(payload.error || '页面脚本执行失败');
  if (payload.data == null) throw new Error('页面脚本未返回有效结果');
  return payload.data;
}

function parsePayload(raw: string): ToutiaoArticlePayload {
  const parsed = JSON.parse(raw) as ToutiaoArticlePayload;
  if (!parsed || typeof parsed !== 'object') throw new Error('JSON 结构无效');
  parsed.writing_style = normalizeWritingStyle(parsed.writing_style);
  if (!Array.isArray(parsed.title_candidates) || parsed.title_candidates.length !== 3) {
    throw new Error('title_candidates 必须正好提供 3 个标题');
  }
  if (!Array.isArray(parsed.blocks)) {
    throw new Error('缺少 blocks 数组');
  }
  parsed.blocks = parsed.blocks.map((block, index) => normalizeBlock(block, index));
  return parsed;
}

async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl, { credentials: 'omit' });
  if (!response.ok) throw new Error(`图片抓取失败: ${response.status}`);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('图片转 data URL 失败'));
    reader.readAsDataURL(blob);
  });
}

async function preparePayloadForInsert(payload: ToutiaoArticlePayload): Promise<ToutiaoArticlePayload> {
  const cloned: ToutiaoArticlePayload = {
    ...payload,
    blocks: Array.isArray(payload.blocks) ? payload.blocks.map((block) => ({ ...block })) : [],
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

function summarizePayload(payload: ToutiaoArticlePayload): string {
  const titleCount = Array.isArray(payload.title_candidates) ? payload.title_candidates.length : 0;
  const blocks = Array.isArray(payload.blocks) ? payload.blocks.length : 0;
  const images = Array.isArray(payload.blocks)
    ? payload.blocks.filter((item) => item && item.type === 'image' && item.image_url).length
    : 0;
  return `${normalizeWritingStyle(payload.writing_style)} · 标题候选 ${titleCount} 个 · 正文块 ${blocks} 个 · 正文图片 ${images} 张`;
}

const toutiaoPublisherApp: PopupApp = {
  id: 'toutiao-publisher',

  icon: {
    bg: '#fff3f0',
    html: `
      <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="3" y="3" width="36" height="36" rx="12" fill="#EF4444"/>
        <path d="M13 12.5H29V16H22.8V29.5H19.2V16H13V12.5Z" fill="white"/>
        <rect x="13" y="21" width="11" height="3.4" rx="1.7" fill="#FECACA"/>
        <rect x="13" y="26.1" width="15" height="3.4" rx="1.7" fill="#FDE68A"/>
      </svg>`,
  },

  async mount(container: HTMLElement, signal: AbortSignal): Promise<void> {
    container.innerHTML = `
      <div class="wp-app">
        <section class="wp-panel">
          <div class="wp-panel__head">
            <div>
              <p class="wp-panel__label">头条文章 JSON</p>
              <p class="wp-panel__meta" data-role="summary">等待输入</p>
            </div>
            <button class="wp-ghost-btn" data-action="format" type="button">格式化</button>
          </div>

          <textarea
            class="wp-textarea"
            data-role="textarea"
            spellcheck="false"
            placeholder='请粘贴头条专用 JSON。仅支持：heading / paragraph / blockquote / bullet_list / numbered_list / divider / table / image'
          ></textarea>

          <div class="wp-actions">
            <button class="wp-primary-btn" data-action="parse-json" type="button">解析JSON</button>
          </div>

          <div class="wp-status" data-role="status" role="status" aria-live="polite"></div>
        </section>

        <div class="wp-modal hidden" data-role="title-modal" aria-hidden="true">
          <div class="wp-modal__mask" data-action="close-modal"></div>
          <div class="wp-modal__panel" role="dialog" aria-modal="true" aria-labelledby="wp-title-modal-title">
            <div class="wp-modal__head">
              <div>
                <p class="wp-modal__eyebrow">选择标题</p>
                <h3 class="wp-modal__title" id="wp-title-modal-title">请选择要插入的标题</h3>
              </div>
              <button class="wp-modal__close" data-action="close-modal" type="button" aria-label="关闭">×</button>
            </div>
            <div class="wp-modal__list" data-role="title-options"></div>
            <div class="wp-modal__actions">
              <button class="wp-secondary-btn" data-action="cancel-title" type="button">取消</button>
              <button class="wp-primary-btn" data-action="confirm-title" type="button">确认并插入</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const textarea = container.querySelector<HTMLTextAreaElement>('[data-role="textarea"]')!;
    const summaryEl = container.querySelector<HTMLElement>('[data-role="summary"]')!;
    const statusEl = container.querySelector<HTMLElement>('[data-role="status"]')!;
    const formatBtn = container.querySelector<HTMLButtonElement>('[data-action="format"]')!;
    const parseJsonBtn = container.querySelector<HTMLButtonElement>('[data-action="parse-json"]')!;
    const modalEl = container.querySelector<HTMLElement>('[data-role="title-modal"]')!;
    const titleOptionsEl = container.querySelector<HTMLElement>('[data-role="title-options"]')!;
    const confirmTitleBtn = container.querySelector<HTMLButtonElement>('[data-action="confirm-title"]')!;
    const closeModalButtons = container.querySelectorAll<HTMLElement>('[data-action="close-modal"], [data-action="cancel-title"]');
    const actionButtons = [formatBtn, parseJsonBtn, confirmTitleBtn];
    let selectedTitleIndex = 0;
    let pendingPayload: ToutiaoArticlePayload | null = null;

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

    function openTitleModal(payload: ToutiaoArticlePayload) {
      pendingPayload = payload;
      selectedTitleIndex = 0;
      titleOptionsEl.innerHTML = '';
      const titles = Array.isArray(payload.title_candidates) ? payload.title_candidates : [];

      titles.forEach((title, index) => {
        const label = document.createElement('label');
        label.className = 'wp-title-option';
        label.innerHTML = `
          <input class="wp-title-option__radio" type="radio" name="wp-title-choice" value="${index}" ${index === 0 ? 'checked' : ''}>
          <span class="wp-title-option__content">
            <span class="wp-title-option__index">标题 ${index + 1}</span>
            <span class="wp-title-option__text"></span>
          </span>
        `;
        const textEl = label.querySelector<HTMLElement>('.wp-title-option__text');
        if (textEl) textEl.textContent = title;
        const radio = label.querySelector<HTMLInputElement>('input[type="radio"]');
        radio?.addEventListener('change', () => {
          if (radio.checked) selectedTitleIndex = index;
        });
        titleOptionsEl.appendChild(label);
      });

      modalEl.classList.remove('hidden');
      modalEl.setAttribute('aria-hidden', 'false');
    }

    function closeTitleModal() {
      modalEl.classList.add('hidden');
      modalEl.setAttribute('aria-hidden', 'true');
      pendingPayload = null;
    }

    async function ensureToutiaoEditor(tabId: number) {
      await injectBridge(tabId);
      const ok = await callBridge<boolean>(tabId, 'isToutiaoEditor');
      if (!ok) throw new Error('当前标签页不是今日头条编辑页，或编辑器尚未加载完成');
    }

    async function runInsert(inputPayload: ToutiaoArticlePayload) {
      setBusy(true);
      setStatus('正在预抓取正文图片...', 'info');

      try {
        const payload = await preparePayloadForInsert(inputPayload);
        const tabId = await getActiveTabId();
        await ensureToutiaoEditor(tabId);
        setStatus('正在写入今日头条编辑器...', 'info');
        const result = await callBridge<{
          success: boolean;
          title: string | null;
          blockCount: number;
          imageResults: Array<{ success: boolean; error?: string }>;
        }>(tabId, 'insertPayload', payload, {
          includeTitle: true,
          includeBody: true,
          includeImages: true,
          replaceBody: true,
        });

        const successImages = (result.imageResults || []).filter((item) => item.success).length;
        const totalImages = (result.imageResults || []).length;
        setStatus(`写入完成：标题已处理 · 正文块 ${result.blockCount} 个 · 图片 ${successImages}/${totalImages} 张`, 'ok');
      } catch (error) {
        setStatus(`插入失败：${(error as Error).message}`, 'error');
      } finally {
        setBusy(false);
      }
    }

    textarea.value = localStorage.getItem(STORAGE_KEY) ?? '';
    updateSummary();
    setStatus('请先打开今日头条编辑页，再粘贴 JSON 执行插入。', 'info');

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

    parseJsonBtn.addEventListener('click', () => {
      try {
        const payload = parsePayload(textarea.value);
        if (!payload.title_candidates?.length) throw new Error('没有可选标题');
        openTitleModal(payload);
        setStatus('请选择一个标题后确认插入。', 'info');
      } catch (error) {
        setStatus(`JSON 解析失败：${(error as Error).message}`, 'error');
      }
    });

    confirmTitleBtn.addEventListener('click', async () => {
      if (!pendingPayload) {
        setStatus('没有待插入的 JSON，请先点击“解析JSON”。', 'error');
        return;
      }
      const titles = Array.isArray(pendingPayload.title_candidates)
        ? pendingPayload.title_candidates.filter((title): title is string => typeof title === 'string' && !!title.trim())
        : [];
      const chosenTitle = titles[selectedTitleIndex];
      const payloadForInsert: ToutiaoArticlePayload = {
        ...pendingPayload,
        selected_title: chosenTitle || pendingPayload.selected_title || '',
      };
      closeTitleModal();
      await runInsert(payloadForInsert);
    });

    closeModalButtons.forEach((button) => {
      button.addEventListener('click', () => {
        closeTitleModal();
      });
    });
  },
};

export default toutiaoPublisherApp;
