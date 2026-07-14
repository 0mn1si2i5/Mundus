export type Locale = 'zh' | 'en';

export const messages = {
  zh: {
    laboratory: '交互式三维地球实验室',
    share: '分享',
    changeLanguage: '切换为英文',
    result: '位置结果',
    selectedPoint: '选择地点',
    openOcean: '海洋或未知区域',
    antipode: '地球另一端',
    coreDistance: '穿过地心',
    surfaceDistance: '沿半球表面',
    modes: '观察模式',
    hint: '拖拽旋转 · 滚动缩放 · 点击选择',
    fallback: '此设备无法启用 WebGL2；坐标与数据界面仍然可用。',
    loadingGlobe: '正在准备地球…',
    contextLost: '图形上下文暂时中断，正在等待浏览器恢复。',
  },
  en: {
    laboratory: 'Interactive terrestrial laboratory',
    share: 'Share',
    changeLanguage: 'Switch to Chinese',
    result: 'Location result',
    selectedPoint: 'Selected point',
    openOcean: 'Ocean or unknown area',
    antipode: 'Other side',
    coreDistance: 'Through the core',
    surfaceDistance: 'Across the hemisphere',
    modes: 'Observation modes',
    hint: 'Drag to rotate · Scroll to zoom · Click to select',
    fallback: 'WebGL2 is unavailable; coordinates and data remain accessible.',
    loadingGlobe: 'Preparing Earth…',
    contextLost:
      'The graphics context was interrupted; waiting for the browser to restore it.',
  },
} as const;
