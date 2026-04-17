/**
 * High-level feature management API for use in popup and options pages.
 * All calls go through the background service worker via runtime messaging.
 */
import type { ExtensionRequest } from './messaging';
import type { FeatureRuntimeState, FeatureStatusResponse } from './types';

export async function listFeatures(): Promise<FeatureRuntimeState[]> {
  const response = (await browser.runtime.sendMessage({
    type: 'features:list',
  } satisfies ExtensionRequest)) as FeatureStatusResponse;
  return response.features;
}

export async function setFeatureEnabled(featureId: string, enabled: boolean): Promise<void> {
  await browser.runtime.sendMessage({
    type: 'features:set-enabled',
    featureId,
    enabled,
  } satisfies ExtensionRequest);
}

export async function setFeatureSettings(
  featureId: string,
  settings: Record<string, unknown>,
): Promise<void> {
  await browser.runtime.sendMessage({
    type: 'features:set-settings',
    featureId,
    settings,
  } satisfies ExtensionRequest);
}

export async function getFeatureState(featureId: string): Promise<FeatureRuntimeState | undefined> {
  const response = (await browser.runtime.sendMessage({
    type: 'features:get-state',
    featureId,
  } satisfies ExtensionRequest)) as FeatureRuntimeState | null;
  return response ?? undefined;
}
