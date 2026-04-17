import { featureRegistry } from '@/features/registry';
import { setFeatureEnabled, setFeatureSettings, toFeatureRuntimeStates } from '@/shared/storage';
import type { ExtensionRequest, ExtensionResponse } from '@/shared/messaging';

type ViewMode = 'popup' | 'sidepanel';
const STORAGE_KEY = 'ruo_view_mode';

// Default = 'popup' to match manifest's default_popup; prevents race-condition mismatch.
let cachedMode: ViewMode = 'popup';

function applyMode(mode: ViewMode): void {
  const sp = (chrome as any).sidePanel;
  if (mode === 'sidepanel') {
    // Clear popup so action.onClicked fires (and openPanelOnActionClick can work).
    chrome.action.setPopup({ popup: '' });
    if (sp) {
      // Explicitly register the panel path (don't rely solely on manifest default).
      sp.setPanel?.({ path: 'sidepanel.html' }).catch?.(() => {});
      sp.setPanelBehavior?.({ openPanelOnActionClick: true }).catch?.(() => {});
    }
  } else {
    chrome.action.setPopup({ popup: chrome.runtime.getURL('popup.html') });
    sp?.setPanelBehavior?.({ openPanelOnActionClick: false }).catch?.(() => {});
  }
}

export default defineBackground(() => {
  // action.onClicked only fires when popup is cleared (= sidepanel mode).
  // Re-apply setPopup('') as a safety net in case Chrome reset it after SW restart.
  chrome.action.onClicked.addListener((tab) => {
    const sp = (chrome as any).sidePanel;
    if (!sp) return;
    chrome.action.setPopup({ popup: '' });
    Promise.resolve(sp.open?.({ windowId: tab.windowId })).catch(() => {});
  });

  // Restore saved mode on SW startup.
  chrome.storage.local.get(STORAGE_KEY).then((result) => {
    cachedMode = (result[STORAGE_KEY] as ViewMode) ?? 'popup';
    applyMode(cachedMode);
  });

  // React immediately when popup/sidepanel UI writes a new mode to storage.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && STORAGE_KEY in changes) {
      cachedMode = (changes[STORAGE_KEY].newValue as ViewMode) ?? 'popup';
      applyMode(cachedMode);
    }
  });

  browser.runtime.onMessage.addListener(
    async (message: ExtensionRequest): Promise<ExtensionResponse> => {
      if (message.type === 'features:list') {
        return { features: await toFeatureRuntimeStates(featureRegistry) };
      }

      if (message.type === 'features:set-enabled') {
        await setFeatureEnabled(message.featureId, message.enabled);
        return { ok: true };
      }

      if (message.type === 'features:set-settings') {
        await setFeatureSettings(message.featureId, message.settings);
        return { ok: true };
      }

      if (message.type === 'features:get-state') {
        const states = await toFeatureRuntimeStates(featureRegistry);
        return (states.find((s) => s.featureId === message.featureId) ??
          null) as ExtensionResponse;
      }

      throw new Error(`Unsupported message type.`);
    },
  );
});
