import type { PopupApp } from '../types';
import './style.css';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface CaptureInfo {
  index: number;
  filename: string;
  type: string;
  size: number;
}

// ─────────────────────────────────────────────
// Bridge helpers
// ─────────────────────────────────────────────
async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('没有找到当前标签页');
  if (!tab.url || !/^https?:/i.test(tab.url)) throw new Error('当前页面不支持（非 http/https）');
  return tab;
}

async function injectBridge(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['q-image-bridge.js'],
    world: 'MAIN',
  });
}

async function isInstalled(tabId: number): Promise<boolean> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => !!(window as any).__ruoruoCutout?.isInstalled,
    world: 'MAIN',
  });
  return !!results?.[0]?.result;
}

async function getCaptures(tabId: number): Promise<CaptureInfo[]> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => (window as any).__ruoruoCutout?.getCaptures?.() ?? [],
    world: 'MAIN',
  });
  return (results?.[0]?.result ?? []) as CaptureInfo[];
}

async function getDataUrl(tabId: number, index: number): Promise<string | null> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (i: number) => (window as any).__ruoruoCutout?.getDataUrl?.(i),
    args: [index],
    world: 'MAIN',
  });
  return (results?.[0]?.result ?? null) as string | null;
}

// ─────────────────────────────────────────────
// App module
// ─────────────────────────────────────────────
const qImageHelperApp: PopupApp = {
  id: 'q-image-helper',

  icon: {
    bg: 'oklch(97% 0.012 200)',
    html: `<img src="icons/a-image-logo.png" width="44" height="44" alt="抠图侠">`,
  },

  async mount(container: HTMLElement, signal: AbortSignal): Promise<void> {
    container.innerHTML = `
      <div class="qi-app">
        <section class="qi-hero">
          <div class="qi-hero__info">
            <p class="qi-hero__label">抠图下载助手</p>
            <p class="qi-hero__desc">在美图秀秀抠图后，点击下方按钮开始监听，完成抠图后图片会自动出现在列表中</p>
          </div>
          <button class="qi-toggle-btn" data-action="toggle" type="button">
            <span class="qi-toggle-btn__dot"></span>
            <span class="qi-toggle-btn__text">开始监听</span>
          </button>
        </section>

        <div class="qi-status" data-role="status" aria-live="polite"></div>

        <section class="qi-panel">
          <div class="qi-panel__head">
            <span class="qi-panel__label">已捕获图片</span>
            <span class="qi-panel__count" data-role="count">0 张</span>
            <button class="qi-refresh-btn" data-action="refresh" type="button" title="刷新列表">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M23 4v6h-6M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
            </button>
          </div>
          <div class="qi-list" data-role="list">
            <div class="qi-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
              <p>等待抠图完成...</p>
            </div>
          </div>
        </section>
      </div>
    `;

    const toggleBtn = container.querySelector<HTMLButtonElement>('[data-action="toggle"]')!;
    const toggleText = toggleBtn.querySelector<HTMLSpanElement>('.qi-toggle-btn__text')!;
    const statusEl = container.querySelector<HTMLElement>('[data-role="status"]')!;
    const countEl = container.querySelector<HTMLElement>('[data-role="count"]')!;
    const listEl = container.querySelector<HTMLElement>('[data-role="list"]')!;
    const refreshBtn = container.querySelector<HTMLButtonElement>('[data-action="refresh"]')!;

    let tabId: number | null = null;
    let monitoring = false;

    function setStatus(msg: string, tone?: 'ok' | 'error' | 'info'): void {
      if (signal.aborted) return;
      statusEl.textContent = msg;
      statusEl.dataset.tone = tone ?? '';
    }

    function setMonitoring(active: boolean): void {
      monitoring = active;
      toggleBtn.classList.toggle('is-active', active);
      toggleText.textContent = active ? '停止监听' : '开始监听';
    }

    function formatSize(bytes: number): string {
      return bytes >= 1024 * 1024
        ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
        : `${(bytes / 1024).toFixed(0)} KB`;
    }

    async function renderCaptures(captures: CaptureInfo[]): Promise<void> {
      if (signal.aborted) return;
      countEl.textContent = `${captures.length} 张`;

      if (captures.length === 0) {
        listEl.innerHTML = `
          <div class="qi-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            <p>${monitoring ? '等待抠图完成...' : '请先点击「开始监听」'}</p>
          </div>`;
        return;
      }

      listEl.innerHTML = '';
      for (const cap of captures) {
        const item = document.createElement('div');
        item.className = 'qi-item';
        item.innerHTML = `
          <div class="qi-item__icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
          <div class="qi-item__info">
            <span class="qi-item__name">${cap.filename}</span>
            <span class="qi-item__meta">${formatSize(cap.size)}</span>
          </div>
          <button class="qi-download-btn" data-index="${cap.index}" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            下载
          </button>
        `;
        listEl.appendChild(item);
      }

      // Bind download buttons
      listEl.querySelectorAll<HTMLButtonElement>('.qi-download-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!tabId) return;
          const index = Number(btn.dataset.index);
          btn.disabled = true;
          btn.textContent = '转换中...';
          try {
            const dataUrl = await getDataUrl(tabId, index);
            if (!dataUrl) throw new Error('获取图片数据失败');
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = captures[index]?.filename ?? `cutout_${Date.now()}.png`;
            a.click();
            btn.textContent = '✓ 已下载';
            btn.classList.add('is-done');
          } catch (err) {
            btn.disabled = false;
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg> 下载`;
            setStatus(`下载失败: ${(err as Error).message}`, 'error');
          }
        });
      });
    }

    async function refreshCaptures(): Promise<void> {
      if (!tabId || !monitoring) return;
      try {
        const captures = await getCaptures(tabId);
        await renderCaptures(captures);
      } catch {
        // Silent refresh failure is ok
      }
    }

    // Auto-refresh every 2s while monitoring
    let refreshTimer: ReturnType<typeof setInterval> | null = null;

    function startAutoRefresh(): void {
      refreshTimer = setInterval(refreshCaptures, 2000);
    }

    function stopAutoRefresh(): void {
      if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    }

    signal.addEventListener('abort', stopAutoRefresh);

    // ── Toggle handler ──
    toggleBtn.addEventListener('click', async () => {
      if (monitoring) {
        setMonitoring(false);
        stopAutoRefresh();
        setStatus('已停止监听', 'info');
        return;
      }

      toggleBtn.disabled = true;
      setStatus('正在注入脚本...', 'info');

      try {
        const tab = await getActiveTab();
        tabId = tab.id!;
        await injectBridge(tabId);
        const ok = await isInstalled(tabId);
        if (!ok) throw new Error('脚本注入失败');

        setMonitoring(true);
        startAutoRefresh();
        setStatus('监听中，请在抠图页面上传图片', 'ok');
        await renderCaptures([]);
      } catch (err) {
        setStatus(`启动失败: ${(err as Error).message}`, 'error');
      } finally {
        toggleBtn.disabled = false;
      }
    });

    // ── Refresh button ──
    refreshBtn.addEventListener('click', async () => {
      if (!tabId) { setStatus('请先点击「开始监听」', 'info'); return; }
      await refreshCaptures();
    });

    // Initial state
    setStatus('点击「开始监听」以捕获抠图结果', 'info');
  },
};

export default qImageHelperApp;
