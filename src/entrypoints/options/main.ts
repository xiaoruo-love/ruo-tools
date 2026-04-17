import { featureRegistry } from '@/features/registry';
import { listFeatures, setFeatureEnabled, setFeatureSettings } from '@/shared/feature-service';
import type { FeatureDefinition, FeatureRuntimeState } from '@/shared/types';
import '../popup/style.css';

function renderSettingField(
  featureId: string,
  field: NonNullable<FeatureDefinition['settingsSchema']>[number],
  currentValue: unknown,
): string {
  const id = `${featureId}-setting-${field.key}`;
  const desc = field.description ? `<small>${field.description}</small>` : '';

  if (field.type === 'boolean') {
    return `
      <div class="setting-field">
        <label for="${id}">${field.label}</label>
        ${desc}
        <input type="checkbox" id="${id}"
          data-feature-id="${featureId}" data-setting-key="${field.key}"
          ${currentValue ? 'checked' : ''} />
      </div>`;
  }

  if (field.type === 'select' && field.options) {
    const options = field.options
      .map(
        (opt) =>
          `<option value="${opt.value}" ${currentValue === opt.value ? 'selected' : ''}>${opt.label}</option>`,
      )
      .join('');
    return `
      <div class="setting-field">
        <label for="${id}">${field.label}</label>
        ${desc}
        <select id="${id}" data-feature-id="${featureId}" data-setting-key="${field.key}">
          ${options}
        </select>
      </div>`;
  }

  return `
    <div class="setting-field">
      <label for="${id}">${field.label}</label>
      ${desc}
      <input type="${field.type === 'number' ? 'number' : 'text'}" id="${id}"
        data-feature-id="${featureId}" data-setting-key="${field.key}"
        value="${currentValue ?? field.defaultValue}" />
    </div>`;
}

function renderFeatureCard(feature: FeatureDefinition, state: FeatureRuntimeState): string {
  const settingsHtml = (feature.settingsSchema ?? [])
    .map((field) => renderSettingField(feature.id, field, state.settings[field.key]))
    .join('');

  return `
    <div class="feature-card">
      <label class="feature-row">
        <span>
          <strong>${feature.name}</strong>
          <small>${feature.description}</small>
        </span>
        <input type="checkbox" data-feature-id="${feature.id}" ${state.enabled ? 'checked' : ''} />
      </label>
      ${settingsHtml ? `<div class="feature-settings">${settingsHtml}</div>` : ''}
    </div>`;
}

async function bootstrap(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) return;

  const featureStates = await listFeatures();

  const cards = featureRegistry.map((feature) => {
    const state = featureStates.find((item) => item.featureId === feature.id) ?? {
      featureId: feature.id,
      enabled: feature.enabledByDefault,
      settings: {},
    };
    return renderFeatureCard(feature, state);
  });

  app.innerHTML = `
    <main class="popup-shell options-shell">
      <section class="hero">
        <p class="eyebrow">Ruo Tools</p>
        <h1>Settings</h1>
        <p class="description">Enable or disable features and configure per-feature options below.</p>
      </section>
      <section class="feature-list">${cards.join('')}</section>
    </main>
  `;

  // Feature enable/disable toggles
  app
    .querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][data-feature-id]:not([data-setting-key])',
    )
    .forEach((input) => {
      input.addEventListener('change', async () => {
        const featureId = input.dataset.featureId;
        if (!featureId) return;
        await setFeatureEnabled(featureId, input.checked);
      });
    });

  // Per-feature setting inputs
  app
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-feature-id][data-setting-key]')
    .forEach((el) => {
      el.addEventListener('change', async () => {
        const featureId = el.dataset.featureId;
        const key = el.dataset.settingKey;
        if (!featureId || !key) return;

        let value: unknown;
        if (el instanceof HTMLInputElement && el.type === 'checkbox') {
          value = el.checked;
        } else if (el instanceof HTMLInputElement && el.type === 'number') {
          value = el.valueAsNumber;
        } else {
          value = (el as HTMLInputElement | HTMLSelectElement).value;
        }

        const currentState = featureStates.find((s) => s.featureId === featureId);
        if (!currentState) return;
        const updated = { ...currentState.settings, [key]: value };
        await setFeatureSettings(featureId, updated);
        currentState.settings[key] = value;
      });
    });
}

void bootstrap();
