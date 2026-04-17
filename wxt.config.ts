import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  targetBrowsers: ['chrome', 'firefox'],
  manifest: {
    name: 'Ruo Tools',
    description: 'A modular browser extension workspace for multiple scripts and utilities.',
    version: '0.1.0',
    permissions: ['storage', 'tabs', 'scripting', 'sidePanel'],
    host_permissions: ['<all_urls>'],
    icons: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
    action: {
      default_title: 'Ruo Tools',
      default_icon: {
        '16': 'icons/icon-16.png',
        '32': 'icons/icon-32.png',
        '48': 'icons/icon-48.png',
        '128': 'icons/icon-128.png',
      },
    },
  },
  webExt: {
    disabled: true,
  },
});
