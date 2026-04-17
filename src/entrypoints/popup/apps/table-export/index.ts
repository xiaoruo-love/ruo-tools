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

interface ParticleOptions {
  x?: number; y?: number;
  dx?: number; dy?: number;
  rotate?: number;
  size?: number;
  fontSize?: number;
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
// Reward system
// ─────────────────────────────────────────────
const REWARD_THEMES = [
  {
    label: '糖霜星星雨',
    message: '导出成功，掉落一小片星星糖。',
    particles: ['★', '✦', '✧', '✶', '✹', '✷'],
    colors: ['#ff8cb3', '#ffbe78', '#8fdcc4', '#f090c0'],
    mode: 'burst',
  },
  {
    label: '草莓爱心波',
    message: '爱心补给发放，今天也顺顺利利。',
    particles: ['❤', '♡', '♥', '❥', '⟡'],
    colors: ['#ff7da5', '#ff95bc', '#ffb1c7', '#f7a85f'],
    mode: 'float',
  },
  {
    label: '缎带庆祝礼',
    message: '发来缎带奖励，下载完成。',
    particles: ['🎀', '✿', '❀', '✦'],
    colors: ['#ff8aab', '#ffc96f', '#9bdcc7', '#d9a2ff'],
    mode: 'ribbon',
  },
  {
    label: '贴纸暴击',
    message: '收下贴纸章，导出动作非常漂亮。',
    particles: ['☻', '✦', '★', '☁', '✿'],
    colors: ['#ff9191', '#ffb36f', '#83d5b4', '#ff8fc8'],
    mode: 'badge',
  },
];

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomPick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
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

    container.innerHTML = `
      <div class="te-app">
        <div class="te-reward-layer" aria-hidden="true"></div>
        <div class="te-reward-toast" aria-hidden="true"></div>

        <section class="te-hero">
          <div class="te-hero__badge">导出文件</div>
          <div class="te-hero__content">
            <p class="te-hero__eyebrow">Table Export Companion</p>
          </div>
          <button class="te-primary-btn" data-action="export-all" type="button" disabled>全部导出</button>
        </section>

        <section class="te-panel">
          <div class="te-panel__head">
            <div>
              <p class="te-panel__label">页面表格</p>
              <h2 class="te-panel__title" data-role="count">正在扫描...</h2>
            </div>
            <span class="te-panel__sparkle"></span>
          </div>
          <div class="te-status" data-role="status" role="status" aria-live="polite"></div>
          <div class="te-list" data-role="list"></div>
        </section>
      </div>
    `;

    const heroEl       = container.querySelector<HTMLElement>('.te-hero')!;
    const rewardLayer  = container.querySelector<HTMLElement>('.te-reward-layer')!;
    const rewardToast  = container.querySelector<HTMLElement>('.te-reward-toast')!;
    const statusEl     = container.querySelector<HTMLElement>('[data-role="status"]')!;
    const countEl      = container.querySelector<HTMLElement>('[data-role="count"]')!;
    const listEl       = container.querySelector<HTMLElement>('[data-role="list"]')!;
    const exportAllBtn = container.querySelector<HTMLButtonElement>('[data-action="export-all"]')!;

    // ── Status helpers ──
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

    // ── Reward helpers ──
    let toastTimer: ReturnType<typeof setTimeout> | null = null;

    function showToast(message: string): void {
      if (toastTimer) clearTimeout(toastTimer);
      rewardToast.textContent = message;
      rewardToast.classList.add('is-visible');
      toastTimer = setTimeout(() => rewardToast.classList.remove('is-visible'), 1500);
    }

    function celebrateHero(): void {
      heroEl.classList.remove('is-celebrating');
      void heroEl.offsetWidth;
      heroEl.classList.add('is-celebrating');
      setTimeout(() => heroEl.classList.remove('is-celebrating'), 620);
    }

    function animateTarget(target: Element | null): void {
      if (!target) return;
      target.classList.remove('is-rewarded');
      void (target as HTMLElement).offsetWidth;
      target.classList.add('is-rewarded');
      setTimeout(() => target.classList.remove('is-rewarded'), 720);
    }

