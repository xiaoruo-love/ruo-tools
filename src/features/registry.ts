import type { FeatureDefinition } from '@/shared/types';

export const featureRegistry: FeatureDefinition[] = [
  {
    id: 'table-export',
    name: '表格侠',
    description: '扫描当前页面的所有 table，一键导出为 xlsx 文件，支持合并单元格。',
    category: 'productivity',
    version: '1.0.0',
    type: 'popup-only',
    matches: [],
    enabledByDefault: true,
  },
  {
    id: 'q-image-helper',
    name: '抠图侠',
    description: '下载美图秀秀页面的抠图结果',
    category: 'productivity',
    version: '1.0.0',
    type: 'popup-only',
    matches: [],
    enabledByDefault: true,
  },
  {
    id: 'wechat-publisher',
    name: '发文姬',
    description: '把结构化公众号 JSON 直接插入当前微信公众号编辑页，支持标题、正文 blocks 和正文图片。',
    category: 'productivity',
    version: '1.0.0',
    type: 'popup-only',
    matches: [],
    enabledByDefault: true,
  },
  {
    id: 'toutiao-publisher',
    name: '头条姬',
    description: '把结构化文章 JSON 直接插入当前今日头条编辑页，仅支持头条原生 block：heading、paragraph、blockquote、列表、divider、table 和 image。',
    category: 'productivity',
    version: '1.0.0',
    type: 'popup-only',
    matches: [],
    enabledByDefault: true,
  },
];

export function getFeatureDefinition(featureId: string): FeatureDefinition | undefined {
  return featureRegistry.find((f) => f.id === featureId);
}
