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
];

export function getFeatureDefinition(featureId: string): FeatureDefinition | undefined {
  return featureRegistry.find((f) => f.id === featureId);
}
