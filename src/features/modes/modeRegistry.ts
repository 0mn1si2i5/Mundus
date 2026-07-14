import type { Locale } from '../../i18n/messages';

export type ModeId = 'antipodes' | 'development' | 'sunline';

interface LocalizedText {
  zh: string;
  en: string;
}

export interface ModeDefinition {
  id: ModeId;
  version: 1;
  title: LocalizedText;
  question: LocalizedText;
}

export const MODE_DEFINITIONS: Record<ModeId, ModeDefinition> = {
  antipodes: {
    id: 'antipodes',
    version: 1,
    title: { zh: '地球另一端', en: 'Other Side' },
    question: {
      zh: '如果从这里穿过地心，你会在哪里重新看见天空？',
      en: 'If you passed through Earth from here, where would you see the sky again?',
    },
  },
  development: {
    id: 'development',
    version: 1,
    title: { zh: '发展的不同侧面', en: 'Development, Unpacked' },
    question: {
      zh: '相近的发展水平，由哪些不同的结构组成？',
      en: 'What different structures can produce similar levels of development?',
    },
  },
  sunline: {
    id: 'sunline',
    version: 1,
    title: { zh: '日照线', en: 'Sunline' },
    question: {
      zh: '此刻，白昼正在从地球的哪些地方离开？',
      en: 'Where is daylight leaving Earth at this moment?',
    },
  },
};

export function isLocale(value: string | null): value is Locale {
  return value === 'zh' || value === 'en';
}
