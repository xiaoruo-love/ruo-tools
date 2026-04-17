import { storage } from 'wxt/utils/storage';
import type { FeatureDefinition, FeatureRuntimeState } from './types';

const featureStatesStorage = storage.defineItem<Record<string, boolean>>(
  'local:feature-states',
  { defaultValue: {} },
);

const featureSettingsStorage = storage.defineItem<Record<string, Record<string, unknown>>>(
  'local:feature-settings',
  { defaultValue: {} },
);

export async function getFeatureStates(): Promise<Record<string, boolean>> {
  return (await featureStatesStorage.getValue()) ?? {};
}

export async function setFeatureEnabled(featureId: string, enabled: boolean): Promise<void> {
  const current = await getFeatureStates();
  await featureStatesStorage.setValue({ ...current, [featureId]: enabled });
}

export async function getFeatureSettings(featureId: string): Promise<Record<string, unknown>> {
  const all = (await featureSettingsStorage.getValue()) ?? {};
  return all[featureId] ?? {};
}

export async function setFeatureSettings(
  featureId: string,
  settings: Record<string, unknown>,
): Promise<void> {
  const all = (await featureSettingsStorage.getValue()) ?? {};
  await featureSettingsStorage.setValue({ ...all, [featureId]: settings });
}

export async function toFeatureRuntimeStates(
  features: Pick<FeatureDefinition, 'id' | 'enabledByDefault' | 'settingsSchema'>[],
): Promise<FeatureRuntimeState[]> {
  const [storedStates, allSettings] = await Promise.all([
    featureStatesStorage.getValue(),
    featureSettingsStorage.getValue(),
  ]);

  return features.map((feature) => {
    const defaults = Object.fromEntries(
      (feature.settingsSchema ?? []).map((field) => [field.key, field.defaultValue]),
    );
    return {
      featureId: feature.id,
      enabled: storedStates?.[feature.id] ?? feature.enabledByDefault,
      settings: { ...defaults, ...(allSettings?.[feature.id] ?? {}) },
    };
  });
}
