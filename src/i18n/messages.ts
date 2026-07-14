export type Locale = 'zh' | 'en';

export const messages = {
  zh: {
    laboratory: '交互式三维地球实验室',
    share: '分享',
    changeLanguage: '切换为英文',
    result: '位置结果',
    selectedPoint: '选择地点',
    antipode: '地球另一端',
    modes: '观察模式',
    hint: '拖拽旋转 · 滚动缩放 · 点击选择',
    fallback: '此设备无法启用 WebGL2；坐标与数据界面仍然可用。',
  },
  en: {
    laboratory: 'Interactive terrestrial laboratory',
    share: 'Share',
    changeLanguage: 'Switch to Chinese',
    result: 'Location result',
    selectedPoint: 'Selected point',
    antipode: 'Other side',
    modes: 'Observation modes',
    hint: 'Drag to rotate · Scroll to zoom · Click to select',
    fallback: 'WebGL2 is unavailable; coordinates and data remain accessible.',
  },
} as const;
