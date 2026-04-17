import { featureRegistry } from '@/features/registry';
import { setFeatureEnabled, setFeatureSettings, toFeatureRuntimeStates } from '@/shared/storage';
import type { ExtensionRequest, ExtensionResponse } from '@/shared/messaging';

export default defineBackground(() => {
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
