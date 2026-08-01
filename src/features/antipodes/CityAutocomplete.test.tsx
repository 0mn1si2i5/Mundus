import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CityAutocomplete } from './CityAutocomplete';
import type { GeoNamesCityLoadState } from './useGeoNamesCityIndex';
import type { GeoNamesCity } from './geonamesCities';

const beijing: GeoNamesCity = {
  id: 1816670,
  name: { en: 'Beijing', zh: '北京' },
  nameZhFallback: false,
  country: { en: 'China', zh: '中国' },
  admin1: { en: 'Beijing', zh: '北京' },
  countryCode: 'CN',
  point: { latitude: 39.9075, longitude: 116.39723 },
  population: 11716620,
  featureCode: 'PPLC',
  aliases: [],
  search: {
    nameEn: 'beijing',
    nameZh: '北京',
    countryEn: 'china',
    countryZh: '中国',
    adminEn: 'beijing',
    adminZh: '北京',
    aliases: [],
  },
};

const cities: readonly GeoNamesCity[] = [
  beijing,
  {
    id: 5128581,
    name: { en: 'New York City', zh: '纽约市' },
    nameZhFallback: false,
    country: { en: 'United States', zh: '美国' },
    admin1: { en: 'New York', zh: '纽约州' },
    countryCode: 'US',
    point: { latitude: 40.71427, longitude: -74.00597 },
    population: 8804190,
    featureCode: 'PPL',
    aliases: ['紐約市'],
    search: {
      nameEn: 'new york city',
      nameZh: '纽约市',
      countryEn: 'united states',
      countryZh: '美国',
      adminEn: 'new york',
      adminZh: '纽约州',
      aliases: ['紐約市'],
    },
  },
];

const fallbackCity: GeoNamesCity = {
  ...beijing,
  id: 300,
  name: { en: 'Fallback City', zh: 'Fallback City' },
  nameZhFallback: true,
  admin1: { en: 'Fallback Region', zh: 'Fallback Region' },
  search: {
    ...beijing.search,
    nameEn: 'fallback city',
    nameZh: 'fallback city',
    adminEn: 'fallback region',
    adminZh: 'fallback region',
  },
};

const ambiguousCities: readonly GeoNamesCity[] = [
  ...cities,
  {
    ...beijing,
    id: 101,
    name: { en: 'Springfield', zh: '春田' },
    country: { en: 'Example', zh: '示例国' },
    admin1: { en: 'Central', zh: '中央州' },
    point: { latitude: 10.12345, longitude: -20.54321 },
    search: {
      ...beijing.search,
      nameEn: 'springfield',
      nameZh: '春田',
      countryEn: 'example',
      countryZh: '示例国',
      adminEn: 'central',
      adminZh: '中央州',
    },
  },
  {
    ...beijing,
    id: 102,
    name: { en: 'Springfield', zh: '春田' },
    country: { en: 'Example', zh: '示例国' },
    admin1: { en: 'Central', zh: '中央州' },
    point: { latitude: -11.23456, longitude: 21.65432 },
    search: {
      ...beijing.search,
      nameEn: 'springfield',
      nameZh: '春田',
      countryEn: 'example',
      countryZh: '示例国',
      adminEn: 'central',
      adminZh: '中央州',
    },
  },
];

afterEach(cleanup);

function ready(): GeoNamesCityLoadState {
  return { status: 'ready', data: cities };
}

