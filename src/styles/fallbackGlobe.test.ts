import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');
const globalCss = readSource('src/styles/global.css');
const appCss = readSource('src/app/App.module.css');
const viewportCss = readSource('src/features/globe/GlobeViewport.module.css');

describe('fallback globe style contract', () => {
  it('defines shared matte globe paint and consumes it in both fallback paths', () => {
    expect(globalCss).toContain('--fallback-globe-background:');
    expect(globalCss).toContain('--fallback-globe-shadow:');
    expect(appCss).toContain('background: var(--fallback-globe-background)');
    expect(appCss).toContain('box-shadow: var(--fallback-globe-shadow)');
    expect(viewportCss).toContain(
      'background: var(--fallback-globe-background)',
    );
    expect(viewportCss).toContain('box-shadow: var(--fallback-globe-shadow)');
  });
});
