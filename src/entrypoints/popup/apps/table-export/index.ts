import type { PopupApp } from '../types';
import './style.css';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface TableItem {
  index: number;
  title: string;
  rowCount: number;
  colCount: number;
  preview: string;
}

// ─────────────────────────────────────────────
// Bridge helpers (stateless — take tabId explicitly)
// ─────────────────────────────────────────────
async function getActiveTabId(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('没有找到当前标签页');
  if (!tab.url || !/^https?:/i.test(tab.url)) throw new Error('当前页面不支持（非 http/https）');
  return tab.id;
}

async function injectBridge(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['table-export-bridge.js'],
  });
}

async function callBridge<T>(tabId: number, method: string, ...args: unknown[]): Promise<T> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (m: string, a: unknown[]) => {
      const bridge = (window as any).__ruoruoTableExporter__;
      if (!bridge || typeof bridge[m] !== 'function') throw new Error('桥接脚本未就绪');
      return bridge[m](...a);
    },
    args: [method, args],
  });
  const [res] = results ?? [];
  if (!res) throw new Error('页面脚本未返回结果');
  return res.result as T;
}

// ─────────────────────────────────────────────
// App module
// ─────────────────────────────────────────────
let _tabId: number | null = null;

const tableExportApp: PopupApp = {
  id: 'table-export',

  icon: {
    bg: 'oklch(97% 0.010 60)',
    html: `<img src="icons/table-export.png" width="44" height="44" style="image-rendering:pixelated" alt="Table Export">`,
  },

  async mount(container: HTMLElement, signal: AbortSignal): Promise<void> {
    _tabId = null;

    // ── Render skeleton ──
    container.innerHTML = `
      <div class="te-status">正在扫描当前页面...</div>
      <div class="te-toolbar">
        <span class="te-count">—</span>
        <button class="btn-primary" data-action="export-all" disabled>导出全部</button>
      </div>
      <div class="te-list"></div>
    `;

    const statusEl    = container.querySelector<HTMLElement>('.te-status')!;
    const countEl     = container.querySelector<HTMLElement>('.te-count')!;
    const listEl      = container.querySelector<HTMLElement>('.te-list')!;
    const exportAllBtn = container.querySelector<HTMLButtonElement>('[data-action="export-all"]')!;

    function setStatus(msg: string, tone?: string): void {
      if (signal.aborted) return;
      statusEl.textContent = msg;
      if (tone) statusEl.dataset.tone = tone;
      else delete statusEl.dataset.tone;
    }

    function setCount(text: string): void {
      if (signal.aborted) return;
      countEl.textContent = text;
    }

    function renderList(items: TableItem[]): void {
      if (signal.aborted) return;

      if (!items.length) {
        listEl.innerHTML = `
          <div class="te-empty">
            <p class="te-empty-title">没有找到表格</p>
            <p class="te-empty-desc">当前页面里没有可导出的 table 元素。</p>
          </div>
        `;
        exportAllBtn.disabled = true;
        setCount('0 个表格');
        return;
      }

      exportAllBtn.disabled = false;
      setCount(`${items.length} 个表格`);

      listEl.innerHTML = items
        .map(
          (item) => `
          <button class="te-item" data-index="${item.index}">
            <div class="te-item-top">
              <span class="te-item-index">#${item.index + 1}</span>
              <div class="te-item-meta">
                <p class="te-item-title">${item.title}</p>
                <p class="te-item-sub">${item.rowCount} 行 · ${item.colCount} 列</p>
              </div>
            </div>
            <p class="te-item-preview${!item.preview ? ' empty' : ''}">
              ${item.preview || '无预览内容，点击直接导出'}
            </p>
          </button>
        `,
        )
        .join('');

      listEl.querySelectorAll<HTMLButtonElement>('.te-item').forEach((btn) => {
        const idx = Number(btn.dataset.index);
        const tabId = _tabId!;

        btn.addEventListener('mouseenter', async () => {
          try {
            await callBridge(tabId, 'highlightTable', idx);
            setStatus(`已定位到第 ${idx + 1} 个表格`);
          } catch (_) { /* ignore */ }
        });

        btn.addEventListener('mouseleave', async () => {
          try {
            await callBridge(tabId, 'clearHighlight');
            setStatus(`找到 ${items.length} 个表格，点击导出`);
          } catch (_) { /* ignore */ }
        });

        btn.addEventListener('click', async () => {
          btn.disabled = true;
          setStatus(`正在导出第 ${idx + 1} 个表格...`);
          try {
            await callBridge(tabId, 'exportTable', idx);
            setStatus(`第 ${idx + 1} 个表格已导出 ✓`, 'success');
          } catch (err: any) {
            setStatus(err.message, 'error');
          } finally {
            btn.disabled = false;
          }
        });
      });
    }

    // ── Wire export-all ──
    let tableItems: TableItem[] = [];

    exportAllBtn.addEventListener('click', async () => {
      exportAllBtn.disabled = true;
      setStatus('正在导出全部表格...');
      try {
        const count = await callBridge<number>(_tabId!, 'exportAllTables');
        setStatus(`已导出 ${count} 个表格 ✓`, 'success');
      } catch (err: any) {
        setStatus(err.message, 'error');
      } finally {
        exportAllBtn.disabled = !tableItems.length;
      }
    });

    // ── Scan ──
    try {
      _tabId = await getActiveTabId();
      if (signal.aborted) return;

      await injectBridge(_tabId);
      if (signal.aborted) return;

      tableItems = (await callBridge<TableItem[]>(_tabId, 'scanTables')) ?? [];
      if (signal.aborted) return;

      renderList(tableItems);
      setStatus(`找到 ${tableItems.length} 个表格，点击任意卡片导出`);
    } catch (err: any) {
      if (signal.aborted) return;
      setStatus(err.message, 'error');
      setCount('无法读取');
      listEl.innerHTML = `
        <div class="te-empty">
          <p class="te-empty-title">页面暂不支持</p>
          <p class="te-empty-desc">${err.message}</p>
        </div>
      `;
    }
  },

  async unmount(): Promise<void> {
    if (_tabId !== null) {
      await chrome.scripting
        .executeScript({
          target: { tabId: _tabId },
          func: () => { (window as any).__ruoruoTableExporter__?.clearHighlight?.(); },
        })
        .catch(() => {});
    }
    _tabId = null;
  },
};

export default tableExportApp;
