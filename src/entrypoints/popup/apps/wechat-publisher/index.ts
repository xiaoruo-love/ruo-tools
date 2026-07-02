import type { PopupApp } from '../types';
import './style.css';

interface WechatArticlePayload {
  title_candidates?: string[];
  selected_title?: string;
  author?: string;
  author_name?: string;
  summary?: string;
  digest?: string;
  theme?: {
    accent_color?: string;
    accent_name?: string;
    reason?: string;
  };
  cover_image?: {
    query?: string;
    image_url?: string;
    source_name?: string;
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
    world: 'MAIN',
  });
}

async function callBridge<T>(tabId: number, method: string, ...args: unknown[]): Promise<T> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (m: string, a: unknown[]) => {
      const bridge = (window as any).__ruoruoWechatPublisher__;
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
    args: [method, args],
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

function parsePayload(raw: string): WechatArticlePayload {
  const parsed = JSON.parse(raw) as WechatArticlePayload;
  if (!parsed || typeof parsed !== 'object') throw new Error('JSON 结构无效');
  if (!Array.isArray(parsed.title_candidates) || parsed.title_candidates.length !== 3) {
    throw new Error('title_candidates 必须正好提供 3 个标题');
  }
  if (!parsed.theme || typeof parsed.theme !== 'object' || !String(parsed.theme.accent_color || '').trim()) {
    throw new Error('缺少 theme.accent_color');
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
  const titleCount = Array.isArray(payload.title_candidates) ? payload.title_candidates.length : 0;
  const blocks = Array.isArray(payload.blocks) ? payload.blocks.length : 0;
  const images = Array.isArray(payload.blocks)
    ? payload.blocks.filter((item) => item && item.type === 'image' && item.image_url).length
    : 0;
  return `标题候选 ${titleCount} 个 · 正文块 ${blocks} 个 · 正文图片 ${images} 张`;
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
            <button class="wp-primary-btn" data-action="parse-json" type="button">解析JSON</button>
            <button class="wp-secondary-btn" data-action="attach-meta" type="button">添加附件属性</button>
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
    const attachMetaBtn = container.querySelector<HTMLButtonElement>('[data-action="attach-meta"]')!;
    const modalEl = container.querySelector<HTMLElement>('[data-role="title-modal"]')!;
    const titleOptionsEl = container.querySelector<HTMLElement>('[data-role="title-options"]')!;
    const confirmTitleBtn = container.querySelector<HTMLButtonElement>('[data-action="confirm-title"]')!;
    const closeModalButtons = container.querySelectorAll<HTMLElement>('[data-action="close-modal"], [data-action="cancel-title"]');
    const actionButtons = [formatBtn, parseJsonBtn, attachMetaBtn, confirmTitleBtn];
    let selectedTitleIndex = 0;
    let pendingPayload: WechatArticlePayload | null = null;

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

    function openTitleModal(payload: WechatArticlePayload) {
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

    async function ensureWechatEditor(tabId: number) {
      await injectBridge(tabId);
      const ok = await callBridge<boolean>(tabId, 'isWechatEditor');
      if (!ok) throw new Error('当前标签页不是公众号编辑页，或编辑器尚未加载完成');
    }

    async function runInsert(options: {
      includeTitle: boolean;
      includeAuthor: boolean;
      includeSummary: boolean;
      includeBody: boolean;
      includeImages: boolean;
      includeSaveDraft: boolean;
      replaceBody: boolean;
    }, inputPayload?: WechatArticlePayload) {
      let payload = inputPayload;
      if (!payload) {
        try {
          payload = parsePayload(textarea.value);
        } catch (error) {
          setStatus(`JSON 解析失败：${(error as Error).message}`, 'error');
          return;
        }
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
          authorResult: { filled: boolean; author: string; reason?: string };
          summaryResult: { filled: boolean; summary: string };
          blockCount: number;
          imageResults: Array<{ success: boolean }>;
          saveDraftResult: { success: boolean; error?: string } | null;
        }>(tabId, 'insertPayload', payload, options);

        if (!result || typeof result !== 'object') {
          throw new Error('页面脚本未返回有效结果');
        }

        const successImages = (result.imageResults || []).filter((item) => item.success).length;
        const totalImages = (result.imageResults || []).length;
        const statusParts: string[] = [];

        if (options.includeTitle) statusParts.push('标题已处理');
        if (options.includeAuthor) {
          statusParts.push(
            result.authorResult?.filled
              ? '作者已填'
              : `作者跳过${result.authorResult?.reason ? `(${result.authorResult.reason})` : ''}`,
          );
        }
        if (options.includeSummary) {
          statusParts.push(result.summaryResult?.filled ? '摘要已填' : '摘要跳过');
        }
        if (options.includeBody) {
          statusParts.push(`正文块 ${result.blockCount} 个`);
        }
        if (options.includeImages) {
          statusParts.push(`图片 ${successImages}/${totalImages} 张`);
        }
        if (options.includeSaveDraft) {
          statusParts.push(result.saveDraftResult?.success ? '草稿已保存' : '草稿保存失败');
        }

        setStatus(`写入完成：${statusParts.join(' · ')}`, 'ok');
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

    parseJsonBtn.addEventListener('click', () => {
      try {
        const payload = parsePayload(textarea.value);
        if (!payload.title_candidates?.length) {
          throw new Error('没有可选标题');
        }
        openTitleModal(payload);
        setStatus('请选择一个标题后确认插入。', 'info');
      } catch (error) {
        setStatus(`JSON 解析失败：${(error as Error).message}`, 'error');
      }
    });

    attachMetaBtn.addEventListener('click', async () => {
      await runInsert({
        includeTitle: false,
        includeAuthor: true,
        includeSummary: true,
        includeBody: false,
        includeImages: false,
        includeSaveDraft: true,
        replaceBody: false,
      });
    });

    confirmTitleBtn.addEventListener('click', async () => {
      if (!pendingPayload) {
        setStatus('没有待插入的 JSON，请先点击“解析JSON”。', 'error');
        return;
      }
      const originalTitles = Array.isArray(pendingPayload.title_candidates)
        ? pendingPayload.title_candidates.filter((title): title is string => typeof title === 'string' && !!title.trim())
        : [];
      const chosenTitle = originalTitles[selectedTitleIndex];
      const payloadForInsert: WechatArticlePayload = {
        ...pendingPayload,
        selected_title: chosenTitle || pendingPayload.selected_title || '',
      };
      closeTitleModal();
      await runInsert(
        {
          includeTitle: true,
          includeAuthor: false,
          includeSummary: false,
          includeBody: true,
          includeImages: true,
          includeSaveDraft: false,
          replaceBody: true,
        },
        payloadForInsert,
      );
    });

    closeModalButtons.forEach((button) => {
      button.addEventListener('click', () => {
        closeTitleModal();
      });
    });
  },
};

export default wechatPublisherApp;
