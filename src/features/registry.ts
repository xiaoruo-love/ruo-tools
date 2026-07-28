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
    id: 'teacher-profile-writer',
    name: '师简姬',
    description: '框选教师主页中的履历或简介区域，提取文本并生成一段专业、准确的教师简介。',
    category: 'productivity',
    version: '1.0.0',
    type: 'popup-only',
    matches: [],
    enabledByDefault: true,
    settingsSchema: [
      {
        key: 'apiKey',
        label: 'DashScope API Key',
        type: 'string',
        defaultValue: '',
      },
      {
        key: 'model',
        label: '模型',
        type: 'string',
        defaultValue: 'qwen3.7-max',
      },
      {
        key: 'extraInstruction',
        label: '附加要求',
        description: '可选，例如“突出研究方向和教学任务，不要写教材信息”。',
        type: 'string',
        defaultValue: '',
      },
    ],
  },
];

export function getFeatureDefinition(featureId: string): FeatureDefinition | undefined {
  return featureRegistry.find((f) => f.id === featureId);
}
