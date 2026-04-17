import { defineAppConfig } from 'wxt/utils/define-app-config';

export interface FeatureToggleConfig {
  enabledByDefault: boolean;
}

declare module 'wxt/utils/define-app-config' {
  export interface WxtAppConfig {
    featureToggles: Record<string, FeatureToggleConfig>;
  }
}

export default defineAppConfig({
  featureToggles: {},
});
