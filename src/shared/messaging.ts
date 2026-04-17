import type { FeatureRuntimeState, FeatureStatusResponse } from './types';

export type ExtensionRequest =
  | { type: 'features:list' }
  | { type: 'features:set-enabled'; featureId: string; enabled: boolean }
  | { type: 'features:set-settings'; featureId: string; settings: Record<string, unknown> }
  | { type: 'features:get-state'; featureId: string };

export type ExtensionResponse =
  | FeatureStatusResponse
  | FeatureRuntimeState
  | { ok: true };
