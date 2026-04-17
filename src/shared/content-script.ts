import { getFeatureSettings, getFeatureStates } from './storage';

export interface ContentScriptContext {
  isEnabled: boolean;
  /** Resolved settings for this feature (defaults merged with stored overrides). */
  settings: Record<string, unknown>;
}

export type ContentScriptMain = (ctx: ContentScriptContext) => void | Promise<void>;

/**
 * Bootstraps a feature content script.
 * Reads the stored enabled-state and settings, then calls `main` only when enabled.
 * Use this in every content-script entrypoint to eliminate boilerplate.
 *
 * @example
 * export default defineContentScript({
 *   matches: ['<all_urls>'],
 *   main: () => runFeatureContentScript('my-feature', false, ({ settings }) => { ... }),
 * });
 */
export async function runFeatureContentScript(
  featureId: string,
  enabledByDefault: boolean,
  main: ContentScriptMain,
): Promise<void> {
  const [featureStates, settings] = await Promise.all([
    getFeatureStates(),
    getFeatureSettings(featureId),
  ]);

  const isEnabled = featureStates[featureId] ?? enabledByDefault;
  if (!isEnabled) return;

  await main({ isEnabled, settings });
}
