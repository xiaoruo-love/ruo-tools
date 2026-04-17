import { featureRegistry } from '@/features/registry';
import { listFeatures } from '@/shared/feature-service';
import type { FeatureRuntimeState } from '@/shared/types';
import { apps } from './apps';
import type { PopupApp } from './apps/types';

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────
let featureStates: FeatureRuntimeState[] = [];
let currentApp: PopupApp | null = null;
let mountController: AbortController | null = null;

// ─────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────
async function navigateTo(featureId: string): Promise<void> {
  const app = apps.find((a) => a.id === featureId);
  if (!app) return;

  mountController?.abort();
  await currentApp?.unmount?.();
  currentApp = app;

  const titleEl   = document.getElementById('app-title')!;
  const navIconEl = document.getElementById('app-nav-icon')!;
  const mountEl   = document.getElementById('app-mount')!;
  const feature   = featureRegistry.find((f) => f.id === featureId);
  titleEl.textContent   = feature?.name ?? featureId;
  navIconEl.innerHTML   = app.icon.html;
  mountEl.innerHTML     = '';

  showView('app');

  mountController = new AbortController();
  try {
    await app.mount(mountEl, mountController.signal);
  } catch (err) {
    if (mountController.signal.aborted) return;
    mountEl.innerHTML = `
      <div class="mount-error">
        <p class="mount-error-title">加载失败</p>
        <p class="mount-error-desc">${(err as Error).message}</p>
      </div>
    `;
  }
}

async function goHome(): Promise<void> {
  mountController?.abort();
  await currentApp?.unmount?.();
  currentApp = null;
  showView('home');
  featureStates = await listFeatures();
  renderHome();
}

function showView(name: 'home' | 'app'): void {
  document.querySelectorAll('.view').forEach((el) => el.classList.remove('active'));
  document.getElementById(`view-${name}`)?.classList.add('active');
}

// ─────────────────────────────────────────────
// Home view
// ─────────────────────────────────────────────
function getState(featureId: string): FeatureRuntimeState {
  return (
    featureStates.find((s) => s.featureId === featureId) ?? {
      featureId,
      enabled: featureRegistry.find((f) => f.id === featureId)?.enabledByDefault ?? false,
      settings: {},
    }
  );
}

function renderHome(): void {
  const grid = document.getElementById('app-grid')!;
  const appMap = new Map(apps.map((a) => [a.id, a]));

  const enabledCount = featureRegistry.filter((f) => getState(f.id).enabled).length;
  const pill = document.getElementById('active-pill');
  if (pill) pill.textContent = `${enabledCount} active`;

  grid.innerHTML = featureRegistry
    .map((feature) => {
      const app = appMap.get(feature.id);
      const isOn = getState(feature.id).enabled;
      return `
        <button class="app-cell${!isOn ? ' disabled' : ''}" data-feature-id="${feature.id}">
          <div class="app-icon" style="background:${app?.icon.bg ?? 'oklch(95% 0.006 72)'}">
            ${app?.icon.html ?? ''}
            <span class="status-dot${!isOn ? ' hidden' : ''}"></span>
          </div>
          <span class="app-name">${feature.name}</span>
        </button>
      `;
    })
    .join('');

  grid.querySelectorAll<HTMLButtonElement>('.app-cell').forEach((cell) => {
    cell.addEventListener('click', () => navigateTo(cell.dataset.featureId!));
  });

  const footerText = document.getElementById('home-footer-text');
  if (footerText) {
    footerText.innerHTML = `<b>${enabledCount}</b> / ${featureRegistry.length} 已启用`;
  }
}

// ─────────────────────────────────────────────
// View mode toggle
// ─────────────────────────────────────────────
type ViewMode = 'popup' | 'sidepanel';

const PANEL_ICON = `<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
  <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="9" y="2" width="5" height="12" rx="1"/>
</svg>`;

const POPUP_ICON = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
  <rect x="2" y="4" width="12" height="10" rx="2"/>
  <path d="M5 4V2.5a.5.5 0 01.5-.5h5a.5.5 0 01.5.5V4"/>
</svg>`;

async function getCurrentMode(): Promise<ViewMode> {
  const result = await chrome.storage.local.get('ruo_view_mode');
  return (result.ruo_view_mode as ViewMode) ?? 'popup';
}

function renderModeToggle(btn: HTMLButtonElement, mode: ViewMode): void {
  const isSidePanel = mode === 'sidepanel';
  btn.innerHTML  = isSidePanel ? POPUP_ICON : PANEL_ICON;
  btn.title = isSidePanel ? '切换为弹出窗口模式' : '切换为侧边栏模式';
}

function showModeToast(message: string): void {
  const existing = document.getElementById('mode-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'mode-toast';
  toast.className = 'mode-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  setTimeout(() => { toast.classList.remove('is-visible'); setTimeout(() => toast.remove(), 300); }, 2500);
}

// ─────────────────────────────────────────────
// Bootstrap entry
// ─────────────────────────────────────────────
export async function bootstrap(): Promise<void> {
  if (import.meta.env.DEV) {
    apps.forEach((app) => {
      if (!featureRegistry.find((f) => f.id === app.id)) {
        console.warn(`[ruo-tools] App "${app.id}" has no matching entry in featureRegistry`);
      }
    });
  }

  const appEl = document.querySelector<HTMLDivElement>('#app')!;

  appEl.innerHTML = `
    <!-- ── Home ── -->
    <div id="view-home" class="view active">
      <header class="popup-header">
        <img class="app-logo" src="icons/ruo-tool-logo.png" alt="Ruo Tools" />
        <span class="wordmark">ruo<span class="wordmark-dot">·</span>tools</span>
        <div class="header-right">
          <span class="active-pill" id="active-pill">0 active</span>
          <button class="icon-btn mode-toggle-btn" id="mode-toggle" title="切换显示模式"></button>
        </div>
      </header>
      <main id="app-grid" class="app-grid"></main>
      <footer class="popup-footer">
        <span class="footer-text" id="home-footer-text">&nbsp;</span>
        <span class="footer-version">v0.1.0</span>
      </footer>
    </div>

    <!-- ── App view (generic container for all sub-apps) ── -->
    <div id="view-app" class="view">
      <nav class="nav-header">
        <button class="icon-btn" id="app-back">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"
               stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 3L4.5 7.5L9 12"/>
          </svg>
        </button>
        <span class="nav-icon" id="app-nav-icon"></span>
        <span class="nav-title" id="app-title"></span>
      </nav>
      <div id="app-mount"></div>
    </div>
  `;

  document.getElementById('app-back')!.addEventListener('click', goHome);

  // Mode toggle button
  const modeBtn = document.getElementById('mode-toggle') as HTMLButtonElement;
  const currentMode = await getCurrentMode();
  renderModeToggle(modeBtn, currentMode);

  modeBtn.addEventListener('click', async () => {
    const mode = await getCurrentMode();
    const next: ViewMode = mode === 'sidepanel' ? 'popup' : 'sidepanel';
    // Write directly to storage; background reacts via storage.onChanged (no SW ping needed)
    await chrome.storage.local.set({ ruo_view_mode: next });
    renderModeToggle(modeBtn, next);
    showModeToast(
      next === 'sidepanel'
        ? '已切换为侧边栏模式，关闭后重新点击图标生效'
        : '已切换为弹出窗口模式，关闭后重新点击图标生效',
    );
  });

  featureStates = await listFeatures();
  renderHome();
}