    function appendParticle(
      symbol: string, color: string, cls: string, opts: ParticleOptions = {},
    ): void {
      const p = document.createElement('span');
      p.className = `te-particle ${cls}`;
      p.textContent = symbol;
      p.style.setProperty('--x',         `${opts.x        ?? randomBetween(22, 78)}%`);
      p.style.setProperty('--y',         `${opts.y        ?? randomBetween(34, 68)}%`);
      p.style.setProperty('--dx',        `${opts.dx       ?? randomBetween(-110, 110)}px`);
      p.style.setProperty('--dy',        `${opts.dy       ?? randomBetween(-120, -46)}px`);
      p.style.setProperty('--rotate',    `${opts.rotate   ?? randomBetween(-180, 180)}deg`);
      p.style.setProperty('--size',      `${opts.size     ?? randomBetween(20, 34)}px`);
      p.style.setProperty('--font-size', `${opts.fontSize ?? randomBetween(16, 25)}px`);
      p.style.setProperty('--color', color);
      rewardLayer.appendChild(p);
      setTimeout(() => p.remove(), 1400);
    }

    function playBurst(theme: typeof REWARD_THEMES[0]): void {
      for (let i = 0; i < 18; i++) {
        appendParticle(randomPick(theme.particles), randomPick(theme.colors), 'te-particle--burst', {
          x: 50 + randomBetween(-8, 8), y: 52 + randomBetween(-10, 10),
          dx: randomBetween(-140, 140), dy: randomBetween(-130, -32),
          rotate: randomBetween(-240, 240),
        });
      }
    }

    function playFloat(theme: typeof REWARD_THEMES[0]): void {
      for (let i = 0; i < 12; i++) {
        appendParticle(
          randomPick(theme.particles), randomPick(theme.colors),
          i % 2 === 0 ? 'te-particle--float' : 'te-particle--spin',
          { x: randomBetween(16, 84), y: randomBetween(48, 76), dx: randomBetween(-56, 56), dy: randomBetween(-150, -68), rotate: randomBetween(-220, 220), size: randomBetween(20, 30) },
        );
      }
    }

    function playRibbon(theme: typeof REWARD_THEMES[0]): void {
      const ribbon = document.createElement('div');
      ribbon.className = 'te-reward-ribbon';
      for (let i = 0; i < 11; i++) {
        const line = document.createElement('span');
        line.className = 'te-reward-ribbon__line';
        line.style.left = `${randomBetween(4, 94)}%`;
        line.style.background = `linear-gradient(180deg, ${randomPick(theme.colors)}, rgba(255,255,255,0))`;
        line.style.setProperty('--rotate', `${randomBetween(-28, 28)}deg`);
        line.style.animationDelay = `${randomBetween(0, 160)}ms`;
        ribbon.appendChild(line);
      }
      rewardLayer.appendChild(ribbon);
      for (let i = 0; i < 8; i++) {
        appendParticle(randomPick(theme.particles), randomPick(theme.colors), 'te-particle--float', {
          x: randomBetween(22, 78), y: randomBetween(42, 62),
          dx: randomBetween(-36, 36), dy: randomBetween(-88, -32), rotate: randomBetween(-90, 90),
        });
      }
      setTimeout(() => ribbon.remove(), 1200);
    }

    function playBadge(theme: typeof REWARD_THEMES[0]): void {
      const badge = document.createElement('div');
      badge.className = 'te-reward-badge';
      badge.textContent = `${randomPick(['好耶', '完成啦', '超顺利', '可爱加分'])} · ${theme.label}`;
      rewardLayer.appendChild(badge);
      for (let i = 0; i < 10; i++) {
        appendParticle(
          randomPick(theme.particles), randomPick(theme.colors),
          i % 2 ? 'te-particle--spin' : 'te-particle--burst',
          { x: randomBetween(34, 66), y: randomBetween(40, 60), dx: randomBetween(-92, 92), dy: randomBetween(-110, 32), rotate: randomBetween(-260, 260) },
        );
      }
      setTimeout(() => badge.remove(), 1100);
    }

