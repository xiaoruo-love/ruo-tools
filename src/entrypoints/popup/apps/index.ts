import type { PopupApp } from './types';
import tableExport from './table-export';
import qImageHelper from './q-image-helper';

/**
 * All registered popup sub-apps.
 * Each id must correspond to an entry in src/features/registry.ts.
 */
export const apps: PopupApp[] = [tableExport, qImageHelper];
