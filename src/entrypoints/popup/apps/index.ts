import type { PopupApp } from './types';
import tableExport from './table-export';
import qImageHelper from './q-image-helper';
import wechatPublisher from './wechat-publisher';
import toutiaoPublisher from './toutiao-publisher';

/**
 * All registered popup sub-apps.
 * Each id must correspond to an entry in src/features/registry.ts.
 */
export const apps: PopupApp[] = [tableExport, qImageHelper, wechatPublisher, toutiaoPublisher];