    function playReward(target: Element | null, message?: string): void {
      const theme = randomPick(REWARD_THEMES);
      rewardLayer.innerHTML = '';
      celebrateHero();
      animateTarget(target);
      showToast(message ?? theme.message);
      if (theme.mode === 'float')  { playFloat(theme);  return; }
      if (theme.mode === 'ribbon') { playRibbon(theme); return; }
      if (theme.mode === 'badge')  { playBadge(theme);  return; }
      playBurst(theme);
    }

    // ── Render helpers ──
    function renderList(items: TableItem[]): void {
      if (signal.aborted) return;
      listEl.innerHTML = '';

      if (!items.length) {
        listEl.innerHTML = `
          <div class="te-empty">
            <p class="te-empty__title">没有找到表格</p>
            <p class="te-empty__desc">当前页面里没有可导出的 table 元素。</p>
          </div>
        `;
        exportAllBtn.disabled = true;
        setCount('0 个表格');
        setStatus('换个页面再试试');
        return;
      }

      exportAllBtn.disabled = false;
      setCount(`${items.length} 个表格`);
      setStatus(`找到 ${items.length} 个表格，点击任意卡片即可导出`);

      items.forEach((item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'te-item';
        btn.innerHTML = `
          <div class="te-item__top">
            <span class="te-item__index">#${item.index + 1}</span>
            <div class="te-item__meta">
              <p class="te-item__title">${item.title}</p>
              <p class="te-item__sub">${item.rowCount} 行 · ${item.colCount} 列</p>
            </div>
          </div>
        `;

        const tabId = _tabId!;

        btn.addEventListener('mouseenter', async () => {
          try {
            await callBridge(tabId, 'highlightTable', item.index);
            setStatus(`已定位到第 ${item.index + 1} 个表格`);
          } catch (_) { /* ignore */ }
        });

        btn.addEventListener('mouseleave', async () => {
          try {
            await callBridge(tabId, 'clearHighlight');
            setStatus(`找到 ${items.length} 个表格，点击任意卡片即可导出`);
          } catch (_) { /* ignore */ }
        });

        btn.addEventListener('click', async () => {
          btn.disabled = true;
          setStatus(`正在导出第 ${item.index + 1} 个表格...`);
          try {
            await callBridge(tabId, 'exportTable', item.index);
            setStatus(`第 ${item.index + 1} 个表格已导出`, 'success');
            playReward(btn, `第 ${item.index + 1} 个表格下载完成，随机奖励已送达。`);
          } catch (err: any) {
            setStatus(err.message, 'error');
          } finally {
            btn.disabled = false;
          }
        });

        listEl.appendChild(btn);
      });
    }

    // ── Wire export-all ──
    let tableItems: TableItem[] = [];

    exportAllBtn.addEventListener('click', async () => {
      exportAllBtn.disabled = true;
      setStatus('正在导出全部表格...');
      try {
        const count = await callBridge<number>(_tabId!, 'exportAllTables');
        setStatus(`已导出 ${count} 个表格`, 'success');
        playReward(exportAllBtn, `一口气导出 ${count} 个表格，奖励翻倍掉落。`);
      } catch (err: any) {
        setStatus(err.message, 'error');
      } finally {
        exportAllBtn.disabled = !tableItems.length;
      }
    });

    // ── Scan ──
    setStatus('正在扫描当前页面...');
    try {
      _tabId = await getActiveTabId();
      if (signal.aborted) return;

      await injectBridge(_tabId);
      if (signal.aborted) return;

      tableItems = (await callBridge<TableItem[]>(_tabId, 'scanTables')) ?? [];
      if (signal.aborted) return;

      renderList(tableItems);
    } catch (err: any) {
      if (signal.aborted) return;
      exportAllBtn.disabled = true;
      setCount('无法读取页面');
      listEl.innerHTML = `
        <div class="te-empty">
          <p class="te-empty__title">页面暂不支持</p>
          <p class="te-empty__desc">${err.message}</p>
        </div>
      `;
      setStatus(err.message, 'error');
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
