import { useMemo, useRef, useState } from 'react';
import type { Locale } from '../../i18n/messages';
import { useAppStore } from '../../state/appStore';
import type { CountryRef } from '../globe/countryData';
import {
  DEVELOPMENT_INDICATORS,
  developmentColor,
  valueFor,
  type DevelopmentCountry,
  type DevelopmentIndicator,
} from './developmentData';
import type { DevelopmentLoadState } from './useDevelopmentDataset';
import styles from './DevelopmentControls.module.css';

const COPY = {
  zh: {
    title: '拆解发展结构',
    loading: '正在载入 UNDP HDR 2025…',
    error: '发展数据暂时无法载入。',
    year: '年份',
    selected: '所选国家',
    choose: '点击地球选择国家',
    missing: '该年没有数据',
    noPolygon: '该国家未收录于 110m 地球多边形',
    legend: '指数值',
    noData: '缺失',
    table: '表格视图',
    closeTable: '关闭表格',
    country: '国家或地区',
    value: '指数',
    method: '数据与方法',
    methodText:
      'HDI 为 UNDP 报告值；健康、教育和收入按 HDR 2025 技术说明从组成字段派生。缺失值不会转为零。',
    source: 'UNDP HDR 2025 来源页',
    scope: '195 个国家和地区 · 1990–2023',
    expand: '展开发展控件',
    collapse: '收起发展控件',
    indicators: {
      hdi: '综合 HDI',
      health: '健康',
      education: '教育',
      income: '收入',
    },
  },
  en: {
    title: 'Unpack development',
    loading: 'Loading UNDP HDR 2025…',
    error: 'Development data is unavailable.',
    year: 'Year',
    selected: 'Selected country',
    choose: 'Click the globe to select a country',
    missing: 'No observation for this year',
    noPolygon: 'This country is absent from the 110m globe polygons',
    legend: 'Index value',
    noData: 'Missing',
    table: 'Table view',
    closeTable: 'Close table',
    country: 'Country or territory',
    value: 'Index',
    method: 'Data and method',
    methodText:
      'HDI is reported by UNDP. Health, education and income are derived from component fields using HDR 2025 Technical Note 1. Missing values never become zero.',
    source: 'UNDP HDR 2025 source',
    scope: '195 countries and territories · 1990–2023',
    expand: 'Expand development controls',
    collapse: 'Collapse development controls',
    indicators: {
      hdi: 'Overall HDI',
      health: 'Health',
      education: 'Education',
      income: 'Income',
    },
  },
} as const;

const LEGEND_VALUES = [0.3, 0.475, 0.625, 0.75, 0.85, 0.95] as const;

