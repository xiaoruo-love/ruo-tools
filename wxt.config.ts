import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  targetBrowsers: ['chrome', 'firefox'],
  manifest: {
    name: 'Ruo Tools',
    description: 'A modular browser extension workspace for multiple scripts and utilities.',
    version: '0.1.0',
    permissions: ['storage', 'tabs', 'scripting'],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'Ruo Tools',
    },
  },
  webExt: {
    disabled: true,
  },
});
