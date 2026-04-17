import { featureRegistry } from '@/features/registry';
import { listFeatures } from '@/shared/feature-service';
import type { FeatureRuntimeState } from '@/shared/types';
import { apps } from './apps';
import type { PopupApp } from './apps/types';
import './style.css';

// ─────────────────────────────────────────────
// Startup validation: every app must have a registry entry
// ─────────────────────────────────────────────
if (import.meta.env.DEV) {
  apps.forEach((app) => {
    if (!featureRegistry.find((f) => f.id === app.id)) {
      console.warn(`[ruo-tools] App "${app.id}" has no matching entry in featureRegistry`);
    }
  });
}

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

  // Abort any in-flight mount and unmount current app
  mountController?.abort();
  await currentApp?.unmount?.();
  currentApp = app;

  // Prepare the generic app view
  const titleEl   = document.getElementById('app-title')!;
  const navIconEl = document.getElementById('app-nav-icon')!;
  const mountEl   = document.getElementById('app-mount')!;
  const feature = featureRegistry.find((f) => f.id === featureId);
  titleEl.textContent = feature?.name ?? featureId;
  navIconEl.innerHTML = app.icon.html;
  mountEl.innerHTML = '';

  showView('app');

  // Mount with fresh abort signal
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
// Bootstrap
// ─────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  const appEl = document.querySelector<HTMLDivElement>('#app')!;

  appEl.innerHTML = `
    <!-- ── Home ── -->
    <div id="view-home" class="view active">
      <header class="popup-header">
        <span class="wordmark">ruo<span class="wordmark-dot">·</span></span>
        <div class="header-right">
          <span class="active-pill" id="active-pill">0 active</span>
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

  featureStates = await listFeatures();
  renderHome();
}

void bootstrap();

