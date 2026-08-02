import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SunlineControls } from './SunlineControls';

describe('SunlineControls copy', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  it.each([
    {
      locale: 'zh' as const,
      method: '“曙暮光”表示太阳高度低于 0° 至 -6°（含 -6°）的民用曙暮光范围。',
    },
    {
      locale: 'en' as const,
      method:
        '“Twilight” denotes the civil-twilight range from below 0° through -6° (inclusive).',
    },
  ])('shows the Twilight definition in $locale', ({ locale, method }) => {
    render(<SunlineControls locale={locale} />);

    fireEvent.click(
      screen.getByText(locale === 'zh' ? '计算说明' : 'Calculation note'),
    );

    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'P' &&
          element.textContent?.includes(method) === true,
      ),
    ).toBeVisible();
  });
});
