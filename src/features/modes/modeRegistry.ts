import type { Locale } from '../../i18n/messages';
import { z } from 'zod';

export type ModeId = 'antipodes' | 'development' | 'sunline';

interface LocalizedText {
  zh: string;
  en: string;
}

export interface ModeDefinition {
  id: ModeId;
  version: 1;
  status: 'curated' | 'experimental';
  category: 'spatial' | 'human' | 'temporal';
  title: LocalizedText;
  question: LocalizedText;
  summary: LocalizedText;
  cameraPolicy: 'preserve';
  resources: readonly string[];
  stateSchema: z.ZodType;
}

export const MODE_DEFINITIONS: Record<ModeId, ModeDefinition> = {
  antipodes: {
    id: 'antipodes',
    version: 1,
    status: 'curated',
    category: 'spatial',
    title: { zh: '地球另一端', en: 'Other Side' },
    question: {
      zh: '如果从这里穿过地心，你会在哪里重新看见天空？',
      en: 'If you passed through Earth from here, where would you see the sky again?',
    },
    summary: {
      zh: '选择一个地点，沿直线穿过地心抵达它的对跖点。',
      en: 'Choose a point and pass through Earth to its antipode.',
    },
    cameraPolicy: 'preserve',
    resources: ['natural-earth-countries-110m'],
    stateSchema: z.object({
      point: z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      }),
    }),
  },
  development: {
    id: 'development',
    version: 1,
    status: 'experimental',
    category: 'human',
    title: { zh: '发展的不同侧面', en: 'Development, Unpacked' },
    question: {
      zh: '相近的发展水平，由哪些不同的结构组成？',
      en: 'What different structures can produce similar levels of development?',
    },
    summary: {
      zh: '拆开健康、教育与收入，观察相近结果背后的不同结构。',
      en: 'Unpack health, education, and income behind similar outcomes.',
    },
    cameraPolicy: 'preserve',
    resources: ['natural-earth-countries-110m'],
    stateSchema: z.object({}),
  },
  sunline: {
    id: 'sunline',
    version: 1,
    status: 'experimental',
    category: 'temporal',
    title: { zh: '日照线', en: 'Sunline' },
    question: {
      zh: '此刻，白昼正在从地球的哪些地方离开？',
      en: 'Where is daylight leaving Earth at this moment?',
    },
    summary: {
      zh: '移动时间，观察昼夜分界与太阳直射点。',
      en: 'Move through time to inspect the terminator and subsolar point.',
    },
    cameraPolicy: 'preserve',
    resources: [],
    stateSchema: z.object({}),
  },
};

export function isLocale(value: string | null): value is Locale {
  return value === 'zh' || value === 'en';
}
