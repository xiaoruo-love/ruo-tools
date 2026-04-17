import type { PopupApp } from './types';
import tableExport from './table-export';

/**
 * All registered popup sub-apps.
 * Each id must correspond to an entry in src/features/registry.ts.
 */
export const apps: PopupApp[] = [tableExport];