describe('CityAutocomplete', () => {
  it('provides the ARIA combobox contract and selects the active option', () => {
    const onSelect = vi.fn();
    render(
      <CityAutocomplete locale="en" loadState={ready()} onSelect={onSelect} />,
    );
    const input = screen.getByRole('combobox', { name: 'Search major cities' });
    input.focus();
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    fireEvent.change(input, { target: { value: 'Be' } });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      'city-option-1816670',
    );
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(cities[0]);
    expect(input).toHaveFocus();
  });

  it('supports Chinese and traditional source aliases', () => {
    render(
      <CityAutocomplete locale="zh" loadState={ready()} onSelect={vi.fn()} />,
    );
    const input = screen.getByRole('combobox', { name: '搜索全球主要城市' });
    fireEvent.change(input, { target: { value: '纽约' } });
    expect(screen.getByRole('option', { name: /纽约市/ })).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '紐約' } });
    expect(screen.getByRole('option', { name: /纽约市/ })).toBeInTheDocument();
  });

  it('marks only canonical Chinese fallbacks visibly and accessibly in Chinese', () => {
    const { rerender } = render(
      <CityAutocomplete
        locale="zh"
        loadState={{ status: 'ready', data: [...cities, fallbackCity] }}
        onSelect={vi.fn()}
      />,
    );
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Fallback' } });
    const fallback = screen.getByRole('option');
    expect(fallback).toHaveTextContent('GeoNames 原名（暂无中文名）');
    expect(fallback).toHaveAccessibleName(
      'Fallback City；Fallback Region；中国；GeoNames 原名（暂无中文名）',
    );

    fireEvent.change(input, { target: { value: '北京' } });
    expect(screen.getByRole('option')).not.toHaveTextContent('暂无中文名');

    rerender(
      <CityAutocomplete
        locale="en"
        loadState={{ status: 'ready', data: [...cities, fallbackCity] }}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Fallback' },
    });
    expect(screen.getByRole('option')).not.toHaveTextContent('暂无中文名');
    expect(screen.getByRole('option')).toHaveAccessibleName(
      'Fallback City; Fallback Region; China',
    );
  });

  it.each([
    [
      'en',
      'Spring',
      'Springfield; Central; Example; latitude +10.12345° N; longitude -20.54321° W',
    ],
    [
      'zh',
      '春田',
      '春田；中央州；示例国；纬度 +10.12345° 北；经度 -20.54321° 西；英文名 Springfield',
    ],
  ] as const)(
    'disambiguates duplicate visible localized tuples in %s without changing selection',
    (locale, query, firstAccessibleName) => {
      const onSelect = vi.fn();
      render(
        <CityAutocomplete
          locale={locale}
          loadState={{ status: 'ready', data: ambiguousCities }}
          onSelect={onSelect}
        />,
      );
      const input = screen.getByRole('combobox');
      fireEvent.change(input, { target: { value: query } });
      const options = screen.getAllByRole('option');

      expect(options).toHaveLength(2);
      expect(options[0]!).toHaveAccessibleName(firstAccessibleName);
      expect(options[1]!).toHaveAccessibleName(
        locale === 'en'
          ? 'Springfield; Central; Example; latitude -11.23456° S; longitude +21.65432° E'
          : '春田；中央州；示例国；纬度 -11.23456° 南；经度 +21.65432° 东；英文名 Springfield',
      );
      expect(options[0]!).not.toHaveAccessibleName(
        options[1]!.textContent ?? '',
      );

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onSelect).toHaveBeenCalledWith(ambiguousCities[2]!);
    },
  );

  it('leaves an unambiguous option label unchanged and pointer-selects its city', () => {
    const onSelect = vi.fn();
    render(
      <CityAutocomplete
        locale="en"
        loadState={{ status: 'ready', data: ambiguousCities }}
        onSelect={onSelect}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Be' },
    });
    const option = screen.getByRole('option', {
      name: 'Beijing; Beijing; China',
    });
    expect(option).not.toHaveTextContent('°');
    fireEvent.mouseDown(option, { button: 0 });
    expect(onSelect).toHaveBeenCalledWith(cities[0]);
  });

  it('closes on Escape and Tab without selection', () => {
    const onSelect = vi.fn();
    render(
      <CityAutocomplete locale="en" loadState={ready()} onSelect={onSelect} />,
    );
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Be' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveValue('Be');
    fireEvent.change(input, { target: { value: 'Be' } });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('announces loading, no results, and retryable errors', () => {
    const retry = vi.fn();
    const { rerender } = render(
      <CityAutocomplete
        locale="en"
        loadState={{ status: 'loading', data: null }}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading major cities',
    );
    rerender(
      <CityAutocomplete locale="en" loadState={ready()} onSelect={vi.fn()} />,
    );
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'zzzzzz' },
    });
    expect(screen.getByRole('status')).toHaveTextContent('No matching cities');
    rerender(
      <CityAutocomplete
        locale="en"
        loadState={{ status: 'error', data: null, retry }}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'City index is unavailable',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry city index' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('selects by pointer while focus remains managed by the input', () => {
    const onSelect = vi.fn();
    render(
      <CityAutocomplete locale="en" loadState={ready()} onSelect={onSelect} />,
    );
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Be' } });
    fireEvent.mouseDown(screen.getByRole('option'), { button: 0 });
    expect(onSelect).toHaveBeenCalledWith(cities[0]);
  });

  it('closes when focus leaves the composite and for an outside pointer', () => {
    render(
      <div>
        <CityAutocomplete locale="en" loadState={ready()} onSelect={vi.fn()} />
        <button type="button">Outside</button>
      </div>,
    );
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Be' } });
    fireEvent.blur(input, {
      relatedTarget: screen.getByRole('button', { name: 'Outside' }),
    });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Be' } });
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not close before an option mousedown selection', () => {
    const onSelect = vi.fn();
    render(
      <CityAutocomplete locale="en" loadState={ready()} onSelect={onSelect} />,
    );
    const input = screen.getByRole('combobox');
    input.focus();
    fireEvent.change(input, { target: { value: 'Be' } });
    const option = screen.getByRole('option');
    fireEvent.blur(input, { relatedTarget: option });
    fireEvent.mouseDown(option, { button: 0 });
    expect(onSelect).toHaveBeenCalledWith(cities[0]);
  });
});