export function DevelopmentControls({
  locale,
  loadState,
  selectedCountry,
}: {
  locale: Locale;
  loadState: DevelopmentLoadState;
  selectedCountry: CountryRef | null;
}) {
  const indicator = useAppStore((state) => state.developmentIndicator);
  const year = useAppStore((state) => state.developmentYear);
  const selectIndicator = useAppStore(
    (state) => state.selectDevelopmentIndicator,
  );
  const selectYear = useAppStore((state) => state.selectDevelopmentYear);
  const [expanded, setExpanded] = useState(() => window.innerWidth > 760);
  const [tableOpen, setTableOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const copy = COPY[locale];
  const country = selectedCountry
    ? (loadState.data?.countriesById.get(selectedCountry.countryId) ?? null)
    : null;
  const selectedValue = country ? valueFor(country, indicator, year) : null;

  function collapse() {
    setExpanded(false);
    setTableOpen(false);
    window.requestAnimationFrame(() => toggle.current?.focus());
  }

  return (
    <>
      <section
        className={styles.panel}
        data-expanded={expanded}
        aria-labelledby="development-controls-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && window.innerWidth <= 760) {
            event.preventDefault();
            collapse();
          }
        }}
      >
        <div className={styles.heading}>
          <div>
            <h2 id="development-controls-title">{copy.title}</h2>
            <p>{copy.scope}</p>
          </div>
          <button
            ref={toggle}
            className={styles.toggle}
            type="button"
            aria-expanded={expanded}
            aria-controls="development-controls-body"
            aria-label={expanded ? copy.collapse : copy.expand}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? '–' : '+'}
          </button>
        </div>

        {expanded ? (
          <div id="development-controls-body" className={styles.body}>
            {loadState.status === 'loading' ? (
              <p className={styles.status} role="status">
                {copy.loading}
              </p>
            ) : null}
            {loadState.status === 'error' ? (
              <p className={styles.status} role="alert">
                {copy.error}
              </p>
            ) : null}
            {loadState.status === 'ready' ? (
              <>
                <div className={styles.indicators} aria-label={copy.title}>
                  {DEVELOPMENT_INDICATORS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      data-active={item === indicator}
                      aria-pressed={item === indicator}
                      onClick={() => selectIndicator(item)}
                    >
                      {copy.indicators[item]}
                    </button>
                  ))}
                </div>

                <label className={styles.timeline}>
                  <span>{copy.year}</span>
                  <strong>{year}</strong>
                  <input
                    type="range"
                    min="1990"
                    max="2023"
                    step="1"
                    value={year}
                    onChange={(event) => selectYear(Number(event.target.value))}
                  />
                </label>

                <div className={styles.selection} aria-live="polite">
                  <span>{copy.selected}</span>
                  <strong>{selectedCountry?.name ?? copy.choose}</strong>
                  {selectedCountry ? (
                    <em>
                      {country
                        ? (selectedValue?.toFixed(3) ?? copy.missing)
                        : copy.noPolygon}
                    </em>
                  ) : null}
                </div>

                <div className={styles.legend} aria-label={copy.legend}>
                  <span>{copy.legend}</span>
                  <div>
                    {LEGEND_VALUES.map((value) => (
                      <i
                        key={value}
                        style={{ backgroundColor: developmentColor(value) }}
                      />
                    ))}
                  </div>
                  <small>
                    0 <b>{copy.noData}</b> 1
                  </small>
                </div>

                <div className={styles.footerActions}>
                  <button
                    type="button"
                    aria-expanded={tableOpen}
                    onClick={() => setTableOpen((current) => !current)}
                  >
                    {tableOpen ? copy.closeTable : copy.table}
                  </button>
                  <details>
                    <summary>{copy.method}</summary>
                    <p>{copy.methodText}</p>
                    <a
                      href="https://hdr.undp.org/data-center/documentation-and-downloads"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {copy.source} ↗
                    </a>
                  </details>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </section>

      {tableOpen && loadState.status === 'ready' ? (
        <DevelopmentTable
          locale={locale}
          countries={loadState.data.countries}
          indicator={indicator}
          year={year}
          selectedCountryId={selectedCountry?.countryId ?? null}
          onClose={() => setTableOpen(false)}
        />
      ) : null}
    </>
  );
}

function DevelopmentTable({
  locale,
  countries,
  indicator,
  year,
  selectedCountryId,
  onClose,
}: {
  locale: Locale;
  countries: readonly DevelopmentCountry[];
  indicator: DevelopmentIndicator;
  year: number;
  selectedCountryId: string | null;
  onClose: () => void;
}) {
  const copy = COPY[locale];
  const rows = useMemo(
    () =>
      countries
        .map((country) => ({
          country,
          value: valueFor(country, indicator, year),
        }))
        .sort(
          (a, b) =>
            (b.value ?? -1) - (a.value ?? -1) ||
            a.country.name.localeCompare(b.country.name),
        ),
    [countries, indicator, year],
  );

  return (
    <aside
      className={styles.tablePanel}
      aria-labelledby="development-table-title"
    >
      <div className={styles.tableHeading}>
        <div>
          <span id="development-table-title">{copy.table}</span>
          <strong>
            {copy.indicators[indicator]} · {year}
          </strong>
        </div>
        <button type="button" onClick={onClose} aria-label={copy.closeTable}>
          ×
        </button>
      </div>
      <div className={styles.tableScroll}>
        <table>
          <thead>
            <tr>
              <th>{copy.country}</th>
              <th>{copy.value}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ country, value }) => (
              <tr
                key={country.iso3}
                data-selected={country.countryId === selectedCountryId}
              >
                <td>{country.name}</td>
                <td>{value?.toFixed(3) ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </aside>
  );
}
