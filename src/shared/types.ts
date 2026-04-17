export type FeatureCategory = 'productivity' | 'privacy' | 'accessibility' | 'developer';

export type FeatureRunAt = 'document_start' | 'document_end' | 'document_idle';

/** A single configuration field a feature exposes to the user. */
export interface FeatureSettingField<T = unknown> {
  key: string;
  label: string;
  description?: string;
  type: 'boolean' | 'string' | 'number' | 'select';
  defaultValue: T;
  /** Only used when type === 'select'. */
  options?: Array<{ label: string; value: T }>;
}

export interface FeatureDefinition {
  id: string;
  name: string;
  description: string;
  /** Grouping shown in the settings UI. */
  category: FeatureCategory;
  /** Semver string for change-tracking. */
  version: string;
  /**
   * 'content'     — 注册为 WXT content script，在匹配页面自动运行
   * 'popup-only'  — 不注册 content script，只在 popup 中展示自定义视图
   */
  type: 'content' | 'popup-only';
  matches: string[];
  runAt?: FeatureRunAt;
  enabledByDefault: boolean;
  /** Extra manifest permissions this feature requires (added to wxt.config when needed). */
  permissions?: string[];
  /** Optional typed settings schema; rendered automatically in the options page. */
  settingsSchema?: FeatureSettingField[];
}

export interface FeatureRuntimeState {
  featureId: string;
  enabled: boolean;
  /** Resolved settings (defaults merged with stored overrides). */
  settings: Record<string, unknown>;
}

export interface FeatureStatusResponse {
  features: FeatureRuntimeState[];
}
